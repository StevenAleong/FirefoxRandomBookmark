function init() {
	logToDebugConsole('init');

    loadUserSettings();
    loadContextMenus();

	// Delay preloading of bookmarks a bit more
	setTimeout(loadBrowserActionGroups, 5000);

    // Watch for when the user clicks on the browser action
    browser.browserAction.onClicked.addListener(handleBrowserClickAction);

    // Watch for when the storage/settings are changed
    browser.storage.onChanged.addListener(handleStorageChangeAction);

    // Watch for when the user clicks on the context menu
    browser.menus.onClicked.addListener(handleMenuClickAction);
	
    // Watch when user changes their bookmarks.
    browser.bookmarks.onCreated.addListener(handleBookmarksCreatedAction);
    browser.bookmarks.onChanged.addListener(handleBookmarksChangedAction);
    browser.bookmarks.onMoved.addListener(handleBookmarksMovedAction);
    browser.bookmarks.onRemoved.addListener(handleBookmarksRemovedAction);

	if (localStorage.getItem('randomized-history') !== null) {
		localStorage.removeItem('randomized-history');
	}
}

function showNotification(title, msg) {
	logToDebugConsole('showNotification');

    browser.notifications.create('random-bookmark-loading-notification', {
        type: 'basic',
		iconUrl: browser.runtime.getURL('icons/icon-96.png'),
        title: title,
        message: msg
    });
}

function handleBrowserClickAction(tabInfo) {
	logToDebugConsole('handleBrowserClickAction');

    if (pluginSettings.initialLoading || pluginSettings.loadingBookmarks || pluginSettings.loadingGroups) {
        showNotification("Loading Your Bookmarks", "Sorry, please wait a moment while your bookmarks are preloaded. If this pop up keeps showing up after a minute, please go to the options page and scroll to the bottom and clear out all add-on data, and then reinstall the plugin. Sorry.");

		if (sessionInfo.loadingDateTimeStarted !== null) {
			var currentDate = new Date();
			var seconds = (currentDate.getTime() - sessionInfo.loadingDateTimeStarted) / 1000;
			if (seconds >= 30) {
				// Try reloading bookmarks again
				preloadBookmarksIntoLocalStorage('handleBrowserClickAction');
			}
		}

    } else {
		logToDebugConsole('pluginSettings.selectedGroup', pluginSettings.selectedGroup);

		var currentGroupGet = browser.storage.local.get(pluginSettings.selectedGroup);

        currentGroupGet.then((resBookmarks) => {
			// resBookmarks is the array of bookmarks for the groups
			if (resBookmarks[pluginSettings.selectedGroup].length === 0) {
				showNotification("No bookmarks found", "Start adding bookmarks first or check the add-on settings");
				
			} else {		
					
				if (pluginSettings.randomOption === 'bybookmark' || pluginSettings.randomOption === 'alphabetical') {
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
						var bookmarkId = resBookmarks[pluginSettings.selectedGroup][groupIndex];
						
						// Open it
						browser.bookmarks
							.get(bookmarkId)
							.then((result) => {
								openBookmarks(result, false, tabInfo);
							});
						
						// Show notice
						if (pluginSettings.showActionNotice === true) {
							showNotification('Information', 'Showing bookmark ' + (groupIndex + 1) + '/' + resBookmarks[pluginSettings.selectedGroup].length);
						}
						
						// Set the index for when the user presses the button again
						groupIndex = groupIndex + 1;						
						browser.storage.local.set({
							[groupIndexName]: groupIndex
						});
					});
					
				} else {
					// Get a random index
					var randomIndex = 0;

					if (resBookmarks[pluginSettings.selectedGroup].length > 1) {
						var r = new Random();
						randomIndex = r.Next(0, resBookmarks[pluginSettings.selectedGroup].length - 1);
					}

					var bookmarkId = resBookmarks[pluginSettings.selectedGroup][randomIndex];
					browser.bookmarks
						.get(bookmarkId)
						.then((result) => {
							openBookmarks(result, false, tabInfo);
						});
											
				}

			}			
        });
    }    
}

