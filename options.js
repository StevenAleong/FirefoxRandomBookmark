const settingsEnum = {
  RANDOMIZEMETHOD: "randomizemethod",
  TABOPTION: "taboption",
  TABACTIVE: "tabactive",
  CONTEXTMENU: "contextmenu",
  GROUP: "bookmarkgroups",
  FILTERS: "filterurls",
  CONTEXTOPENCOUNT: "contextopencount",
  SHOWACTIONNOTICE: "showactionnotice",
  RANDOMIZEHISTORY: "randomizeHistory",
  DISABLEAUTOMATICREFRESH: "disableautomaticrefresh",
};

let loading = true;
const treeID = "#bookmarks-wrapper";
const replacements = { "&": "&amp;", '"': "&quot;", "'": "&#39;", "<": "&lt;", ">": "&gt;" };

let bookmarkGroupSettings = [
  {
    name: "Default",
    id: "default",
    selected: [],
    reload: true,
  },
];

const selectAll = document.getElementById("select-all");
selectAll.addEventListener("click", function () {
  const allCheckboxes = document.getElementsByName("selected-folder");
  for (let i = 0, n = allCheckboxes.length; i < n; i++) {
    allCheckboxes[i].checked = selectAll.checked;
  }
});

let randomizedHistoryTracking = false;

// Clear All Data
const btnClearData = document.getElementById("action-clear-data");
btnClearData.addEventListener("click", function () {
  browser.storage.sync.clear();
  browser.storage.local.clear();
  location.reload();
});

// Log all Data
const btnLogAllData = document.getElementById("action-log-all-data");
btnLogAllData.addEventListener("click", async function (e) {
  const localStorage = await browser.storage.local.get(null);
  console.log("Local Storage", localStorage);

  const syncStorage = await browser.storage.sync.get(null);
  console.log("Sync Storage", syncStorage);

  console.log("Plugin Settings", pluginSettings);
});

// Randomize Method
// -------------------------------------------------------------
const radioRandomizeDefault = document.getElementById("randomoption-default");
radioRandomizeDefault.addEventListener("change", function () {
  saveSettings(settingsEnum.RANDOMIZEMETHOD);
});

const radioRandomizeByBookmark = document.getElementById("randomoption-bybookmark");
radioRandomizeByBookmark.addEventListener("change", function () {
  saveSettings(settingsEnum.RANDOMIZEMETHOD);
});

const radioRandomizeAlphbetical = document.getElementById("randomoption-alphabetical");
radioRandomizeAlphbetical.addEventListener("change", function () {
  saveSettings(settingsEnum.RANDOMIZEMETHOD);
});

// Tab Options
// -------------------------------------------------------------
const checkboxSetTabActive = document.getElementById("activeoption");
checkboxSetTabActive.addEventListener("change", function () {
  saveSettings(settingsEnum.TABACTIVE);
});

// Tab Open Options
// ------------------------------------------------------------
const radioOpenOptionDefault = document.getElementById("openoption-default");
radioOpenOptionDefault.addEventListener("change", function () {
  saveSettings(settingsEnum.TABOPTION);
});

const radioOpenOptionNew = document.getElementById("openoption-new");
radioOpenOptionNew.addEventListener("change", function () {
  saveSettings(settingsEnum.TABOPTION);
});

const radioOpenOptionCurrent = document.getElementById("openoption-current");
radioOpenOptionCurrent.addEventListener("change", function () {
  saveSettings(settingsEnum.TABOPTION);
});

// filters
// -------------------------------------------------------------
const textareaOptionFilter = document.getElementById("filter-urls");
let filterUrlsOnFocus = "";

textareaOptionFilter.addEventListener("focus", function () {
  filterUrlsOnFocus = this.value;
});

textareaOptionFilter.addEventListener("blur", function () {
  if (this.value !== filterUrlsOnFocus) {
    saveSettings(settingsEnum.FILTERS);
  }
});

// Automatic Refresh
// -------------------------------------------------------------
const checkboxAutomaticRefresh = document.getElementById("disableAutomaticRefresh");
checkboxAutomaticRefresh.addEventListener("change", function () {
  saveSettings(settingsEnum.DISABLEAUTOMATICREFRESH);
});

// Bookmark History
// -------------------------------------------------------------
const checkboxRandomizeHistory = document.getElementById("randomizeHistory");
checkboxRandomizeHistory.addEventListener("change", function () {
  saveSettings(settingsEnum.RANDOMIZEHISTORY);
});

// Context Options
// -------------------------------------------------------------
const checkboxContextMenu = document.getElementById("showContextMenu");
checkboxContextMenu.addEventListener("change", function () {
  saveSettings(settingsEnum.CONTEXTMENU);
});

