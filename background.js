// background.js
// Listens for the hotkey command and toggles blur state across all tabs
chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-blur") {
    // Get the current 'enabled' state from storage
    chrome.storage.sync.get("enabled", ({ enabled }) => {
      const newState = !enabled;
      // Update the 'enabled' state in storage
      chrome.storage.sync.set({ enabled: newState });

      // Notify all tabs to apply or remove blur
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          chrome.tabs.sendMessage(tab.id, {
            action: "applyBlurFromHotkey",
            enabled: newState,
          });
        });
      });
    });
  }
});
