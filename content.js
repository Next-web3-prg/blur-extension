// content.js
// Applies or removes blur on images and background images
function setImageBlur(enabled, amount) {
  const images = document.querySelectorAll('img');
  images.forEach(img => {
    img.style.filter = enabled ? `blur(${amount}px)` : '';
  });
  // Blur videos
  const videos = document.querySelectorAll('video');
  videos.forEach(video => {
    video.style.filter = enabled ? `blur(${amount}px)` : '';
  });
  const divs = document.querySelectorAll('div');
  divs.forEach(div => {
    const bg = window.getComputedStyle(div).backgroundImage;
    if (bg && bg !== 'none') {
      div.style.filter = enabled ? `blur(${amount}px)` : '';
    } else if (!enabled) {
      div.style.filter = '';
    }
  });
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "applyBlurFromHotkey") {
    chrome.storage.sync.get("blur", ({ blur = 0 }) => {
      const blurAmount = (blur / 10).toFixed(1);
      setImageBlur(msg.enabled, blurAmount);
    });
  }
  if (msg.action === 'applyBlur') {
    const blurAmount = (msg.blur / 10).toFixed(1);
    setImageBlur(msg.enabled, blurAmount);
  }
});

// On load, apply current blur state
chrome.storage.sync.get(['enabled', 'blur'], ({enabled = false, blur = 0}) => {
  const blurAmount = (blur / 10).toFixed(1);
  setImageBlur(enabled, blurAmount);
});

// Observe DOM changes and re-apply blur for SPA and dynamic content
const observer = new MutationObserver(() => {
  chrome.storage.sync.get(['enabled', 'blur'], ({enabled = false, blur = 0}) => {
    const blurAmount = (blur / 10).toFixed(1);
    setImageBlur(enabled, blurAmount);
  });
});
observer.observe(document.body, { childList: true, subtree: true, attributes: true });