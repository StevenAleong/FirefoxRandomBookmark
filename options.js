const settingsEnum = {
    RANDOMIZEMETHOD: 'randomizemethod',
    TABOPTION: 'taboption',
    TABACTIVE: 'tabactive',
    CONTEXTMENU: 'contextmenu',
    GROUP: 'bookmarkgroups',
    CONTEXTOPENCOUNT: 'contextopencount',
    SHOWACTIONNOTICE: 'showactionnotice',
    RANDOMIZEHISTORY: 'randomizeHistory',
    DISABLEAUTOMTICREFRESH: 'disableautomaticrefresh',
};

var loading = true;
var treeID = '#bookmarks-wrapper';
var replacements = { "&": "&amp;", '"': "&quot;", "'": "&#39;", "<": "&lt;", ">": "&gt;" };

var bookmarkGroupSettings = [{
    name: 'Default',
    id: 'default',
    selected: [],
    reload: true
}];

var selectAll = document.getElementById('select-all');
selectAll.onclick = function() {
	var allCheckboxes = document.getElementsByName('selected-folder');   
	for(var i = 0, n = allCheckboxes.length; i < n; i++) {
		allCheckboxes[i].checked = selectAll.checked;
	} 
};

var randomizedHistoryTracking = false;

// Close Settings
// -------------------------------------------------------------
// var closeSettings = document.getElementById('action-close');
// closeSettings.onclick = function() {
//     var currentTab = browser.tabs.getCurrent();
// 	currentTab.then((res) => {		
// 		browser.tabs.remove(res.id);		
// 	});
// };

// Clear All Data
var btnClearData = document.getElementById('action-clear-data');
btnClearData.onclick = function(e) {
    browser.storage.sync.clear();
    browser.storage.local.clear();
	location.reload(); 
};

// Log all Data
var btnLogAllData = document.getElementById('action-log-all-data');
btnLogAllData.onclick = function(e) {
	var localStorage = browser.storage.local.get(null);
	localStorage.then((local) => {
		console.log(local);
	});	
	
	var syncStorage = browser.storage.sync.get(null);
	syncStorage.then((sync) => {
		console.log(sync);
    });	
    
    console.log(pluginSettings);
};

// Randomize Method
// -------------------------------------------------------------
var radioRandomizeDefault = document.getElementById('randomoption-default');
radioRandomizeDefault.addEventListener('change', function() { saveSettings(settingsEnum.RANDOMIZEMETHOD); });

var radioRandomizeByBookmark = document.getElementById('randomoption-bybookmark');
radioRandomizeByBookmark.addEventListener('change', function() { saveSettings(settingsEnum.RANDOMIZEMETHOD); });

var radioRandomizeAlphbetical = document.getElementById('randomoption-alphabetical');
radioRandomizeAlphbetical.addEventListener('change', function() { saveSettings(settingsEnum.RANDOMIZEMETHOD); });

// Tab Options
// -------------------------------------------------------------
var checkboxSetTabActive = document.getElementById('activeoption');
checkboxSetTabActive.addEventListener('change', function() { saveSettings(settingsEnum.TABACTIVE); });

// Tab Open Options
// ------------------------------------------------------------
var radioOpenOptionDefault = document.getElementById('openoption-default');
radioOpenOptionDefault.addEventListener('change', function() { saveSettings(settingsEnum.TABOPTION); });

var radioOpenOptionNew = document.getElementById('openoption-new');
radioOpenOptionNew.addEventListener('change', function() { saveSettings(settingsEnum.TABOPTION); });

var radioOpenOptionCurrent = document.getElementById('openoption-current');
radioOpenOptionCurrent.addEventListener('change', function() { saveSettings(settingsEnum.TABOPTION); });

// Automatic Refresh
// -------------------------------------------------------------
var checkboxAutomaticRefresh = document.getElementById('disableAutomaticRefresh');
checkboxAutomaticRefresh.addEventListener('change', function() { saveSettings(settingsEnum.DISABLEAUTOMTICREFRESH); });

// Bookmark History
// -------------------------------------------------------------
var checkboxRandomizeHistory = document.getElementById('randomizeHistory');
checkboxRandomizeHistory.addEventListener('change', function() { saveSettings(settingsEnum.RANDOMIZEHISTORY); });

// Context Options
// -------------------------------------------------------------
var checkboxContextMenu = document.getElementById('showContextMenu');
checkboxContextMenu.addEventListener('change', function() { saveSettings(settingsEnum.CONTEXTMENU); });

