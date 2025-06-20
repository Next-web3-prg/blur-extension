// popup.js
// Handles popup UI for toggling blur and adjusting blur amount
const toggle = document.getElementById("toggleBlur");
const range = document.getElementById("blurRange");
const blurValue = document.getElementById("blurValue");
const toggleVideo = document.getElementById("toggleVideo");
const toggleCanvas = document.getElementById("toggleCanvas");
const toggleBgImage = document.getElementById("toggleBgImage");

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
  ["enabled", "blur", "blurVideo", "blurCanvas", "blurBgImage"],
  ({
    enabled = false,
    blur = 0,
    blurVideo = true,
    blurCanvas = true,
    blurBgImage = true,
  }) => {
    toggle.checked = enabled;
    range.value = blur;
    blurValue.textContent = `${blur}%`;
    toggleVideo.checked = blurVideo;
    toggleCanvas.checked = blurCanvas;
    toggleBgImage.checked = blurBgImage;
  }
);

toggle.addEventListener("change", () => {
  chrome.storage.sync.set({ enabled: toggle.checked }, sendUpdate);
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

toggleVideo.addEventListener("change", () => {
  chrome.storage.sync.set(
    { enabled: toggle.checked, blurVideo: toggleVideo.checked },
    sendUpdate
  );
});
toggleCanvas.addEventListener("change", () => {
  chrome.storage.sync.set(
    { enabled: toggle.checked, blurCanvas: toggleCanvas.checked },
    sendUpdate
  );
});
toggleBgImage.addEventListener("change", () => {
  chrome.storage.sync.set(
    { enabled: toggle.checked, blurBgImage: toggleBgImage.checked },
    sendUpdate
  );
});