const checkboxContextOpenCountMenu = document.getElementById("showContextOpenCountMenu");
checkboxContextOpenCountMenu.addEventListener("change", function () {
  saveSettings(settingsEnum.CONTEXTOPENCOUNT);
});

// Helper Options
// -------------------------------------------------------------
const checkboxActionNotice = document.getElementById("showActionNotice");
checkboxActionNotice.addEventListener("change", function () {
  saveSettings(settingsEnum.SHOWACTIONNOTICE);
});

// Bookmark Option
// -------------------------------------------------------------
const bookmarkGroups = document.getElementById("bookmark-groups");
const addBookmarkGroup = document.getElementById("action-add-group");
const editBookmarkGroup = document.getElementById("action-edit-group");
const deleteBookmarkGroup = document.getElementById("action-delete-group");
let previousSelectedGroup = "nothing";

bookmarkGroups.addEventListener("change", function () {
  const selected = bookmarkGroups.options[bookmarkGroups.selectedIndex].value;
  editBookmarkGroup.disabled = selected === "default";
  deleteBookmarkGroup.disabled = selected === "default";

  if (selected !== previousSelectedGroup) {
    previousSelectedGroup = selected;

    loadSelectedBookmarks(selected);
  }
});

addBookmarkGroup.addEventListener("click", function () {
  const name = prompt("Name of new bookmark group");
  if (name && name.trim() !== "") {
    const ticks = 621355968e9 + new Date().getTime() * 1e4;
    const hash = "bookmarks_" + (name + ticks.toString()).hashCode().toString();

    // Add new bookmark group to select dropdown
    // And select it
    const newOption = document.createElement("option");
    newOption.value = hash;
    newOption.text = name.trim();
    bookmarkGroups.add(newOption);
    bookmarkGroups.value = hash;

    const newGroupInfo = {
      name: name.trim(),
      id: hash.toString(),
      selected: [],
      reload: true,
    };

    bookmarkGroupSettings.push(newGroupInfo);

    saveBookmarks();

    // Deselect any checkboxes
    const allCheckboxes = document.getElementsByName("selected-folder");
    for (let i = 0, n = allCheckboxes.length; i < n; i++) {
      allCheckboxes[i].checked = false;
    }

    // Enable buttons
    editBookmarkGroup.disabled = false;
    deleteBookmarkGroup.disabled = false;
  }
});

editBookmarkGroup.addEventListener("click", function () {
  const selected = bookmarkGroups.options[bookmarkGroups.selectedIndex].value;
  const text = bookmarkGroups.options[bookmarkGroups.selectedIndex].text;

  if (selected !== "default") {
    const nameEdit = prompt("Edit name of bookmark group", text);
    if (nameEdit && nameEdit.trim() !== "") {
      const editGroupInfo = bookmarkGroupSettings.find((obj) => {
        return obj.id === selected;
      });

      editGroupInfo.name = nameEdit.trim();
      saveBookmarks();

      bookmarkGroups.options[bookmarkGroups.selectedIndex].textContent = nameEdit;
    }
  }
});