var checkboxContextOpenCountMenu = document.getElementById('showContextOpenCountMenu');
checkboxContextOpenCountMenu.addEventListener('change', function() { saveSettings(settingsEnum.CONTEXTOPENCOUNT); });

// Helper Options
// -------------------------------------------------------------
var checkboxActionNotice = document.getElementById('showActionNotice');
checkboxActionNotice.addEventListener('change', function() { saveSettings(settingsEnum.SHOWACTIONNOTICE); });

// Bookmark Option
// -------------------------------------------------------------
var bookmarkGroups = document.getElementById('bookmark-groups');
var addBookmarkGroup = document.getElementById('action-add-group');
var editBookmarkGroup = document.getElementById('action-edit-group');
var deleteBookmarkGroup = document.getElementById('action-delete-group');
var previousSelectedGroup = 'nothing';

bookmarkGroups.onchange = function() {
    var selected = bookmarkGroups.options[bookmarkGroups.selectedIndex].value;
    editBookmarkGroup.disabled = selected === 'default';
    deleteBookmarkGroup.disabled = selected === 'default';
    
    if (selected !== previousSelectedGroup) {
        previousSelectedGroup = selected;
        
        loadSelectedBookmarks(selected);  
    }
};

addBookmarkGroup.onclick = function() {
    var name = prompt('Name of new bookmark group');
    if (name && name.trim() !== '') {
        var ticks = (621355968e9 + (new Date()).getTime() * 1e4);
        var hash = 'bookmarks_' + (name + ticks.toString()).hashCode().toString();

        // Save current bookmark group
        saveBookmarks();

        // Add new bookmark group to select dropdown
        // And select it
        var newOption = document.createElement('option');
        newOption.value = hash;
        newOption.text = name.trim();
        bookmarkGroups.add(newOption);
        bookmarkGroups.value = hash;

        var newGroupInfo = {
            name: name.trim(),
            id: hash.toString(),
            selected: [],
            reload: true
        };

        bookmarkGroupSettings.push(newGroupInfo);

        saveBookmarks();

        // Deselect any checkboxes
        var allCheckboxes = document.getElementsByName('selected-folder');   
        for(var i = 0, n = allCheckboxes.length; i < n; i++) {
            allCheckboxes[i].checked = false;
        } 

        // Enable buttons
        editBookmarkGroup.disabled = false;
        deleteBookmarkGroup.disabled = false;

        groupsChanged();
    }
};

editBookmarkGroup.onclick = function() {
    var selected = bookmarkGroups.options[bookmarkGroups.selectedIndex].value;
    var text = bookmarkGroups.options[bookmarkGroups.selectedIndex].text;
    
    if (selected !== 'default') {
        var nameEdit = prompt('Edit name of bookmark group', text);
        if (nameEdit && nameEdit.trim() !== '') {
            var editGroupInfo = bookmarkGroupSettings.find(obj => {
                return obj.id === selected;
            });

            editGroupInfo.name = nameEdit.trim();
            saveBookmarks();

            bookmarkGroups.options[bookmarkGroups.selectedIndex].textContent = nameEdit;
            
            groupsChanged();
        }
    }
};

deleteBookmarkGroup.onclick = function() {
    var selected = bookmarkGroups.options[bookmarkGroups.selectedIndex].value;

    if (selected !== 'default') {
		if (confirm('Please confirm you want to delete this group')) {
			for(var i = 0; i < bookmarkGroupSettings.length; i++) {
				if (bookmarkGroupSettings[i].id === selected) {
					bookmarkGroupSettings.splice(i, 1);
					// Also remove from local storage if it was sync'd
					browser.storage.local.remove(selected);
                    browser.storage.local.remove(`${selected}_index`);
					break;
				}
			}

			saveBookmarks();
			
			// Go back to default drop down
			bookmarkGroups.value = 'default';

			// Disable buttons
			editBookmarkGroup.disabled = true;
			deleteBookmarkGroup.disabled = true;

			// Remove from options
			for(var i = 0; i < bookmarkGroups.options.length; i++) {
				if (bookmarkGroups.options[i].value === selected) {
					bookmarkGroups.remove(i);                
					break;
				}
			}
			
			loadSelectedBookmarks('default');   
			groupsChanged();
		}
    }
};

