var pluginSettings = {
    randomOption: 'default',
    tabOption: 'default',
    tabSetActive: true,
    showContextMenu: false,
	showContextOpenCountMenu: false,
    contextMenuName: 'randombookmarkContext',
    loadingGroups: false,
    loadingBookmarks: false,
    selectedGroup: 'default',
    browserAction: [],
    isDebugging: false
};

var sessionInfo = {
    currentTabId: 0,
    loadingDateTimeStarted: null
};

function loadUserSettings() {
    logToDebugConsole('loadUserSettings');

    var userOptions = browser.storage.sync.get();
    userOptions.then((resSync) => {
        pluginSettings.randomOption = resSync.randomOption === 'bybookmark' ? 'bybookmark' : 'default';
        pluginSettings.tabSetActive = typeof resSync.setActive !== 'undefined' ? resSync.setActive : true;
        pluginSettings.showContextMenu = typeof resSync.showContextMenu !== 'undefined' ? resSync.showContextMenu : false;  
		pluginSettings.showContextOpenCountMenu = typeof resSync.showContextOpenCountMenu !== 'undefined' ? resSync.showContextOpenCountMenu : false;  

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

function loadBrowserActionGroups() {
    logToDebugConsole('loadBrowserActionGroups');

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

                //console.log(bookmarkGroupSettings);

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
            
            // Add a shortcut to the options page
            browser.menus.create({
                id: 'options-page',
                type: 'normal',
                title: 'Random Bookmark Options',
                contexts: ['browser_action'],
                icons: {
                    "16": "icons/gear-16.png",
                    "32": "icons/gear-32.png"
                }
            }, function() {
                pluginSettings.browserAction.push('options-page');
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

function preloadBookmarksIntoLocalStorage(source) {
    logToDebugConsole('preloadBookmarksIntoLocalStorage', { 'source': source, 'pluginSettings': pluginSettings });

    if (pluginSettings.loadingBookmarks === false) {

        sessionInfo.loadingDateTimeStarted = Date.now();
        pluginSettings.loadingBookmarks = true;
    
        // Preload only the selected group.
        // I can't figure out how to load all the groups annoyingly, i don't get async.
        var userSyncOptions = browser.storage.sync.get();
        userSyncOptions.then((syncRes) => {
            var found = syncRes.groups.filter(obj => {
                return obj.id === pluginSettings.selectedGroup;
            });
    
            if (found.length) {
                var group = found[0];
                
                if (group.reload) {
                    loadBookmarksIntoLocalStorage(group.id, group.selected);
    
                }  else {
                    setTimeout(function() {
                        pluginSettings.loadingBookmarks = false;
                    }, 250);
                    
                    sessionInfo.loadingDateTimeStarted = null;
    
                }
                
            } else {
                setTimeout(function() {
                    pluginSettings.loadingBookmarks = false;
                }, 250);

                sessionInfo.loadingDateTimeStarted = null;
    
            }
        
        });
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
            console.log(result);
            if (result.state === 'fulfilled'){
                //console.log('succeeded', result.value);

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

        Shuffle(uniqueBookmarks);

        browser.storage.local.set({
            [id]: uniqueBookmarks
        });

        setTimeout(function() {
            pluginSettings.loadingBookmarks = false;
        }, 250);
    });
};

function processBookmarks(bookmarkItem, goDeeper) {
    logToDebugConsole('processBookmarks', { 'bookmarkItem': bookmarkItem, 'goDeeper': goDeeper });

    var bookmarksCollection = [];

    if (bookmarkItem.type === 'folder') {
        var result = getBookmarks(bookmarkItem.children);
        bookmarksCollection = bookmarksCollection.concat(result);

    } else if (bookmarkItem.type === 'bookmark') {
        bookmarksCollection.push(bookmarkItem.url);

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
            bookmarksCollection.push(bookmarkFolder[i].url);
        }
    }

    return bookmarksCollection;
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