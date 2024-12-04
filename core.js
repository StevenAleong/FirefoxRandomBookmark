var pluginSettings = {
    randomOption: 'default',
    tabOption: 'default',
    tabSetActive: true,
    randomizeHistory: false,
    maxHistory: 10,
    showContextMenu: false,
	showContextOpenCountMenu: false,
    contextMenuName: 'randombookmarkContext',
    loadingGroups: false,
    loadingBookmarks: false,
    initialLoading: true,
    selectedGroup: 'default',
    browserAction: [],
    isDebugging: false,
    showActionNotice: false
};

var sessionInfo = {
    currentTabId: 0,
    loadingDateTimeStarted: null
};

function loadUserSettings() {
    logToDebugConsole('loadUserSettings');

    var userOptions = browser.storage.sync.get();
    userOptions.then((resSync) => {
		var randomOpt = 'default';
		if (resSync.randomOption === 'bybookmark') {
			randomOpt = 'bybookmark';
		} else if (resSync.randomOption === 'alphabetical') {
			randomOpt = 'alphabetical';
		}
		
        pluginSettings.randomOption = randomOpt;
        pluginSettings.tabSetActive = typeof resSync.setActive !== 'undefined' ? resSync.setActive : true;
        pluginSettings.randomizeHistory = typeof resSync.randomizeHistory !== 'undefined' ? resSync.randomizeHistory : false;
        pluginSettings.showContextMenu = typeof resSync.showContextMenu !== 'undefined' ? resSync.showContextMenu : false;  
        pluginSettings.showContextOpenCountMenu = typeof resSync.showContextOpenCountMenu !== 'undefined' ? resSync.showContextOpenCountMenu : false;  
        pluginSettings.showActionNotice = typeof resSync.showActionNotice !== 'undefined' ? resSync.showActionNotice : false; 

        if (resSync.tabOption === 'newTab' || resSync.tabOption === 'currentTab') {
            pluginSettings.tabOption = resSync.tabOption;
        } else {
            pluginSettings.tabOption = 'default';
        }
        
        if (resSync.selectedFolders) {
            // Updating from an older install version
            changeToGroups(resSync.selectedFolders);

        } else if (typeof resSync.groups === 'undefined') {
            // New install, set the default group to everything
            changeToGroups([]);

        }

    });
};

function changeToGroups(selectedFolders) {
    logToDebugConsole('changeToGroups');

    var defaultBookmarks = [{
        name: 'Default',
        id: 'default',
        selected: selectedFolders,
        reload: true,
		index: 0
    }];

    browser.storage.sync.set({
        groups: defaultBookmarks
    });

    browser.storage.sync.remove('selectedFolders');
    browser.storage.sync.remove('reloadBookmarks'); 

    return defaultBookmarks;
};

function loadContextMenus() {
    logToDebugConsole('loadContextMenus');

    var userLocalStorage = browser.storage.local.get();
    userLocalStorage.then((res) => {
		removeContextOption(pluginSettings.contextMenuName);

		if (pluginSettings.showContextMenu) {
			browser.menus.create({
				id: pluginSettings.contextMenuName,
				title: 'Load Random Bookmark',
				contexts: ['bookmark']
			});
		}
		
		for(var i = 2; i <= 10; i++) {
			removeContextOption('open-random-' + i);	
		}
		
		if (pluginSettings.showContextOpenCountMenu) {
			for(var i = 2; i <= 10; i++) {
				browser.menus.create({						
					id: 'open-random-' + i,
					title: 'Load ' + i + ' Random Bookmarks',
					contexts: ['bookmark']
				});	
			}			
		}        
    });
};

