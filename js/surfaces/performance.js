/* ============================================================================
 * RELAY demo — Performance / attribution (performance.js)  [§8.7 / §5 — A3]
 * Computed from store.analytics(). The offline-conversion EXPORT is built for
 * real (DEMO §3): a click-ID-keyed file for Meta + Google offline uploaders.
 * ========================================================================== */
(function () {
  'use strict';
  var R = window.RELAY, U = R.util, S = R.store, esc = U.esc;
  var RANGE = 'all';

  var RANGES = [ { k: 'all', l: 'All time' }, { k: '90', l: 'Last 90 days' }, { k: 'month', l: 'Last 30 days' } ];

  function render(c) {
    var a = S.analytics(RANGE);
    var k = a.kpis;
    c.innerHTML =
      '<div class="wrap">' +
        '<div class="page-head"><div><h1>Performance</h1><p>Which ad is making you money — powered by RELAY’s closed attribution loop.</p></div>' +
          '<div class="row">' + RANGES.map(function (r) {
            return '<button class="qfilter' + (r.k === RANGE ? ' is-active' : '') + '" data-range="' + r.k + '">' + esc(r.l) + '</button>';
          }).join('') + '</div></div>' +

        '<div class="kpis" style="margin-bottom:22px">' +
          kpi('Median time-to-send', k.medianTimeToSend == null ? '—' : k.medianTimeToSend.toFixed(1) + 'h', 'north star') +
          kpi('Lead → booked', U.pct(k.leadToBooked), 'of contacts') +
          kpi('Booked → paid', U.pct(k.bookedToPaid), 'close rate') +
          kpi('Attributed revenue', U.money(k.revenue), 'in window') +
          kpi('Blended ROAS', k.roas ? k.roas.toFixed(1) + '×' : '—', 'revenue / spend') +
          kpi('Video view rate', U.pct(k.videoViewRate), 'of sent') +
        '</div>' +

        '<div style="display:grid;grid-template-columns:1.2fr .8fr;gap:18px;align-items:start" class="perf-grid">' +
          '<div class="card"><div class="card__title">Conversion funnel</div>' + funnel(a) + '</div>' +
          '<div class="card"><div class="card__title">Video engagement</div>' +
            engRow('View rate', U.pct(k.videoViewRate)) +
            engRow('Avg views per lead', (k.avgViews || 0).toFixed(1)) +
            engRow('Avg % watched', U.pct(k.avgWatchPct)) +
          '</div>' +
        '</div>' +

        '<div class="card" style="margin-top:18px"><div class="card__title">By channel — the moat (§5)</div>' + channelTable(a) + '</div>' +

        '<div class="card" style="margin-top:18px"><div class="card__title">Widget &amp; link analytics</div>' + widgetAnalytics() + '</div>' +

        /* §5.3 — offline-conversion export, BUILT FOR REAL */
        '<div class="card" style="margin-top:18px;border-color:var(--relay-accent)"><div class="card__title">Feed back the late conversions — offline-conversion export ' +
          '<span class="pill pill--ok" style="margin-left:auto">built for real</span></div>' +
          '<p class="muted" style="font-size:.85rem;margin-top:0">The conversion that matters (paid) fires days after the click, so the pixel never sees it. ' +
          'RELAY keys every paid conversion to its original click ID and exports it for Meta / Google offline uploaders.</p>' +
          '<div class="row row--wrap">' +
            '<button class="btn btn--primary" data-export="meta">⬇ Meta offline CSV</button>' +
            '<button class="btn btn--primary" data-export="google">⬇ Google Ads CSV</button>' +
            '<button class="btn btn--ghost" data-export="copy">Copy Meta CSV</button>' +
            '<span class="muted" style="font-size:.82rem">' + paidCount(a) + ' paid conversions keyed to click IDs</span>' +
          '</div>' +
          '<pre class="script" data-preview style="margin-top:12px">' + esc(R.attribution.buildMetaCSV(a.leads)) + '</pre>' +
        '</div>' +
      '</div>';

    U.on(c, 'click', '[data-range]', function (e, t) { RANGE = t.getAttribute('data-range'); render(c); });
    U.on(c, 'click', '[data-export]', function (e, t) {
      var which = t.getAttribute('data-export');
      var leads = S.analytics(RANGE).leads;
      if (which === 'meta') { R.attribution.download('relay-meta-offline-conversions.csv', R.attribution.buildMetaCSV(leads)); R.app.toast('Meta CSV downloaded.'); }
      else if (which === 'google') { R.attribution.download('relay-google-offline-conversions.csv', R.attribution.buildGoogleCSV(leads)); R.app.toast('Google Ads CSV downloaded.'); }
      else { R.attribution.copy(R.attribution.buildMetaCSV(leads)).then(function () { R.app.toast('Meta CSV copied to clipboard.'); }); }
      R.devconsole && R.devconsole.info('Offline-conversion export generated', { format: which, leads: leads.length });
    });
  }

  function kpi(label, value, sub) {
    return '<div class="kpi"><div class="kpi__label">' + esc(label) + '</div><div class="kpi__value">' + esc(value) + '</div><div class="kpi__sub">' + esc(sub) + '</div></div>';
  }
  function engRow(l, v) { return '<div class="row spread" style="padding:8px 0;border-bottom:1px solid var(--color-border)"><span class="muted">' + esc(l) + '</span><strong class="num">' + esc(v) + '</strong></div>'; }

  function funnel(a) {
    var start = a.funnel[0].n || 1;
    return '<div class="funnel">' + a.funnel.map(function (s, i) {
      var pctOfStart = Math.round((s.n / start) * 100);
      var drop = i > 0 ? a.funnel[i - 1].n - s.n : 0;
      return '<div class="funnel__step"><span class="muted" style="font-size:.82rem">' + esc(s.label) + '</span>' +
        '<div class="funnel__bar"><div class="funnel__fill" style="width:' + Math.max(pctOfStart, 4) + '%">' + s.n + '</div></div>' +
        '<span class="funnel__drop">' + (i > 0 && drop > 0 ? '−' + drop : pctOfStart + '%') + '</span></div>';
    }).join('') + '</div>';
  }

  function channelTable(a) {
    if (!a.byChannel.length) return '<p class="muted">No data in this window.</p>';
    var rows = a.byChannel.map(function (r) {
      var roasCls = r.roas >= 3 ? 'roas-good' : (r.roas && r.roas < 1.5 ? 'roas-bad' : '');
      return '<tr><td><strong>' + esc(r.channel) + '</strong></td>' +
        '<td>' + U.money(r.spend || 0) + '</td><td>' + r.leads + '</td>' +
        '<td>' + r.sent + '</td><td>' + r.viewed + '</td><td>' + r.booked + '</td><td>' + r.paid + '</td>' +
        '<td>' + U.money(r.revenue) + '</td>' +
        '<td>' + (r.cpl ? U.money(r.cpl) : '—') + '</td><td>' + (r.cpa ? U.money(r.cpa) : '—') + '</td>' +
        '<td class="' + roasCls + '">' + (r.roas ? r.roas.toFixed(1) + '×' : '—') + '</td></tr>';
    }).join('');
    return '<div style="overflow-x:auto"><table class="data"><thead><tr>' +
      '<th>Channel</th><th>Spend</th><th>Leads</th><th>Sent</th><th>Viewed</th><th>Booked</th><th>Paid</th><th>Revenue</th><th>CPL</th><th>CPA</th><th>ROAS</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function widgetAnalytics() {
    var ev = R.instrument.all();
    var views = ev.filter(function (e) { return e.name === 'widget_view'; });
    var taps = ev.filter(function (e) { return e.name === 'widget_tap'; });
    var byType = {};
    taps.forEach(function (e) { var t = (e.props && e.props.widget) || 'unknown'; byType[t] = (byType[t] || 0) + 1; });
    var typeRows = Object.keys(byType).map(function (t) { return '<span class="pill pill--source">' + esc(t) + ': ' + byType[t] + ' taps</span>'; }).join(' ') || '<span class="muted">No widget taps yet — open the widget gallery and click some CTAs.</span>';
    return '<div class="row row--wrap">' +
      '<div class="kpi" style="min-width:120px"><div class="kpi__label">Widget views</div><div class="kpi__value">' + views.length + '</div></div>' +
      '<div class="kpi" style="min-width:120px"><div class="kpi__label">Widget taps</div><div class="kpi__value">' + taps.length + '</div></div>' +
      '<div class="kpi" style="min-width:120px"><div class="kpi__label">Tap rate</div><div class="kpi__value">' + (views.length ? U.pct(taps.length / views.length * 100) : '—') + '</div></div>' +
      '</div><div style="margin-top:12px">' + typeRows + '</div>';
  }

  function paidCount(a) { return a.leads.filter(function (l) { return l.booking && l.booking.paid; }).length; }

  R.surfaces = R.surfaces || {};
  R.surfaces.performance = { render: render };
})();
