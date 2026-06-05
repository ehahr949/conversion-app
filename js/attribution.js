/* ============================================================================
 * RELAY demo — attribution & the closed loop (attribution.js)  [REQUIREMENTS §5]
 * BUILT FOR REAL in the demo (DEMO §3): parse-in UTMs/click-IDs/referrer/?from=,
 * resolve a human channel, fire pixels to the visible dev console, and generate
 * the offline-conversion EXPORT (download + clipboard).
 * ========================================================================== */
(function () {
  'use strict';
  var R = (window.RELAY = window.RELAY || {});

  var UTM_KEYS = ['utm_source', 'utm_campaign', 'utm_content', 'utm_medium', 'utm_term'];
  var CLICK_KEYS = ['fbclid', 'gclid', 'ttclid', 'msclkid'];

  /* ---- §5.1 Parse IN ---------------------------------------------------- */
  function parseSource(search, referrer) {
    var params = new URLSearchParams(search || window.location.search);
    var src = {};
    UTM_KEYS.forEach(function (k) { if (params.get(k)) src[k] = params.get(k); });
    CLICK_KEYS.forEach(function (k) { if (params.get(k)) src[k] = params.get(k); });
    src.from = params.get('from') || '';
    src.referrer = referrer !== undefined ? referrer : (document.referrer || '');
    src.landingPath = window.location.pathname + window.location.hash;
    src.ts = new Date().toISOString();
    return src;
  }

  /* ---- channel resolution via configurable alias map (§5.1) ------------- */
  var DEFAULT_ALIASES = {
    facebook: 'Facebook', 'fb': 'Facebook', meta: 'Facebook', ig: 'Instagram',
    instagram: 'Instagram', google: 'Google', 'google-ads': 'Google',
    adwords: 'Google', tiktok: 'TikTok', 'tt': 'TikTok', youtube: 'YouTube',
    bing: 'Bing', email: 'Email', newsletter: 'Email'
  };
  function resolveChannel(source, aliasMap) {
    var aliases = R.util.deepMerge(DEFAULT_ALIASES, aliasMap || {});
    if (source && source.utm_source) {
      var key = String(source.utm_source).toLowerCase();
      if (aliases[key]) return aliases[key];
      return source.utm_source.charAt(0).toUpperCase() + source.utm_source.slice(1);
    }
    /* infer from click id when utm missing */
    if (source) {
      if (source.fbclid) return 'Facebook';
      if (source.gclid) return 'Google';
      if (source.ttclid) return 'TikTok';
      if (source.msclkid) return 'Bing';
    }
    if (source && source.referrer) {
      var r = source.referrer.toLowerCase();
      if (r.indexOf('facebook') >= 0) return 'Facebook';
      if (r.indexOf('instagram') >= 0) return 'Instagram';
      if (r.indexOf('google') >= 0) return 'Google';
      if (r.indexOf('tiktok') >= 0) return 'TikTok';
      if (r) return 'Referral';
    }
    return 'Direct';
  }

  /* ---- §5.2 Fire OUT — early pixels (logged to dev console) ------------- */
  function firePixels(analyticsCfg, eventName, payload) {
    analyticsCfg = analyticsCfg || {};
    var fired = [];
    if (analyticsCfg.metaPixelId) {
      R.devconsole && R.devconsole.pixel('Meta', eventName,
        { pixel_id: analyticsCfg.metaPixelId, event: eventName, data: payload });
      fired.push('Meta');
    }
    if (analyticsCfg.ga4Id) {
      R.devconsole && R.devconsole.pixel('GA4', eventName,
        { measurement_id: analyticsCfg.ga4Id, event: eventName, params: payload });
      fired.push('GA4');
    }
    if (analyticsCfg.googleAdsId) {
      R.devconsole && R.devconsole.pixel('Google Ads', eventName,
        { conversion_id: analyticsCfg.googleAdsId, event: eventName, data: payload });
      fired.push('Google Ads');
    }
    return fired;
  }

  /* ---- §5.3 Feed BACK — offline-conversion export (real) ---------------- */
  /* Meta offline-conversion CSV shape, keyed on click id (fbclid → "match keys"). */
  function buildMetaCSV(leads) {
    var header = ['event_name', 'event_time', 'value', 'currency', 'fbclid', 'email_sha256_omitted', 'phone_omitted'];
    var lines = [header.join(',')];
    leads.forEach(function (l) {
      var b = l.booking || {}; var s = l.source || {};
      if (!b.paid) return;
      var evTime = Math.floor(new Date(b.bookedAt || l.updatedAt || Date.now()).getTime() / 1000);
      lines.push([
        'Purchase', evTime, (b.value || 0), 'USD',
        s.fbclid || '', '(hashed in prod)', '(hashed in prod)'
      ].join(','));
    });
    return lines.join('\n');
  }
  /* Google Ads offline-conversion CSV shape, keyed on gclid. */
  function buildGoogleCSV(leads) {
    var header = ['Google Click ID', 'Conversion Name', 'Conversion Time', 'Conversion Value', 'Conversion Currency'];
    var lines = ['Parameters:TimeZone=America/New_York', header.join(',')];
    leads.forEach(function (l) {
      var b = l.booking || {}; var s = l.source || {};
      if (!b.paid || !s.gclid) return;
      var t = new Date(b.bookedAt || l.updatedAt || Date.now());
      lines.push([
        s.gclid, 'RELAY Paid Consult',
        t.toISOString().slice(0, 19).replace('T', ' '),
        (b.value || 0), 'USD'
      ].join(','));
    });
    return lines.join('\n');
  }

  function download(filename, text) {
    var blob = new Blob([text], { type: 'text/csv' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta);
    ta.select(); try { document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta);
    return Promise.resolve();
  }

  R.attribution = {
    UTM_KEYS: UTM_KEYS, CLICK_KEYS: CLICK_KEYS,
    parseSource: parseSource, resolveChannel: resolveChannel, firePixels: firePixels,
    buildMetaCSV: buildMetaCSV, buildGoogleCSV: buildGoogleCSV,
    download: download, copy: copy
  };
})();