/// Set up the interactive icon action button at the top of the browser
/// When there's more than 5 bookmark groups, it'll group them into it's own dropdown for the right click action
async function loadBrowserActionGroups() {
    logToDebugConsole('loadBrowserActionGroups');
    
    const theme = await browser.theme.getCurrent();
    const userAgent = navigator.userAgent.toLowerCase();
    const isDarkTheme = (theme?.properties?.color_scheme || userAgent.includes("ubuntu")) ?? false;

	var userLocalStorage = browser.storage.local.get();
    userLocalStorage.then((res) => {
		var userSyncOptions = browser.storage.sync.get();
		userSyncOptions.then((syncRes) => {
			for(var i = 0; i < pluginSettings.browserAction.length; i++) {
				removeContextOption(pluginSettings.browserAction[i]);
			}
			pluginSettings.browserAction = [];
			
			if (syncRes.groups) {
				var bookmarkGroupSettings = syncRes.groups;
				bookmarkGroupSettings.sort(compareBookmarkGroup);
								
				var groupExists = bookmarkGroupSettings.find(obj => {
					return obj.id === pluginSettings.selectedGroup;
				});
				
				if (groupExists) {

				} else {
					// Group no longer exists, set it back to default
					pluginSettings.selectedGroup = 'default';
					browser.storage.local.set({
						activeGroup: 'default'
					});
                }

                var parentId;

                if (bookmarkGroupSettings.length > 5) {
                    // Add the bookmark groups menu option
                    browser.menus.create({
                        id: 'options-groupparent',
                        type: 'normal',
                        title: 'Bookmark Groups',
                        contexts: ['browser_action']
                    }, function() {
                        pluginSettings.browserAction.push('options-groupparent');
                    });

                    parentId = 'options-groupparent';
                }
                
                // Add the default group
                createContextOption('default', 'Default', parentId);
                
                // Add the rest of the groups
				for(var i = 0; i < bookmarkGroupSettings.length; i++) {
					if (bookmarkGroupSettings[i].id !== 'default') {
						createContextOption(bookmarkGroupSettings[i].id, bookmarkGroupSettings[i].name, parentId);
					}                    
				}
				
			} else {
				createContextOption('default', 'Default');
            }

            browser.menus.create({
                id: 'random-bookmark-options',
                type: 'normal',
                title: 'Help',
                contexts: ['browser_action'],
                icons: {
                    "16": `icons/bookmark-star${isDarkTheme ? '-white' : ''}-16.png`,
                    "32": `icons/bookmark-star${isDarkTheme ? '-white' : ''}-32.png`
                }
            }, function() {
                pluginSettings.browserAction.push('random-bookmark-options');
            });

            // Add a shortcut to the options page
            browser.menus.create({
                id: 'options-page',
                type: 'normal',
                title: 'Random Bookmark Options',
                contexts: ['browser_action'],
                icons: {
                    "16": `icons/gear${isDarkTheme ? '-white' : ''}-16.png`,
                    "32": `icons/gear${isDarkTheme ? '-white' : ''}-32.png`
                },
                parentId: 'random-bookmark-options'
            }, function() {
                pluginSettings.browserAction.push('options-page');
            });

            // Will be used to update and show the last path
            browser.menus.create({
                id: 'last-bookmark-path',
                type: 'normal',
                title: '[Last Bookmark Path]',
                contexts: ['browser_action'],
                visible: false,
                icons: {
                    "16": `icons/asterisk${isDarkTheme ? '-white' : ''}-16.png`,
                    "32": `icons/asterisk${isDarkTheme ? '-white' : ''}-32.png`
                },
                parentId: 'random-bookmark-options'
            }, function() {
                pluginSettings.browserAction.push('last-bookmark-path');
            });

            // Add shortcut to plugin page on firefox add-ons
            browser.menus.create({
                id: 'plugin-page',
                type: 'normal',
                title: 'Random Bookmark Add-on Info',
                contexts: ['browser_action'],
                icons: {
                    "16": `icons/globe${isDarkTheme ? '-white' : ''}-16.png`,
                    "32": `icons/globe${isDarkTheme ? '-white' : ''}-32.png`
                },
                parentId: 'random-bookmark-options'
            }, function() {
                pluginSettings.browserAction.push('plugin-page');
            });

			// Check/preload the currently selected menu
			preloadBookmarksIntoLocalStorage('loadBrowserActionGroups');

			pluginSettings.loadingGroups = false;
							
			if (res.activeGroup) {
				pluginSettings.selectedGroup = res.activeGroup;
			}
		});
	});
};

function removeContextOption(id){ 
    logToDebugConsole('removeContextOption');

	browser.menus.remove(id);
};

function createContextOption(id, name, parent) {
    logToDebugConsole('createContextOption');

    var menuItem = {
        id: id,
        type: 'radio',
        title: name,
        checked: id === pluginSettings.selectedGroup ? true : false,
        contexts: ['browser_action']
    };

    if (typeof parent != 'undefined' && parent !== '') {
        menuItem.parentId = parent;
    }

    browser.menus.create(menuItem, function() {
		pluginSettings.browserAction.push(id);
	});
};

async function preloadBookmarksIntoLocalStorage(source) {	
    logToDebugConsole('preloadBookmarksIntoLocalStorage', { 'source': source, 'pluginSettings': pluginSettings });

    if (pluginSettings.loadingBookmarks === false) {

        sessionInfo.loadingDateTimeStarted = Date.now();
        pluginSettings.loadingBookmarks = true;
    
        // Preload only the selected group.
        // I can't figure out how to load all the groups annoyingly, i don't get async.
        var userSyncOptions = await browser.storage.sync.get();
        
        var found = userSyncOptions.groups.filter(obj => {
            return obj.id === pluginSettings.selectedGroup;
        });

        if (found.length) {
            var group = found[0];
            
            if (group.reload) {
                group.reload = false;

                loadBookmarksIntoLocalStorage(group.id, group.selected);
                
                const index = userSyncOptions.groups.findIndex(obj => obj.id === pluginSettings.selectedGroup);
                userSyncOptions.groups[index] = group;

                browser.storage.sync.set({
                    groups: userSyncOptions.groups
                });

            }  else {
                setTimeout(function() {
                    finishedLoading();
                }, 250);
                
                sessionInfo.loadingDateTimeStarted = null;

            }
            
        } else {
            setTimeout(function() {
                finishedLoading();
            }, 250);

            sessionInfo.loadingDateTimeStarted = null;

        }
        
    }
};

