// popup.js
// Handles popup UI for toggling blur and adjusting blur amount
const toggle = document.getElementById("toggleBlur");
const range = document.getElementById("blurRange");
const blurValue = document.getElementById("blurValue");
const toggleVideo = document.getElementById("toggleVideo");
const toggleCanvas = document.getElementById("toggleCanvas");
const toggleBgImage = document.getElementById("toggleBgImage");

function sendUpdate(forceEnabled) {
  chrome.storage.sync.get(["enabled", "blur", "whitelist"], (data) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs.length) return;
      // Check if current site is in whitelist
      let host = '';
      try {
        host = new URL(tabs[0].url).hostname;
      } catch (e) {}
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

// --- Whitelist UI ---
const whitelistSection = document.createElement("div");
whitelistSection.style.margin = "10px 0";
const whitelistLabel = document.createElement("div");
whitelistLabel.textContent = "Whitelist:";
whitelistLabel.style.fontWeight = "bold";
whitelistSection.appendChild(whitelistLabel);

const whitelistList = document.createElement("select");
whitelistList.id = "whitelistList";
whitelistList.size = 4;
whitelistList.style.width = "100%";
whitelistSection.appendChild(whitelistList);

const addRemoveBtn = document.createElement("button");
addRemoveBtn.textContent = "Add/Remove Current Site";
addRemoveBtn.style.width = "100%";
addRemoveBtn.style.marginTop = "4px";
whitelistSection.appendChild(addRemoveBtn);

document.body.appendChild(whitelistSection);

function renderWhitelistBox(currentHost) {
  chrome.storage.sync.get(["whitelist"], ({ whitelist = [] }) => {
    const list = Array.isArray(whitelist) ? whitelist : [];
    whitelistList.innerHTML = "";
    list.forEach((site) => {
      const opt = document.createElement("option");
      opt.value = site;
      opt.textContent = site;
      whitelistList.appendChild(opt);
    });
    // Update button text
    if (currentHost) {
      const inList = list.includes(currentHost) || list.some(site => currentHost.endsWith('.' + site));
      addRemoveBtn.textContent = inList ? "Remove Current Site" : "Add Current Site";
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
