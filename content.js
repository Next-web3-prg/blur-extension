// content.js
// Blur logic for images, videos, canvases, and divs with background images
let lastKeyTime = 0;
const maxBlur = 50; // Maximum blur amount

// Main keydown handler for global blur toggle and blur amount adjustment
// Alt+L: toggle blur, Alt+[ / Alt+]: decrease/increase blur

document.addEventListener("keydown", (e) => {
  const now = Date.now();
  if (now - lastKeyTime < 100) return;
  lastKeyTime = now;

  // Global blur toggle
  if (e.altKey && (e.key === 0x4C || e.key === 0x6C)) {
    chrome.storage.sync.get(["enabled", "blur"], ({ enabled, blur }) => {
      const newState = !enabled;
      chrome.storage.sync.set({ enabled: newState });
      setBlurAll(newState, blur);
    });
  }

  // Blur amount adjustment
  if (e.altKey && (e.key === "[" || e.key === "]")) {
    chrome.storage.sync.get(["enabled", "blur"], ({ enabled, blur }) => {
      let newBlur = blur;
      if (e.key === "]" && blur < 100){
        if (newBlur === 0) newBlur = 1; // Start from 1 if currently 0
        if (newBlur >= 100) return; // Don't exceed max blur
        if (newBlur < 5) newBlur += 1; // Avoid too small increments
        else if (newBlur < 20) newBlur += Math.ceil(newBlur / 10);
        else if (newBlur < 50) newBlur += Math.ceil(newBlur / 5);
        else if (newBlur < 100) newBlur += Math.ceil(newBlur / 2);
      }
      if (e.key === "[" && blur > 1){
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
  document.querySelectorAll("img, video, canvas, svg").forEach((el) => {
    el.style.filter = enabled ? `blur(${(amount * maxBlur) / 100}px)` : "";
  });
  document.querySelectorAll("div, span").forEach((el) => {
    const bg = window.getComputedStyle(el).backgroundImage;
    // Only blur if backgroundImage is a url (not none, not gradient)
    if (bg && bg.startsWith("url(")) {
      el.style.filter = enabled ? `blur(${(amount * maxBlur) / 100}px)` : "";
    } else if (!enabled) {
      el.style.filter = "";
    }
  });
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
    ["enabled", "blur"],
    ({ enabled = false, blur = 0 }) => {
      setBlurAll(enabled, blur);
    }
  );
});
observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
});