function handleMenuClickAction(info, tab) {
	logToDebugConsole('handleMenuClickAction', info, tab);

	if (info.menuItemId.toString() === 'options-page') {
		// Load up the options
		logToDebugConsole('Open the options page');
		browser.runtime.openOptionsPage();

	} else if (info.menuItemId.toString() === 'plugin-page') {
		// Go to the mozilla browser plugin page
		logToDebugConsole('Open plugin page');
		browser.tabs.create({
			url: 'https://addons.mozilla.org/en-US/firefox/addon/random-bookmark-addon/',
			active: true
		});

	} else if (info.menuItemId.toString() === 'last-bookmark-path') {
		// user clicked on last bookmark path, dont do anything currently. Maybe open the url again?

	} else if (tab === undefined) {
		// Context click, the user wants to load up a random bookmark from a folder
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
						folderBookmarks.push(child.id);
					}						
				}

				if (folderBookmarks.length > 0) {
					Shuffle(folderBookmarks);
				
					var toOpen = folderBookmarks.slice(0, bookmarksToOpen);
	
					logToDebugConsole('toOpen', toOpen);
	
					browser.bookmarks
						.get(toOpen)
						.then((result) => {
							openBookmarks(result, true);
						});
				} else {
					showNotification("Random Bookmark Alert", "No bookmarks found in this folder, this does not look in child folders, only the current folder.");
				}

			});
		});			
		
	} else if (pluginSettings.loadingBookmarks) {
		// Reload the context menus because I don't know how else to reselect the previous selected menu
		loadBrowserActionGroups();

		showNotification("Loading Your Bookmarks", "Sorry, please wait a moment while your bookmarks are preloaded.");

	} else {
		if (pluginSettings.selectedGroup !== info.menuItemId.toString()) {
			preloadBookmarksIntoLocalStorage('handleMenuClickAction');
		}		

		// User changed the selected category
		pluginSettings.selectedGroup = info.menuItemId.toString();	
		browser.storage.local.set({
			activeGroup: info.menuItemId
		});
		
		
	}
}

function handleStorageChangeAction(changes, area) {
	logToDebugConsole('handleStorageChangeAction', { 'changes': changes, 'area': area });
    if (area === 'sync') {
		if (changes.showContextMenu || changes.showContextOpenCountMenu) {
			loadContextMenus();			
		}
		
        if (changes.groups) {
            loadBrowserActionGroups();
        } 
		
		loadUserSettings();
    }
}

function handleBookmarksCreatedAction() {
	logToDebugConsole('handleBookmarksCreatedAction');
	handleTheBookmarks('handleBookmarksCreatedAction');
}

function handleBookmarksMovedAction() {
	logToDebugConsole('handleBookmarksMovedAction');
	handleTheBookmarks('handleBookmarksMovedAction');
}

function handleBookmarksRemovedAction() {
	logToDebugConsole('handleBookmarksRemovedAction');
	handleTheBookmarks('handleBookmarksRemovedAction');
}

function handleBookmarksChangedAction(id, changeInfo) {
	logToDebugConsole('handleBookmarksChangedAction', { 'id': id, 'changeInfo': changeInfo });
	handleTheBookmarks('handleBookmarksChangedAction');	
}

function handleTheBookmarks(source) {
	logToDebugConsole('handleTheBookmarks', { 'source': source });

	// Bookmarks was changed (edited/added/deleted)
    // Set all bookmark groups to reload
    var userSyncOptions = browser.storage.sync.get();
    userSyncOptions.then((syncRes) => {
		logToDebugConsole('handleTheBookmarks', { 'syncRes': syncRes });
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
			
            preloadBookmarksIntoLocalStorage('handleTheBookmarks');
        }
    });
}

/**
 * The main function to handle the opening of a bookmark.
 * Used by when the user clicks on the context menu or the browser action button
 * 
 * @param array bookmarks 
 * @param boolean forceNewTab 
 * @param object tabInfo 
 */
