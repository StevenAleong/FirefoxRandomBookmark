function init() {
    loadUserSettings();
    loadContextMenus();
	loadBrowserActionGroups();

    // Watch for when the user clicks on the browser action
    browser.browserAction.onClicked.addListener(handleBrowserClickAction);

    // Watch for when the storage/settings are changed
    browser.storage.onChanged.addListener(handleStorageChangeAction);

    // Watch for when the user clicks on the context menu
    browser.menus.onClicked.addListener(handleMenuClickAction);
	
    // Watch when user changes their bookmarks.
    browser.bookmarks.onCreated.addListener(handleBookmarksChangeAction);
    browser.bookmarks.onChanged.addListener(handleBookmarksChangeAction);
    browser.bookmarks.onMoved.addListener(handleBookmarksChangeAction);
    browser.bookmarks.onRemoved.addListener(handleBookmarksChangeAction);
};

function showNotification(title, msg) {
    browser.notifications.create('random-bookmark-loading-notification', {
        "type": "basic",
        "title": title,
        "message": msg
    });
}

function handleBrowserClickAction(tabInfo) {	
	// var allStorage = browser.storage.local.get(null);
	// allStorage.then((all) => {
		// console.log(all);
	// });

    if (pluginSettings.loadingBookmarks || pluginSettings.loadingGroups) {
        showNotification("Loading Your Bookmarks", "Sorry, please wait a moment while your bookmarks are preloaded. If this pop up keeps showing up after a minute, please go to the options page and scroll to the bottom and clear out all add-on data, and then reinstall the plugin. Sorry.");

		if (sessionInfo.loadingDateTimeStarted !== null) {
			var currentDate = new Date();
			var seconds = (currentDate.getTime() - sessionInfo.loadingDateTimeStarted) / 1000;
			if (seconds >= 30) {
				// Try reloading bookmarks again
				preloadBookmarksIntoLocalStorage();
			}
		}

    } else {
		var currentGroupGet = browser.storage.local.get(pluginSettings.selectedGroup);

        currentGroupGet.then((resBookmarks) => {
			// resBookmarks is the array of bookmarks for the groups
			if (resBookmarks[pluginSettings.selectedGroup].length === 0) {
				showNotification("No bookmarks found", "Start adding bookmarks first or check the addon settings");
				
			} else {		
					
				if (pluginSettings.randomOption === 'bybookmark') {
					var groupIndex = 0;
					var groupIndexName = pluginSettings.selectedGroup + '_index';
					var currentGroupIndexGet = browser.storage.local.get(groupIndexName);
					currentGroupIndexGet.then((resIndex) => {						
						if (Number.isInteger(resIndex[groupIndexName])) {
							groupIndex = resIndex[groupIndexName];							
						}
						
						if (groupIndex >= resBookmarks[pluginSettings.selectedGroup].length) {
							groupIndex = 0;
						}

						// Get the bookmark
						var urlToOpen = resBookmarks[pluginSettings.selectedGroup][groupIndex];
						
						// Open it
						openBookmarks([ urlToOpen ], false, tabInfo);
						
						// Set the index for when the user presses the button again
						groupIndex = groupIndex + 1;						
						browser.storage.local.set({
							[groupIndexName]: groupIndex
						});
					});
					
				} else {
					// Get a random index
					var r = new Random();
					var randomIndex = r.Next(0, resBookmarks[pluginSettings.selectedGroup].length - 1);

					var toOpen = resBookmarks[pluginSettings.selectedGroup][randomIndex];
					openBookmarks([ toOpen ], false, tabInfo);
					
				}

			}			
        });
    }    
};

function handleMenuClickAction(info, tab) {
	if (tab === undefined) {
		// Context click
		var bookmarksToOpen = 1;
		if (info.menuItemId.startsWith('open-random')) {
			bookmarksToOpen = parseInt(info.menuItemId.replace('open-random-', ''), 10);
		}
				
		var getBookmarkInfo = browser.bookmarks.get(info.bookmarkId);
		getBookmarkInfo.then(function(bookmarkInfo) {
			var folderID = '';
			
			if (bookmarkInfo[0].type === 'folder') {
				folderID = bookmarkInfo[0].id;
				
			} else if (bookmarkInfo[0].type === 'bookmark') {
				folderID = bookmarkInfo[0].parentId;
				
			}
			
			var gettingChildren = browser.bookmarks.getChildren(folderID);
			gettingChildren.then(function(children) {
				var folderBookmarks = [];
				
				for(child of children) {
					if (child.type === 'bookmark') {
						folderBookmarks.push(child.url);
					}						
				}
				
				Shuffle(folderBookmarks);
				
				var toOpen = folderBookmarks.slice(0, bookmarksToOpen);
				openBookmarks(toOpen, true);
			});
		});			
		
	} else {
		// Browser Action group change
		if (info.menuItemId.toString() === 'options-page') {
			var openingPage = browser.runtime.openOptionsPage();

		} else if (pluginSettings.loadingBookmarks) {
			// Reload the context menus because I don't know how else to reselect the previous selected menu
			loadBrowserActionGroups();

			showNotification("Loading Your Bookmarks", "Sorry, please wait a moment while your bookmarks are preloaded.");

		} else {
			pluginSettings.selectedGroup = info.menuItemId.toString();
			browser.storage.local.set({
				activeGroup: info.menuItemId
			});

			// Check/preload the currently selected menu
			preloadBookmarksIntoLocalStorage();
		}
        
    }
};

