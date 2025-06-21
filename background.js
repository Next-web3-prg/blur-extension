chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "setIcon") {
        chrome.action.setIcon({
            path: msg.enabled
                ? {
                    "16": "icons/enabled-16.png",
                    "32": "icons/enabled-32.png",
                    "48": "icons/enabled-48.png",
                    "128": "icons/enabled-128.png",
                }
                : {
                    "16": "icons/disabled-16.png",
                    "32": "icons/disabled-32.png",
                    "48": "icons/disabled-48.png",
                    "128": "icons/disabled-128.png",
                },
        });
    }
});

