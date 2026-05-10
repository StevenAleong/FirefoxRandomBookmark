const pluginSettings = {
  randomOption: "default",
  tabOption: "default",
  tabSetActive: true,
  disableAutomaticRefresh: false,
  randomizeHistory: false,
  maxHistory: 10,
  showContextMenu: false,
  showContextOpenCountMenu: false,
  contextMenuName: "randombookmarkContext",
  loadingGroups: false,
  loadingBookmarks: false,
  initialLoading: true,
  selectedGroup: "default",
  isDebugging: false,
  showActionNotice: false,
  filters: [],
};

const sessionInfo = {
  currentTabId: 0,
  loadingDateTimeStarted: null,
};

async function loadUserSettings() {
  logToDebugConsole("loadUserSettings");

  const resSync = await browser.storage.sync.get();
  let randomOpt = "default";
  if (resSync.randomOption === "bybookmark") {
    randomOpt = "bybookmark";
  } else if (resSync.randomOption === "alphabetical") {
    randomOpt = "alphabetical";
  }

  pluginSettings.randomOption = randomOpt;
  pluginSettings.tabSetActive = resSync.setActive ?? true;
  pluginSettings.disableAutomaticRefresh = resSync.disableAutomaticRefresh ?? false;
  pluginSettings.randomizeHistory = resSync.randomizeHistory ?? false;
  pluginSettings.showContextMenu = resSync.showContextMenu ?? false;
  pluginSettings.showContextOpenCountMenu = resSync.showContextOpenCountMenu ?? false;
  pluginSettings.showActionNotice = resSync.showActionNotice ?? false;

  const savedFilters = resSync.filters ?? null;
  const splitFilters = (savedFilters ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("//"));
  pluginSettings.filters = splitFilters;

  if (resSync.tabOption === "newTab" || resSync.tabOption === "currentTab") {
    pluginSettings.tabOption = resSync.tabOption;
  } else {
    pluginSettings.tabOption = "default";
  }

  if (resSync.selectedFolders) {
    // Updating from an older install version
    changeToGroups(resSync.selectedFolders);
  } else if (typeof resSync.groups === "undefined") {
    // New install, set the default group to everything
    changeToGroups([]);
  }
}

function changeToGroups(selectedFolders) {
  logToDebugConsole("changeToGroups");

  const defaultBookmarks = [
    {
      name: "Default",
      id: "default",
      selected: selectedFolders,
      reload: true,
      index: 0,
    },
  ];

  browser.storage.sync.set({
    groups: defaultBookmarks,
  });

  browser.storage.sync.remove("selectedFolders");
  browser.storage.sync.remove("reloadBookmarks");

  return defaultBookmarks;
}

async function loadContextMenus() {
  logToDebugConsole("loadContextMenus");

  removeContextOption(pluginSettings.contextMenuName);
  if (pluginSettings.showContextMenu) {
    await browser.menus.create({
      id: pluginSettings.contextMenuName,
      title: "Load Random Bookmark",
      contexts: ["bookmark"],
    });
  }

  for (let i = 2; i <= 10; i++) {
    removeContextOption(`open-random-${i}`);
  }
  if (pluginSettings.showContextOpenCountMenu) {
    for (let i = 2; i <= 10; i++) {
      await browser.menus.create({
        id: `open-random-${i}`,
        title: "Load " + i + " Random Bookmarks",
        contexts: ["bookmark"],
      });
    }
  }
}

