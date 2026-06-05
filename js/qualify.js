/* ============================================================================
 * RELAY demo — qualification (qualify.js)  [REQUIREMENTS §9]
 * qualify(lead, vertical) → { score 0–100, tier, value, flags } computed on read.
 * v1: responseTier always resolves to 'video' (§9.2, dormant routing).
 * ========================================================================== */
(function () {
  'use strict';
  var R = (window.RELAY = window.RELAY || {});

  function maxPriceForSelections(vert, lead) {
    var sels = (lead && lead.taxonomySelections) || [];
    var max = 0;
    vert.taxonomy.forEach(function (t) {
      if (sels.indexOf(t.id) >= 0 && t.price > max) max = t.price;
    });
    return max;
  }

  function qualify(lead, vertical) {
    var vert = vertical || (R.verticals && R.verticals.plastics);
    var m = vert.qualifyModel;
    var intake = (lead && lead.intake) || {};

    var value = maxPriceForSelections(vert, lead);
    var valueNorm = Math.min(1, value / (m.valueAnchor || 1));
    var readiness = m.readiness[intake.timeline] != null ? m.readiness[intake.timeline] : 0.3;
    var budget = m.budget[intake.budget] != null ? m.budget[intake.budget] : 0.35;

    var raw = valueNorm * m.weights.value +
              readiness  * m.weights.readiness +
              budget     * m.weights.budget;
    var score = Math.round(raw * 100);

    /* candidacy flags — surfaced to provider only, never to patient (§4.2) */
    var flags = [];
    (m.flags || []).forEach(function (f) {
      if (intake[f.key] === f.when) flags.push(f.label);
    });

    var tier = score >= m.tiers.hot ? 'hot' : (score >= m.tiers.warm ? 'warm' : 'cold');

    return { score: score, tier: tier, value: value, flags: flags };
  }

  /* responseTier resolver — dormant in v1, always 'video' (§9.2) */
  function resolveResponseTier(/* lead, qual */) { return 'video'; }

  R.qualify = qualify;
  R.resolveResponseTier = resolveResponseTier;
})();
