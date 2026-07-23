// popup.js — blur controls, more options, current-site exception
const toggle = document.getElementById("toggleBlur");
const range = document.getElementById("blurRange");
const blurValue = document.getElementById("blurValue");
const toggleVideo = document.getElementById("toggleVideo");
const toggleCanvas = document.getElementById("toggleCanvas");
const toggleBgImage = document.getElementById("toggleBgImage");
const toggleSkipTiny = document.getElementById("toggleSkipTiny");
const addRemoveBtn = document.getElementById("addRemoveBtn");
const manageExceptionsBtn = document.getElementById("manageExceptionsBtn");
const statusPill = document.getElementById("statusPill");
const masterHint = document.getElementById("masterHint");
const headerHost = document.getElementById("headerHost");
const currentSiteLabel = document.getElementById("currentSiteLabel");
const siteChip = document.getElementById("siteChip");
const exceptionsLabel = document.getElementById("exceptionsLabel");
const moreToggle = document.getElementById("moreToggle");
const morePanel = document.getElementById("morePanel");
const moreHint = document.getElementById("moreHint");
const coverageHint = document.getElementById("coverageHint");
const coverageButtons = [
  document.getElementById("coverageAuto"),
  document.getElementById("coverageBalanced"),
  document.getElementById("coverageMaximum"),
];
let currentHost = "";

const COVERAGE_HINTS = {
  auto: "Recommended. Uses stronger coverage on complex apps like Adobe Firefly.",
  balanced: "Lighter on CPU. Best for everyday browsing.",
  maximum: "Strongest coverage for stubborn sites. Uses more CPU.",
};
const ICON_ENABLED = {
  "16": "icons/enabled-16.png",
  "32": "icons/enabled-32.png",
  "48": "icons/enabled-48.png",
  "128": "icons/enabled-128.png",
};
const ICON_DISABLED = {
  "16": "icons/disabled-16.png",
  "32": "icons/disabled-32.png",
  "48": "icons/disabled-48.png",
  "128": "icons/disabled-128.png",
};

function isWhitelisted(whitelist, host) {
  if (!host || !Array.isArray(whitelist)) return false;
  return (
    whitelist.includes(host) ||
    whitelist.some((site) => site && host.endsWith("." + site))
  );
}

function setSliderFill(val) {
  range.style.setProperty("--fill", `${val}%`);
}

function updateStatusUI(enabled, exempt) {
  document.body.classList.toggle("is-on", !!enabled);
  if (!enabled) {
    statusPill.textContent = "Off";
    masterHint.textContent = "Off on all sites";
  } else if (exempt) {
    statusPill.textContent = "Exempt";
    masterHint.textContent = "On — this site exempt";
  } else {
    statusPill.textContent = "On";
    masterHint.textContent = "Blurring this page";
  }
  siteChip.classList.toggle("is-exempt", !!exempt);
}

function refreshSiteStatus() {
  chrome.storage.sync.get(["enabled", "whitelist"], (data) => {
    const list = Array.isArray(data.whitelist) ? data.whitelist : [];
    const exempt = isWhitelisted(list, currentHost);
    updateStatusUI(!!data.enabled, exempt);
    updateExceptionControls(list);
  });
}

function updateExceptionControls(list) {
  const count = Array.isArray(list) ? list.length : 0;
  exceptionsLabel.textContent =
    count > 0 ? `Exceptions (${count})` : "Exceptions";

  if (!currentHost) {
    addRemoveBtn.disabled = true;
    return;
  }

  const inList = isWhitelisted(list, currentHost);
  addRemoveBtn.disabled = false;
  addRemoveBtn.textContent = inList
    ? "Remove site exception"
    : "Exempt this site";
  addRemoveBtn.className = inList
    ? "whitelist-btn remove"
    : "whitelist-btn add";
}

function sendUpdate() {
  chrome.storage.sync.get(["enabled", "blur", "whitelist"], (data) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs.length || !tabs[0].id) return;
      let host = "";
      try {
        host = new URL(tabs[0].url).hostname;
      } catch (_) {}
      const whitelist = Array.isArray(data.whitelist) ? data.whitelist : [];
      const shouldBlur = !!(data.enabled && !isWhitelisted(whitelist, host));
      chrome.tabs.sendMessage(
        tabs[0].id,
        {
          action: "applyBlur",
          enabled: shouldBlur,
          blur: data.blur ?? 0,
        },
        () => {
          void chrome.runtime.lastError;
        }
      );
    });
  });
}

