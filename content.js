// content.js
// Handles blur logic for images, videos, and divs with background images
let lastKeyTime = 0;
const blurReleasedElements = new WeakSet();
let hoveredElement = null;

document.addEventListener("mouseover", (e) => {
  hoveredElement = e.target;
});

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
      setImageBlur(newState, blurAmount);
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
      setImageBlur(enabled, blurAmount);
    });
  }

  // Toggle blur on hovered element
  if (e.altKey && e.key.toLowerCase() === "k" && hoveredElement) {
    const isImg = hoveredElement.tagName === "IMG";
    const isCanvas = hoveredElement.tagName === "CANVAS";
    const isVideo = hoveredElement.tagName === "VIDEO";
    const isDivWithBg =
      hoveredElement.tagName === "DIV" &&
      window.getComputedStyle(hoveredElement).backgroundImage !== "none";
    if (isImg || isVideo || isDivWithBg || isCanvas) {
      if (blurReleasedElements.has(hoveredElement)) {
        // Re-apply blur
        chrome.storage.sync.get(["enabled", "blur"], ({ enabled, blur }) => {
          if (enabled) {
            hoveredElement.style.filter = `blur(${(blur / 10).toFixed(1)}px)`;
          } else {
            hoveredElement.style.filter = "";
          }
        });
        blurReleasedElements.delete(hoveredElement);
      } else {
        // Remove blur (release)
        hoveredElement.style.filter = "";
        blurReleasedElements.add(hoveredElement);
        hoveredElement.style.filter = `blur(0px)`;
      }
    }
  }
});

function setImageBlur(enabled, amount) {
  const images = document.querySelectorAll("img");
  images.forEach((img) => {
    if (!blurReleasedElements.has(img)) {
      img.style.filter = enabled ? `blur(${amount}px)` : "";
    }
  });
  const videos = document.querySelectorAll("video");
  videos.forEach((video) => {
    if (!blurReleasedElements.has(video)) {
      video.style.filter = enabled ? `blur(${amount}px)` : "";
    }
  });
  const canvases = document.querySelectorAll("canvas");
  canvases.forEach((canvas) => {
    if (!blurReleasedElements.has(canvas)) {
      canvas.style.filter = enabled ? `blur(${amount}px)` : "";
    }
  });
  const divs = document.querySelectorAll("div");
  divs.forEach((div) => {
    const bg = window.getComputedStyle(div).backgroundImage;
    if (bg && bg !== "none") {
      if (!blurReleasedElements.has(div)) {
        div.style.filter = enabled ? `blur(${amount}px)` : "";
      }
    } else if (!enabled) {
      div.style.filter = "";
    }
  });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "applyBlur") {
    const blurAmount = (msg.blur / 10).toFixed(1);
    setImageBlur(msg.enabled, blurAmount);
  }
});

chrome.storage.sync.get(
  ["enabled", "blur"],
  ({ enabled = false, blur = 0 }) => {
    const blurAmount = (blur / 10).toFixed(1);
    setImageBlur(enabled, blurAmount);
  }
);

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
