/* ============================================================================
 * RELAY demo — white-label theming (brand.js)  [REQUIREMENTS §3.5]
 * Overrides the small set of --brand-* tokens at runtime from config.brand.
 * Derives WCAG-AA-legible ink colors programmatically (don't trust a customer
 * to pick an accessible accent). Everything else inherits the RELAY base.
 * ========================================================================== */
(function () {
  'use strict';
  var R = (window.RELAY = window.RELAY || {});
  var U = R.util;

  /* applyBrand(brand, root?) — paints brand tokens onto :root (or a scope) */
  function applyBrand(brand, root) {
    brand = brand || {};
    var style = (root || document.documentElement).style;
    if (brand.primary) {
      style.setProperty('--brand-primary', brand.primary);
      style.setProperty('--brand-primary-ink', U.readableInk(brand.primary));
    }
    if (brand.accent) {
      style.setProperty('--brand-accent', brand.accent);
      style.setProperty('--brand-accent-ink', U.readableInk(brand.accent));
    }
    if (brand.font) style.setProperty('--font-brand', brand.font + ', ' + 'var(--font-ui)');
    if (brand.favicon) setFavicon(brand.favicon);
    if (brand.name) document.title = brand.name;
  }

  function setFavicon(href) {
    var link = document.querySelector('link[rel="icon"]') || document.createElement('link');
    link.rel = 'icon'; link.href = href;
    if (!link.parentNode) document.head.appendChild(link);
  }

  /* logoMark(brand) — returns HTML for a logo or a clean wordmark fallback */
  function logoMark(brand) {
    brand = brand || {};
    if (brand.logo) {
      return '<img class="brandmark__img" src="' + U.attr(brand.logo) + '" alt="' + U.attr(brand.name || '') + '">';
    }
    var label = brand.wordmark || brand.name || 'Brand';
    return '<span class="brandmark__word">' + U.esc(label) + '</span>';
  }

  R.brand = { applyBrand: applyBrand, logoMark: logoMark, setFavicon: setFavicon };
})();
