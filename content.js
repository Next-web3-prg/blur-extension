const maxBlur = 50;
const ATTR = "data-ibt";
const SKIP_ATTR = "data-ibt-skip";
const STYLE_ID = "ibt-style";
const EXT_ID = (() => {
  try {
    return chrome.runtime.id;
  } catch (_) {
    return null;
  }
})();

/** Hosts that often wipe styles / use heavy shadow DOM */
const STUBBORN_HOST_RE =
  /(^|\.)(adobe\.com|figma\.com|canva\.com|notion\.(so|site)|dropbox\.com|airtable\.com|asana\.com|monday\.com)$/i;

const EXT_INTERVAL_MAX = 450;
const EXT_INTERVAL_BALANCED = 2000;

let lastBlurKeyTime = 0;
let debounceTimer = null;
let enforceTimer = null;
let observer = null;
let tornDown = !EXT_ID;
let settings = {
  enabled: false,
  blur: 0,
  whitelist: [],
  enableVideo: true,
  enableCanvas: true,
  enableBgImage: true,
  skipTinyImages: true,
  coverageMode: "auto", // auto | balanced | maximum
};

function isContextValid() {
  if (tornDown || !EXT_ID) return false;
  try {
    return chrome.runtime.id === EXT_ID;
  } catch (_) {
    return false;
  }
}

function isInvalidatedError(err) {
  const msg = err && (err.message || String(err));
  return typeof msg === "string" && msg.includes("Extension context invalidated");
}

function teardown() {
  if (tornDown) return;
  tornDown = true;
  clearTimeout(debounceTimer);
  stopEnforceLoop();
  clearAllBlur();
  if (observer) {
    try {
      observer.disconnect();
    } catch (_) {}
    observer = null;
  }
  try {
    chrome.runtime.onMessage.removeListener(onMessage);
  } catch (_) {}
  try {
    chrome.storage.onChanged.removeListener(onStorageChanged);
  } catch (_) {}
  try {
    document.removeEventListener("keydown", onKeyDown, true);
  } catch (_) {}
  try {
    document.removeEventListener("load", onMediaLoadCapture, true);
  } catch (_) {}
  try {
    document.removeEventListener("visibilitychange", onVisibilityChange);
  } catch (_) {}
  try {
    window.removeEventListener("pagehide", teardown);
  } catch (_) {}
  window.__blurObserverAttached = false;
  if (window.__ibtTeardown === teardown) {
    try {
      delete window.__ibtTeardown;
    } catch (_) {
      window.__ibtTeardown = null;
    }
  }
}

function callChrome(apiCall, callback) {
  if (!isContextValid()) {
    teardown();
    return;
  }
  try {
    const maybePromise = apiCall((...args) => {
      if (!isContextValid()) {
        teardown();
        return;
      }
      try {
        if (callback) callback(...args);
      } catch (e) {
        if (isInvalidatedError(e)) teardown();
      }
    });
    if (maybePromise && typeof maybePromise.then === "function") {
      maybePromise.then(
        () => {},
        (err) => {
          if (!isContextValid() || isInvalidatedError(err)) teardown();
        }
      );
    }
  } catch (e) {
    if (!isContextValid() || isInvalidatedError(e)) teardown();
  }
}

function storageGet(keys, callback) {
  callChrome((cb) => chrome.storage.sync.get(keys, cb), callback);
}

function storageSet(values, callback) {
  callChrome((cb) => chrome.storage.sync.set(values, cb), callback);
}

function sendMessage(message) {
  callChrome((cb) => chrome.runtime.sendMessage(message, cb), () => {
    const err = chrome.runtime.lastError;
    if (err && isInvalidatedError(err)) teardown();
  });
}

function isWhitelisted(whitelist, host) {
  if (!host || !Array.isArray(whitelist)) return false;
  return (
    whitelist.includes(host) ||
    whitelist.some((site) => site && host.endsWith("." + site))
  );
}

function getHost() {
  try {
    return window.location.hostname;
  } catch (_) {
    return "";
  }
}

function shouldBlurNow() {
  return settings.enabled && !isWhitelisted(settings.whitelist, getHost());
}

function isTabVisible() {
  return document.visibilityState !== "hidden";
}

function resolvedCoverageMode() {
  const mode = settings.coverageMode || "auto";
  if (mode === "balanced" || mode === "maximum") return mode;
  // auto
  return STUBBORN_HOST_RE.test(getHost()) ? "maximum" : "balanced";
}

function blurPx(amount) {
  const a = Math.max(0, Math.min(100, Number(amount) || 0));
  if (a <= 0) return 0;
  return (a * maxBlur) / 100;
}

