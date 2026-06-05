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
    var key = name === 'studio' || name === 'studio-intro' ? '' : name;
    U.qsa('.sidebar .navitem', app).forEach(function (a) {
      a.classList.toggle('is-active', a.getAttribute('data-nav') === key);
    });
  }

  /* Monarch-style line icons (inline SVG, currentColor) */
  var ICONS = {
    mark: '<svg class="sidebar__mark" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 12c-1.6-3.8-4-5.5-6.4-5.5C3.2 6.5 2 8.2 2 10.3 2 13.2 4.6 15 8 15c1.7 0 3.1-.6 4-1.6V19h0c.9 1 2.3 1.6 4 1.6 3.4 0 6-1.8 6-4.7 0-2.1-1.2-3.8-3.6-3.8-2.4 0-4.8 1.7-6.4 5.5z" opacity=".25"/><path d="M12 11.5c-1.5-3.3-3.7-4.8-5.8-4.8C4 6.7 3 8.1 3 9.9c0 2.5 2.3 4.1 5.2 4.1 1.6 0 3-.6 3.8-1.6.8 1 2.2 1.6 3.8 1.6 2.9 0 5.2-1.6 5.2-4.1 0-1.8-1-3.2-3.2-3.2-2.1 0-4.3 1.5-5.8 4.8z"/></svg>',
    queue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
    performance: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5M4 19h16M8 16v-4M12.5 16V9M17 16v-7"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 13a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V19a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 13H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1A2 2 0 1 1 8 3.2l.1.1a1.7 1.7 0 0 0 2.9-1.2V2a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 17.9 3.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 19.4 9H20a2 2 0 1 1 0 4h-.6z"/></svg>',
    studio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10.5 21.5 7v10l-6-3.5z"/></svg>'
  };

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
      '<div class="shell">' +
        '<aside class="sidebar">' +
          '<a class="sidebar__brand" href="#/queue">' + ICONS.mark + 'RELAY</a>' +
          '<div class="navsection">Workspace</div>' +
          navitem('queue', 'Queue', ICONS.queue) +
          navitem('performance', 'Performance', ICONS.performance) +
          navitem('settings', 'Settings', ICONS.settings) +
          '<div class="navsection">Create</div>' +
          '<a class="navitem" href="#/studio-intro">' + ICONS.studio + '<span class="navitem__label">Record intro</span></a>' +
          '<div class="sidebar__spacer"></div>' +
          '<div class="sidebar__foot">' +
            '<div class="sidebar__acct"><span class="avatar">' + esc(U.initials(cfg.brand.name)) + '</span>' +
              '<div style="min-width:0"><strong style="display:block;font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(cfg.brand.name) + '</strong>' +
              '<span class="muted" style="font-size:.72rem">' + esc(cfg.account ? (cfg.account.plan || 'Practice') : 'Practice') + ' plan</span></div></div>' +
            '<select data-role title="Acting as (role picker)">' + roleOpts(cfg) + '</select>' +
            '<button class="btn btn--ghost btn--sm" data-act="reset" title="Wipe + reseed the demo">↻ Reset demo</button>' +
          '</div>' +
        '</aside>' +
        '<main class="main" id="content"></main>' +
      '</div>';
    content = U.qs('#content', app);

    U.on(app, 'change', '[data-role]', function (e, t) { setRole(t.value); navigate(); });
    U.on(app, 'click', '[data-act="reset"]', function () {
      if (confirm('Reset the demo? This wipes all local leads/config and reseeds the sample plastics account.')) {
        S.reset(); currentRole = null; renderShell(); navigate(); R.app.toast('Demo reset to seed data.');
      }
    });
  }
  function navitem(name, label, icon) {
    return '<a class="navitem" data-nav="' + name + '" href="#/' + name + '">' + icon + '<span class="navitem__label">' + esc(label) + '</span></a>';
  }
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
