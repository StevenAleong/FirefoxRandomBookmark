var panelDivWrapper = document.getElementById('groups-wrapper');
var selectedGroup = 'default';
var loading = true;
var reload = false;

function loadBookmarkGroups() { 
    var userLocalStorage = browser.storage.local.get();
    userLocalStorage.then((localRes) => {
        if (localRes.reloadSidebar) {
            reload = true;
            browser.storage.local.remove('reloadSidebar');
        }

        if (localRes.activeGroup) {
            selectedGroup = localRes.activeGroup;
        }

        if (loading || reload) {
            while (panelDivWrapper.firstChild) {
                panelDivWrapper.removeChild(panelDivWrapper.firstChild);
            }

            var userSyncOptions = browser.storage.sync.get();
            userSyncOptions.then((syncRes) => {
                if (syncRes.groups) {
                    var bookmarkGroupSettings = syncRes.groups;
                    bookmarkGroupSettings.sort(compareBookmarkGroup);
    
                    var groupExists = bookmarkGroupSettings.find(obj => {
                        return obj.id === selectedGroup;
                    });
    
                    if (groupExists) {
    
                    } else {
                        // Group no longer exists, set it back to default
                        selectedGroup = 'default';
                        browser.storage.local.set({
                            activeGroup: 'default'
                        });
                    }
                    createGroupOption('default', 'Default');
    
                    for(var i = 0; i < bookmarkGroupSettings.length; i++) {
                        if (bookmarkGroupSettings[i].id !== 'default') {
                            createGroupOption(bookmarkGroupSettings[i].id, bookmarkGroupSettings[i].name);
                        }                    
                    }
        
                } else {
                    createGroupOption('default', 'Default');
                }
                
                loading = false;
                reload = false;
            });
        }
    });    

    // Check for new groups and updates every 10 seconds
    setTimeout(function() { loadBookmarkGroups() }, 10000);
};

function createGroupOption(id, name) {
    var option = document.createElement('button');
    option.innerHTML = name;
    option.id = id;
    option.className = setActiveButtonCss(id);
    option.onclick = function() { 
        changeActiveGroup(this);
    };
    panelDivWrapper.appendChild(option);
};

function changeActiveGroup(button) {
    selectedGroup = button.id;
    browser.storage.local.set({
        activeGroup: button.id
    });

    var groupButtons = document.getElementsByClassName('list-group-item');
    for(var i = 0; i < groupButtons.length; i++) {
        groupButtons[i].className = setActiveButtonCss(groupButtons[i].id);
    }
};

function setActiveButtonCss(id) {
    return 'list-group-item list-group-action' + (id === selectedGroup ? ' active font-weight-bold' : '');
}

function compareBookmarkGroup( a, b ) {
    if ( a.name < b.name ){
      return -1;
    }
    if ( a.name > b.name ){
      return 1;
    }
    return 0;
};

document.addEventListener('DOMContentLoaded', loadBookmarkGroups());