/// Set up the interactive icon action button at the top of the browser
/// When there's more than 5 bookmark groups, it'll group them into it's own dropdown for the right click action
async function loadBrowserActionGroups() {
  logToDebugConsole("loadBrowserActionGroups");

  const theme = await browser.theme.getCurrent();
  const userAgent = navigator.userAgent.toLowerCase();
  const isDarkTheme = (theme?.properties?.color_scheme || userAgent.includes("ubuntu")) ?? false;

  const userLocalStorage = await browser.storage.local.get();
  const userSyncOptions = await browser.storage.sync.get();

  if (userSyncOptions.groups) {
    const bookmarkGroupSettings = userSyncOptions.groups;
    bookmarkGroupSettings.sort(compareBookmarkGroup);

    const groupExists = bookmarkGroupSettings.find((obj) => {
      return obj.id === pluginSettings.selectedGroup;
    });

    if (!groupExists) {
      // Group no longer exists, set it back to default
      pluginSettings.selectedGroup = "default";
      browser.storage.local.set({
        activeGroup: "default",
      });
    }

    let parentId;

    if (bookmarkGroupSettings.length > 5) {
      removeContextOption("options-groupparent");

      // Add the bookmark groups menu option
      await browser.menus.create({
        id: "options-groupparent",
        type: "normal",
        title: "Bookmark Groups",
        contexts: ["browser_action"],
      });

      parentId = "options-groupparent";
    }

    // Add the default group
    createContextOption("default", "Default", parentId);

    // Add the rest of the groups
    for (let i = 0; i < bookmarkGroupSettings.length; i++) {
      if (bookmarkGroupSettings[i].id !== "default") {
        createContextOption(bookmarkGroupSettings[i].id, bookmarkGroupSettings[i].name, parentId);
      }
    }
  } else {
    createContextOption("default", "Default");
  }

  removeContextOption("random-bookmark-options");
  await browser.menus.create({
    id: "random-bookmark-options",
    type: "normal",
    title: "Help",
    contexts: ["browser_action"],
    icons: {
      16: `icons/bookmark-star${isDarkTheme ? "-white" : ""}-16.png`,
      32: `icons/bookmark-star${isDarkTheme ? "-white" : ""}-32.png`,
    },
  });

  // Add a shortcut to the options page
  removeContextOption("options-page");
  await browser.menus.create({
    id: "options-page",
    type: "normal",
    title: "Random Bookmark Options",
    contexts: ["browser_action"],
    icons: {
      16: `icons/gear${isDarkTheme ? "-white" : ""}-16.png`,
      32: `icons/gear${isDarkTheme ? "-white" : ""}-32.png`,
    },
    parentId: "random-bookmark-options",
  });

  // Force cache reload of current group
  removeContextOption("refresh-cache");
  await browser.menus.create({
    id: "refresh-cache",
    type: "normal",
    title: "Force Group Cache Refresh",
    contexts: ["browser_action"],
    icons: {
      16: `icons/refresh${isDarkTheme ? "-white" : ""}-16.png`,
      32: `icons/refresh${isDarkTheme ? "-white" : ""}-32.png`,
    },
    parentId: "random-bookmark-options",
  });

  // Will be used to update and show the last path
  removeContextOption("last-bookmark-path");
  await browser.menus.create({
    id: "last-bookmark-path",
    type: "normal",
    title: "[Last Bookmark Path]",
    contexts: ["browser_action"],
    visible: false,
    icons: {
      16: `icons/asterisk${isDarkTheme ? "-white" : ""}-16.png`,
      32: `icons/asterisk${isDarkTheme ? "-white" : ""}-32.png`,
    },
    parentId: "random-bookmark-options",
  });

  // Add shortcut to plugin page on firefox add-ons
  removeContextOption("plugin-page");
  await browser.menus.create({
    id: "plugin-page",
    type: "normal",
    title: "Random Bookmark Add-on Info",
    contexts: ["browser_action"],
    icons: {
      16: `icons/globe${isDarkTheme ? "-white" : ""}-16.png`,
      32: `icons/globe${isDarkTheme ? "-white" : ""}-32.png`,
    },
    parentId: "random-bookmark-options",
  });

  // Check/preload the currently selected menu
  preloadBookmarksIntoLocalStorage("loadBrowserActionGroups");

  pluginSettings.loadingGroups = false;

  if (userLocalStorage.activeGroup) {
    pluginSettings.selectedGroup = userLocalStorage.activeGroup;
  }
}

async function removeContextOption(id) {
  logToDebugConsole("removeContextOption");

  try {
    await browser.menus.remove(id);
  } catch {
    // Failed, who knows
  }
}

async function createContextOption(id, name, parent) {
  logToDebugConsole("createContextOption");

  removeContextOption(id);

  const menuItem = {
    id: id,
    type: "radio",
    title: name,
    checked: id === pluginSettings.selectedGroup,
    contexts: ["browser_action"],
  };

  if (typeof parent !== "undefined" && parent !== "") {
    menuItem.parentId = parent;
  }

  await browser.menus.create(menuItem);
}

async function preloadBookmarksIntoLocalStorage(source) {
  logToDebugConsole("preloadBookmarksIntoLocalStorage", { source: source, pluginSettings: pluginSettings });

  if (pluginSettings.loadingBookmarks === false) {
    sessionInfo.loadingDateTimeStarted = Date.now();
    pluginSettings.loadingBookmarks = true;

    // Preload only the selected group.
    const userSyncOptions = await browser.storage.sync.get();

    const found = userSyncOptions.groups.filter((obj) => {
      return obj.id === pluginSettings.selectedGroup;
    });

    if (found.length) {
      const group = found[0];

      if (group.reload) {
        group.reload = false;

        loadBookmarksIntoLocalStorage(group.id, group.selected);

        const index = userSyncOptions.groups.findIndex((obj) => obj.id === pluginSettings.selectedGroup);
        userSyncOptions.groups[index] = group;

        browser.storage.sync.set({
          groups: userSyncOptions.groups,
        });
      } else {
        setTimeout(function () {
          finishedLoading();
        }, 250);

        sessionInfo.loadingDateTimeStarted = null;
      }
    } else {
      setTimeout(function () {
        finishedLoading();
      }, 250);

      sessionInfo.loadingDateTimeStarted = null;
    }
  }
}