deleteBookmarkGroup.addEventListener("click", function () {
  const selected = bookmarkGroups.options[bookmarkGroups.selectedIndex].value;

  if (selected !== "default") {
    if (confirm("Please confirm you want to delete this group")) {
      for (let i = 0; i < bookmarkGroupSettings.length; i++) {
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
      bookmarkGroups.value = "default";

      // Disable buttons
      editBookmarkGroup.disabled = true;
      deleteBookmarkGroup.disabled = true;

      // Remove from options
      for (let i = 0; i < bookmarkGroups.options.length; i++) {
        if (bookmarkGroups.options[i].value === selected) {
          bookmarkGroups.remove(i);
          break;
        }
      }

      loadSelectedBookmarks("default");
    }
  }
});

async function saveSettings(option) {
  if (loading === false) {
    switch (option) {
      case settingsEnum.RANDOMIZEMETHOD:
        let randomOption = "default";
        if (document.getElementById("randomoption-bybookmark").checked) {
          randomOption = "bybookmark";
        } else if (document.getElementById("randomoption-alphabetical").checked) {
          randomOption = "alphabetical";
        }

        browser.storage.sync.set({
          randomOption: randomOption,
        });

        pluginSettings.randomOption = randomOption;
        await resetReloadOnGroups("randomizeMethodChanged");
        break;

      case settingsEnum.TABACTIVE:
        browser.storage.sync.set({
          setActive: document.getElementById("activeoption").checked,
        });
        break;

      case settingsEnum.TABOPTION:
        let tabOption = "default";
        if (document.getElementById("openoption-new").checked) {
          tabOption = "newTab";
        } else if (document.getElementById("openoption-current").checked) {
          tabOption = "currentTab";
        }

        browser.storage.sync.set({
          tabOption: tabOption,
        });
        break;

      case settingsEnum.DISABLEAUTOMATICREFRESH:
        disableAutomaticRefresh = document.getElementById("disableAutomaticRefresh").checked;

        browser.storage.sync.set({
          disableAutomaticRefresh: disableAutomaticRefresh,
        });
        break;

      case settingsEnum.FILTERS:
        filterUrls = document.getElementById("filter-urls").value;

        await browser.storage.sync.set({
          filters: filterUrls,
        });

        await resetReloadOnGroups("filters");
        break;

      case settingsEnum.RANDOMIZEHISTORY:
        randomizedHistoryTracking = document.getElementById("randomizeHistory").checked;

        browser.storage.sync.set({
          randomizeHistory: randomizedHistoryTracking,
        });

        document.getElementById("history-list-wrapper").style.display = randomizedHistoryTracking ? "block" : "none";

        if (!randomizedHistoryTracking) {
          browser.storage.local.remove("randomized-history");
          loadRandomizeHistory([]);
        }
        break;

      case settingsEnum.CONTEXTMENU:
        browser.storage.sync.set({
          showContextMenu: document.getElementById("showContextMenu").checked,
        });
        loadContextMenus();
        break;

      case settingsEnum.CONTEXTOPENCOUNT:
        browser.storage.sync.set({
          showContextOpenCountMenu: document.getElementById("showContextOpenCountMenu").checked,
        });
        loadContextMenus();
        break;

      case settingsEnum.SHOWACTIONNOTICE:
        browser.storage.sync.set({
          showActionNotice: document.getElementById("showActionNotice").checked,
        });
        break;
    }

    showSavedMessage();
  }
}

async function resetReloadOnGroups(source) {
  // Bookmarks shuffle method was changed, if it's bybookmark or alphabetical
  // Set all bookmark groups to reload
  const userSyncOptions = await browser.storage.sync.get();
  if (userSyncOptions.groups) {
    const userBookmarkGroups = userSyncOptions.groups;

    for (let i = 0; i < userBookmarkGroups.length; i++) {
      // Force reload of bookmarks in storage
      userBookmarkGroups[i].reload = true;

      // Reset the selected group index back to zero
      const groupIndexName = userBookmarkGroups[i].id + "_index";
      browser.storage.local.set({
        [groupIndexName]: 0,
      });
    }

    browser.storage.sync.set({
      groups: userBookmarkGroups,
    });

    preloadBookmarksIntoLocalStorage(source);
  }
}

function showSavedMessage() {
  document.getElementById("save-message").style.display = "block";
  setTimeout(function () {
    document.getElementById("save-message").style.display = "none";
  }, 1500);
}

async function loadSavedOptions() {
  const syncRes = await browser.storage.sync.get();

  if (syncRes.randomOption === "bybookmark") {
    document.getElementById("randomoption-bybookmark").checked = true;
    randomizeMethod = "bybookmark";
  } else if (syncRes.randomOption === "alphabetical") {
    document.getElementById("randomoption-alphabetical").checked = true;
    randomizeMethod = "alphabetical";
  }

  document.getElementById("activeoption").checked = syncRes.setActive ?? true;

  if (syncRes.tabOption === "newTab") {
    document.getElementById("openoption-new").checked = true;
  } else if (syncRes.tabOption === "currentTab") {
    document.getElementById("openoption-current").checked = true;
  }

  document.getElementById("filter-urls").value = syncRes.filters ?? "";

  document.getElementById("disableAutomaticRefresh").checked = syncRes.disableAutomaticRefresh;

  document.getElementById("randomizeHistory").checked = syncRes.randomizeHistory;
  randomizedHistoryTracking = syncRes.randomizeHistory;
  document.getElementById("history-list-wrapper").style.display = randomizedHistoryTracking ? "block" : "none";
  if (randomizedHistoryTracking) {
    const storageCollection = await browser.storage.local.get("randomized-history");
    const historyCollection = Object.hasOwn(storageCollection, "randomized-history") ? JSON.parse(storageCollection["randomized-history"]) : [];
    loadRandomizeHistory(historyCollection);
  }

  document.getElementById("showContextMenu").checked = syncRes.showContextMenu;
  document.getElementById("showContextOpenCountMenu").checked = syncRes.showContextOpenCountMenu;
  document.getElementById("showActionNotice").checked = syncRes.showActionNotice;

  // Port over selectedFolders to groups json
  if (syncRes.selectedFolders && syncRes.selectedFolders.length) {
    bookmarkGroupSettings = changeToGroups(syncRes.selectedFolders);
  } else if (syncRes.groups) {
    bookmarkGroupSettings = syncRes.groups;
  }

  // Load bookmark groups
  bookmarkGroupSettings.sort(compareBookmarkGroup);
  for (let i = 0; i < bookmarkGroupSettings.length; i++) {
    if (bookmarkGroupSettings[i].id !== "default") {
      const newOption = document.createElement("option");
      newOption.value = bookmarkGroupSettings[i].id;
      newOption.text = bookmarkGroupSettings[i].name;
      bookmarkGroups.add(newOption);
    }
  }

  loadSelectedBookmarks("default");

  loading = false;
}

function selectCheckbox(checkbox) {
  const currentGroupID = bookmarkGroups.options[bookmarkGroups.selectedIndex].value;

  const selectedGroup = bookmarkGroupSettings.find((obj) => {
    return obj.id === currentGroupID;
  });

  if (selectedGroup) {
    if (selectedGroup.selected.filter((e) => e === checkbox.value).length > 0) {
      if (checkbox.checked === false) {
        // Remove it from the bookmarks
        const bookmarkIndex = selectedGroup.selected.indexOf(checkbox.value);
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
  const currentGroupID = bookmarkGroups.options[bookmarkGroups.selectedIndex].value;

  const selectedGroup = bookmarkGroupSettings.find((obj) => {
    return obj.id === currentGroupID;
  });

  if (selectedGroup) {
    const childCheckboxes = document.body.querySelectorAll('[data-parent="' + bookmarkId + '"]');
    for (let i = 0, n = childCheckboxes.length; i < n; i++) {
      childCheckboxes[i].checked = true;

      if (!selectedGroup.selected.includes(childCheckboxes[i].value)) {
        selectedGroup.selected.push(childCheckboxes[i].value);
      }
    }

    selectedGroup.reload = true;
    saveBookmarks();
  }
}

function loadSelectedBookmarks(groupID) {
  // Deselect all the checkboxes
  const allCheckboxes = document.getElementsByName("selected-folder");
  for (let i = 0, n = allCheckboxes.length; i < n; i++) {
    allCheckboxes[i].checked = false;
  }

  // Load bookmark group selected options
  const groupInfo = bookmarkGroupSettings.find((obj) => {
    return obj.id === groupID;
  });

  if (groupInfo) {
    for (let i = 0; i < groupInfo.selected.length; i++) {
      if (document.getElementById(groupInfo.selected[i]) !== null) {
        document.getElementById(groupInfo.selected[i]).checked = true;
      }
    }
  }
}

function options_processBookmarks(bookmarkItem, indent, parentID) {
  if (bookmarkItem.type === "folder" && bookmarkItem.title !== "") {
    let countOfBookmarks = 0;
    for (let i = 0; i < bookmarkItem.children.length; i++) {
      if (bookmarkItem.children[i].type === "bookmark") countOfBookmarks++;
    }

    const tbody = document.getElementById("bookmarks-folders");
    const tr = document.createElement("tr");

    const tdInput = document.createElement("td");
    tdInput.style.textAlign = "center";

    const tdCheckbox = document.createElement("input");
    tdCheckbox.type = "checkbox";
    tdCheckbox.name = "selected-folder";
    tdCheckbox.value = bookmarkItem.id;
    tdCheckbox.id = bookmarkItem.id;
    tdCheckbox.setAttribute("data-parent", parentID);

    tdCheckbox.addEventListener("click", function () {
      selectCheckbox(this);
    });
    tdInput.appendChild(tdCheckbox);
    tr.appendChild(tdInput);

    const tdInfo = document.createElement("td");

    const labelTitle = document.createElement("label");
    labelTitle.htmlFor = bookmarkItem.id;
    labelTitle.appendChild(document.createTextNode(makeIndent(indent) + " " + escapeHTML(bookmarkItem.title)));

    if (indent === 0) {
      labelTitle.style.fontWeight = "bold";
    }
    tdInfo.appendChild(labelTitle);

    if (bookmarkItem.children) {
      let showToggle = false;

      for (let i = 0; i < bookmarkItem.children.length; i++) {
        if (bookmarkItem.children[i].type === "folder") {
          showToggle = true;
          break;
        }
      }

      if (showToggle) {
        const btnSelectChildren = document.createElement("button");
        btnSelectChildren.textContent = "Select direct sub-folders";
        btnSelectChildren.style.fontSize = "12px";
        btnSelectChildren.style.color = "#555";
        btnSelectChildren.style.float = "right";
        btnSelectChildren.style.marginTop = "5px";
        btnSelectChildren.type = "button";

        btnSelectChildren.addEventListener("click", function () {
          selectChildren(bookmarkItem.id);
        });

        tdInfo.appendChild(btnSelectChildren);
      }
    }

    tr.appendChild(tdInfo);

    const tdCount = document.createElement("td");
    tdCount.style.textAlign = "right";
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
}

function makeIndent(indentLength) {
  //return ' &nbsp; &nbsp; &nbsp; '.repeat(indentLength);
  return " \u00A0\u00A0\u00A0\u00A0 ".repeat(indentLength);
}

function escapeHTML(str) {
  return str.replace(/[&"'<>]/g, (m) => replacements[m]);
}

function saveBookmarks() {
  browser.storage.sync.set({
    groups: bookmarkGroupSettings,
  });

  showSavedMessage();
}

async function loadUsedSpaceSize() {
  const gettingSpace = await browser.storage.sync.getBytesInUse(null);
  document.getElementById("used-storage-sync").appendChild(document.createTextNode(gettingSpace));
}

async function loadRandomizeHistory(items) {
  const listContainer = document.getElementById("randomize-history-list");
  listContainer.innerHTML = "";

  // Need to handle the list when a user deletes a bookmark
  const bookmarkIds = items.map((item) => item.bookmark?.id);

  const bookmarks = [];

  for (const id of bookmarkIds) {
    try {
      const bookmarkInfo = await browser.bookmarks.get(id);
      bookmarks.push(bookmarkInfo[0]);
    } catch {
      // Bookmark was deleted — skip it
    }
  }

  // No items found
  document.getElementById("history-list-none").style.display = bookmarks.length === 0 ? "block" : "none";

  for (const item of items) {
    if (bookmarks.some((bm) => bm.id === item.bookmark.id)) {
      const listItem = document.createElement("li");
      listItem.className = "list-group-item";

      const path = await getBookmarkPath(item.bookmark.id);

      const linkElement = document.createElement("a");
      linkElement.href = item.bookmark.url;
      linkElement.target = "_blank";
      linkElement.className = "fw-bold";
      linkElement.textContent = item.bookmark.title;
      listItem.appendChild(linkElement);

      listItem.appendChild(document.createElement("br"));

      const savePathSmall = document.createElement("small");
      savePathSmall.textContent = `Save Path: ${path}`;
      listItem.appendChild(savePathSmall);

      listItem.appendChild(document.createElement("br"));

      const dateRandomizedSmall = document.createElement("small");
      dateRandomizedSmall.textContent = `Date Randomized: ${new Date(item.dateRandomized).toLocaleString()}`;
      listItem.appendChild(dateRandomizedSmall);

      listContainer.appendChild(listItem);
    }
  }
}

async function setup() {
  const bookmarksTree = await browser.bookmarks.getTree();
  options_processBookmarks(bookmarksTree[0], 0, "root");
  await loadSavedOptions();
}

document.addEventListener("DOMContentLoaded", setup);

/**
 * Watches for changes to the randomized history local storage and updates
 * the listing of randomized history
 */
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes["randomized-history"] && randomizedHistoryTracking) {
    const historyArray = JSON.parse(changes["randomized-history"].newValue);
    loadRandomizeHistory(historyArray);
  }
});

// Accordion
document.querySelectorAll(".accordion-button").forEach((button) => {
  button.addEventListener("click", function () {
    // Identify the target collapse element (from data-bs-target)
    const collapseId = button.getAttribute("data-bs-target");
    const collapseEl = document.querySelector(collapseId);

    // If we want to close other open accordions in the same group:
    const parentSelector = collapseEl.getAttribute("data-bs-parent");
    if (parentSelector) {
      // Close any other .show elements under the same parent
      const parentEl = document.querySelector(parentSelector);
      parentEl.querySelectorAll(".accordion-collapse.show").forEach((openEl) => {
        if (openEl !== collapseEl) {
          openEl.classList.remove("show");
          // Mark the corresponding button as collapsed
          parentEl.querySelector(`[data-bs-target="#${openEl.id}"]`).classList.add("collapsed");
          parentEl.querySelector(`[data-bs-target="#${openEl.id}"]`).setAttribute("aria-expanded", "false");
        }
      });
    }

    // Toggle this one
    collapseEl.classList.toggle("show");
    button.classList.toggle("collapsed");

    // Update aria-expanded attribute
    const isExpanded = !button.classList.contains("collapsed");
    button.setAttribute("aria-expanded", isExpanded.toString());
  });
});
