chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-blur") {
    chrome.storage.sync.get(["enabled", "blur"], ({ enabled }) => {
      const newState = !enabled;
      chrome.storage.sync.set({ enabled: newState });

      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          chrome.tabs.sendMessage(tab.id, {
            action: "applyBlurFromHotkey",
            enabled: newState,
          });
        }
      });
    });
  }
});