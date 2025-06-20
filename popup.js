// popup.js
// Handles popup UI for toggling blur and adjusting blur amount
const toggle = document.getElementById("toggleBlur");
const range = document.getElementById("blurRange");
const blurValue = document.getElementById("blurValue");

function sendUpdate() {
  chrome.storage.sync.get(["enabled", "blur"], (data) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs.length) return;
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "applyBlur",
        enabled: data.enabled,
        blur: data.blur,
      });
    });
  });
}

// Initialize popup state
chrome.storage.sync.get(
  ["enabled", "blur"],
  ({ enabled = false, blur = 0 }) => {
    toggle.checked = enabled;
    range.value = blur;
    blurValue.textContent = `${blur}%`;
  }
);

toggle.addEventListener("change", () => {
  chrome.storage.sync.set({ enabled: toggle.checked }, () => {
    sendUpdate();
    chrome.action.setIcon({
      path: toggle.checked
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
  });
});

let blurSaveTimeout = null;
let lastBlurValue = null;

range.addEventListener("input", () => {
  const val = parseInt(range.value);
  blurValue.textContent = `${val}%`;
  lastBlurValue = val;
  if (blurSaveTimeout) clearTimeout(blurSaveTimeout);
  blurSaveTimeout = setTimeout(() => {
    chrome.storage.sync.set({ blur: lastBlurValue }, sendUpdate);
    blurSaveTimeout = null;
  }, 100);
});