function blurCss(amount) {
  const px = blurPx(amount);
  return px > 0 ? `blur(${px}px)` : "";
}

function mediaBlurCssText(px, pending) {
  const filter = `blur(${px}px)`;
  // Never blanket-blur svg/canvas in CSS. Firefly (and similar apps) rebuild
  // shadow trees and strip attributes; CSS would keep blurring 20px icons.
  // SVG/canvas are blurred only via inline styles on non-tiny elements.
  const selectors = [`img:not([${SKIP_ATTR}])`];
  if (pending || settings.enableVideo) {
    selectors.push(`video:not([${SKIP_ATTR}])`);
  }
  selectors.push(`object[type^="image"]:not([${SKIP_ATTR}])`);

  return `
    ${selectors.join(",\n    ")} {
      filter: ${filter} !important;
    }
    img[${SKIP_ATTR}],
    video[${SKIP_ATTR}],
    canvas[${SKIP_ATTR}],
    svg[${SKIP_ATTR}],
    object[${SKIP_ATTR}] {
      filter: none !important;
    }
  `;
}

function getShadowRoot(el) {
  if (!el || el.nodeType !== 1) return null;
  try {
    if (el.shadowRoot) return el.shadowRoot;
  } catch (_) {}
  try {
    if (chrome.dom && typeof chrome.dom.openOrClosedShadowRoot === "function") {
      return chrome.dom.openOrClosedShadowRoot(el);
    }
  } catch (_) {}
  return null;
}

function ensureStyleInRoot(root, cssText) {
  if (!root) return;
  const isDoc = root.nodeType === 9;
  const host = isDoc ? document.head || document.documentElement : root;
  if (!host || !host.appendChild) return;

  let style =
    (host.getElementById && host.getElementById(STYLE_ID)) ||
    (root.querySelector && root.querySelector(`#${STYLE_ID}`));
  if (!style && isDoc) style = document.getElementById(STYLE_ID);

  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    host.appendChild(style);
  } else if (!style.isConnected) {
    host.appendChild(style);
  }
  if (style.textContent !== cssText) style.textContent = cssText;
}

function forEachRoot(callback) {
  const seen = new Set();
  const visitRoot = (root) => {
    if (!root || seen.has(root)) return;
    seen.add(root);
    callback(root);
    let elements;
    try {
      elements = root.querySelectorAll ? root.querySelectorAll("*") : [];
    } catch (_) {
      return;
    }
    for (let i = 0; i < elements.length; i++) {
      const shadow = getShadowRoot(elements[i]);
      if (shadow) visitRoot(shadow);
    }
  };
  visitRoot(document);
}

function forEachDeep(selector, callback) {
  forEachRoot((root) => {
    try {
      if (!root.querySelectorAll) return;
      const list = root.querySelectorAll(selector);
      for (let i = 0; i < list.length; i++) callback(list[i]);
    } catch (_) {}
  });
}

function markFilter(el, filter) {
  if (!el || el.nodeType !== 1) return;
  if (filter) {
    el.removeAttribute(SKIP_ATTR);
    if (el.style.getPropertyValue("filter") !== filter) {
      el.style.setProperty("filter", filter, "important");
    }
    el.setAttribute(ATTR, "1");
  } else if (el.hasAttribute(ATTR) || el.style.getPropertyValue("filter")) {
    el.style.removeProperty("filter");
    el.removeAttribute(ATTR);
  }
}

function markSkipped(el, skip) {
  if (!el || el.nodeType !== 1) return;
  if (skip) {
    el.setAttribute(SKIP_ATTR, "1");
    el.removeAttribute(ATTR);
    if (el.style.getPropertyValue("filter") !== "none") {
      el.style.setProperty("filter", "none", "important");
    }
  } else if (el.hasAttribute(SKIP_ATTR)) {
    el.removeAttribute(SKIP_ATTR);
    if (el.style.getPropertyValue("filter") === "none") {
      el.style.removeProperty("filter");
    }
  }
}

function clearAllBlur() {
  try {
    document.documentElement.classList.remove("ibt-pending", "ibt-on");
  } catch (_) {}
  forEachRoot((root) => {
    try {
      const style =
        (root.getElementById && root.getElementById(STYLE_ID)) ||
        (root.querySelector && root.querySelector(`#${STYLE_ID}`));
      if (style) style.remove();
    } catch (_) {}
    try {
      if (!root.querySelectorAll) return;
      root.querySelectorAll(`[${ATTR}]`).forEach((el) => {
        el.style.removeProperty("filter");
        el.removeAttribute(ATTR);
      });
      root.querySelectorAll(`[${SKIP_ATTR}]`).forEach((el) => {
        el.style.removeProperty("filter");
        el.removeAttribute(SKIP_ATTR);
      });
    } catch (_) {}
  });
  const docStyle = document.getElementById(STYLE_ID);
  if (docStyle) docStyle.remove();
}

