/* ============================================================================
 * RELAY demo — the Store (store.js)  [DEMO §4 — the key architectural decision]
 *
 * Implements the REAL store API surface (REQUIREMENTS §5/§7) over localStorage.
 * ALL surfaces call ONLY this API. When real v1 arrives, swap this implementation
 * for an HTTP client — surfaces don't change.
 *
 * Method surface:
 *   config()                  → deep-merged config (saved over vertical defaults)
 *   saveConfig(partial)       → deep-merge + persist + notify
 *   vertical()                → resolved vertical object
 *   all()                     → all leads (decorated with qual on read)
 *   get(id)                   → one decorated lead
 *   upsert(partial)           → deep-merge write at EVERY step (partial capture)
 *   patch(id, partial)        → shorthand upsert for an existing id
 *   onChange(fn)              → subscribe to store mutations (cross-surface live)
 *   seed(force)               → install rich plastics seed if empty (or force)
 *   reset()                   → wipe + reseed (the "Reset demo" button)
 *   analytics(range)          → computed metrics for the Performance view
 * ========================================================================== */
(function () {
  'use strict';
  var R = (window.RELAY = window.RELAY || {});
  var U = R.util;

  var K_CONFIG = 'relay.demo.config.v1';
  var K_LEADS  = 'relay.demo.leads.v1';
  var K_SEEDED = 'relay.demo.seeded.v1';

  /* ---- persistence + cross-tab/cross-surface notification --------------- */
  var listeners = [];
  function notify(kind, payload) {
    listeners.forEach(function (fn) { try { fn(kind, payload); } catch (e) {} });
  }
  function onChange(fn) { listeners.push(fn); return function () {
    var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1);
  }; }
  /* live updates when another tab (e.g. the portal) writes */
  window.addEventListener('storage', function (e) {
    if (e.key === K_LEADS) notify('leads', null);
    if (e.key === K_CONFIG) notify('config', null);
  });

  function readJSON(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  }
  function writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  /* ---- config ----------------------------------------------------------- */
  function verticalDefaults() {
    var v = (R.verticals && R.verticals.plastics) || {};
    return {
      vertical: v.id,
      booking: v.booking || {}
    };
  }
  function vertical() { return (R.verticals && R.verticals.plastics); }

  function config() {
    var saved = readJSON(K_CONFIG, null);
    var base = R.defaultConfig ? R.defaultConfig() : {};
    return U.deepMerge(base, saved || {});
  }
  function saveConfig(partial) {
    var current = readJSON(K_CONFIG, {}) || {};
    var merged = U.deepMerge(current, partial || {});
    writeJSON(K_CONFIG, merged);
    notify('config', merged);
    return config();
  }

  /* ---- leads ------------------------------------------------------------ */
  function rawLeads() { return readJSON(K_LEADS, []) || []; }
  function writeLeads(list) { writeJSON(K_LEADS, list); }

  /* decorate a lead with computed qual + responseTier on read (§9) */
  function decorate(lead) {
    if (!lead) return lead;
    var d = U.clone(lead);
    d.qual = R.qualify ? R.qualify(d, vertical()) : { score: 0, tier: 'cold', value: 0, flags: [] };
    d.responseTier = R.resolveResponseTier ? R.resolveResponseTier(d, d.qual) : 'video';
    d.slaHoursLeft = slaHoursLeft(d);
    return d;
  }

  function all() { return rawLeads().map(decorate); }
  function get(idv) {
    var found = rawLeads().filter(function (l) { return l.id === idv; })[0];
    return found ? decorate(found) : null;
  }

  /* upsert(partial): deep-merge write at EVERY step (§7.1).
     Deep-merges nested objects; arrays are shallow-set. */
  var ARRAY_FIELDS = ['taxonomySelections', 'photos', 'tags', 'notes', 'messages'];
  function upsert(partial) {
    if (!partial) return null;
    var list = rawLeads();
    var now = new Date().toISOString();
    var idx = partial.id ? list.map(function (l) { return l.id; }).indexOf(partial.id) : -1;

    if (idx < 0) {
      /* new lead */
      var lead = U.deepMerge(blankLead(), partial);
      lead.id = partial.id || U.id('lead');
      lead.createdAt = lead.createdAt || now;
      lead.updatedAt = now;
      list.unshift(lead);
      writeLeads(list);
      notify('leads', lead.id);
      return decorate(lead);
    }
    /* existing: deep-merge, but arrays shallow-set if provided */
    var existing = list[idx];
    var merged = U.deepMerge(existing, partial);
    ARRAY_FIELDS.forEach(function (f) {
      if (partial[f] !== undefined) merged[f] = partial[f];
    });
    merged.updatedAt = now;
    list[idx] = merged;
    writeLeads(list);
    notify('leads', merged.id);
    return decorate(merged);
  }
  function patch(idv, partial) {
    partial = partial || {}; partial.id = idv; return upsert(partial);
  }

  function blankLead() {
    return {
      id: null, accountId: 'acct_demo', createdAt: null, updatedAt: null,
      vertical: 'plastics', status: 'new', furthestStep: 'welcome', responseTier: 'video',
      intake: {}, taxonomySelections: [], goalText: '', photos: [], photoConsent: false,
      contactConsent: { email: false, sms: false, at: null },
      contact: { firstName: '', email: '', phone: '' },
      source: {},
      delivery: { sentAt: null, channels: [], emailStatus: null, smsStatus: null },
      video: { recordedAt: null, sentAt: null, viewedAt: null, durationSec: 0,
               watchCount: 0, watchPct: 0, hasRecording: false, slides: [], assetUrl: '' },
      booking: { mode: null, bookedAt: null, apptTime: null, attended: false, paid: false,
                 value: 0, depositPaid: false, stripePaymentId: null, note: '' },
      assignedTo: null, notes: [], tags: [], messages: [],
      account: { passwordSet: false }
    };
  }

  /* ---- status / SLA (§7.3) --------------------------------------------- */
  var STATUS = [
    { key: 'new',       order: 0, label: 'New' },
    { key: 'in_review', order: 1, label: 'In review' },
    { key: 'recorded',  order: 2, label: 'Recorded' },
    { key: 'sent',      order: 3, label: 'Sent' },
    { key: 'viewed',    order: 4, label: 'Viewed' },
    { key: 'booked',    order: 5, label: 'Booked' },
    { key: 'no_response', order: 6, label: 'No response' }
  ];
  function statusMeta(key) {
    return STATUS.filter(function (s) { return s.key === key; })[0] || STATUS[0];
  }
  function slaTargetHours() { return (config().slaHours) || 24; }
  function slaHoursLeft(lead) {
    /* only meaningful while awaiting send */
    var awaiting = ['new', 'in_review'].indexOf(lead.status) >= 0;
    if (!awaiting) return null;
    var hoursSince = (Date.now() - new Date(lead.createdAt).getTime()) / 3600000;
    return Math.round((slaTargetHours() - hoursSince) * 10) / 10;
  }
  function slaState(hoursLeft) {
    if (hoursLeft == null) return 'none';
    if (hoursLeft < 0) return 'over';
    if (hoursLeft < 6) return 'warn';
    return 'ok';
  }

  /* queue sort: tier rank → SLA urgency (§7.3) */
  var TIER_RANK = { hot: 0, warm: 1, cold: 2 };
  function queueSorted(leads) {
    return leads.slice().sort(function (a, b) {
      var t = (TIER_RANK[a.qual.tier] - TIER_RANK[b.qual.tier]);
      if (t !== 0) return t;
      var ah = a.slaHoursLeft == null ? 1e9 : a.slaHoursLeft;
      var bh = b.slaHoursLeft == null ? 1e9 : b.slaHoursLeft;
      return ah - bh;
    });
  }

  /* ---- seed / reset ----------------------------------------------------- */
  function seed(force) {
    if (!force && localStorage.getItem(K_SEEDED)) return;
    var s = R.seedData ? R.seedData() : { config: {}, leads: [] };
    writeJSON(K_CONFIG, s.config);
    writeLeads(s.leads);
    localStorage.setItem(K_SEEDED, '1');
    if (R.instrument) {} /* seed does not emit funnel events */
    notify('config', s.config); notify('leads', null);
  }
  function reset() {
    localStorage.removeItem(K_SEEDED);
    if (R.instrument) R.instrument.clear();
    seed(true);
  }

  /* ---- analytics(range) — computed metrics for Performance (§8.7) ------- */
  function analytics(range) {
    var leads = all();
    var now = Date.now();
    var since = 0;
    if (range === '90') since = now - 90 * 86400000;
    else if (range === 'month') since = now - 30 * 86400000;
    else if (range && range.from) since = new Date(range.from).getTime();
    var windowed = leads.filter(function (l) {
      return new Date(l.createdAt).getTime() >= since;
    });

    function has(l, st) { return statusMeta(l.status).order >= statusMeta(st).order; }
    var started = windowed.length;
    var withContact = windowed.filter(function (l) { return l.contact && l.contact.email; }).length;
    var sent = windowed.filter(function (l) { return has(l, 'sent'); }).length;
    var viewed = windowed.filter(function (l) { return (l.video && l.video.viewedAt) || has(l, 'viewed'); }).length;
    var booked = windowed.filter(function (l) { return l.status === 'booked' || (l.booking && l.booking.bookedAt); }).length;
    var paid = windowed.filter(function (l) { return l.booking && l.booking.paid; }).length;
    var photos = windowed.filter(function (l) { return (l.photos || []).length > 0; }).length;

    /* median time-to-send (north star) */
    var sendTimes = windowed
      .filter(function (l) { return l.video && l.video.recordedAt; })
      .map(function (l) { return (new Date(l.video.recordedAt).getTime() - new Date(l.createdAt).getTime()) / 3600000; })
      .filter(function (h) { return h >= 0; }).sort(function (a, b) { return a - b; });
    var medianTTS = sendTimes.length ? sendTimes[Math.floor(sendTimes.length / 2)] : null;

    var revenue = windowed.reduce(function (a, l) {
      return a + ((l.booking && l.booking.paid) ? (l.booking.value || 0) : 0);
    }, 0);

    /* by-channel table */
    var cfg = config();
    var byChannel = {};
    windowed.forEach(function (l) {
      var ch = R.attribution.resolveChannel(l.source, cfg.sourceAliases);
      var row = byChannel[ch] || (byChannel[ch] = {
        channel: ch, leads: 0, sent: 0, viewed: 0, booked: 0, paid: 0, revenue: 0
      });
      row.leads++;
      if (has(l, 'sent')) row.sent++;
      if ((l.video && l.video.viewedAt) || has(l, 'viewed')) row.viewed++;
      if (l.status === 'booked' || (l.booking && l.booking.bookedAt)) row.booked++;
      if (l.booking && l.booking.paid) { row.paid++; row.revenue += (l.booking.value || 0); }
    });
    /* fold in monthly spend (scaled to window) */
    var spend = cfg.spendBySource || {};
    var windowDays = since ? Math.max(1, (now - since) / 86400000) : 90;
    var scale = windowDays / 30;
    Object.keys(byChannel).forEach(function (ch) {
      var monthly = spend[ch] || spend[ch.toLowerCase()] || 0;
      var s = monthly * scale;
      var row = byChannel[ch];
      row.spend = s;
      row.cpl = row.leads ? s / row.leads : 0;
      row.cpa = row.paid ? s / row.paid : 0;
      row.roas = s ? row.revenue / s : 0;
    });

    /* video engagement */
    var viewedLeads = windowed.filter(function (l) { return l.video && l.video.viewedAt; });
    var avgWatchPct = viewedLeads.length
      ? viewedLeads.reduce(function (a, l) { return a + (l.video.watchPct || 0); }, 0) / viewedLeads.length : 0;
    var avgViews = viewedLeads.length
      ? viewedLeads.reduce(function (a, l) { return a + (l.video.watchCount || 0); }, 0) / viewedLeads.length : 0;

    return {
      range: range || 'all', started: started,
      funnel: [
        { key: 'started', label: 'Started', n: started },
        { key: 'goals',   label: 'Goals set', n: windowed.filter(function (l) { return (l.taxonomySelections || []).length || l.goalText; }).length },
        { key: 'photos',  label: 'Photos', n: photos },
        { key: 'lead',    label: 'Contact', n: withContact },
        { key: 'sent',    label: 'Sent', n: sent },
        { key: 'viewed',  label: 'Viewed', n: viewed },
        { key: 'booked',  label: 'Booked', n: booked },
        { key: 'paid',    label: 'Paid', n: paid }
      ],
      kpis: {
        medianTimeToSend: medianTTS,
        leadToBooked: withContact ? (booked / withContact) * 100 : 0,
        bookedToPaid: booked ? (paid / booked) * 100 : 0,
        revenue: revenue,
        roas: (function () {
          var totalSpend = Object.keys(byChannel).reduce(function (a, ch) { return a + (byChannel[ch].spend || 0); }, 0);
          return totalSpend ? revenue / totalSpend : 0;
        })(),
        videoViewRate: sent ? (viewed / sent) * 100 : 0,
        avgWatchPct: avgWatchPct,
        avgViews: avgViews
      },
      byChannel: Object.keys(byChannel).map(function (k) { return byChannel[k]; })
        .sort(function (a, b) { return b.revenue - a.revenue; }),
      leads: windowed
    };
  }

  R.store = {
    config: config, saveConfig: saveConfig, vertical: vertical,
    all: all, get: get, upsert: upsert, patch: patch,
    onChange: onChange, seed: seed, reset: reset, analytics: analytics,
    /* helpers exposed for surfaces */
    STATUS: STATUS, statusMeta: statusMeta, slaState: slaState,
    queueSorted: queueSorted, blankLead: blankLead, decorate: decorate
  };
})();
