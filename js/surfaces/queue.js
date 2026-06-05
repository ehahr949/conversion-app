/* ============================================================================
 * RELAY demo — provider console: Queue + Lead Drawer (queue.js)  [§8.3]
 * Timed work queue (tier rank → SLA urgency). Drawer = the workspace, driven by
 * a stage-engine nextAction(lead). Fake "send" shows SMS/email preview + dev-console
 * log + copy-link (DEMO §3). Conversion box feeds revenue + the attribution loop.
 * ========================================================================== */
(function () {
  'use strict';
  var R = window.RELAY, U = R.util, S = R.store, esc = U.esc;
  var track = function (n, p) { R.instrument.track(n, p); };
  var FILTER = 'all', openLeadId = null, container;

  /* ---- filters ---------------------------------------------------------- */
  var FILTERS = [
    { key: 'all',     label: 'All' },
    { key: 'mine',    label: 'Mine' },
    { key: 'unassigned', label: 'Unassigned' },
    { key: 'hot',     label: '🔥 Hot tier' },
    { key: 'recover', label: 'Recover abandoned' },
    { key: 'awaiting', label: 'Sent · awaiting action' }
  ];
  function applyFilter(leads) {
    var me = R.app.role().id;
    return leads.filter(function (l) {
      switch (FILTER) {
        case 'mine': return l.assignedTo === me;
        case 'unassigned': return !l.assignedTo;
        case 'hot': return l.qual.tier === 'hot';
        case 'recover': return !(l.contact && l.contact.email) || l.furthestStep !== 'confirm';
        case 'awaiting': return ['sent', 'viewed'].indexOf(l.status) >= 0;
        default: return true;
      }
    });
  }

  /* ---- render queue ----------------------------------------------------- */
  function render(c) {
    container = c;
    var leads = S.queueSorted(S.all());
    var visible = applyFilter(leads);
    var a = S.analytics('all');
    var overdue = leads.filter(function (l) { return l.slaHoursLeft != null && l.slaHoursLeft < 0; }).length;
    var mtts = a.kpis.medianTimeToSend;

    c.innerHTML =
      '<div class="wrap">' +
        '<div class="page-head"><div><h1>Queue</h1><p>Your timed work queue — sorted by tier, then SLA urgency.</p></div>' +
          '<a class="btn btn--ghost" href="#/studio-intro">🎬 Record intro video</a></div>' +
        '<div class="kpis" style="margin-bottom:20px">' +
          kpi('In queue', leads.filter(function (l) { return ['new', 'in_review', 'recorded'].indexOf(l.status) >= 0; }).length, 'awaiting send') +
          kpi('Overdue SLA', overdue, overdue ? 'past 24h target' : 'all on time', overdue ? 'over' : 'ok') +
          kpi('Median time-to-send', mtts == null ? '—' : mtts.toFixed(1) + 'h', 'north-star metric') +
          kpi('Booked (paid)', leads.filter(function (l) { return l.booking && l.booking.paid; }).length, 'reserved consults') +
        '</div>' +
        '<div class="qfilters">' + FILTERS.map(function (f) {
          return '<button class="qfilter' + (f.key === FILTER ? ' is-active' : '') + '" data-filter="' + f.key + '">' + esc(f.label) + '</button>';
        }).join('') + '</div>' +
        '<div class="queue-layout">' + (visible.length ? visible.map(row).join('') :
          '<div class="card center muted">No leads match this filter.</div>') + '</div>' +
      '</div>' +
      '<div class="scrim" data-scrim></div><aside class="drawer" data-drawer></aside>';

    U.on(c, 'click', '[data-filter]', function (e, t) { FILTER = t.getAttribute('data-filter'); render(c); });
    U.on(c, 'click', '[data-open]', function (e, t) { openDrawer(t.getAttribute('data-open')); });
    U.on(c, 'click', '[data-scrim]', closeDrawer);

    if (openLeadId) openDrawer(openLeadId);
  }

  function kpi(label, value, sub, tone) {
    return '<div class="kpi"><div class="kpi__label">' + esc(label) + '</div>' +
      '<div class="kpi__value' + (tone === 'over' ? '" style="color:var(--color-over)' : '') + '">' + esc(value) + '</div>' +
      '<div class="kpi__sub">' + esc(sub) + '</div></div>';
  }

  function row(l) {
    var name = (l.contact && l.contact.firstName) || 'Anonymous lead';
    var chips = l.taxonomySelections.slice(0, 3).map(function (id) {
      var t = S.vertical().taxonomy.filter(function (x) { return x.id === id; })[0];
      return t ? '<span class="pill pill--source">' + esc(t.label) + '</span>' : '';
    }).join('');
    var channel = R.attribution.resolveChannel(l.source, S.config().sourceAliases);
    var sla = l.slaHoursLeft;
    var slaState = S.slaState(sla);
    var slaPill = sla == null ? '' :
      '<span class="pill pill--' + slaState + '"><span class="dot"></span>' +
        (sla < 0 ? Math.abs(sla).toFixed(1) + 'h over' : sla.toFixed(1) + 'h left') + '</span>';
    var dropped = l.furthestStep !== 'confirm' && !(l.contact && l.contact.email)
      ? '<span class="pill pill--warn">dropped at ' + esc(l.furthestStep) + '</span>' : '';
    var st = S.statusMeta(l.status);

    return '<div class="qrow" data-open="' + esc(l.id) + '">' +
      '<div style="display:flex;gap:12px;align-items:center"><div class="tier-rail tier-rail--' + l.qual.tier + '"></div>' +
      '<div class="avatar">' + esc(U.initials(name)) + '</div></div>' +
      '<div class="qrow__mid">' +
        '<div class="qrow__name">' + esc(name) + ' <span class="pill pill--' + l.qual.tier + '">' + l.qual.tier + ' · ' + l.qual.score + '</span></div>' +
        '<div class="qrow__meta">' + chips +
          '<span class="pill pill--source">' + esc(channel) + '</span>' + dropped + '</div>' +
      '</div>' +
      '<div class="qrow__right">' +
        '<span class="pill">' + esc(st.label) + '</span>' + slaPill +
        '<span class="qrow__time">' + esc(U.timeAgo(l.createdAt)) + '</span>' +
      '</div></div>';
  }

  /* ====================== DRAWER (the workspace) ========================= */
  function openDrawer(id) {
    openLeadId = id;
    var lead = S.get(id); if (!lead) return;
    var drawer = U.qs('[data-drawer]', container), scrim = U.qs('[data-scrim]', container);
    drawer.innerHTML = drawerHTML(lead);
    drawer.classList.add('is-open'); scrim.classList.add('is-open');
    wireDrawer(drawer, lead);
  }
  function closeDrawer() {
    openLeadId = null;
    var drawer = U.qs('[data-drawer]', container), scrim = U.qs('[data-scrim]', container);
    if (drawer) drawer.classList.remove('is-open');
    if (scrim) scrim.classList.remove('is-open');
  }

  /* stage-engine: the single primary action for the current status */
  function nextAction(lead) {
    var v = lead.video || {};
    if (lead.status === 'booked') return { label: 'Booked ✓', hint: 'Log the outcome below.', act: null };
    if (lead.status === 'no_response') return { label: 'Re-send video', hint: 'No response yet — try another nudge.', act: 'send' };
    if (v.viewedAt && lead.status !== 'booked') return { label: 'Send booking nudge', hint: 'They watched — nudge them to reserve.', act: 'nudge' };
    if (lead.status === 'sent') return { label: 'Waiting on view', hint: 'Delivered. Resend if it goes cold.', act: 'send' };
    if (v.hasRecording && lead.status === 'recorded') return { label: 'Send the video', hint: 'Recorded — deliver by email + SMS.', act: 'send' };
    return { label: 'Open Consult Studio', hint: 'Record this patient’s personal video.', act: 'studio' };
  }

  function drawerHTML(lead) {
    var name = (lead.contact && lead.contact.firstName) || 'Anonymous lead';
    var na = nextAction(lead);
    var cfg = S.config();
    var channel = R.attribution.resolveChannel(lead.source, cfg.sourceAliases);
    var script = R.scriptgen.generate(lead, cfg);

    return '<div class="drawer__head"><div class="avatar avatar--lg">' + esc(U.initials(name)) + '</div>' +
        '<div><strong>' + esc(name) + '</strong> <span class="pill pill--' + lead.qual.tier + '">' + lead.qual.tier + '</span><br>' +
        '<span class="muted" style="font-size:.82rem">' + esc(channel) + ' · ' + esc(U.timeAgo(lead.createdAt)) + '</span></div>' +
        '<button class="drawer__x" data-act="close">✕</button></div>' +
      '<div class="drawer__body">' +

        '<div class="nextaction"><div class="nextaction__label">Next action</div>' +
          '<div class="nextaction__title">' + esc(na.hint) + '</div>' +
          (na.act ? '<button class="btn btn--accent btn--lg" data-act="' + na.act + '">' + esc(na.label) + '</button>' :
            '<span class="pill pill--ok">' + esc(na.label) + '</span>') + '</div>' +

        /* qualification ring */
        '<div class="card card--pad-sm">' + qualRing(lead) + '</div>' +

        /* status pipeline + override */
        '<div class="card card--pad-sm"><div class="card__title">Status</div>' + pipeline(lead) +
          '<label class="field" style="margin:12px 0 0"><span>Override status</span>' +
          '<select data-status>' + S.STATUS.map(function (s) {
            return '<option value="' + s.key + '"' + (s.key === lead.status ? ' selected' : '') + '>' + esc(s.label) + '</option>';
          }).join('') + '</select></label></div>' +

        /* photos */
        (lead.photos && lead.photos.length ? '<div class="card card--pad-sm"><div class="card__title">Photos <span class="muted" style="margin-left:auto;font-weight:400">' + lead.photos.length + ' guided shots</span></div><div class="photo-thumbs">' +
          lead.photos.map(function (p) {
            var src = typeof p === 'string' ? p : (p && p.src) || ''; var lbl = (p && p.label) || '';
            var has = /^data:/.test(src);
            return '<div class="photo-thumb" title="' + esc(lbl) + '"' + (has ? ' style="background-image:url(' + esc(src) + ')"' : '') + '>' + (has ? '' : '🖼') + '</div>';
          }).join('') +
          '</div>' + (lead.photoConsent ? '<p class="muted" style="font-size:.74rem;margin:8px 0 0">✓ Image consent on file</p>' : '') + '</div>' : '') +

        /* intake + source */
        '<div class="card card--pad-sm"><div class="card__title">Intake &amp; source</div>' + intakeKV(lead, cfg) + '</div>' +

        /* AI-drafted script (the §10 LLM seam) */
        '<div class="card card--pad-sm"><div class="card__title">AI-drafted video script <span class="pill" style="margin-left:auto">ScriptGen</span></div>' +
          '<div class="script" data-script>' + esc(script.script) + '</div>' +
          '<div class="row" style="margin-top:10px"><button class="btn btn--ghost btn--sm" data-act="copyscript">Copy script</button>' +
          '<button class="btn btn--ghost btn--sm" data-act="studio">Open in Studio →</button></div></div>' +

        /* send & follow-up */
        '<div class="card card--pad-sm"><div class="card__title">Send &amp; follow-up</div>' +
          '<div class="row row--wrap">' +
            '<button class="btn btn--primary btn--sm" data-act="send">✉ Send video (email + SMS)</button>' +
            '<button class="btn btn--ghost btn--sm" data-act="simviewed">Simulate “viewed”</button>' +
            '<button class="btn btn--ghost btn--sm" data-act="openportal">Open portal as patient ↗</button>' +
          '</div></div>' +

        /* conversion box (booked) */
        (lead.status === 'booked' || (lead.booking && lead.booking.bookedAt) ? conversionBox(lead) : '') +

        /* assignment (gated by canRecord) */
        '<div class="card card--pad-sm"><div class="card__title">Assignment</div>' +
          '<label class="field" style="margin:0"><span>Assigned to (recorders only)</span>' +
          '<select data-assign><option value="">Unassigned</option>' +
          (cfg.staff || []).filter(function (s) { return s.canRecord; }).map(function (s) {
            return '<option value="' + esc(s.id) + '"' + (s.id === lead.assignedTo ? ' selected' : '') + '>' + esc(s.name) + '</option>';
          }).join('') + '</select></label></div>' +

        /* tags + notes */
        '<div class="card card--pad-sm"><div class="card__title">Notes</div>' +
          '<div data-notes>' + (lead.notes || []).map(function (n) {
            return '<div style="font-size:.85rem;margin-bottom:6px"><strong>' + esc(n.author) + '</strong> <span class="muted">' + esc(U.timeAgo(n.at)) + '</span><br>' + esc(n.body) + '</div>';
          }).join('') + '</div>' +
          '<div class="row" style="margin-top:8px"><input type="text" data-note placeholder="Add a note…" class="grow"><button class="btn btn--ghost btn--sm" data-act="addnote">Add</button></div></div>' +

      '</div>';
  }

  function qualRing(lead) {
    var q = lead.qual;
    var color = q.tier === 'hot' ? 'var(--tier-hot)' : q.tier === 'warm' ? 'var(--tier-warm)' : 'var(--tier-cold)';
    var deg = Math.round(q.score * 3.6);
    var flags = (q.flags || []).map(function (f) { return '<div class="flag">⚠ ' + esc(f) + '</div>'; }).join('') ||
      '<div class="muted" style="font-size:.82rem">No risk flags.</div>';
    return '<div class="qring">' +
      '<div class="ring" style="background:conic-gradient(' + color + ' ' + deg + 'deg, var(--color-surface-sunk) 0)">' +
        '<div class="ring__inner"><div class="ring__score">' + q.score + '</div><div class="ring__cap">' + esc(q.tier) + '</div></div></div>' +
      '<div class="grow"><div class="kv"><dt>Est. value</dt><dd>' + U.money(q.value) + '</dd>' +
        '<dt>Response</dt><dd>Personal video</dd></div>' +
        '<div class="flaglist" style="margin-top:8px">' + flags + '</div></div></div>';
  }

  function pipeline(lead) {
    var cur = S.statusMeta(lead.status).order;
    return '<div class="pipeline">' + S.STATUS.filter(function (s) { return s.key !== 'no_response'; }).map(function (s) {
      var cls = s.order < cur ? 'is-done' : (s.order === cur ? 'is-current' : '');
      return '<div class="pipeline__step ' + cls + '">' + esc(s.label) + '</div>';
    }).join('') + '</div>';
  }

  function intakeKV(lead, cfg) {
    var vert = S.vertical();
    var rows = [];
    vert.intakeSchema.forEach(function (q) {
      var v = (lead.intake || {})[q.key];
      if (!v) return;
      var opt = (q.options.filter(function (o) { return o.value === v; })[0] || {}).label || v;
      rows.push('<dt>' + esc(q.label.replace(/\?.*/, '').slice(0, 22)) + '</dt><dd>' + esc(opt) + '</dd>');
    });
    var s = lead.source || {};
    if (lead.goalText) rows.unshift('<dt>In their words</dt><dd>“' + esc(lead.goalText) + '”</dd>');
    rows.push('<dt>Campaign</dt><dd>' + esc(s.utm_campaign || '—') + '</dd>');
    rows.push('<dt>Click ID</dt><dd style="word-break:break-all">' + esc(s.fbclid || s.gclid || s.ttclid || s.msclkid || '—') + '</dd>');
    rows.push('<dt>Consent</dt><dd>' + (lead.contactConsent && lead.contactConsent.sms ? 'SMS ✓ ' : '') + (lead.contactConsent && lead.contactConsent.email ? 'Email ✓' : '') + '</dd>');
    return '<dl class="kv">' + rows.join('') + '</dl>';
  }

  function conversionBox(lead) {
    var b = lead.booking || {};
    return '<div class="card card--pad-sm" style="border-color:var(--color-ok)"><div class="card__title">Conversion ✓ <span class="muted" style="margin-left:auto;font-weight:400">feeds revenue + attribution loop</span></div>' +
      '<label class="check"><input type="checkbox" data-conv="attended" ' + (b.attended ? 'checked' : '') + '> <span>Attended consult</span></label>' +
      '<label class="check" style="margin-top:8px"><input type="checkbox" data-conv="paid" ' + (b.paid ? 'checked' : '') + '> <span>Paid / procedure closed</span></label>' +
      '<label class="field" style="margin-top:10px"><span>Closed value</span><input type="number" data-conv="value" value="' + (b.value || 0) + '"></label>' +
      '</div>';
  }

  /* ---- drawer events ---------------------------------------------------- */
  function wireDrawer(drawer, lead) {
    U.on(drawer, 'click', '[data-act="close"]', closeDrawer);
    U.on(drawer, 'click', '[data-act="studio"]', function () { R.app.go('#/studio/' + lead.id); });
    U.on(drawer, 'click', '[data-act="send"]', function () { sendModal(lead); });
    U.on(drawer, 'click', '[data-act="nudge"]', function () { sendModal(lead, true); });
    U.on(drawer, 'click', '[data-act="copyscript"]', function () {
      R.attribution.copy(drawer.querySelector('[data-script]').textContent).then(function () { R.app.toast('Script copied.'); });
    });
    U.on(drawer, 'click', '[data-act="simviewed"]', function () {
      S.patch(lead.id, { status: S.statusMeta(lead.status).order >= 4 ? lead.status : 'viewed',
        video: { viewedAt: new Date().toISOString(), watchCount: ((lead.video && lead.video.watchCount) || 0) + 1, watchPct: 90 } });
      track('video_played', { lead: lead.id, simulated: true });
      R.app.toast('Marked viewed.'); openDrawer(lead.id);
    });
    U.on(drawer, 'click', '[data-act="openportal"]', function () {
      window.open('portal.html?lead=' + encodeURIComponent(lead.id), '_blank');
    });
    U.on(drawer, 'change', '[data-status]', function (e, t) { S.patch(lead.id, { status: t.value }); R.app.toast('Status → ' + t.value); openDrawer(lead.id); });
    U.on(drawer, 'change', '[data-assign]', function (e, t) { S.patch(lead.id, { assignedTo: t.value || null }); R.app.toast(t.value ? 'Assigned.' : 'Unassigned.'); });
    U.on(drawer, 'change', '[data-conv]', function (e, t) {
      var field = t.getAttribute('data-conv');
      var val = field === 'value' ? Number(t.value) : t.checked;
      var patch = { booking: {} }; patch.booking[field] = val;
      S.patch(lead.id, patch);
      if (field === 'paid' && val) R.attribution.firePixels(S.config().analytics, 'Purchase', { lead_id: lead.id, value: lead.booking.value });
      R.app.toast('Conversion updated.');
    });
    U.on(drawer, 'click', '[data-act="addnote"]', function () {
      var inp = drawer.querySelector('[data-note]'); var body = inp.value.trim(); if (!body) return;
      var notes = (lead.notes || []).slice();
      notes.push({ body: body, author: R.app.role().name, at: new Date().toISOString() });
      S.patch(lead.id, { notes: notes }); openDrawer(lead.id);
    });
  }

  /* ---- fake SEND: SMS + email preview + dev-console log + copy-link ----- */
  function sendModal(lead, isNudge) {
    var cfg = S.config(), p = cfg.provider;
    var to = (lead.contact && lead.contact.phone) || (lead.contact && lead.contact.email) || 'the lead';
    var portalUrl = location.origin + location.pathname.replace(/[^/]*$/, '') + 'portal.html?lead=' + lead.id;
    var name = (lead.contact && lead.contact.firstName) || 'there';
    var smsBody = isNudge
      ? 'Hi ' + name + ', just checking in — your consult video from ' + p.name + ' is ready to revisit, and you can reserve your spot here: ' + portalUrl
      : 'Hi ' + name + '! ' + p.name + ' recorded a personal video about your goals. Watch it here: ' + portalUrl + ' — Reply STOP to opt out.';
    var emailBody = 'Your personal consultation video from ' + p.name + ' is ready. Tap below to watch and reserve your consult.';

    /* fire the real fakes: dev-console log + (later) pixel */
    R.devconsole.send('SMS', to, smsBody);
    R.devconsole.send('EMAIL', (lead.contact && lead.contact.email) || '—', emailBody);
    track('send', { lead: lead.id, nudge: !!isNudge });

    /* persist the delivery + advance status */
    if (!isNudge) {
      S.patch(lead.id, {
        status: S.statusMeta(lead.status).order >= 3 ? lead.status : 'sent',
        video: { recordedAt: (lead.video && lead.video.recordedAt) || new Date().toISOString(),
                 sentAt: new Date().toISOString(), hasRecording: true },
        delivery: { sentAt: new Date().toISOString(), channels: ['email', 'sms'], emailStatus: 'delivered', smsStatus: 'delivered' }
      });
    }

    var modal = U.el('div', { class: 'scrim is-open' });
    modal.style.zIndex = 60;
    modal.innerHTML =
      '<div class="card" style="max-width:520px;margin:6vh auto;max-height:88vh;overflow:auto" data-stop>' +
        '<div class="card__title">' + (isNudge ? 'Booking nudge sent' : 'Video delivered') + ' — preview <span class="pill pill--ok" style="margin-left:auto">RELAY-owned send</span></div>' +
        '<p class="muted" style="font-size:.82rem;margin-top:0">In the real product RELAY sends this by email + SMS (§3.3). Here it’s logged to the dev console and you can copy the link.</p>' +
        '<div class="card card--pad-sm" style="background:var(--color-surface-2)"><strong>📱 SMS → ' + esc(to) + '</strong><p style="font-size:.85rem;margin:6px 0 0">' + esc(smsBody) + '</p></div>' +
        '<div class="card card--pad-sm" style="background:var(--color-surface-2);margin-top:10px"><strong>✉ Email → ' + esc((lead.contact && lead.contact.email) || '—') + '</strong>' +
          '<p style="font-size:.85rem;margin:6px 0 4px"><strong>' + esc(cfg.brand.name) + '</strong> — Your personal video is ready</p>' +
          '<p style="font-size:.85rem;margin:0">' + esc(emailBody) + '</p>' +
          '<p style="font-size:.7rem;color:var(--color-ink-3);margin:8px 0 0">Unsubscribe · CAN-SPAM compliant footer</p></div>' +
        '<div class="row row--wrap" style="margin-top:14px">' +
          '<button class="btn btn--accent" data-copy="' + esc(portalUrl) + '">Copy portal link</button>' +
          '<a class="btn btn--ghost" href="portal.html?lead=' + esc(lead.id) + '" target="_blank">Open portal ↗</a>' +
          '<button class="btn btn--ghost" data-closemodal>Done</button>' +
        '</div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function (e) {
      if (e.target === modal || e.target.hasAttribute('data-closemodal')) { modal.remove(); openDrawer(lead.id); }
      var cp = e.target.closest('[data-copy]');
      if (cp) R.attribution.copy(cp.getAttribute('data-copy')).then(function () { R.app.toast('Portal link copied.'); });
    });
  }

  R.surfaces = R.surfaces || {};
  R.surfaces.queue = { render: render };
})();
