# Image Blur Toggle — Browser Extension

Easily blur or unblur images, videos, canvases, and backgrounds on any webpage. Adjust intensity or toggle instantly with keyboard shortcuts.

## Features
- Blur images, videos, canvases/SVG, and CSS background images
- Adjust intensity with a slider or **Alt+[** / **Alt+]**
- Toggle blur globally with **Alt+L**
- Site exceptions (exempt the current site or manage a full list)
- Skip tiny images (icons under 48px stay clear)
- **Site compatibility** modes: Auto, Balanced, or Maximum — Auto uses stronger coverage on complex apps (e.g. Adobe Firefly)
- Works with dynamic content, SPAs, and many Shadow DOM pages
- Pauses background work when the tab is hidden to save CPU

## How to Use
1. Open the popup to enable blur and set intensity
2. Expand **More options** for video/canvas/background toggles, skip-tiny, and compatibility mode
3. Use **Exempt this site** or **Manage all exceptions** when you want a page left clear
4. Shortcuts: **Alt+L** toggle · **Alt+[** softer · **Alt+]** stronger

After reloading the extension from `chrome://extensions`, open tabs are reinjected automatically so blur keeps working without a manual page refresh. (A hard refresh can still help on a few stubborn Shadow DOM apps if icons were created before the page hook ran.)

## Permissions
- `storage` — save your settings
- `activeTab` — talk to the current tab from the popup
- `scripting` + host access — reinject into open tabs after an extension reload

## Installation
1. Download or clone this repository
2. Go to `chrome://extensions` and enable Developer Mode
3. Click **Load unpacked** and select this folder

---

For feedback or contributions, open an issue or pull request on GitHub.