function setCoverageModeUI(mode) {
  const next = mode === "balanced" || mode === "maximum" ? mode : "auto";
  coverageButtons.forEach((btn) => {
    if (!btn) return;
    const active = btn.dataset.mode === next;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });
  coverageHint.textContent = COVERAGE_HINTS[next];
}

function setMoreOpen(open) {
  moreToggle.setAttribute("aria-expanded", open ? "true" : "false");
  morePanel.classList.toggle("is-open", open);
  morePanel.hidden = !open;
  moreHint.textContent = open ? "Hide advanced settings" : "Video, canvas, coverage…";
}

moreToggle.addEventListener("click", () => {
  const open = moreToggle.getAttribute("aria-expanded") !== "true";
  setMoreOpen(open);
});

chrome.storage.sync.get(
  [
    "enabled",
    "blur",
    "enableVideo",
    "enableCanvas",
    "enableBgImage",
    "skipTinyImages",
    "coverageMode",
    "whitelist",
  ],
  ({
    enabled = false,
    blur = 0,
    enableVideo = true,
    enableCanvas = true,
    enableBgImage = true,
    skipTinyImages = true,
    coverageMode = "auto",
    whitelist = [],
  }) => {
    toggle.checked = enabled;
    range.value = blur;
    blurValue.textContent = `${blur}%`;
    setSliderFill(blur);
    toggleVideo.checked = enableVideo;
    toggleCanvas.checked = enableCanvas;
    toggleBgImage.checked = enableBgImage;
    toggleSkipTiny.checked = skipTinyImages;
    setCoverageModeUI(coverageMode);
    updateStatusUI(enabled, isWhitelisted(whitelist, currentHost));
    updateExceptionControls(whitelist);
  }
);

toggle.addEventListener("change", () => {
  chrome.storage.sync.set({ enabled: toggle.checked }, () => {
    sendUpdate();
    chrome.action.setIcon({
      path: toggle.checked ? ICON_ENABLED : ICON_DISABLED,
    });
    refreshSiteStatus();
  });
});

let blurSaveTimeout = null;
let lastBlurValue = null;

range.addEventListener("input", () => {
  const val = parseInt(range.value, 10);
  blurValue.textContent = `${val}%`;
  setSliderFill(val);
  lastBlurValue = val;
  if (blurSaveTimeout) clearTimeout(blurSaveTimeout);
  blurSaveTimeout = setTimeout(() => {
    chrome.storage.sync.set({ blur: lastBlurValue }, sendUpdate);
    blurSaveTimeout = null;
  }, 100);
});

window.addEventListener("pagehide", () => {
  if (blurSaveTimeout && lastBlurValue !== null) {
    clearTimeout(blurSaveTimeout);
    blurSaveTimeout = null;
    chrome.storage.sync.set({ blur: lastBlurValue });
  }
});

toggleVideo.addEventListener("change", () => {
  chrome.storage.sync.set({ enableVideo: toggleVideo.checked }, sendUpdate);
});
toggleCanvas.addEventListener("change", () => {
  chrome.storage.sync.set({ enableCanvas: toggleCanvas.checked }, sendUpdate);
});
toggleBgImage.addEventListener("change", () => {
  chrome.storage.sync.set({ enableBgImage: toggleBgImage.checked }, sendUpdate);
});
toggleSkipTiny.addEventListener("change", () => {
  chrome.storage.sync.set(
    { skipTinyImages: toggleSkipTiny.checked },
    sendUpdate
  );
});

coverageButtons.forEach((btn) => {
  if (!btn) return;
  btn.addEventListener("click", () => {
    const mode = btn.dataset.mode || "auto";
    setCoverageModeUI(mode);
    chrome.storage.sync.set({ coverageMode: mode }, sendUpdate);
  });
});

function applyEnabledToUI(enabled) {
  toggle.checked = !!enabled;
  chrome.action.setIcon({
    path: enabled ? ICON_ENABLED : ICON_DISABLED,
  });
  refreshSiteStatus();
}

function applyBlurToUI(blur) {
  const val = Math.max(0, Math.min(100, Number(blur) || 0));
  range.value = val;
  blurValue.textContent = `${val}%`;
  setSliderFill(val);
}

