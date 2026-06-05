/* ============================================================================
 * RELAY demo — delivered patient portal (portal.js)  [REQUIREMENTS §8.5 / §8.6]
 * White-label, RELAY-hosted page the lead reaches via the link in the SMS/email.
 * Watch the personal video → book (deposit-to-reserve, Stripe-faked) or links out.
 * Engagement (viewed, watch %, count) flows back to the lead + analytics loop.
 * ========================================================================== */
(function () {
  'use strict';
  var R = window.RELAY, U = R.util, S = R.store, esc = U.esc;
  var track = function (n, p) { R.instrument.track(n, p); };
  var cfg, vert, lead, root, played = false;

  function init(mountEl) {
    root = mountEl;
    S.seed();
    cfg = S.config(); vert = S.vertical();
    R.brand.applyBrand(cfg.brand);
    var id = new URLSearchParams(location.search).get('lead');
    lead = id ? S.get(id) : mostRecentSendable();
    if (!lead) { root.innerHTML = '<div class="portal"><div class="card">No consult found. <a href="flow.html">Start one →</a></div></div>'; return; }
    track('portal_opened', { lead: lead.id, channel: R.attribution.resolveChannel(lead.source, cfg.sourceAliases) });
    /* mark "sent/viewed" so the demo loop is coherent even if provider hasn't recorded */
    render();
    wire();
  }

  function mostRecentSendable() {
    var list = S.all().filter(function (l) { return l.contact && l.contact.email; });
    return list[0] || S.all()[0];
  }

  function render() {
    var p = cfg.provider, b = lead.booking || {};
    var booked = lead.status === 'booked' || b.depositPaid;
    var firstName = (lead.contact && lead.contact.firstName) || 'there';
    var dep = (cfg.booking && cfg.booking.depositAmount) || 250;
    var links = (cfg.links || []).map(function (l) {
      return '<a href="' + esc(l.url) + '" target="_blank" rel="noopener" data-link="' + esc(l.id) + '"><span>' + esc(l.icon || '🔗') + '</span> ' + esc(l.label) + '</a>';
    }).join('');

    root.innerHTML =
      '<div class="brandbar"><span class="brandmark">' + R.brand.logoMark(cfg.brand) + '</span>' +
        '<span class="muted" style="margin-left:auto;font-size:.72rem">Private page for ' + esc(firstName) + '</span></div>' +
      '<div class="portal">' +
        '<h1 class="display" style="margin-bottom:6px">A personal video from ' + esc(p.name) + '</h1>' +
        '<p class="dim" style="margin-top:0">Recorded just for you, ' + esc(firstName) + '.</p>' +

        '<div class="portal__video" data-video>' +
          '<div class="reward-video__play" data-act="play"><span>▶</span></div>' +
          '<div style="position:absolute;bottom:0;left:0;right:0;padding:14px;background:linear-gradient(transparent,rgba(0,0,0,.8));text-align:left;color:#fff">' +
            '<strong>' + esc(p.name) + '</strong> · ' + esc(p.credential) +
            '<span style="float:right">' + fmtDur(lead.video && lead.video.durationSec) + '</span></div>' +
        '</div>' +

        '<div class="card card--pad-sm" style="margin-bottom:16px"><div class="row">' +
          '<div class="avatar avatar--lg" style="background:var(--brand-primary)">' + esc(U.initials(p.name)) + '</div>' +
          '<div><strong>' + esc(p.name) + '</strong>, ' + esc(p.credential) + '<br>' +
          '<span class="muted" style="font-size:.85rem">' + esc(p.specialty) + ' · ' + esc(p.city) + ', ' + esc(p.state) + '</span></div>' +
        '</div><p style="font-size:.88rem;margin:12px 0 0">' + esc(p.bio) + '</p></div>' +

        (booked
          ? '<div class="card" style="border-color:var(--color-ok);background:var(--color-ok-bg)"><h3 style="margin:0">✓ Your consult is reserved</h3>' +
            '<p style="margin:6px 0 0">Your refundable ' + U.money(dep) + ' deposit is in. ' + esc(p.name) + '’s team will reach out to finalize timing.</p></div>'
          : '') +

        '<h3 style="margin-top:24px">More from ' + esc(cfg.brand.name) + '</h3>' +
        '<div class="linklist">' + links + '</div>' +

        '<h3 style="margin-top:24px">Message ' + esc(p.name) + '’s team</h3>' +
        '<div class="card card--pad-sm"><div class="msg-thread" data-thread>' + renderThread() + '</div>' +
          '<div class="row" style="margin-top:12px"><input type="text" data-msg placeholder="Ask a question…" class="grow"><button class="btn btn--primary" data-act="send">Send</button></div></div>' +
        '<p class="muted center" style="font-size:.74rem;margin-top:20px">🔒 This private page is hosted by RELAY for ' + esc(cfg.brand.name) + '.</p>' +
      '</div>' +

      (booked ? '' :
        '<div class="portal__cta"><div class="wrap-narrow">' +
          '<button class="btn btn--accent btn--lg btn--block" data-act="book">Reserve my consult — ' + U.money(dep) + ' refundable deposit</button>' +
          '<p class="muted center" style="font-size:.72rem;margin:8px 0 0">Fully refundable. Applies toward your procedure.</p>' +
        '</div></div>');
  }

  function renderThread() {
    var msgs = lead.messages || [];
    if (!msgs.length) return '<div class="msg msg--provider">Hi! Reply here with any questions and we’ll get right back to you. 💛</div>';
    return msgs.map(function (m) {
      return '<div class="msg msg--' + esc(m.from) + '">' + esc(m.body) + '</div>';
    }).join('');
  }

  function fmtDur(s) { s = s || 0; var m = Math.floor(s / 60); return m + ':' + ('0' + (s % 60)).slice(-2); }

  function wire() {
    U.on(root, 'click', '[data-act="play"]', function () { playVideo(); });
    U.on(root, 'click', '[data-act="book"]', function () { book(); });
    U.on(root, 'click', '[data-link]', function (e, t) {
      track('cta_clicked', { lead: lead.id, link: t.getAttribute('data-link') });
    });
    U.on(root, 'click', '[data-act="send"]', function () { sendMsg(); });
  }

  function playVideo() {
    if (!played) {
      played = true;
      track('video_played', { lead: lead.id });
      var watchPct = 95;
      lead = S.patch(lead.id, {
        status: statusAtLeast('viewed'),
        video: { viewedAt: new Date().toISOString(),
                 watchCount: ((lead.video && lead.video.watchCount) || 0) + 1, watchPct: watchPct }
      });
      track('watch_pct', { lead: lead.id, pct: watchPct });
    }
    var box = root.querySelector('[data-video]');
    box.innerHTML = '<div style="position:absolute;inset:0;display:grid;place-items:center;background:#0c1116;color:#fff;text-align:center;padding:24px">' +
      '<div><div class="avatar avatar--lg" style="margin:0 auto 14px;background:var(--brand-primary)">' + esc(U.initials(cfg.provider.name)) + '</div>' +
      '<p style="max-width:300px">“' + esc(cfg.provider.name.split(' ')[0]) + ' here — I made this just for you. Let’s talk through your goals and the plan I’d recommend…”</p>' +
      '<div class="phone__progress" style="margin-top:16px;max-width:240px"><i style="width:0;transition:width 4s linear"></i></div></div></div>';
    var bar = box.querySelector('i');
    requestAnimationFrame(function () { bar.style.width = '100%'; });
  }

  function statusAtLeast(target) {
    var cur = S.statusMeta(lead.status).order, want = S.statusMeta(target).order;
    return cur >= want ? lead.status : target;
  }

  function book() {
    track('deposit_intent', { lead: lead.id });
    var dep = (cfg.booking && cfg.booking.depositAmount) || 250;
    /* fake Stripe deposit (DEMO §3) — marks booked */
    R.devconsole && R.devconsole.log('deposit', 'STRIPE (test) deposit captured', { amount: dep, currency: 'USD', lead: lead.id });
    var pid = 'pi_demo_' + lead.id.slice(-5);
    lead = S.patch(lead.id, {
      status: 'booked',
      booking: { mode: 'deposit', bookedAt: new Date().toISOString(), depositPaid: true,
                 paid: true, value: lead.qual.value || dep, stripePaymentId: pid }
    });
    track('booked', { lead: lead.id, value: lead.qual.value, deposit: dep });
    /* §5.2 fire purchase pixel; §5.3 this conversion now feeds the offline export */
    R.attribution.firePixels(cfg.analytics, 'Purchase', { lead_id: lead.id, value: lead.qual.value, currency: 'USD' });
    render();
    toast('Deposit received — your consult is reserved! 🎉');
  }

  function sendMsg() {
    var inp = root.querySelector('[data-msg]'); var body = inp.value.trim(); if (!body) return;
    var msgs = (lead.messages || []).slice();
    msgs.push({ from: 'patient', body: body, at: new Date().toISOString() });
    lead = S.patch(lead.id, { messages: msgs });
    inp.value = '';
    root.querySelector('[data-thread]').innerHTML = renderThread();
    track('cta_clicked', { lead: lead.id, link: 'message' });
  }

  function toast(msg) {
    var host = document.querySelector('.toast-host') || (function () { var h = U.el('div', { class: 'toast-host' }); document.body.appendChild(h); return h; })();
    var t = U.el('div', { class: 'toast', text: msg }); host.appendChild(t);
    setTimeout(function () { t.remove(); }, 3200);
  }

  R.portal = { init: init };
})();
