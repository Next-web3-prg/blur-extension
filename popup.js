const toggle = document.getElementById('toggleBlur');
const range = document.getElementById('blurRange');
const blurValue = document.getElementById('blurValue');

function sendUpdate() {
  chrome.storage.sync.get(['enabled', 'blur'], (data) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs.length) return;
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'applyBlur',
        enabled: data.enabled,
        blur: data.blur
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('No content script found in this tab.');
        }
      });
    });
  });
}


chrome.storage.sync.get(['enabled', 'blur'], ({enabled = false, blur = 0}) => {
  toggle.checked = enabled;
  range.value = blur;
  blurValue.textContent = `${blur}%`;
});

toggle.addEventListener('change', () => {
  chrome.storage.sync.set({enabled: toggle.checked}, sendUpdate);
});

let blurSaveTimeout = null;
let lastBlurValue = null;

range.addEventListener('input', () => {
  const val = parseInt(range.value);
  blurValue.textContent = `${val}%`;
  lastBlurValue = val;
  if (blurSaveTimeout) clearTimeout(blurSaveTimeout);
  blurSaveTimeout = setTimeout(() => {
    chrome.storage.sync.set({blur: lastBlurValue}, sendUpdate);
    blurSaveTimeout = null;
  }, 100);
});

window.addEventListener('keydown', (e) => {
  if (e.altKey && e.key.toLowerCase() === 'l') {
    toggle.checked = !toggle.checked;
    chrome.storage.sync.set({enabled: toggle.checked}, sendUpdate);
  }
});