function setIcon(enabled) {
  chrome.action.setIcon({
    path: enabled
      ? {
          "16": "icons/enabled-16.png",
          "32": "icons/enabled-32.png",
          "48": "icons/enabled-48.png",
          "128": "icons/enabled-128.png",
        }
      : {
          "16": "icons/disabled-16.png",
          "32": "icons/disabled-32.png",
          "48": "icons/disabled-48.png",
          "128": "icons/disabled-128.png",
        },
  });
}

function syncIconFromStorage() {
  chrome.storage.sync.get(["enabled"], ({ enabled = false }) => {
    setIcon(enabled);
  });
}

let lastToggleAt = 0;

function toggleBlur() {
  const now = Date.now();
  // Dedupe when both content-script Alt+L and chrome.commands fire
  if (now - lastToggleAt < 300) return;
  lastToggleAt = now;

  chrome.storage.sync.get(["enabled"], ({ enabled = false }) => {
    const newState = !enabled;
    chrome.storage.sync.set({ enabled: newState }, () => setIcon(newState));
  });
}

function isInjectableUrl(url) {
  if (!url) return false;
  return !(
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:") ||
    url.startsWith("devtools://") ||
    url.startsWith("https://chrome.google.com/webstore") ||
    url.startsWith("https://chromewebstore.google.com")
  );
}

/** Chrome does not auto-reinject content scripts after Reload — do it ourselves. */
async function reinjectIntoOpenTabs() {
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({});
  } catch (_) {
    return;
  }

  await Promise.all(
    tabs.map(async (tab) => {
      if (!tab.id || !isInjectableUrl(tab.url)) return;

      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          files: ["page-hook.js"],
          world: "MAIN",
          injectImmediately: true,
        });
      } catch (_) {}

      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          files: ["content.js"],
          injectImmediately: true,
        });
      } catch (_) {}
    })
  );
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "setIcon") {
    setIcon(!!msg.enabled);
  }
  if (msg.action === "toggleBlur") {
    toggleBlur();
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-blur") {
    toggleBlur();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  syncIconFromStorage();
  reinjectIntoOpenTabs();
});

chrome.runtime.onStartup.addListener(syncIconFromStorage);
syncIconFromStorage();