function saveSettings(option) {
    if (loading === false) {
        switch (option) {
            case settingsEnum.RANDOMIZEMETHOD:
                var randomOption = 'default';
                if (document.getElementById('randomoption-bybookmark').checked) {
                    randomOption = 'bybookmark';
                } else if (document.getElementById('randomoption-alphabetical').checked) {
					randomOption = 'alphabetical';
				}
    
                browser.storage.sync.set({
                    randomOption: randomOption
                });
				
				pluginSettings.randomOption = randomOption;								
				preloadBookmarksIntoLocalStorage('saveSettings');
				    
                break;
    
            case settingsEnum.TABACTIVE:
                browser.storage.sync.set({
                    setActive: document.getElementById('activeoption').checked
                });
                break;
    
            case settingsEnum.TABOPTION:
                var tabOption = 'default';
                if (document.getElementById('openoption-new').checked) {
                    tabOption = 'newTab';
                    
                } else if (document.getElementById('openoption-current').checked) {
                    tabOption = 'currentTab';
                }
        
                browser.storage.sync.set({
                    tabOption: tabOption
                });
                break;

            case settingsEnum.DISABLEAUTOMTICREFRESH:
                disableAutomaticRefresh = document.getElementById('disableAutomaticRefresh').checked;

                browser.storage.sync.set({
                    disableAutomaticRefresh: disableAutomaticRefresh
                });
                break;

            case settingsEnum.RANDOMIZEHISTORY:
                randomizedHistoryTracking = document.getElementById('randomizeHistory').checked;                
                
                browser.storage.sync.set({
                    randomizeHistory: randomizedHistoryTracking
                });

                document.getElementById('history-list-wrapper').style.display = randomizedHistoryTracking ? 'block' : 'none';

                if (!randomizedHistoryTracking) {
                    browser.storage.local.remove('randomized-history');
                    loadRandomizeHistory([]);        
                }
                break;

            case settingsEnum.CONTEXTMENU:
                browser.storage.sync.set({
                    showContextMenu: document.getElementById('showContextMenu').checked
                });
                groupsChanged();
                break;
				
			case settingsEnum.CONTEXTOPENCOUNT:
				browser.storage.sync.set({
					showContextOpenCountMenu: document.getElementById('showContextOpenCountMenu').checked
				});
                groupsChanged();
                break;
                
            case settingsEnum.SHOWACTIONNOTICE:
                browser.storage.sync.set({
					showActionNotice: document.getElementById('showActionNotice').checked
				});
                break;
        }
				
		showSavedMessage();
    }    
};

function showSavedMessage() {
	document.getElementById('save-message').style.display = 'block';
	setTimeout(function() {
		document.getElementById('save-message').style.display = 'none';
	}, 1500);
};

async function loadSavedOptions() {
    var syncRes = await browser.storage.sync.get();
    //userSyncOptions.then((syncRes) => {
                
    if (syncRes.randomOption === 'bybookmark') {
        document.getElementById('randomoption-bybookmark').checked = true;
        randomizeMethod = 'bybookmark';			
    } else if (syncRes.randomOption === 'alphabetical') {
        document.getElementById('randomoption-alphabetical').checked = true;
        randomizeMethod = 'alphabetical';			
    }

    document.getElementById('activeoption').checked = syncRes.setActive;

    if (syncRes.tabOption === 'newTab') {
        document.getElementById('openoption-new').checked = true;
    } else if (syncRes.tabOption === 'currentTab') {
        document.getElementById('openoption-current').checked = true;
    }

    document.getElementById('disableAutomaticRefresh').checked = syncRes.disableAutomaticRefresh;

    document.getElementById('randomizeHistory').checked = syncRes.randomizeHistory;
    randomizedHistoryTracking = syncRes.randomizeHistory;
    document.getElementById('history-list-wrapper').style.display = randomizedHistoryTracking ? 'block' : 'none';
    if (randomizedHistoryTracking) {
        const storageCollection = await browser.storage.local.get('randomized-history');
        const historyCollection = storageCollection.hasOwnProperty('randomized-history') ? JSON.parse(storageCollection['randomized-history']) : [];
        loadRandomizeHistory(historyCollection);
    }

    document.getElementById('showContextMenu').checked = syncRes.showContextMenu;
    document.getElementById('showContextOpenCountMenu').checked = syncRes.showContextOpenCountMenu;
    document.getElementById('showActionNotice').checked = syncRes.showActionNotice;
    
    // Port over selectedFolders to groups json
    if (syncRes.selectedFolders && syncRes.selectedFolders.length) {
        bookmarkGroupSettings = changeToGroups(syncRes.selectedFolders);      

    } else if (syncRes.groups) {
        bookmarkGroupSettings = syncRes.groups;

    }        

    // Load bookmark groups
    bookmarkGroupSettings.sort(compareBookmarkGroup);
    for(var i = 0; i < bookmarkGroupSettings.length; i++) {
        if (bookmarkGroupSettings[i].id !== 'default') {
            var newOption = document.createElement('option');
            newOption.value = bookmarkGroupSettings[i].id;
            newOption.text = bookmarkGroupSettings[i].name;
            bookmarkGroups.add(newOption);
        }                
    }

    loadSelectedBookmarks('default');

    loading = false;
    //});
};