function renderedSize(el) {
  if (!el || el.nodeType !== 1) return { w: 0, h: 0 };
  let w = el.clientWidth || 0;
  let h = el.clientHeight || 0;
  if (w > 0 || h > 0) return { w, h };
  try {
    const r = el.getBoundingClientRect();
    w = Math.round(r.width) || 0;
    h = Math.round(r.height) || 0;
  } catch (_) {}
  return { w, h };
}

function isTinyImage(el) {
  let { w, h } = renderedSize(el);

  // Spectrum-style icons: size is often on the host / parent, not the svg
  if (!(w > 0 || h > 0)) {
    try {
      const root = el.getRootNode && el.getRootNode();
      if (root && root.host) {
        ({ w, h } = renderedSize(root.host));
      }
    } catch (_) {}
  }
  if (!(w > 0 || h > 0) && el.parentElement) {
    ({ w, h } = renderedSize(el.parentElement));
  }

  if (w > 0 || h > 0) return w < 48 && h < 48;

  const tag = el.tagName;
  if (tag === "IMG" || tag === "OBJECT" || tag === "VIDEO" || tag === "CANVAS") {
    const nw = el.naturalWidth || el.videoWidth || el.width || 0;
    const nh = el.naturalHeight || el.videoHeight || el.height || 0;
    if (nw > 0 || nh > 0) return nw < 48 && nh < 48;
  }

  const aw = parseFloat(el.getAttribute("width")) || 0;
  const ah = parseFloat(el.getAttribute("height")) || 0;
  if (aw > 0 || ah > 0) return aw < 48 && ah < 48;

  // Unlaid-out SVGs in apps like Firefly are almost always icons
  if (tag === "SVG") return true;
  return false;
}

function shouldSkipImage(el) {
  return settings.skipTinyImages && isTinyImage(el);
}

function clearElementBlur(el) {
  if (!el || el.nodeType !== 1) return;
  el.style.removeProperty("filter");
  el.removeAttribute(ATTR);
  el.removeAttribute(SKIP_ATTR);
}

function hasBgImage(el) {
  try {
    const bg = window.getComputedStyle(el).backgroundImage;
    return !!(bg && bg.startsWith("url("));
  } catch (_) {
    return false;
  }
}

function applyStylesEverywhere(pending) {
  const active = pending || shouldBlurNow();
  const px = pending ? maxBlur : blurPx(settings.blur);
  if (!active || px <= 0) {
    clearAllBlur();
    stopEnforceLoop();
    return;
  }

  const cssText = mediaBlurCssText(px, !!pending);
  if (pending) {
    document.documentElement.classList.add("ibt-pending");
  } else {
    document.documentElement.classList.remove("ibt-pending");
    document.documentElement.classList.add("ibt-on");
  }

  forEachRoot((root) => ensureStyleInRoot(root, cssText));
}

function applyMediaInline() {
  const active = shouldBlurNow();
  const filter = blurCss(settings.blur);
  if (!active || !filter) return;

  forEachDeep("img, video, canvas, svg, object[type^='image']", (el) => {
    const tag = el.tagName;
    if (tag === "IMG") {
      if (shouldSkipImage(el)) markSkipped(el, true);
      else {
        markSkipped(el, false);
        markFilter(el, filter);
      }
      return;
    }
    if (tag === "VIDEO") {
      if (!settings.enableVideo || shouldSkipImage(el)) {
        clearElementBlur(el);
        return;
      }
      markSkipped(el, false);
      markFilter(el, filter);
      return;
    }
    if (tag === "CANVAS" || tag === "SVG") {
      // Blur only via inline styles (not CSS), so tiny Firefly icons stay clear
      // even when the page strips data attributes from shadow trees.
      if (!settings.enableCanvas || shouldSkipImage(el)) {
        clearElementBlur(el);
        return;
      }
      markSkipped(el, false);
      markFilter(el, filter);
      return;
    }
    if (tag === "OBJECT" && (el.getAttribute("type") || "").startsWith("image")) {
      if (shouldSkipImage(el)) markSkipped(el, true);
      else {
        markSkipped(el, false);
        markFilter(el, filter);
      }
    }
  });
}