function adjustBlur(blur, direction) {
  let newBlur = Number(blur) || 0;
  if (direction === "increase") {
    if (newBlur <= 0) newBlur = 1;
    else if (newBlur >= 100) return blur;
    else if (newBlur < 5) newBlur += 1;
    else if (newBlur < 20) newBlur += Math.ceil(newBlur / 10);
    else if (newBlur < 50) newBlur += Math.ceil(newBlur / 5);
    else newBlur += Math.ceil(newBlur / 2);
  } else {
    if (newBlur <= 0) return blur;
    else if (newBlur <= 1) newBlur = 0;
    else if (newBlur <= 5) newBlur -= 1;
    else if (newBlur <= 20) newBlur -= Math.ceil(newBlur / 10);
    else if (newBlur <= 50) newBlur -= Math.ceil(newBlur / 5);
    else newBlur -= Math.ceil(newBlur / 2);
  }
  return Math.max(0, Math.min(100, newBlur));
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync") return;

  if (changes.enabled) {
    applyEnabledToUI(changes.enabled.newValue ?? false);
  }
  if (changes.blur) {
    applyBlurToUI(changes.blur.newValue ?? 0);
  }
  if (changes.enableVideo) {
    toggleVideo.checked = changes.enableVideo.newValue ?? true;
  }
  if (changes.enableCanvas) {
    toggleCanvas.checked = changes.enableCanvas.newValue ?? true;
  }
  if (changes.enableBgImage) {
    toggleBgImage.checked = changes.enableBgImage.newValue ?? true;
  }
  if (changes.skipTinyImages) {
    toggleSkipTiny.checked = changes.skipTinyImages.newValue ?? true;
  }
  if (changes.coverageMode) {
    setCoverageModeUI(changes.coverageMode.newValue || "auto");
  }
  if (changes.whitelist) {
    const list = Array.isArray(changes.whitelist.newValue)
      ? changes.whitelist.newValue
      : [];
    updateExceptionControls(list);
    refreshSiteStatus();
  }
});

let lastPopupKeyTime = 0;
document.addEventListener(
  "keydown",
  (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;

    const isToggle = e.code === "KeyL";
    const isIncrease = e.code === "BracketRight";
    const isDecrease = e.code === "BracketLeft";
    if (!isToggle && !isIncrease && !isDecrease) return;

    const now = Date.now();
    if (now - lastPopupKeyTime < 100) return;
    lastPopupKeyTime = now;

    e.preventDefault();
    e.stopPropagation();

    if (isToggle) {
      chrome.runtime.sendMessage({ action: "toggleBlur" }, () => {
        void chrome.runtime.lastError;
      });
      return;
    }

    chrome.storage.sync.get(["blur"], ({ blur = 0 }) => {
      const newBlur = adjustBlur(blur, isIncrease ? "increase" : "decrease");
      if (newBlur === blur) return;
      chrome.storage.sync.set({ blur: newBlur }, sendUpdate);
    });
  },
  true
);

manageExceptionsBtn.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (!tabs.length) {
    headerHost.textContent = "No active tab";
    currentSiteLabel.textContent = "Unavailable";
    addRemoveBtn.disabled = true;
    return;
  }
  try {
    const url = new URL(tabs[0].url);
    currentHost = url.hostname;
    headerHost.textContent = currentHost || "This tab";
    currentSiteLabel.textContent = currentHost || "Unavailable";
    refreshSiteStatus();
    addRemoveBtn.onclick = () => {
      chrome.storage.sync.get(["whitelist"], ({ whitelist = [] }) => {
        let list = Array.isArray(whitelist) ? whitelist : [];
        const inList = isWhitelisted(list, currentHost);
        if (inList) {
          list = list.filter(
            (site) =>
              site &&
              site !== currentHost &&
              !currentHost.endsWith("." + site)
          );
        } else if (currentHost) {
          list.push(currentHost);
        }
        chrome.storage.sync.set({ whitelist: list }, () => {
          updateExceptionControls(list);
          refreshSiteStatus();
          sendUpdate();
        });
      });
    };
  } catch (_) {
    headerHost.textContent = "Restricted page";
    currentSiteLabel.textContent = "Unavailable";
    addRemoveBtn.disabled = true;
    addRemoveBtn.textContent = "Can't modify this page";
  }
});
