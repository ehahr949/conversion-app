/* ============================================================================
 * RELAY demo — shared utilities (util.js)
 * No imports (file:// safe). Attaches helpers to window.RELAY.util.
 * ========================================================================== */
(function () {
  'use strict';
  var R = (window.RELAY = window.RELAY || {});

  /* ---- esc(): HTML-escape (prototype convention, REQUIREMENTS §3.2) ------ */
  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---- attr(): escape for an attribute value ---------------------------- */
  function attr(s) { return esc(s); }

  /* ---- id(): short unique id -------------------------------------------- */
  function id(prefix) {
    return (prefix || 'id') + '_' +
      Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  /* ---- deepMerge(): recursive merge, arrays are shallow-set ------------- */
  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  function deepMerge(base, over) {
    if (!isObj(base)) base = {};
    var out = {};
    var k;
    for (k in base) if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k];
    if (!isObj(over)) return out;
    for (k in over) {
      if (!Object.prototype.hasOwnProperty.call(over, k)) continue;
      var ov = over[k];
      if (isObj(ov) && isObj(out[k])) out[k] = deepMerge(out[k], ov);
      else out[k] = ov;
    }
    return out;
  }

  /* ---- clone(): structural clone --------------------------------------- */
  function clone(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }

  /* ---- query helpers ---------------------------------------------------- */
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) if (attrs.hasOwnProperty(k)) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    if (html !== undefined) n.innerHTML = html;
    return n;
  }
  /* Delegated event binding */
  function on(root, evt, sel, fn) {
    root.addEventListener(evt, function (e) {
      var t = e.target.closest(sel);
      if (t && root.contains(t)) fn(e, t);
    });
  }

  /* ---- formatting ------------------------------------------------------- */
  function money(n) {
    n = Number(n) || 0;
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function pct(n, digits) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return (Number(n)).toFixed(digits == null ? 0 : digits) + '%';
  }
  function timeAgo(ts) {
    if (!ts) return '';
    var s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
    if (s < 60) return 'just now';
    var m = s / 60; if (m < 60) return Math.floor(m) + 'm ago';
    var h = m / 60; if (h < 24) return Math.floor(h) + 'h ago';
    var d = h / 24; if (d < 30) return Math.floor(d) + 'd ago';
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  function initials(name) {
    if (!name) return '?';
    var p = String(name).trim().split(/\s+/);
    return (p[0][0] + (p[1] ? p[1][0] : '')).toUpperCase();
  }

  /* ---- color: derive a WCAG-AA readable ink for an arbitrary brand bg --- */
  function hexToRgb(hex) {
    hex = String(hex || '').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(hex || '000000', 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function relLum(rgb) {
    function lin(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
  }
  function contrastRatio(hexA, hexB) {
    var la = relLum(hexToRgb(hexA)), lb = relLum(hexToRgb(hexB));
    var hi = Math.max(la, lb), lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }
  /* Pick black or white ink for legibility on a given bg (AA target). */
  function readableInk(bgHex) {
    var onWhite = contrastRatio(bgHex, '#ffffff');
    var onBlack = contrastRatio(bgHex, '#16181f');
    return onWhite >= onBlack ? '#ffffff' : '#16181f';
  }

  R.util = {
    esc: esc, attr: attr, id: id, deepMerge: deepMerge, clone: clone,
    qs: qs, qsa: qsa, el: el, on: on,
    money: money, pct: pct, timeAgo: timeAgo, initials: initials,
    hexToRgb: hexToRgb, contrastRatio: contrastRatio, readableInk: readableInk
  };
})();