function openBookmarks(bookmarks, forceNewTab, tabInfo) {
	logToDebugConsole('openBookmarks');

	if (forceNewTab == null) {
		forceNewTab = false;
	}

	logToDebugConsole(bookmarks);

	bookmarks.forEach((bookmark, index) => {
		logToDebugConsole('bookmark', bookmark);

		processHistory(bookmark);

		if (forceNewTab) {			
			// Context clicked to open random bookmarks from a folder
			browser.tabs.create({ 
				active: index == 0,
				url: bookmark.url
			});

		} else {
			if (pluginSettings.tabOption === 'newTab') {
				browser.tabs.create({ 
					active: pluginSettings.tabSetActive,
					url: bookmark.url
				});
				
			} else if (pluginSettings.tabOption === 'currentTab' && tabInfo != null) {
				browser.tabs.update(
					tabInfo.id,
					{
						active: pluginSettings.tabSetActive,
						highlighted: pluginSettings.tabSetActive,
						url: bookmark.url
					}
				);				
				
			} else {				
				if (sessionInfo.currentTabId === 0) {
					var newTabInfo = browser.tabs.create({
						active: pluginSettings.tabSetActive,
						url: bookmark.url
					});

					newTabInfo.then((resNewTab) => {
						sessionInfo.currentTabId = resNewTab.id;
					});

				} else {
					// Check for the newly created tab and then keep using it
					// if it doesn't exist, create a new one and use that one.
					browser.tabs.get(sessionInfo.currentTabId)
						.then((tab) => {
							logToDebugConsole('tab', tab);

							browser.tabs.update(
								tab.id,
								{
									active: pluginSettings.tabSetActive,
									highlighted: pluginSettings.tabSetActive,
									url: bookmark.url,
								}
							);

							if (pluginSettings.tabSetActive) {
								browser.windows.update(
									tab.windowId, {
									focused: true
								});
							}

							sessionInfo.currentTabId = tab.id;
						},
						(failed) => {
							logToDebugConsole('failed', failed);

							var newTabInfo = browser.tabs.create({
								active: pluginSettings.tabSetActive,
								url: bookmark.url
							});
	
							newTabInfo.then((resNewTab) => {
								sessionInfo.currentTabId = resNewTab.id;
							});
						});
				}				
			}		
		}
	});

}

async function processHistory(bookmark) {
	const path = await getBookmarkPath(bookmark.id);
	
	// Update the menu with the path of the last randomized bookmark
	browser.menus.update(
		'last-bookmark-path',
		{
			title: path,
			visible: true
		}
	);

	// If enabled, save to local storage
	if (pluginSettings.randomizeHistory) {
		logToDebugConsole('Save history');
		const storageCollection = await browser.storage.local.get('randomized-history');
        const historyCollection = storageCollection.hasOwnProperty('randomized-history') ? JSON.parse(storageCollection['randomized-history']) : [];

		historyCollection.unshift({
			bookmark,
			dateRandomized: new Date().toISOString()
		});

		if (historyCollection.length > pluginSettings.maxHistory) {
			historyCollection.pop();
		}

		logToDebugConsole('historyCollection', historyCollection);

		browser.storage.local.set({
			'randomized-history': JSON.stringify(historyCollection)
		});
	}
}

init();

/*
	Runs when the user installs the add-on
*/
browser.runtime.onInstalled.addListener(async({ reason, temporary }) => {
    if (temporary) {
		console.log('-------------------------------------------------------------------------------------------');
		console.log('DEBUGGING RANDOM BOOKMARK');
		console.log('-------------------------------------------------------------------------------------------');
		pluginSettings.isDebugging = true;
    }

    switch (reason) {
        case 'install':
            browser.runtime.openOptionsPage();
            break;
			
		case 'update':
			// We've updated how we're updating the bookmarks, just force restore of localstorage.
			handleTheBookmarks('pluginupdated');
			//browser.runtime.openOptionsPage();
			break;
    }

});