function handleStorageChangeAction(changes, area) {
    if (area === 'sync') {
		if (changes.showContextMenu || changes.showContextOpenCountMenu) {
			loadContextMenus();			
		}
		
        if (changes.groups) {
            loadBrowserActionGroups();
        } 
		
		loadUserSettings();
    }
};

function handleBookmarksChangeAction() {
	// Bookmarks was changed (edited/added/deleted)
    // Set all bookmark groups to reload
    var userSyncOptions = browser.storage.sync.get();
    userSyncOptions.then((syncRes) => {
        if (syncRes.groups) {
            var bookmarkGroups = syncRes.groups;

            for(var i = 0; i < bookmarkGroups.length; i++) {
				// Force reload of bookmarks in storage
                bookmarkGroups[i].reload = true;
				
				// Reset the selected group index back to zero
				var groupIndexName = bookmarkGroups[i].id + '_index';
				browser.storage.local.set({
					[groupIndexName]: 0
				});
            }
			
            browser.storage.sync.set({
                groups: bookmarkGroups
            });
			
            preloadBookmarksIntoLocalStorage();
        }
    });
};

async function openBookmarks(bookmarksArray, forceNewTab, tabInfo) {
	if (forceNewTab == null) {
		forceNewTab = false;
	}
		
	for(var i = 0; i < bookmarksArray.length; i++) {
		if (forceNewTab) {			
			browser.tabs.create({ 
				active: i == 0,
				url: bookmarksArray[i]
			});
			
		} else {
			if (pluginSettings.tabOption === 'newTab') {
				browser.tabs.create({ 
					active: pluginSettings.tabSetActive,
					url: bookmarksArray[0]
				});
				
			} else if (pluginSettings.tabOption === 'currentTab' && tabInfo != null) {
				browser.tabs.update(
					tabInfo.id,
					{
						active: pluginSettings.tabSetActive,
						highlighted: pluginSettings.tabSetActive,
						url: bookmarksArray[0]
					}
				);				
				
			} else {				
				if (sessionInfo.currentTabId === 0) {
					var newTabInfo = browser.tabs.create({
						active: pluginSettings.tabSetActive,
						url: bookmarksArray[0]
					});

					newTabInfo.then((resNewTab) => {
						sessionInfo.currentTabId = resNewTab.id;
					});

				} else {
					try {
						var getTab = await browser.tabs.get(sessionInfo.currentTabId);
						
						browser.tabs.update(
							getTab.id,
							{
								active: pluginSettings.tabSetActive,
								highlighted: pluginSettings.tabSetActive,
								url: bookmarksArray[0]
							}
						);
						
						if (pluginSettings.tabSetActive) {
							browser.windows.update(getTab.windowId, {
								focused: true
							});
						}
						

					} catch (error) {
						var newTabInfo = browser.tabs.create({
							active: pluginSettings.tabSetActive,
							url: bookmarksArray[0]
						});
	
						newTabInfo.then((resNewTab) => {
							sessionInfo.currentTabId = resNewTab.id;
						});
					}
				}				
			}			
		}
	}
}

init();

/*
	Runs when the user installs the add-on
*/
browser.runtime.onInstalled.addListener(async({ reason, temporary }) => {
    if (temporary) {

    }

    switch (reason) {
        case 'install':
            //browser.runtime.openOptionsPage();
			//const installUrl = browser.runtime.getURL('options.html');
			//await browser.tabs.create({ installUrl });
			
            break;
			
		case 'update':
			browser.runtime.openOptionsPage();
			//const updateUrl = browser.runtime.getURL('options.html');
			//await browser.tabs.create({ updateUrl });
			
			break;
    }

});