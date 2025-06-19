// content.js
let lastKeyTime = 0;
document.addEventListener("keydown", (e) => {
  const now = Date.now();
  if (now - lastKeyTime < 100) return;
  lastKeyTime = now;
  if (e.altKey && e.key.toLowerCase() === "l") {
    chrome.storage.sync.get(["enabled", "blur"], ({ enabled, blur }) => {
      const newState = !enabled;
      chrome.storage.sync.set({ enabled: newState });
      const blurAmount = (blur / 10).toFixed(1);
      setImageBlur(newState, blurAmount);
    });
  }
  // Increase blur value with Alt+ArrowUp, decrease with Alt+ArrowDown
  if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
    chrome.storage.sync.get(["enabled", "blur"], ({ enabled, blur }) => {
      let newBlur = blur;
      if (e.key === "ArrowUp" && blur < 100) newBlur += 10;
      if (e.key === "ArrowDown" && blur > 0) newBlur -= 10;
      chrome.storage.sync.set({ blur: newBlur });
      const blurAmount = (newBlur / 10).toFixed(1);
      setImageBlur(enabled, blurAmount);
    });
  }
});

// Applies or removes blur on images and background images
function setImageBlur(enabled, amount) {
  const images = document.querySelectorAll("img");
  images.forEach((img) => {
    img.style.filter = enabled ? `blur(${amount}px)` : "";
  });
  // Blur videos
  const videos = document.querySelectorAll("video");
  videos.forEach((video) => {
    video.style.filter = enabled ? `blur(${amount}px)` : "";
  });
  const divs = document.querySelectorAll("div");
  divs.forEach((div) => {
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
    setImageBlur(msg.enabled, blurAmount);
  }
});

// On load, apply current blur state
chrome.storage.sync.get(
  ["enabled", "blur"],
  ({ enabled = false, blur = 0 }) => {
    const blurAmount = (blur / 10).toFixed(1);
    setImageBlur(enabled, blurAmount);
  }
);

// Observe DOM changes and re-apply blur for SPA and dynamic content
const observer = new MutationObserver(() => {
  chrome.storage.sync.get(
    ["enabled", "blur"],
    ({ enabled = false, blur = 0 }) => {
      const blurAmount = (blur / 10).toFixed(1);
      setImageBlur(enabled, blurAmount);
    }
  );
});
observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
});