function applyBgImages() {
  const active = shouldBlurNow();
  const filter = blurCss(settings.blur);

  if (!active || !filter || !settings.enableBgImage) {
    forEachDeep(`div[${ATTR}], span[${ATTR}]`, (el) => markFilter(el, ""));
    return;
  }

  forEachDeep("div, span", (el) => {
    if (hasBgImage(el)) markFilter(el, filter);
  });
}

function applyAll(options = {}) {
  const { includeBg = true } = options;
  if (!shouldBlurNow() || blurPx(settings.blur) <= 0) {
    clearAllBlur();
    stopEnforceLoop();
    return;
  }
  applyStylesEverywhere(false);
  applyMediaInline();
  if (includeBg) applyBgImages();
  syncEnforceLoop();
}

function syncEnforceLoop() {
  stopEnforceLoop();
  if (!shouldBlurNow() || blurPx(settings.blur) <= 0) return;
  if (!isTabVisible()) return;

  const mode = resolvedCoverageMode();
  const interval = mode === "maximum" ? EXT_INTERVAL_MAX : EXT_INTERVAL_BALANCED;

  enforceTimer = setInterval(() => {
    if (!isContextValid()) {
      teardown();
      return;
    }
    if (!isTabVisible()) return;
    if (!shouldBlurNow() || blurPx(settings.blur) <= 0) return;

    // Styles + media only on the timer (bg scans are expensive → mutation/settings only)
    applyStylesEverywhere(false);
    applyMediaInline();
    if (resolvedCoverageMode() === "maximum") {
      // Occasional light bg pass in maximum mode only
      applyBgImages();
    }
  }, interval);
}

function stopEnforceLoop() {
  if (enforceTimer) {
    clearInterval(enforceTimer);
    enforceTimer = null;
  }
}

function onVisibilityChange() {
  if (!isContextValid()) return;
  if (isTabVisible()) {
    if (shouldBlurNow() && blurPx(settings.blur) > 0) {
      applyAll({ includeBg: true });
    }
  } else {
    stopEnforceLoop();
  }
}

// Early pending blur
if (EXT_ID && document.documentElement) {
  try {
    applyStylesEverywhere(true);
  } catch (_) {}
}

function applyFromSettings() {
  if (!isContextValid()) {
    teardown();
    return;
  }
  applyAll({ includeBg: true });
  if (window === window.top) {
    sendMessage({ action: "setIcon", enabled: settings.enabled });
  }
}

function loadSettings(callback) {
  storageGet(
    [
      "enabled",
      "blur",
      "whitelist",
      "enableVideo",
      "enableCanvas",
      "enableBgImage",
      "skipTinyImages",
      "coverageMode",
    ],
    (data) => {
      if (!data) return;
      settings = {
        enabled: data.enabled ?? false,
        blur: data.blur ?? 0,
        whitelist: Array.isArray(data.whitelist) ? data.whitelist : [],
        enableVideo: data.enableVideo ?? true,
        enableCanvas: data.enableCanvas ?? true,
        enableBgImage: data.enableBgImage ?? true,
        skipTinyImages: data.skipTinyImages ?? true,
        coverageMode: data.coverageMode || "auto",
      };
      if (callback) callback();
    }
  );
}

function adjustBlur(blur, direction) {
  let newBlur = Number(blur) || 0;
  if (direction === "increase") {
    if (newBlur <= 0) newBlur = 1;
    else if (newBlur >= 100) return blur;
    else if (newBlur < 5) newBlur += 1;
    else if (newBlur < 20) newBlur += Math.ceil(newBlur / 10);
    else if (newBlur < 50) newBlur += Math.ceil(newBlur / 5);
    else newBlur += Math.ceil(newBlur / 2);
  } else {
    if (newBlur <= 0) return blur;
    else if (newBlur <= 1) newBlur = 0;
    else if (newBlur <= 5) newBlur -= 1;
    else if (newBlur <= 20) newBlur -= Math.ceil(newBlur / 10);
    else if (newBlur <= 50) newBlur -= Math.ceil(newBlur / 5);
    else newBlur -= Math.ceil(newBlur / 2);
  }
  return Math.max(0, Math.min(100, newBlur));
}

