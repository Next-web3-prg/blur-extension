// content.js
// Blur logic for images, videos, canvases, and divs with background images
let lastKeyTime = 0;
const maxBlur = 50; // Maximum blur amount

// Main keydown handler for global blur toggle and blur amount adjustment
// Alt+L: toggle blur, Alt+[ / Alt+]: decrease/increase blur

document.addEventListener("DOMContentLoaded", () => {
  // Set initial icon based on storage state
  chrome.storage.sync.get(["enabled", "blur"], ({ enabled, blur }) => {
    chrome.runtime.sendMessage({
      action: "setIcon",
      enabled: enabled,
    });
  });
});

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
  chrome.storage.sync.get(
    ["blurVideo", "blurCanvas", "blurBgImage"],
    ({ blurVideo = true, blurCanvas = true, blurBgImage = true }) => {
      document.querySelectorAll("img").forEach((el) => {
        el.style.filter = enabled ? `blur(${(amount * maxBlur) / 100}px)` : "";
      });
      if (blurVideo && enabled) {
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
      if (blurCanvas && enabled) {
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
      if (blurBgImage) {
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

// Observe DOM changes and re-apply blur for SPA and dynamic content
const observer = new MutationObserver(() => {
  chrome.storage.sync.get(
    ["enabled", "blur", "whitelist"],
    ({ enabled = false, blur = 0, whitelist = [] }) => {
      let host = '';
      try { host = window.location.hostname; } catch (e) {}
      const isWhitelisted = Array.isArray(whitelist) && (whitelist.includes(host) || whitelist.some(site => host.endsWith('.' + site)));
      setBlurAll(enabled && !isWhitelisted, blur);
    }
  );
});
observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
});