function loadBookmarksIntoLocalStorage(id, folders) {
  logToDebugConsole("loadBookmarksIntoLocalStorage", { id: id, folders: folders });

  if (folders.length > 0) {
    const selectedPromises = [];

    // Selected Bookmarks
    for (let i = 0; i < folders.length; i++) {
      selectedPromises.push(browser.bookmarks.getChildren(folders[i]));
    }

    processBookmarkPromises(id, selectedPromises);
  } else {
    // All Bookmarks
    const allBookmarks = browser.bookmarks.getTree();
    const allPromises = [allBookmarks];

    processBookmarkPromises(id, allPromises);
  }
}

function processBookmarkPromises(id, promises) {
  logToDebugConsole("processBookmarkPromises", { id: id, promises: promises });

  Promise.allSettled(promises).then((results) => {
    let bookmarksToSave = [];

    results.forEach((result) => {
      logToDebugConsole("processBookmarkPromises Result", result);

      if (result.status === "fulfilled") {
        for (let i = 0; i < result.value.length; i++) {
          const r = processBookmarks(result.value[i], result.value[i].id === "root________");
          bookmarksToSave = bookmarksToSave.concat(r);
        }
      }
    });

    const uniqueBookmarks = bookmarksToSave.filter(function (elem, index, self) {
      return index === self.indexOf(elem);
    });

    if (pluginSettings.randomOption === "alphabetical") {
      uniqueBookmarks.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
    } else {
      Shuffle(uniqueBookmarks);
    }

    logToDebugConsole("Bookmarks to store", uniqueBookmarks);

    browser.storage.local.set({
      [id]: uniqueBookmarks.map((bookmark) => bookmark.id),
    });

    setTimeout(function () {
      finishedLoading();
    }, 250);
  });
}

function processBookmarks(bookmarkItem, goDeeper) {
  //logToDebugConsole('processBookmarks', { 'bookmarkItem': bookmarkItem, 'goDeeper': goDeeper });

  let bookmarksCollection = [];

  if (bookmarkItem.type === "folder") {
    const result = getBookmarks(bookmarkItem.children);
    bookmarksCollection = bookmarksCollection.concat(result);
  } else if (bookmarkItem.type === "bookmark") {
    if (allowAdd(bookmarkItem.url)) bookmarksCollection.push({ id: bookmarkItem.id, title: bookmarkItem.title });
  }

  if (bookmarkItem.children && goDeeper) {
    for (const child of bookmarkItem.children) {
      const result = processBookmarks(child, goDeeper);
      bookmarksCollection = bookmarksCollection.concat(result);
    }
  }

  return bookmarksCollection;
}

function getBookmarks(bookmarkFolder) {
  logToDebugConsole("getBookmarks", { bookmarkFolder: bookmarkFolder });

  const bookmarksCollection = [];
  if (typeof bookmarkFolder !== "undefined" && bookmarkFolder !== null)
    for (let i = 0; i < bookmarkFolder.length; i++) {
      if (bookmarkFolder[i].type === "bookmark") {
        const bookmarkItem = bookmarkFolder[i];
        if (allowAdd(bookmarkItem.url)) bookmarksCollection.push({ id: bookmarkItem.id, title: bookmarkItem.title });
      }
    }

  return bookmarksCollection;
}

function allowAdd(url) {
  let addBookmark = true;

  if (pluginSettings.filters.length > 0) {
    addBookmark = pluginSettings.filters.some((filter) => url.startsWith(filter)) === false;
  }

  return addBookmark;
}

function finishedLoading() {
  pluginSettings.loadingBookmarks = false;
  pluginSettings.initialLoading = false;
}

function onError(e) {
  console.error(e);
}

function logToDebugConsole(what, data) {
  if (pluginSettings.isDebugging) {
    console.log(what, data);
  }
}

async function getBookmarkPath(bookmarkId) {
  let path = [];
  let currentId = bookmarkId;

  while (currentId) {
    // Get the current bookmark or folder
    const [currentBookmark] = await browser.bookmarks.get(currentId);
    path.unshift(currentBookmark.title); // Add the title to the path
    currentId = currentBookmark.parentId; // Move to the parent
  }

  return path.slice(0, -1).filter(Boolean).join(" > ");
}