function loadBookmarksIntoLocalStorage(id, folders) {
    logToDebugConsole('loadBookmarksIntoLocalStorage', { 'id': id, 'folders': folders });

    if (folders.length > 0) {
        var selectedPromises = [];

        // Selected Bookmarks
        for(var i = 0; i < folders.length; i++) {
            selectedPromises.push(browser.bookmarks.getChildren(folders[i]));
        }

        processBookmarkPromises(id, selectedPromises);

    } else {
        // All Bookmarks
        var allBookmarks = browser.bookmarks.getTree();
        var allPromises = [allBookmarks];

        processBookmarkPromises(id, allPromises);
    }
};

function processBookmarkPromises(id, promises) {
    logToDebugConsole('processBookmarkPromises', { 'id': id, 'promises': promises });

    settlePromises(promises)
    .then(results => {
        var bookmarksToSave = [];

        results.forEach(result => {
            logToDebugConsole('processBookmarkPromises Result', result);
			
            if (result.state === 'fulfilled'){
                for(var i = 0; i < result.value.length; i++) {
                    var r = processBookmarks(result.value[i], result.value[i].id === 'root________');
                    bookmarksToSave = bookmarksToSave.concat(r);
                }

            } else {
                //console.log('failed', result.value);
                // Remove from the grouped settings
                // bookmarkGroupSettings

            }
        });

        var uniqueBookmarks = bookmarksToSave.filter(function(elem, index, self) {
            return index === self.indexOf(elem);
        });
				
		if (pluginSettings.randomOption === 'alphabetical') {
			uniqueBookmarks.sort((a, b) => a.localeCompare(b, undefined, {sensitivity: 'base'}));
		} else {
			Shuffle(uniqueBookmarks);
		}
		
		logToDebugConsole('Bookmarks to store', uniqueBookmarks);

        browser.storage.local.set({
            [id]: uniqueBookmarks
        });

        setTimeout(function() {
            finishedLoading();
        }, 250);
    });
};

function processBookmarks(bookmarkItem, goDeeper) {
    //logToDebugConsole('processBookmarks', { 'bookmarkItem': bookmarkItem, 'goDeeper': goDeeper });

    var bookmarksCollection = [];

    if (bookmarkItem.type === 'folder') {
        var result = getBookmarks(bookmarkItem.children);
        bookmarksCollection = bookmarksCollection.concat(result);

    } else if (bookmarkItem.type === 'bookmark') {
        bookmarksCollection.push(bookmarkItem.id);
    }

    if (bookmarkItem.children && goDeeper) {
        for (child of bookmarkItem.children) {
            var result = processBookmarks(child, goDeeper);
            bookmarksCollection = bookmarksCollection.concat(result);
        }
    }

    return bookmarksCollection;
};

function getBookmarks(bookmarkFolder) {
    logToDebugConsole('getBookmarks', { 'bookmarkFolder': bookmarkFolder });
    
    var bookmarksCollection = [];
    if (typeof bookmarkFolder !== 'undefined' && bookmarkFolder !== null)
		for (var i = 0; i < bookmarkFolder.length; i++) {
			if (bookmarkFolder[i].type === 'bookmark') {
				bookmarksCollection.push(bookmarkFolder[i].id);
			}
		}

    return bookmarksCollection;
};

function finishedLoading() {
    pluginSettings.loadingBookmarks = false;
    pluginSettings.initialLoading = false;
};

function onError(e) {
    console.error(e);
};

function logToDebugConsole(what, data) {
	if (pluginSettings.isDebugging) {
        if (typeof data !== 'undefined') {
            console.log(what, data);
        } else {
            console.log(what);
        }		
	}
};

// https://stackoverflow.com/a/32979111/13690517
function settlePromises(arr){
    return Promise.all(arr.map(promise => {
        return promise.then(
            value => ({state: 'fulfilled', value}),
            value => ({state: 'rejected', value})
        );
    }));
};

async function getBookmarkPath(bookmarkId) {
	let path = [];
	let currentId = bookmarkId;
  
	while (currentId) {
	  // Get the current bookmark or folder
	  let [currentBookmark] = await browser.bookmarks.get(currentId);
	  path.unshift(currentBookmark.title); // Add the title to the path
	  currentId = currentBookmark.parentId; // Move to the parent
	}
  
	return path.slice(0, -1).filter(Boolean).join(" > ");
}