function selectCheckbox(checkbox) {
    var currentGroupID = bookmarkGroups.options[bookmarkGroups.selectedIndex].value;

    var selectedGroup = bookmarkGroupSettings.find(obj => {
        return obj.id === currentGroupID;
    });

    if (selectedGroup) {
        if (selectedGroup.selected.filter(e => e === checkbox.value).length > 0) {
            if (checkbox.checked === false) {
                // Remove it from the bookmarks
                var bookmarkIndex = selectedGroup.selected.indexOf(checkbox.value);
                if (bookmarkIndex !== -1) {
                    selectedGroup.selected.splice(bookmarkIndex, 1);
                }                
            }

        } else if (checkbox.checked) {
            selectedGroup.selected.push(checkbox.value);

        }

        selectedGroup.reload = true;
		saveBookmarks();
    }

}

function selectChildren(bookmarkId) {
    var currentGroupID = bookmarkGroups.options[bookmarkGroups.selectedIndex].value;
	
    var selectedGroup = bookmarkGroupSettings.find(obj => {
        return obj.id === currentGroupID;
    });
	
	if (selectedGroup) {
		var parentCheckbox = document.getElementById(bookmarkId);
		
		var childCheckboxes = document.body.querySelectorAll('[data-parent="' + bookmarkId + '"]');   
		for(var i = 0, n = childCheckboxes.length; i < n; i++) {
			childCheckboxes[i].checked = true;
			
			if (selectedGroup.selected.filter(e => e === childCheckboxes[i].value).length > 0) {
				if (childCheckboxes[i].checked === false) {
					// Remove it from the bookmarks
					var bookmarkIndex = selectedGroup.selected.indexOf(childCheckboxes[i].value);
					if (bookmarkIndex !== -1) {
						selectedGroup.selected.splice(bookmarkIndex, 1);
					}                
				}

			} else if (childCheckboxes[i].checked) {
				selectedGroup.selected.push(childCheckboxes[i].value);

			}

		} 
		
		selectedGroup.reload = true;
		saveBookmarks();
	}
}

function loadSelectedBookmarks(groupID) {
    // Deselect all the checkboxes
    var allCheckboxes = document.getElementsByName('selected-folder');   
    for(var i = 0, n = allCheckboxes.length; i < n; i++) {
        allCheckboxes[i].checked = false;
    } 

    // Load bookmark group selected options
    var groupInfo = bookmarkGroupSettings.find(obj => {
        return obj.id === groupID;
    });

    if (groupInfo) {
        for(var i = 0; i < groupInfo.selected.length; i++) {
            if (document.getElementById(groupInfo.selected[i]) !== null) {
                document.getElementById(groupInfo.selected[i]).checked = true;
            }
        }
    }
	
}

function options_processBookmarks(bookmarkItem, indent, parentID) {
    if (bookmarkItem.type === 'folder' && bookmarkItem.title !== '') {
        var countOfBookmarks = 0;
        for (var i = 0; i < bookmarkItem.children.length; i++) {
            if (bookmarkItem.children[i].type === 'bookmark') 
                countOfBookmarks++;
        }

        var tbody = document.getElementById('bookmarks-folders');
        var tr = document.createElement('tr');

        var tdInput = document.createElement('td');
        tdInput.style.textAlign = 'center';

        var tdCheckbox = document.createElement('input');
        tdCheckbox.type = 'checkbox';
        tdCheckbox.name = 'selected-folder';
        tdCheckbox.value = bookmarkItem.id;
        tdCheckbox.id = bookmarkItem.id;
        tdCheckbox.setAttribute('data-parent', parentID);
        tdCheckbox.onclick = function() {
            selectCheckbox(this);
        };
        tdInput.appendChild(tdCheckbox);
        tr.appendChild(tdInput);

        var tdInfo = document.createElement('td');
        
        var labelTitle = document.createElement('label');
        labelTitle.htmlFor = bookmarkItem.id;		
        labelTitle.appendChild(document.createTextNode(makeIndent(indent) + ' ' + escapeHTML(bookmarkItem.title)));

        if (indent === 0) {
            labelTitle.style.fontWeight = 'bold';
        }
        tdInfo.appendChild(labelTitle);
		
		if (bookmarkItem.children) {
			var showToggle = false;
			
			for (var i = 0; i < bookmarkItem.children.length; i++) {
				if (bookmarkItem.children[i].type === 'folder') {					
					showToggle = true;
					break;
				}
			}
			
			if (showToggle) {
                var btnSelectChildren = document.createElement('button');                
                btnSelectChildren.textContent = 'Select direct sub-folders';
				btnSelectChildren.style.fontSize = '12px';
				btnSelectChildren.style.color = '#555';
				btnSelectChildren.style.float = 'right';
				btnSelectChildren.style.marginTop = '5px';
				btnSelectChildren.type = 'button';
				
				btnSelectChildren.onclick = function() { 
					selectChildren(bookmarkItem.id);
				};
				
				tdInfo.appendChild(btnSelectChildren);
			}
			
		}
		
        tr.appendChild(tdInfo);
		        
        var tdCount = document.createElement('td');
        tdCount.style.textAlign = 'right';
        tdCount.appendChild(document.createTextNode(escapeHTML(countOfBookmarks.toString())));

        tr.appendChild(tdCount);
        
        tbody.appendChild(tr);
        
        indent++;
    }

    if (bookmarkItem.children) {
        for (child of bookmarkItem.children) {
            options_processBookmarks(child, indent, bookmarkItem.id);
        }
    }

    indent--;
};