function onKeyDown(e) {
  try {
    if (!isContextValid()) {
      teardown();
      return;
    }
    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const isToggle = e.code === "KeyL";
    const isIncrease = e.code === "BracketRight";
    const isDecrease = e.code === "BracketLeft";
    if (!isToggle && !isIncrease && !isDecrease) return;

    const now = Date.now();
    if (now - lastBlurKeyTime < 100) return;
    lastBlurKeyTime = now;
    e.preventDefault();
    e.stopPropagation();

    if (isToggle) {
      sendMessage({ action: "toggleBlur" });
      return;
    }

    const currentBlur = settings.blur || 0;
    const newBlur = adjustBlur(
      currentBlur,
      isIncrease ? "increase" : "decrease"
    );
    if (newBlur === currentBlur) return;
    storageSet({ blur: newBlur }, () => {
      settings.blur = newBlur;
      applyFromSettings();
    });
  } catch (e) {
    if (isInvalidatedError(e)) teardown();
  }
}

function onMessage(msg) {
  if (!isContextValid()) {
    teardown();
    return;
  }
  if (msg.action !== "applyBlur") return;
  if (typeof msg.blur === "number") settings.blur = msg.blur;

  if (msg.enabled && blurPx(settings.blur) > 0) {
    document.documentElement.classList.remove("ibt-pending");
    document.documentElement.classList.add("ibt-on");
    applyAll({ includeBg: true });
  } else {
    clearAllBlur();
    stopEnforceLoop();
  }
}

function onStorageChanged(changes, areaName) {
  if (!isContextValid()) {
    teardown();
    return;
  }
  if (areaName !== "sync") return;

  let relevant = false;
  if (changes.enabled) {
    settings.enabled = changes.enabled.newValue ?? false;
    relevant = true;
  }
  if (changes.blur) {
    settings.blur = changes.blur.newValue ?? 0;
    relevant = true;
  }
  if (changes.whitelist) {
    settings.whitelist = Array.isArray(changes.whitelist.newValue)
      ? changes.whitelist.newValue
      : [];
    relevant = true;
  }
  if (changes.enableVideo) {
    settings.enableVideo = changes.enableVideo.newValue ?? true;
    relevant = true;
  }
  if (changes.enableCanvas) {
    settings.enableCanvas = changes.enableCanvas.newValue ?? true;
    relevant = true;
  }
  if (changes.enableBgImage) {
    settings.enableBgImage = changes.enableBgImage.newValue ?? true;
    relevant = true;
  }
  if (changes.skipTinyImages) {
    settings.skipTinyImages = changes.skipTinyImages.newValue ?? true;
    relevant = true;
  }
  if (changes.coverageMode) {
    settings.coverageMode = changes.coverageMode.newValue || "auto";
    relevant = true;
  }
  if (relevant) applyFromSettings();
}

function onMediaLoadCapture(e) {
  if (!shouldBlurNow()) return;
  const t = e.target;
  if (!t || t.nodeType !== 1) return;
  if (["IMG", "VIDEO", "CANVAS", "OBJECT"].includes(t.tagName)) {
    applyMediaInline();
  }
}

function setupObserver() {
  if (!isContextValid()) {
    teardown();
    return;
  }
  if (!document.body) {
    setTimeout(setupObserver, 50);
    return;
  }
  if (window.__blurObserverAttached) return;
  window.__blurObserverAttached = true;

  const mode = () => resolvedCoverageMode();

  observer = new MutationObserver((mutations) => {
    if (!isContextValid()) {
      teardown();
      return;
    }
    if (!shouldBlurNow() || blurPx(settings.blur) <= 0) return;

    let needsMedia = false;
    let needsBg = false;
    for (const m of mutations) {
      if (m.addedNodes && m.addedNodes.length) {
        needsMedia = true;
        needsBg = true;
      }
      if (m.type === "attributes") {
        needsMedia = true;
        if (m.attributeName === "style" || m.attributeName === "class") {
          needsBg = true;
        }
      }
    }
    if (!needsMedia && !needsBg) return;

    clearTimeout(debounceTimer);
    const delay = mode() === "maximum" ? 40 : 120;
    debounceTimer = setTimeout(() => {
      applyStylesEverywhere(false);
      if (needsMedia) applyMediaInline();
      if (needsBg && settings.enableBgImage) applyBgImages();
    }, delay);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["style", "class", "src", "srcset"],
  });
}

// If Chrome reinjects after an extension reload, drop the previous instance first.
if (typeof window.__ibtTeardown === "function") {
  try {
    window.__ibtTeardown();
  } catch (_) {}
}

if (isContextValid()) {
  try {
    window.__ibtTeardown = teardown;
    chrome.runtime.onMessage.addListener(onMessage);
    chrome.storage.onChanged.addListener(onStorageChanged);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("load", onMediaLoadCapture, true);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", teardown);
    loadSettings(applyFromSettings);
  } catch (e) {
    if (isInvalidatedError(e)) teardown();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupObserver, { once: true });
  } else {
    setupObserver();
  }
}
