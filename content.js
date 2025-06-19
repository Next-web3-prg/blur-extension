function applyBlur(enabled, amount) {
  const images = document.querySelectorAll('img');
  for (const img of images) {
    img.style.filter = enabled ? `blur(${amount}px)` : 'none';
  }
  const divs = document.querySelectorAll('div');
  for (const div of divs) {
    const bg = window.getComputedStyle(div).backgroundImage;
    if (bg && bg !== 'none') {
      div.style.filter = enabled ? `blur(${amount}px)` : 'none';
    } else if (!enabled) {
      div.style.filter = '';
    }
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'applyBlur') {
    const blurAmount = (msg.blur / 10).toFixed(1);
    applyBlur(msg.enabled, blurAmount);
  }
});

chrome.storage.sync.get(['enabled', 'blur'], ({enabled = false, blur = 0}) => {
  const blurAmount = (blur / 10).toFixed(1);
  applyBlur(enabled, blurAmount);
});

// Observe DOM changes and re-apply blur for SPA and dynamic content
const observer = new MutationObserver(() => {
  chrome.storage.sync.get(['enabled', 'blur'], ({enabled = false, blur = 0}) => {
    const blurAmount = (blur / 10).toFixed(1);
    applyBlur(enabled, blurAmount);
  });
});
observer.observe(document.body, { childList: true, subtree: true, attributes: true });