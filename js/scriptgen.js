/* ============================================================================
 * RELAY demo — ScriptGen (scriptgen.js)  [DEMO §3 — deterministic template]
 * Stands in for the real Claude script-gen seam (REQUIREMENTS §6.2/§10).
 * Produces an "AI-drafted video script" from the lead's own intake — good
 * enough to show the value; real Claude is an optional swap behind this surface.
 * ========================================================================== */
(function () {
  'use strict';
  var R = (window.RELAY = window.RELAY || {});

  function procLabels(lead, vert) {
    var sels = lead.taxonomySelections || [];
    return vert.taxonomy.filter(function (t) { return sels.indexOf(t.id) >= 0; })
      .map(function (t) { return t.label; });
  }
  function readiness(lead) {
    var t = (lead.intake || {}).timeline;
    return { asap: 'as soon as possible', '1-3mo': 'in the next month or two',
      '3-6mo': 'in a few months', research: 'while you research your options' }[t] || 'when the time is right';
  }
  function budgetLine(lead) {
    var b = (lead.intake || {}).budget;
    if (b === 'financing') return 'I’ll also walk through the financing options we offer so cost is never the thing that holds you back.';
    if (b === 'ready') return 'I’ll be clear and specific about what your investment covers.';
    return 'I’ll give you an honest sense of what to expect, with no pressure.';
  }

  /* generate(lead, config) → { script, blocks } */
  function generate(lead, config) {
    var vert = R.store.vertical();
    var provider = (config && config.provider) || {};
    var procs = procLabels(lead, vert);
    var name = (lead.contact && lead.contact.firstName) || 'there';
    var procPhrase = procs.length
      ? procs.join(' and ')
      : (lead.goalText ? 'your goals' : 'what you’re considering');

    var blocks = [
      { slide: 'Intro',
        line: 'Hi ' + name + ', I’m ' + (provider.name || 'your surgeon') + '. I watched your responses come ' +
              'in and wanted to record this for you personally.' },
      { slide: 'Your goals',
        line: 'You told me you’re thinking about ' + procPhrase +
              (lead.goalText ? ' — and that ' + softQuote(lead.goalText) : '') +
              '. That’s exactly the kind of thing I love helping with, and I’d want to do this ' + readiness(lead) + '.' },
      { slide: 'A result like yours',
        line: 'Let me show you a before-and-after from a patient with a similar starting point, so you can ' +
              'picture what a natural result looks like for you specifically.' },
      { slide: 'Plan & next step',
        line: budgetLine(lead) + ' If this feels right, the next step is simple — tap the button below your video ' +
              'to reserve your consult, and we’ll take great care of you.' }
    ];

    var script = blocks.map(function (b) { return '[' + b.slide + ']\n' + b.line; }).join('\n\n');
    return { script: script, blocks: blocks };
  }

  function softQuote(s) {
    s = String(s).trim().replace(/[.!]+$/, '');
    if (s.length > 90) s = s.slice(0, 88) + '…';
    return '“' + s.charAt(0).toLowerCase() + s.slice(1) + '”';
  }

  R.scriptgen = { generate: generate };
})();