function makeIndent(indentLength) {
    //return ' &nbsp; &nbsp; &nbsp; '.repeat(indentLength);
    return ' \u00A0\u00A0\u00A0\u00A0 '.repeat(indentLength)
};

function escapeHTML(str) {
    return str.replace(/[&"'<>]/g, (m) => replacements[m]);
};

function saveBookmarks() {
    browser.storage.sync.set({
        groups: bookmarkGroupSettings
    });
	
	showSavedMessage();
};

function groupsChanged() {
	
};

function loadUsedSpaceSize() {
	var gettingSpace = browser.storage.sync.getBytesInUse(null);
	gettingSpace.then(function(r) {
		document.getElementById('used-storage-sync').appendChild(document.createTextNode(r));
	});
}

async function loadRandomizeHistory(items) {
    const listContainer = document.getElementById('randomize-history-list');
    listContainer.innerHTML = '';

    // Need to handle the list when a user deletes a bookmark
    const bookmarkIds = items.map(item => item.bookmark?.id);
    
    const bookmarks = [];

    for (const id of bookmarkIds) {        
        try {
            const bookmarkInfo = await browser.bookmarks.get(id);            
            bookmarks.push(bookmarkInfo[0]);
        } catch (error) {
            // console.log('error', error);
        }
    }

    // No items found
    document.getElementById('history-list-none').style.display = bookmarks.length === 0 ? 'block' : 'none';

    for (const item of items) {
        if (bookmarks.some((bm) => bm.id === item.bookmark.id)) {
            const listItem = document.createElement('li');
            listItem.className = 'list-group-item';
    
            const path = await getBookmarkPath(item.bookmark.id);
    
            const linkElement = document.createElement('a');
            linkElement.href = item.bookmark.url;
            linkElement.target = '_blank';
            linkElement.className = 'fw-bold';
            linkElement.textContent = item.bookmark.title;
            listItem.appendChild(linkElement);
    
            listItem.appendChild(document.createElement('br'));
    
            const savePathSmall = document.createElement('small');
            savePathSmall.textContent = `Save Path: ${path}`;
            listItem.appendChild(savePathSmall);
    
            listItem.appendChild(document.createElement('br'));
    
            const dateRandomizedSmall = document.createElement('small');
            dateRandomizedSmall.textContent = `Date Randomized: ${new Date(item.dateRandomized).toLocaleString()}`;
            listItem.appendChild(dateRandomizedSmall);
    
            listContainer.appendChild(listItem);
        }
    }
}

function setup() { 
    var bookmarksTree = browser.bookmarks.getTree();
    bookmarksTree.then(function(bookmarkItem) {
        options_processBookmarks(bookmarkItem[0], 0, 'root');
        loadSavedOptions();

    }, function(error) {
        console.log(`An error: ${error}`);
    }); 
};

document.addEventListener('DOMContentLoaded', setup());

/**
     * Watches for changes to the randomized history local storage and updates
     * the listing of randomized history
     */
browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes['randomized-history'] && randomizedHistoryTracking) {
        const historyArray = JSON.parse(changes['randomized-history'].newValue);
        loadRandomizeHistory(historyArray);
    }
});

