/* ============================================================================
 * RELAY demo — embeddable widget script (embed.js)  [REQUIREMENTS §8.1]
 * Self-contained, dependency-free. Injects its own scoped styles, reads config
 * from data-* attributes, supports auto-mount + programmatic render(target,opts).
 * Each widget: captures attribution on load, tracks the tap BEFORE navigating,
 * defaults its target to the patient flow.
 * ========================================================================== */
(function () {
  'use strict';
  var BASE = (function () {
    var s = document.currentScript || (function () { var a = document.getElementsByTagName('script'); return a[a.length - 1]; })();
    return s && s.src ? s.src.replace(/embed\.js.*$/, '') : '';
  })();
  var FLOW = BASE + 'flow.html';

  /* lightweight attribution + event passthrough (mirrors §5.1 parse-in) */
  function currentQuery() { return window.location.search ? window.location.search.replace(/^\?/, '') : ''; }
  function withSource(target, widgetType) {
    var q = currentQuery();
    var sep = target.indexOf('?') >= 0 ? '&' : '?';
    var extra = 'from=' + encodeURIComponent(widgetType);
    return target + (q ? sep + q + '&' + extra : sep + extra);
  }

  function logTap(widgetType, headline) {
    try {
      var KEY = 'relay.demo.events.v1';
      var list = JSON.parse(localStorage.getItem(KEY) || '[]');
      list.push({ name: 'widget_tap', ts: new Date().toISOString(), props: { widget: widgetType, headline: headline } });
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch (e) {}
  }
  function logView(widgetType) {
    try {
      var KEY = 'relay.demo.events.v1';
      var list = JSON.parse(localStorage.getItem(KEY) || '[]');
      list.push({ name: 'widget_view', ts: new Date().toISOString(), props: { widget: widgetType } });
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch (e) {}
  }

  var STYLE_ID = 'relay-embed-style';
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css =
      '.relay-w{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;box-sizing:border-box}' +
      '.relay-w *{box-sizing:border-box}' +
      '.relay-inline{border:1px solid #e3e3ea;border-radius:16px;padding:22px;max-width:440px;background:#fff;box-shadow:0 4px 14px rgba(20,20,30,.08)}' +
      '.relay-inline h3{margin:0 0 6px;font-size:1.2rem;color:#16181f}' +
      '.relay-inline p{margin:0 0 16px;color:#5a5a6a;font-size:.92rem}' +
      '.relay-cta{display:inline-flex;align-items:center;gap:8px;background:var(--rw-accent,#df8a5c);color:#fff;border:none;border-radius:10px;padding:13px 20px;font-weight:650;font-size:1rem;cursor:pointer;text-decoration:none}' +
      '.relay-row{display:flex;align-items:center;gap:12px;margin-bottom:14px}' +
      '.relay-av{width:46px;height:46px;border-radius:50%;background:var(--rw-primary,#1f4d3d);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;flex:none}' +
      '.relay-pill-float{position:fixed;right:18px;bottom:18px;z-index:2147483000;background:var(--rw-primary,#1f4d3d);color:#fff;border:none;border-radius:999px;padding:13px 20px;font-weight:650;font-size:.95rem;cursor:pointer;box-shadow:0 8px 26px rgba(20,20,30,.28);display:flex;align-items:center;gap:9px}' +
      '.relay-pill-float .relay-dot{width:9px;height:9px;border-radius:50%;background:var(--rw-accent,#df8a5c);box-shadow:0 0 0 0 var(--rw-accent,#df8a5c);animation:relaypulse 2s infinite}' +
      '@keyframes relaypulse{0%{box-shadow:0 0 0 0 rgba(223,138,92,.6)}70%{box-shadow:0 0 0 10px rgba(223,138,92,0)}100%{box-shadow:0 0 0 0 rgba(223,138,92,0)}}' +
      '.relay-takeover{min-height:420px;border-radius:18px;background:linear-gradient(150deg,var(--rw-primary,#1f4d3d),#10271e);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px}' +
      '.relay-takeover h2{font-size:1.9rem;margin:0 0 10px}.relay-takeover p{opacity:.85;max-width:420px;margin:0 0 22px}';
    var s = document.createElement('style'); s.id = STYLE_ID; s.textContent = css; document.head.appendChild(s);
  }

  function readOpts(elm, opts) {
    opts = opts || {};
    function d(k, def) { return opts[k] != null ? opts[k] : (elm && elm.getAttribute('data-' + k)) || def; }
    return {
      type: d('relay-widget', opts.type || 'inline'),
      headline: d('headline', 'See what’s possible — a personal video from the surgeon'),
      sub: d('sub', 'Answer a few quick questions and get a video about your specific goals — usually within 24 hours.'),
      cta: d('cta', 'Start my consult'),
      provider: d('provider', 'Dr. Mara Vance'),
      primary: d('primary', '#0f5e5a'),
      accent: d('accent', '#d98a4e'),
      target: d('target', FLOW)
    };
  }

  function go(o) { logTap(o.type, o.headline); window.location.href = withSource(o.target, o.type); }

  function buildInline(o) {
    var w = document.createElement('div');
    w.className = 'relay-w relay-inline';
    w.style.setProperty('--rw-primary', o.primary); w.style.setProperty('--rw-accent', o.accent);
    var init = o.provider.split(' ').map(function (x) { return x[0]; }).slice(0, 2).join('').toUpperCase();
    w.innerHTML =
      '<div class="relay-row"><div class="relay-av">' + init + '</div><div><strong>' + esc(o.provider) + '</strong><br><span style="color:#7a7a88;font-size:.85rem">Board-certified · ★ 4.9</span></div></div>' +
      '<h3>' + esc(o.headline) + '</h3><p>' + esc(o.sub) + '</p>' +
      '<a class="relay-cta" href="#" data-go>🎥 ' + esc(o.cta) + '</a>';
    w.querySelector('[data-go]').addEventListener('click', function (e) { e.preventDefault(); go(o); });
    logView(o.type);
    return w;
  }
  function buildFloat(o) {
    var b = document.createElement('button');
    b.className = 'relay-w relay-pill-float';
    b.style.setProperty('--rw-primary', o.primary); b.style.setProperty('--rw-accent', o.accent);
    b.innerHTML = '<span class="relay-dot"></span>🎥 ' + esc(o.cta);
    b.addEventListener('click', function () { go(o); });
    logView(o.type);
    return b;
  }
  function buildTakeover(o) {
    var w = document.createElement('div');
    w.className = 'relay-w relay-takeover';
    w.style.setProperty('--rw-primary', o.primary); w.style.setProperty('--rw-accent', o.accent);
    w.innerHTML = '<h2>' + esc(o.headline) + '</h2><p>' + esc(o.sub) + '</p><a class="relay-cta" href="#" data-go>🎥 ' + esc(o.cta) + '</a>';
    w.querySelector('[data-go]').addEventListener('click', function (e) { e.preventDefault(); go(o); });
    logView(o.type);
    return w;
  }

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function build(o) {
    if (o.type === 'floating') return buildFloat(o);
    if (o.type === 'takeover') return buildTakeover(o);
    return buildInline(o);
  }

  function render(target, opts) {
    injectStyles();
    var o = readOpts(null, opts);
    var node = build(o);
    if (o.type === 'floating') { document.body.appendChild(node); return node; }
    var host = typeof target === 'string' ? document.querySelector(target) : target;
    if (host) host.appendChild(node);
    return node;
  }

  function autoMount() {
    injectStyles();
    var nodes = document.querySelectorAll('[data-relay-widget]');
    Array.prototype.forEach.call(nodes, function (elm) {
      if (elm.getAttribute('data-relay-mounted')) return;
      elm.setAttribute('data-relay-mounted', '1');
      var o = readOpts(elm);
      elm.appendChild(build(o));
    });
  }

  window.RelayWidget = { render: render, autoMount: autoMount };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount);
  else autoMount();
})();
