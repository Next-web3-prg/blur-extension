// popup.js
// Handles popup UI for toggling blur and adjusting blur amount
const toggle = document.getElementById("toggleBlur");
const range = document.getElementById("blurRange");
const blurValue = document.getElementById("blurValue");
const toggleVideo = document.getElementById("toggleVideo");
const toggleCanvas = document.getElementById("toggleCanvas");
const toggleBgImage = document.getElementById("toggleBgImage");
const whitelistList = document.getElementById("whitelistList");
const addRemoveBtn = document.getElementById("addRemoveBtn");

function sendUpdate(forceEnabled) {
  chrome.storage.sync.get(["enabled", "blur", "whitelist"], (data) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs.length) return;
      // Check if current site is in whitelist
      let host = '';
      try {
        host = new URL(tabs[0].url).hostname;
      } catch (e) { }
      const whitelist = Array.isArray(data.whitelist) ? data.whitelist : [];
      const isWhitelisted = whitelist.includes(host) || whitelist.some(site => host.endsWith('.' + site));
      const shouldBlur = typeof forceEnabled === 'boolean' ? forceEnabled : (data.enabled && !isWhitelisted);
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "applyBlur",
        enabled: shouldBlur,
        blur: data.blur,
      });
    });
  });
}

// Initialize popup state
chrome.storage.sync.get(
  ["enabled", "blur", "enableVideo", "enableCanvas", "enableBgImage"],
  ({
    enabled = false,
    blur = 0,
    enableVideo = true,
    enableCanvas = true,
    enableBgImage = true,
  }) => {
    toggle.checked = enabled;
    range.value = blur;
    blurValue.textContent = `${blur}%`;
    toggleVideo.checked = enableVideo;
    toggleCanvas.checked = enableCanvas;
    toggleBgImage.checked = enableBgImage;
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

toggleVideo.addEventListener("change", () => {
  chrome.storage.sync.set(
    { enabled: toggle.checked, enableVideo: toggleVideo.checked },
    sendUpdate
  );
});
toggleCanvas.addEventListener("change", () => {
  chrome.storage.sync.set(
    { enabled: toggle.checked, enableCanvas: toggleCanvas.checked },
    sendUpdate
  );
});
toggleBgImage.addEventListener("change", () => {
  chrome.storage.sync.set(
    { enabled: toggle.checked, enableBgImage: toggleBgImage.checked },
    sendUpdate
  );
});

function renderWhitelistBox(currentHost) {
  chrome.storage.sync.get(["whitelist"], ({ whitelist = [] }) => {
    const list = Array.isArray(whitelist) ? whitelist : [];
    whitelistList.innerHTML = "";
    
    if (list.length === 0) {
      const emptyDiv = document.createElement("div");
      emptyDiv.className = "whitelist-empty";
      emptyDiv.textContent = "No sites in whitelist";
      whitelistList.appendChild(emptyDiv);
    } else {
      list.forEach((site) => {
        const siteDiv = document.createElement("div");
        siteDiv.className = "whitelist-item";
        siteDiv.textContent = site;
        whitelistList.appendChild(siteDiv);
      });
    }
    
    // Update button text
    if (currentHost) {
      const inList = list.includes(currentHost) || list.some(site => currentHost.endsWith('.' + site));
      addRemoveBtn.textContent = inList ? "Remove Current Site" : "Add Current Site";
      addRemoveBtn.className = inList ? "whitelist-btn remove" : "whitelist-btn add";
    }
  });
}

// Get current tab's host and wire up add/remove
let currentHost = "";
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (!tabs.length) return;
  try {
    const url = new URL(tabs[0].url);
    currentHost = url.hostname;
    renderWhitelistBox(currentHost);
    addRemoveBtn.onclick = () => {
      chrome.storage.sync.get(["whitelist"], ({ whitelist = [] }) => {
        let list = Array.isArray(whitelist) ? whitelist : [];
        const inList = list.includes(currentHost) || list.some(site => currentHost.endsWith('.' + site));
        let forceEnabled = true;
        if (inList) {
          list = list.filter(site => site && site !== currentHost && !currentHost.endsWith('.' + site));
          forceEnabled = true; // Blur should be applied after removal
        } else {
          list.push(currentHost);
          forceEnabled = false; // Blur should be removed after adding to whitelist
        }
        chrome.storage.sync.set({ whitelist: list }, () => {
          renderWhitelistBox(currentHost);
          sendUpdate(forceEnabled);
        });
      });
    };
  } catch (e) {
    addRemoveBtn.disabled = true;
    addRemoveBtn.textContent = 'Unable to determine site.';
  }
});
