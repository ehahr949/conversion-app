/* ============================================================================
 * RELAY demo — provider console shell + router (app.js)  [REQUIREMENTS §8.3]
 * RELAY-branded SPA. Hash routes: #/queue #/performance #/settings
 * #/studio/<leadId> (consult mode) #/studio-intro (onboarding intro mode).
 * The console is a timed WORK QUEUE, not a CRM.
 * ========================================================================== */
(function () {
  'use strict';
  var R = window.RELAY, U = R.util, S = R.store, esc = U.esc;

  var app, content, currentRole = null;

  var ROUTES = {
    'queue': function (c) { R.surfaces.queue.render(c); },
    'performance': function (c) { R.surfaces.performance.render(c); },
    'settings': function (c) { R.surfaces.settings.render(c); },
    'studio': function (c, arg) { R.surfaces.studio.render(c, { mode: 'consult', leadId: arg }); },
    'studio-intro': function (c) { R.surfaces.studio.render(c, { mode: 'intro' }); }
  };

  function parseHash() {
    var h = (location.hash || '#/queue').replace(/^#\/?/, '');
    var parts = h.split('/');
    return { name: parts[0] || 'queue', arg: parts[1] || null };
  }

  function navigate() {
    var r = parseHash();
    var fn = ROUTES[r.name] || ROUTES.queue;
    setActiveNav(r.name);
    content.innerHTML = '';
    try { fn(content, r.arg); }
    catch (e) { content.innerHTML = '<div class="wrap"><div class="card">Error rendering view: ' + esc(e.message) + '</div></div>'; throw e; }
  }

  function setActiveNav(name) {
    U.qsa('.appbar nav a', app).forEach(function (a) {
      a.classList.toggle('is-active', a.getAttribute('data-nav') === name);
    });
  }

  function role() {
    var cfg = S.config();
    if (!currentRole) currentRole = (cfg.staff && cfg.staff[0] && cfg.staff[0].id) || null;
    var st = (cfg.staff || []).filter(function (s) { return s.id === currentRole; })[0];
    return st || (cfg.staff && cfg.staff[0]) || { id: null, name: 'You', canRecord: true };
  }
  function setRole(id) { currentRole = id; }

  function renderShell() {
    var cfg = S.config();
    app.innerHTML =
      '<header class="appbar">' +
        '<a class="appbar__brand" href="#/queue"><span class="appbar__logo display">R</span> RELAY</a>' +
        '<nav>' +
          navlink('queue', 'Queue') + navlink('performance', 'Performance') + navlink('settings', 'Settings') +
        '</nav>' +
        '<div class="appbar__right">' +
          '<span class="muted" style="font-size:.78rem">' + esc(cfg.brand.name) + '</span>' +
          '<select data-role title="Acting as (role picker)">' + roleOpts(cfg) + '</select>' +
          '<button class="btn btn--sm" data-act="reset" title="Wipe + reseed the demo">↻ Reset demo</button>' +
        '</div>' +
      '</header>' +
      '<main id="content"></main>';
    content = U.qs('#content', app);

    U.on(app, 'change', '[data-role]', function (e, t) { setRole(t.value); navigate(); });
    U.on(app, 'click', '[data-act="reset"]', function () {
      if (confirm('Reset the demo? This wipes all local leads/config and reseeds the sample plastics account.')) {
        S.reset(); currentRole = null; renderShell(); navigate(); R.app.toast('Demo reset to seed data.');
      }
    });
  }
  function navlink(name, label) { return '<a data-nav="' + name + '" href="#/' + name + '">' + esc(label) + '</a>'; }
  function roleOpts(cfg) {
    return (cfg.staff || []).map(function (s) {
      return '<option value="' + esc(s.id) + '"' + (s.id === role().id ? ' selected' : '') + '>' + esc(s.name) + ' · ' + esc(s.role) + '</option>';
    }).join('');
  }

  function toast(msg) {
    var host = document.querySelector('.toast-host') || (function () { var h = U.el('div', { class: 'toast-host' }); document.body.appendChild(h); return h; })();
    var t = U.el('div', { class: 'toast', text: msg }); host.appendChild(t);
    setTimeout(function () { t.remove(); }, 3200);
  }

  function init(mountEl) {
    app = mountEl;
    S.seed();
    R.brand.applyBrand({}); /* console uses RELAY product brand, not white-label */
    renderShell();
    window.addEventListener('hashchange', navigate);
    /* live re-render queue/perf when store changes from another surface/tab */
    S.onChange(function (kind) {
      var r = parseHash();
      if ((kind === 'leads') && (r.name === 'queue' || r.name === 'performance')) navigate();
    });
    navigate();
  }

  R.app = { init: init, navigate: navigate, role: role, setRole: setRole, toast: toast,
            go: function (hash) { location.hash = hash; } };
})();
