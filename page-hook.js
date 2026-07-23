// Runs in the page MAIN world at document_start.
// Many Adobe apps use closed shadow roots; forcing open lets the
// extension content script find and blur media inside them.
(function () {
  try {
    if (window.__ibtShadowHooked) return;
    window.__ibtShadowHooked = true;
    const original = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (init) {
      const next = Object.assign({}, init || {}, { mode: "open" });
      return original.call(this, next);
    };
  } catch (_) {}
})();
