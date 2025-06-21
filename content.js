let lastKeyTime = 0;
const maxBlur = 50; // Maximum blur amount

document.addEventListener("keydown", (e) => {
  const now = Date.now();
  if (now - lastKeyTime < 100) return;
  lastKeyTime = now;

  // Global blur toggle
  if (e.altKey && (e.key === "l" || e.key == "L")) {
    chrome.storage.sync.get(["enabled", "blur"], ({ enabled, blur }) => {
      const newState = !enabled;
      chrome.storage.sync.set({ enabled: newState }, () => {
        setBlurAll(newState, blur);
        chrome.runtime.sendMessage({
          action: "setIcon",
          enabled: newState,
        });
      });
    });
  }

  // Blur amount adjustment
  if (e.altKey && (e.key === "[" || e.key === "]")) {
    chrome.storage.sync.get(["enabled", "blur"], ({ enabled, blur }) => {
      let newBlur = blur;
      if (e.key === "]" && blur < 100) {
        if (newBlur === 0) newBlur = 1; // Start from 1 if currently 0
        if (newBlur >= 100) return; // Don't exceed max blur
        if (newBlur < 5) newBlur += 1; // Avoid too small increments
        else if (newBlur < 20) newBlur += Math.ceil(newBlur / 10);
        else if (newBlur < 50) newBlur += Math.ceil(newBlur / 5);
        else if (newBlur < 100) newBlur += Math.ceil(newBlur / 2);
      }
      if (e.key === "[" && blur > 1) {
        if (newBlur <= 1) return; // Don't go below 1
        if (newBlur <= 5) newBlur -= 1; // Avoid too small decrements
        else if (newBlur <= 20) newBlur -= Math.ceil(newBlur / 10);
        else if (newBlur <= 50) newBlur -= Math.ceil(newBlur / 5);
        else if (newBlur <= 100) newBlur -= Math.ceil(newBlur / 2);
      }
      chrome.storage.sync.set({ blur: newBlur });
      setBlurAll(enabled, newBlur);
    });
  }
});

// Blur/unblur all supported elements
function setBlurAll(enabled, amount) {
  if (amount < 1) {
    amount = 1; // Ensure blur amount is non-negative
  }
  else if (amount > 100) {
    amount = 100; // Cap blur amount at 100%
  }
  chrome.storage.sync.get(
    ["enableVideo", "enableCanvas", "enableBgImage"],
    ({ enableVideo = true, enableCanvas = true, enableBgImage = true }) => {
      document.querySelectorAll("img").forEach((el) => {
        el.style.filter = enabled ? `blur(${(amount * maxBlur) / 100}px)` : "";
      });
      if (enableVideo && enabled) {
        document.querySelectorAll("video").forEach((el) => {
          el.style.filter = enabled
            ? `blur(${(amount * maxBlur) / 100}px)`
            : "";
        });
      } else {
        document.querySelectorAll("video").forEach((el) => {
          el.style.filter = "";
        });
      }
      if (enableCanvas && enabled) {
        document.querySelectorAll("canvas, svg").forEach((el) => {
          el.style.filter = enabled
            ? `blur(${(amount * maxBlur) / 100}px)`
            : "";
        });
      } else {
        document.querySelectorAll("canvas, svg").forEach((el) => {
          el.style.filter = "";
        });
      }
      if (enableBgImage) {
        document.querySelectorAll("div, span").forEach((el) => {
          const bg = window.getComputedStyle(el).backgroundImage;
          if (bg && bg.startsWith("url(")) {
            el.style.filter = enabled
              ? `blur(${(amount * maxBlur) / 100}px)`
              : "";
          } else if (!enabled) {
            el.style.filter = "";
          }
        });
      } else if (!enabled) {
        document.querySelectorAll("div, span").forEach((el) => {
          el.style.filter = "";
        });
      }
      // Blur <object> tags with type starting with "image"
      document.querySelectorAll("object[type^='image']").forEach((el) => {
        el.style.filter = enabled ? `blur(${(amount * maxBlur) / 100}px)` : "";
      });
    }
  );
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "applyBlur") {
    setBlurAll(msg.enabled, msg.blur);
  }
});

// On load, apply current blur state
chrome.storage.sync.get(
  ["enabled", "blur"],
  ({ enabled = false, blur = 0 }) => {
    setBlurAll(enabled, blur);
  }
);

var debounceTimer = null;
function debouncedBlurUpdate() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(function () {
    chrome.storage.sync.get(
      ["enabled", "blur", "whitelist"],
      function ({ enabled = false, blur = 0, whitelist = [] }) {
        var host = '';
        try { host = window.location.hostname; } catch (e) { }
        const isWhitelisted = Array.isArray(whitelist) &&
          (whitelist.includes(host) || whitelist.some(site => host.endsWith('.' + site)));
        setBlurAll(enabled && !isWhitelisted, blur);
      }
    );
  }, 100); // 100ms debounce
}

let observer = null;
function setupObserver() {
  if (!document.body) {
    setTimeout(setupObserver, 50);
    return;
  }
  if (window.__blurObserverAttached) return;
  window.__blurObserverAttached = true;
  observer = new MutationObserver(debouncedBlurUpdate);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
  });
}
// --- Initial setup ---
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupObserver);
} else {
  setupObserver();
}

// --- Optional: Clean up observer and timer on unload ---
window.addEventListener("unload", () => {
  clearTimeout(debounceTimer);
  if (observer) observer.disconnect();
});

document.addEventListener("DOMContentLoaded", () => {
  // Set initial icon based on storage state
  chrome.storage.sync.get(["enabled", "blur", "enableBgImage", "enableCanvas", "enableVideo", "whiteSiteList"], ({ enabled = true, blur, enableBgImage, enableCanvas, enableVideo, whiteSiteList = [] }) => {
    chrome.runtime.sendMessage({
      action: "setIcon",
      enabled: enabled,
    });
    setBlurAll(enabled, blur);
  });
});

chrome.storage.onChanged.addEventListener(({ enabled = true, blur = 1, enableBgImage = true, enableCanvas = true, enableVideo = true, whiteSiteList = [] }) => {
  chrome.runtime.sendMessage({
    action: "setIcon",
    enabled: enabled.newValue,
  });
  setBlurAll(enabled.newValue, blur.newValue);
})