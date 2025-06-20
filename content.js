// content.js
// Blur logic for images, videos, canvases, and divs with background images
let lastKeyTime = 0;

// Main keydown handler for global blur toggle and blur amount adjustment
// Alt+L: toggle blur, Alt+[ / Alt+]: decrease/increase blur

document.addEventListener("keydown", (e) => {
  const now = Date.now();
  if (now - lastKeyTime < 100) return;
  lastKeyTime = now;

  // Global blur toggle
  if (e.altKey && e.key.toLowerCase() === "l") {
    chrome.storage.sync.get(["enabled", "blur"], ({ enabled, blur }) => {
      const newState = !enabled;
      chrome.storage.sync.set({ enabled: newState });
      const blurAmount = (blur / 10).toFixed(1);
      setBlurAll(newState, blurAmount);
    });
  }

  // Blur amount adjustment
  if (e.altKey && (e.key === "[" || e.key === "]")) {
    chrome.storage.sync.get(["enabled", "blur"], ({ enabled, blur }) => {
      let newBlur = blur;
      if (e.key === "]" && blur < 100) newBlur += 10;
      if (e.key === "[" && blur > 0) newBlur -= 10;
      chrome.storage.sync.set({ blur: newBlur });
      const blurAmount = (newBlur / 10).toFixed(1);
      setBlurAll(enabled, blurAmount);
    });
  }
});

// Blur/unblur all supported elements
function setBlurAll(enabled, amount) {
  document.querySelectorAll("img, video, canvas").forEach((el) => {
    el.style.filter = enabled ? `blur(${amount}px)` : "";
  });
  document.querySelectorAll("div").forEach((div) => {
    const bg = window.getComputedStyle(div).backgroundImage;
    if (bg && bg !== "none") {
      div.style.filter = enabled ? `blur(${amount}px)` : "";
    } else if (!enabled) {
      div.style.filter = "";
    }
  });
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "applyBlur") {
    const blurAmount = (msg.blur / 10).toFixed(1);
    setBlurAll(msg.enabled, blurAmount);
  }
});

// On load, apply current blur state
chrome.storage.sync.get(
  ["enabled", "blur"],
  ({ enabled = false, blur = 0 }) => {
    const blurAmount = (blur / 10).toFixed(1);
    setBlurAll(enabled, blurAmount);
  }
);

// Observe DOM changes and re-apply blur for SPA and dynamic content
const observer = new MutationObserver(() => {
  chrome.storage.sync.get(
    ["enabled", "blur"],
    ({ enabled = false, blur = 0 }) => {
      const blurAmount = (blur / 10).toFixed(1);
      setBlurAll(enabled, blurAmount);
    }
  );
});
observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
});
