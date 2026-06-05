/* ============================================================================
 * RELAY demo — Settings / onboarding (settings.js)  [REQUIREMENTS §8.8]
 * Shell fidelity (DEMO §5) but brand/booking/tracking actually save via the
 * store API and re-theme live. Account & billing = Stripe-portal link only.
 * ========================================================================== */
(function () {
  'use strict';
  var R = window.RELAY, U = R.util, S = R.store, esc = U.esc;
  var SECTION = 'onboarding';

  var SECTIONS = [
    { k: 'onboarding', l: 'Onboarding' },
    { k: 'practice', l: 'Practice & provider' },
    { k: 'brand', l: 'Brand & theme' },
    { k: 'intro', l: 'Intro video' },
    { k: 'team', l: 'Team & permissions' },
    { k: 'booking', l: 'Booking' },
    { k: 'tracking', l: 'Tracking & attribution' },
    { k: 'widgets', l: 'Widgets' },
    { k: 'billing', l: 'Account & billing' }
  ];

  function render(c) {
    var cfg = S.config();
    c.innerHTML =
      '<div class="wrap"><div class="page-head"><div><h1>Settings</h1><p>Your zero-integration setup — paste a snippet, record a video, go live.</p></div></div>' +
      '<div class="settings">' +
        '<nav class="settings__nav">' + SECTIONS.map(function (s) {
          return '<button data-sec="' + s.k + '" class="' + (s.k === SECTION ? 'is-active' : '') + '">' + esc(s.l) + '</button>';
        }).join('') + '</nav>' +
        '<div data-secbody></div>' +
      '</div></div>';
    U.on(c, 'click', '[data-sec]', function (e, t) { SECTION = t.getAttribute('data-sec'); render(c); });
    renderSection(c, cfg);
  }

  function renderSection(c, cfg) {
    var host = U.qs('[data-secbody]', c);
    host.innerHTML = (BODIES[SECTION] || function () { return ''; })(cfg);
    wire(c, cfg);
  }

  var BODIES = {
    onboarding: function (cfg) {
      var done = {
        brand: !!cfg.brand.primary, intro: !!(cfg.introVideo && cfg.introVideo.recordedAt),
        booking: !!(cfg.booking && cfg.booking.mode), pixels: !!(cfg.analytics && cfg.analytics.metaPixelId),
        widget: true
      };
      function item(ok, label, action) {
        return '<div class="checklist__item' + (ok ? ' is-done' : '') + '"><div class="checklist__check">' + (ok ? '✓' : '') + '</div>' +
          '<div class="grow"><strong>' + esc(label) + '</strong></div>' + (action || '') + '</div>';
      }
      return '<div class="card"><div class="card__title">First-run checklist</div><div class="checklist">' +
        item(done.brand, 'Set your brand', '<button class="btn btn--sm" data-go="brand">Edit</button>') +
        item(done.intro, 'Record your intro video', '<a class="btn btn--sm" href="#/studio-intro">Record</a>') +
        item(done.booking, 'Set booking mode', '<button class="btn btn--sm" data-go="booking">Edit</button>') +
        item(done.pixels, 'Paste pixel IDs', '<button class="btn btn--sm" data-go="tracking">Edit</button>') +
        item(done.widget, 'Grab a widget snippet', '<a class="btn btn--sm" href="widgets.html" target="_blank">Open</a>') +
        '</div><p class="muted" style="font-size:.82rem;margin-top:14px">That’s the entire setup. No CRM, PMS, calendar, or ad-account integration required (§3.1).</p></div>';
    },

    practice: function (cfg) {
      var p = cfg.provider;
      return card('Provider', [
        field('Name', 'provider.name', p.name),
        field('Credential', 'provider.credential', p.credential),
        field('Specialty', 'provider.specialty', p.specialty),
        field('City', 'provider.city', p.city), field('State', 'provider.state', p.state),
        '<label class="field"><span>Bio</span><textarea data-cfg="provider.bio">' + esc(p.bio) + '</textarea></label>'
      ]);
    },

    brand: function (cfg) {
      var b = cfg.brand;
      return '<div class="settings" style="grid-template-columns:1fr 280px">' +
        card('White-label brand (what patients see)', [
          field('Practice name', 'brand.name', b.name),
          field('Wordmark', 'brand.wordmark', b.wordmark),
          colorField('Primary color', 'brand.primary', b.primary),
          colorField('Accent color', 'brand.accent', b.accent),
          field('Logo URL (optional)', 'brand.logo', b.logo),
          '<p class="muted" style="font-size:.8rem">Colors re-theme the patient flow, recap card, portal, widgets and Studio slides instantly. ' +
          'Ink colors are derived for WCAG-AA contrast automatically (§3.5).</p>'
        ]) +
        '<div><div class="card__title">Live preview</div>' + brandPreview(cfg) + '</div></div>';
    },

    intro: function (cfg) {
      var iv = cfg.introVideo || {};
      return card('Intro / credential video (§4.1A)', [
        '<p class="muted" style="font-size:.88rem;margin-top:0">Recorded once, reused for every lead. It fires at the exact moment of the contact ask — the heart of the conversion engine.</p>' +
        '<div class="card card--pad-sm" style="background:var(--color-surface-2)">' +
          (iv.recordedAt ? '✓ Recorded ' + esc(U.timeAgo(iv.recordedAt)) + ' · ' + (iv.durationSec || 0) + 's' : 'Not recorded yet') + '</div>' +
        '<a class="btn btn--accent btn--lg" href="#/studio-intro" style="margin-top:14px">🎬 ' + (iv.recordedAt ? 'Re-record' : 'Record') + ' intro video</a>'
      ]);
    },

    team: function (cfg) {
      var rows = (cfg.staff || []).map(function (s) {
        return '<div class="row spread" style="padding:10px 0;border-bottom:1px solid var(--color-border)"><div><strong>' + esc(s.name) + '</strong><br><span class="muted" style="font-size:.82rem">' + esc(s.role) + '</span></div>' +
          '<span class="pill ' + (s.canRecord ? 'pill--ok' : '') + '">' + (s.canRecord ? '✓ can record' : 'view only') + '</span></div>';
      }).join('');
      return card('Team & permissions', [rows]);
    },

    booking: function (cfg) {
      var bk = cfg.booking;
      return card('Booking (§8.6)', [
        '<label class="field"><span>Mode</span><select data-cfg="booking.mode">' +
          ['link', 'deposit', 'requestTime'].map(function (m) { return '<option value="' + m + '"' + (bk.mode === m ? ' selected' : '') + '>' + ({ link: 'Link out to my booker', deposit: 'Deposit-to-reserve (recommended)', requestTime: 'Request-a-time' })[m] + '</option>'; }).join('') + '</select></label>',
        field('Booking URL (your Calendly/PMS)', 'booking.bookingUrl', bk.bookingUrl),
        field('Deposit amount ($)', 'booking.depositAmount', bk.depositAmount, 'number'),
        '<p class="muted" style="font-size:.8rem">A refundable deposit reserves intent with zero calendar integration — processed via Stripe (§3.4).</p>'
      ]);
    },

    tracking: function (cfg) {
      var an = cfg.analytics || {};
      var aliases = cfg.sourceAliases || {};
      var aliasRows = Object.keys(aliases).map(function (k) {
        return '<div class="row" style="margin-bottom:6px"><input type="text" value="' + esc(k) + '" data-alias-key style="max-width:140px"><span>→</span><input type="text" value="' + esc(aliases[k]) + '" data-alias-val></div>';
      }).join('');
      return card('Tracking & attribution (§5)', [
        field('Meta Pixel ID', 'analytics.metaPixelId', an.metaPixelId),
        field('GA4 Measurement ID', 'analytics.ga4Id', an.ga4Id),
        field('Google Ads ID', 'analytics.googleAdsId', an.googleAdsId),
        '<p class="muted" style="font-size:.8rem">Pasting an ID is config, not integration. RELAY fires the pixels and owns the offline-conversion feedback.</p>' +
        '<div class="card__title" style="margin-top:14px">Source aliases</div>' + aliasRows +
        '<div class="card__title" style="margin-top:14px">Offline-conversion export</div>' +
        '<a class="btn btn--primary" href="#/performance">Go to Performance → export →</a>'
      ]);
    },

    widgets: function (cfg) {
      return card('Widgets & embeds (§8.1)', [
        '<p class="muted" style="margin-top:0">Drop a snippet on any page. It captures attribution on load and opens the patient flow.</p>' +
        '<a class="btn btn--accent btn--lg" href="widgets.html" target="_blank">Open widget gallery →</a>' +
        '<div style="margin-top:14px"><a href="bio.html" target="_blank">Preview link-in-bio page ↗</a></div>'
      ]);
    },

    billing: function (cfg) {
      var ac = cfg.account || {};
      return card('Account & billing (§3.4)', [
        '<div class="kv"><dt>Plan</dt><dd>' + esc(ac.plan || '—') + '</dd>' +
          '<dt>Status</dt><dd><span class="pill pill--ok">' + esc(ac.status || 'active') + '</span></dd>' +
          '<dt>Stripe customer</dt><dd>' + esc(ac.stripeCustomerId || '—') + '</dd></div>' +
        '<p class="muted" style="font-size:.85rem;margin-top:14px">RELAY renders no invoices or payment methods — everything money-facing lives in Stripe.</p>' +
        '<button class="btn btn--primary" data-act="billingportal">Manage billing in Stripe ↗</button>'
      ]);
    }
  };

  function brandPreview(cfg) {
    var b = cfg.brand;
    return '<div class="mini-phone" data-brandpreview>' +
      '<div class="brandbar" style="--brand-primary:' + esc(b.primary) + '"><span class="brandmark" style="color:' + esc(b.primary) + '">' + R.brand.logoMark(b) + '</span></div>' +
      '<div style="padding:16px;background:#fff">' +
        '<div class="avatar avatar--lg" style="margin:0 auto 10px;background:' + esc(b.primary) + ';color:' + esc(U.readableInk(b.primary)) + '">' + esc(U.initials(cfg.provider.name)) + '</div>' +
        '<p class="center" style="font-size:.85rem;margin:0 0 12px">' + esc(cfg.provider.name) + '</p>' +
        '<div class="btn btn--block" style="background:' + esc(b.accent) + ';color:' + esc(U.readableInk(b.accent)) + '">Start my consult</div>' +
      '</div></div>';
  }

  /* ---- helpers ---------------------------------------------------------- */
  function card(title, items) { return '<div class="card"><div class="card__title">' + esc(title) + '</div>' + items.join('') + '</div>'; }
  function field(label, path, val, type) {
    return '<label class="field"><span>' + esc(label) + '</span><input type="' + (type || 'text') + '" data-cfg="' + esc(path) + '" value="' + esc(val == null ? '' : val) + '"></label>';
  }
  function colorField(label, path, val) {
    return '<label class="field"><span>' + esc(label) + '</span><div class="row"><input type="color" data-cfg="' + esc(path) + '" value="' + esc(val || '#000000') + '" style="width:52px;padding:3px;height:42px">' +
      '<input type="text" data-cfg="' + esc(path) + '" value="' + esc(val || '') + '" class="grow"></div></label>';
  }

  /* set a nested config path */
  function setPath(obj, path, val) {
    var parts = path.split('.'), o = obj;
    for (var i = 0; i < parts.length - 1; i++) { o[parts[i]] = o[parts[i]] || {}; o = o[parts[i]]; }
    o[parts[parts.length - 1]] = val;
    return obj;
  }

  function wire(c, cfg) {
    U.on(c, 'click', '[data-go]', function (e, t) { SECTION = t.getAttribute('data-go'); render(c); });
    U.on(c, 'click', '[data-act="billingportal"]', function () {
      R.devconsole && R.devconsole.info('Stripe billing portal session (faked)', { customer: (cfg.account || {}).stripeCustomerId });
      R.app.toast('In production this deep-links to the Stripe-hosted billing portal.');
    });
    c.addEventListener('input', function (e) {
      var t = e.target;
      if (t.matches('[data-cfg]')) {
        var path = t.getAttribute('data-cfg');
        var val = t.type === 'number' ? Number(t.value) : t.value;
        var patch = setPath({}, path, val);
        S.saveConfig(patch);
        /* live re-theme on brand change */
        if (path.indexOf('brand.') === 0) {
          var b = S.config().brand; R.brand.applyBrand(b);
          var prev = U.qs('[data-secbody]', c);
          if (SECTION === 'brand') { var box = c.querySelector('[data-brandpreview]'); if (box) box.outerHTML = brandPreview(S.config()).replace(/^<div class="mini-phone"/, '<div class="mini-phone" data-brandpreview'); }
        }
      }
    });
    /* alias editor save */
    c.addEventListener('change', function (e) {
      if (e.target.matches('[data-alias-key], [data-alias-val]')) {
        var aliases = {};
        U.qsa('[data-alias-key]', c).forEach(function (k, i) {
          var v = U.qsa('[data-alias-val]', c)[i];
          if (k.value.trim()) aliases[k.value.trim()] = v.value.trim();
        });
        S.saveConfig({ sourceAliases: aliases });
        R.app.toast('Source aliases saved.');
      }
    });
  }

  R.surfaces = R.surfaces || {};
  R.surfaces.settings = { render: render };
})();
