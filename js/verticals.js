/* ============================================================================
 * RELAY demo — vertical config objects (verticals.js)  [REQUIREMENTS §6.3]
 * A vertical is defined by DATA, not code. v1 beachhead = plastics (§6.1).
 * config() deep-merges saved account config over these vertical defaults.
 * ========================================================================== */
(function () {
  'use strict';
  var R = (window.RELAY = window.RELAY || {});

  var plastics = {
    id: 'plastics',
    label: 'Plastic surgery',
    theme: { palette: { primary: '#0f5e5a', accent: '#d98a4e' } },

    /* taxonomy: procedures / goals, drives goal chips + studio photo tiles */
    taxonomy: [
      { id: 'rhino',     label: 'Rhinoplasty',        icon: '👃', region: 'face',  price: 9500,  photoRequests: ['Front', 'Left profile', 'Right profile'] },
      { id: 'face',      label: 'Facelift',           icon: '✨', region: 'face',  price: 18000, photoRequests: ['Front', 'Left profile', 'Right profile'] },
      { id: 'eyes',      label: 'Eyelid lift',        icon: '👁', region: 'face',  price: 6500,  photoRequests: ['Front', 'Eyes closed'] },
      { id: 'breast_aug',label: 'Breast augmentation',icon: '🌸', region: 'body',  price: 11000, photoRequests: ['Front', 'Left side', 'Right side'] },
      { id: 'breast_lift',label:'Breast lift',         icon: '🌷', region: 'body',  price: 12500, photoRequests: ['Front', 'Side'] },
      { id: 'tummy',     label: 'Tummy tuck',         icon: '⏳', region: 'body',  price: 13500, photoRequests: ['Front', 'Side', 'Back'] },
      { id: 'lipo',      label: 'Liposuction',        icon: '💧', region: 'body',  price: 8500,  photoRequests: ['Area front', 'Area side'] },
      { id: 'bbl',       label: 'BBL',                icon: '🍑', region: 'body',  price: 14500, photoRequests: ['Back', 'Side'] },
      { id: 'mommy',     label: 'Mommy makeover',     icon: '💗', region: 'body',  price: 24000, photoRequests: ['Front', 'Side'] },
      { id: 'botox',     label: 'Injectables / Botox',icon: '💉', region: 'face',  price: 1200,  photoRequests: ['Front'] }
    ],

    photoPolicy: { required: true, consentGate: true, dynamicFromTaxonomy: true },

    /* intakeSchema: the §8.2 "questions" step (after goals + photos) */
    intakeSchema: [
      { key: 'timeline', type: 'choice', label: 'When are you hoping to have this done?', required: true,
        options: [
          { value: 'asap',     label: 'As soon as possible' },
          { value: '1-3mo',    label: 'In the next 1–3 months' },
          { value: '3-6mo',    label: 'In 3–6 months' },
          { value: 'research', label: 'Just researching' }
        ] },
      { key: 'budget', type: 'choice', label: 'How are you planning to handle investment?', required: true,
        options: [
          { value: 'ready',     label: 'I have a budget set aside' },
          { value: 'financing', label: "I'd want financing options" },
          { value: 'exploring', label: 'Still exploring cost' }
        ] },
      { key: 'priorSurgery', type: 'choice', label: 'Any prior procedures in this area?', required: false,
        options: [ { value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' } ] },
      { key: 'smoker', type: 'choice', label: 'Do you currently smoke?', required: false,
        options: [ { value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' } ] }
    ],

    /* qualifyModel: §9 — weights, tier cutoffs, candidacy flags */
    qualifyModel: {
      weights: { value: 0.5, readiness: 0.3, budget: 0.2 },
      readiness: { asap: 1, '1-3mo': 0.8, '3-6mo': 0.5, research: 0.2 },
      budget: { ready: 1, financing: 0.7, exploring: 0.35 },
      valueAnchor: 24000,            /* normalizer = highest taxonomy price */
      tiers: { hot: 70, warm: 45 },  /* ≥70 hot, ≥45 warm, else cold */
      flags: [
        { key: 'smoker', when: 'yes', label: 'Smoker — surgical-risk note' },
        { key: 'priorSurgery', when: 'yes', label: 'Prior surgery in area' }
      ]
    },

    copyPack: {
      welcome: 'See what’s possible — from the surgeon, personally.',
      welcomeSub: 'Tell us a little about your goals and Dr. {provider} will record a short, personal video about your specific situation.',
      rewardPromise: 'is personally recording a video about your goals.',
      rewardHeading: 'You’re all set — here’s what happens next',
      confirm: 'Your personal video is on its way',
      goalsPrompt: 'What are you considering? Tap all that apply.',
      contactPrompt: 'Where should we send your personal video?'
    },

    compliance: { moneyTalkInFlow: false, qualFeedback: false, disclaimers: [] },

    booking: { mode: 'deposit', depositAmount: 250, financingPartners: ['CareCredit', 'Cherry'] }
  };

  R.verticals = { plastics: plastics };
})();
