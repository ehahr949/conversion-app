/* ============================================================================
 * RELAY demo — default config + rich plastics seed (seed.js)
 * Single seeded plastics account "Lumière Plastic Surgery" with leads across
 * every status / tier / source, so the console and Performance views are alive
 * on first load. "Reset demo" reseeds from here.
 * ========================================================================== */
(function () {
  'use strict';
  var R = (window.RELAY = window.RELAY || {});

  /* ---- the authored plastics account config (carries forward, DEMO §8) -- */
  function defaultConfig() {
    return {
      accountId: 'acct_demo',
      account: { status: 'active', plan: 'Practice', stripeCustomerId: 'cus_demo123',
                 stripeSubscriptionId: 'sub_demo123', createdAt: '2026-01-12T00:00:00Z' },
      vertical: 'plastics',
      slaHours: 24,
      provider: {
        name: 'Dr. Mara Vance', credential: 'MD, FACS', specialty: 'Board-Certified Plastic Surgeon',
        photo: '', bio: 'Fellowship-trained in aesthetic and reconstructive surgery, with 14 years ' +
          'specializing in natural-looking facial and body procedures.',
        phone: '(305) 555-0148', email: 'frontdesk@lumiereplastics.com',
        city: 'Miami', state: 'FL', rating: 4.9, reviews: 327
      },
      brand: {
        name: 'Lumière Plastic Surgery', logo: '', wordmark: 'Lumière',
        primary: '#0f5e5a', accent: '#d98a4e', font: '',
        favicon: '', ogImage: '',
        videoFrame: { showLogo: true, lowerThird: true }
      },
      introVideo: { assetUrl: '', recordedAt: '2026-01-14T15:00:00Z', durationSec: 38 },
      staff: [
        { id: 'st_mara', name: 'Dr. Mara Vance', role: 'Surgeon', canRecord: true },
        { id: 'st_jules', name: 'Jules Okafor', role: 'Patient coordinator', canRecord: true },
        { id: 'st_rae', name: 'Rae Lindqvist', role: 'Front desk', canRecord: false }
      ],
      pricing: {},
      booking: { mode: 'deposit', bookingUrl: 'https://calendly.com/lumiereplastics/consult',
                 depositAmount: 250, financingPartners: ['CareCredit', 'Cherry'] },
      analytics: { metaPixelId: '418922334455667', ga4Id: 'G-RELAYDEMO1', googleAdsId: 'AW-998877665' },
      sourceAliases: { ig: 'Instagram', fb: 'Facebook', 'ig-reels': 'Instagram', realself: 'RealSelf' },
      spendBySource: { Instagram: 4200, Facebook: 3100, Google: 2600, TikTok: 1500, RealSelf: 900 },
      links: [
        { id: 'lk_site', label: 'Visit our website', url: 'https://lumiereplastics.com', icon: '🌐' },
        { id: 'lk_gallery', label: 'Before & after gallery', url: 'https://lumiereplastics.com/gallery', icon: '🖼' },
        { id: 'lk_reviews', label: 'Read patient reviews', url: 'https://lumiereplastics.com/reviews', icon: '⭐' }
      ],
      widgets: { target: 'flow.html', headline: 'See what’s possible — a personal video from Dr. Vance',
                 cta: 'Start my consult' }
    };
  }

  /* ---- seed leads ------------------------------------------------------- */
  function hoursAgo(h) { return new Date(Date.now() - h * 3600000).toISOString(); }

  function lead(o) {
    var base = R.store.blankLead();
    var L = R.util.deepMerge(base, o);
    ['taxonomySelections', 'photos', 'tags', 'notes', 'messages'].forEach(function (f) {
      if (o[f] !== undefined) L[f] = o[f];
    });
    return L;
  }

  function src(o) {
    return R.util.deepMerge({ referrer: '', from: 'floating', landingPath: '/flow.html', ts: o.ts || hoursAgo(1) }, o);
  }

  function seedData() {
    var leads = [
      /* HOT / new — at top of queue, SLA ticking */
      lead({ id: 'lead_seed_01', createdAt: hoursAgo(2.5), updatedAt: hoursAgo(2.4), status: 'new', furthestStep: 'confirm',
        taxonomySelections: ['mommy'], goalText: 'Want to feel like myself again after two kids.',
        intake: { timeline: 'asap', budget: 'ready', priorSurgery: 'no', smoker: 'no' },
        photos: ['demo:front', 'demo:side'], photoConsent: true,
        contactConsent: { email: true, sms: true, at: hoursAgo(2.5) },
        contact: { firstName: 'Priya', email: 'priya.n@example.com', phone: '(305) 555-0102' },
        source: src({ utm_source: 'instagram', utm_campaign: 'mommy-makeover-spring', utm_content: 'reel-3', fbclid: 'fb.1.priya.aXz9', from: 'floating', ts: hoursAgo(2.5) }) }),

      lead({ id: 'lead_seed_02', createdAt: hoursAgo(5), updatedAt: hoursAgo(5), status: 'new', furthestStep: 'confirm',
        taxonomySelections: ['rhino'], goalText: 'Dorsal hump bothers me in photos.',
        intake: { timeline: '1-3mo', budget: 'ready', priorSurgery: 'no', smoker: 'no' },
        photos: ['demo:front', 'demo:left', 'demo:right'], photoConsent: true,
        contactConsent: { email: true, sms: true, at: hoursAgo(5) },
        contact: { firstName: 'Daniela', email: 'dani.ruiz@example.com', phone: '(786) 555-0144' },
        source: src({ utm_source: 'google', utm_campaign: 'rhinoplasty-miami', gclid: 'Cj0khQ_dani', from: 'inline', ts: hoursAgo(5) }) }),

      /* HOT / overdue SLA */
      lead({ id: 'lead_seed_03', createdAt: hoursAgo(28), updatedAt: hoursAgo(28), status: 'in_review', furthestStep: 'confirm',
        taxonomySelections: ['breast_aug'], goalText: 'Researching for over a year, finally ready.',
        intake: { timeline: 'asap', budget: 'ready', priorSurgery: 'no', smoker: 'no' },
        photos: ['demo:front', 'demo:side'], photoConsent: true, assignedTo: 'st_mara',
        contactConsent: { email: true, sms: true, at: hoursAgo(28) },
        contact: { firstName: 'Mei', email: 'mei.lin@example.com', phone: '(305) 555-0177' },
        source: src({ utm_source: 'realself', utm_campaign: 'profile', from: 'link-in-bio', referrer: 'https://realself.com', ts: hoursAgo(28) }),
        notes: [{ body: 'Called once, left voicemail.', author: 'Jules Okafor', at: hoursAgo(20) }] }),

      /* WARM / financing */
      lead({ id: 'lead_seed_04', createdAt: hoursAgo(9), updatedAt: hoursAgo(9), status: 'new', furthestStep: 'confirm',
        taxonomySelections: ['tummy', 'lipo'], goalText: 'Post-weight-loss, lots of loose skin.',
        intake: { timeline: '1-3mo', budget: 'financing', priorSurgery: 'no', smoker: 'no' },
        photos: ['demo:front'], photoConsent: true,
        contactConsent: { email: true, sms: false, at: hoursAgo(9) },
        contact: { firstName: 'Carla', email: 'carla.b@example.com', phone: '(954) 555-0119' },
        source: src({ utm_source: 'facebook', utm_campaign: 'body-contouring', utm_content: 'carousel-a', fbclid: 'fb.1.carla.99', from: 'inline', ts: hoursAgo(9) }) }),

      /* WARM / smoker flag */
      lead({ id: 'lead_seed_05', createdAt: hoursAgo(14), updatedAt: hoursAgo(14), status: 'new', furthestStep: 'questions',
        taxonomySelections: ['face'], goalText: '',
        intake: { timeline: '3-6mo', budget: 'financing', priorSurgery: 'yes', smoker: 'yes' },
        photos: [], photoConsent: false,
        contactConsent: { email: true, sms: true, at: hoursAgo(14) },
        contact: { firstName: 'Susan', email: 'susan.k@example.com', phone: '' },
        source: src({ utm_source: 'tiktok', utm_campaign: 'facelift-stories', ttclid: 'tt.susan.42', from: 'floating', ts: hoursAgo(14) }) }),

      /* recorded, not yet sent */
      lead({ id: 'lead_seed_06', createdAt: hoursAgo(20), updatedAt: hoursAgo(4), status: 'recorded', furthestStep: 'confirm',
        taxonomySelections: ['bbl'], goalText: 'Want more projection, natural look.',
        intake: { timeline: '1-3mo', budget: 'ready', priorSurgery: 'no', smoker: 'no' },
        photos: ['demo:back', 'demo:side'], photoConsent: true, assignedTo: 'st_mara',
        contactConsent: { email: true, sms: true, at: hoursAgo(20) },
        contact: { firstName: 'Imani', email: 'imani.w@example.com', phone: '(305) 555-0166' },
        video: { recordedAt: hoursAgo(4), hasRecording: true, durationSec: 96, slides: [] },
        source: src({ utm_source: 'instagram', utm_campaign: 'bbl-results', utm_content: 'story-7', fbclid: 'fb.1.imani.71', from: 'floating', ts: hoursAgo(20) }) }),

      /* sent, awaiting view */
      lead({ id: 'lead_seed_07', createdAt: hoursAgo(40), updatedAt: hoursAgo(30), status: 'sent', furthestStep: 'confirm',
        taxonomySelections: ['eyes'], goalText: 'Tired-looking eyes.',
        intake: { timeline: '3-6mo', budget: 'ready', priorSurgery: 'no', smoker: 'no' },
        photos: ['demo:front'], photoConsent: true, assignedTo: 'st_mara',
        contactConsent: { email: true, sms: true, at: hoursAgo(40) },
        contact: { firstName: 'Gloria', email: 'gloria.f@example.com', phone: '(561) 555-0133' },
        video: { recordedAt: hoursAgo(31), sentAt: hoursAgo(30), hasRecording: true, durationSec: 74, slides: [] },
        delivery: { sentAt: hoursAgo(30), channels: ['email', 'sms'], emailStatus: 'delivered', smsStatus: 'delivered' },
        source: src({ utm_source: 'google', utm_campaign: 'eyelid-surgery', gclid: 'Cj0khQ_gloria', from: 'inline', ts: hoursAgo(40) }) }),

      /* viewed, considering */
      lead({ id: 'lead_seed_08', createdAt: hoursAgo(72), updatedAt: hoursAgo(20), status: 'viewed', furthestStep: 'confirm',
        taxonomySelections: ['breast_lift'], goalText: 'After breastfeeding.',
        intake: { timeline: '1-3mo', budget: 'financing', priorSurgery: 'no', smoker: 'no' },
        photos: ['demo:front', 'demo:side'], photoConsent: true, assignedTo: 'st_mara',
        contactConsent: { email: true, sms: true, at: hoursAgo(72) },
        contact: { firstName: 'Tanya', email: 'tanya.s@example.com', phone: '(305) 555-0188' },
        video: { recordedAt: hoursAgo(60), sentAt: hoursAgo(59), viewedAt: hoursAgo(20),
                 hasRecording: true, durationSec: 88, watchCount: 3, watchPct: 92, slides: [] },
        delivery: { sentAt: hoursAgo(59), channels: ['email', 'sms'], emailStatus: 'delivered', smsStatus: 'delivered' },
        source: src({ utm_source: 'instagram', utm_campaign: 'breast-lift', fbclid: 'fb.1.tanya.18', from: 'link-in-bio', ts: hoursAgo(72) }) }),

      /* booked + deposit paid (revenue + attribution export) */
      lead({ id: 'lead_seed_09', createdAt: hoursAgo(120), updatedAt: hoursAgo(40), status: 'booked', furthestStep: 'confirm',
        taxonomySelections: ['mommy'], goalText: 'Ready to book.',
        intake: { timeline: 'asap', budget: 'ready', priorSurgery: 'no', smoker: 'no' },
        photos: ['demo:front', 'demo:side'], photoConsent: true, assignedTo: 'st_mara',
        contactConsent: { email: true, sms: true, at: hoursAgo(120) },
        contact: { firstName: 'Renata', email: 'renata.m@example.com', phone: '(305) 555-0150' },
        video: { recordedAt: hoursAgo(110), sentAt: hoursAgo(109), viewedAt: hoursAgo(100),
                 hasRecording: true, durationSec: 102, watchCount: 4, watchPct: 100, slides: [] },
        delivery: { sentAt: hoursAgo(109), channels: ['email', 'sms'], emailStatus: 'delivered', smsStatus: 'delivered' },
        booking: { mode: 'deposit', bookedAt: hoursAgo(96), apptTime: null, attended: true, paid: true,
                   value: 24000, depositPaid: true, stripePaymentId: 'pi_demo_renata', note: 'Surgery scheduled.' },
        source: src({ utm_source: 'facebook', utm_campaign: 'mommy-makeover-spring', utm_content: 'video-2', fbclid: 'fb.1.renata.0aZ', from: 'floating', ts: hoursAgo(120) }) }),

      lead({ id: 'lead_seed_10', createdAt: hoursAgo(200), updatedAt: hoursAgo(150), status: 'booked', furthestStep: 'confirm',
        taxonomySelections: ['rhino'], goalText: 'Booked already!',
        intake: { timeline: 'asap', budget: 'ready', priorSurgery: 'no', smoker: 'no' },
        photos: ['demo:front', 'demo:left', 'demo:right'], photoConsent: true, assignedTo: 'st_mara',
        contactConsent: { email: true, sms: true, at: hoursAgo(200) },
        contact: { firstName: 'Bianca', email: 'bianca.t@example.com', phone: '(305) 555-0190' },
        video: { recordedAt: hoursAgo(190), sentAt: hoursAgo(189), viewedAt: hoursAgo(180),
                 hasRecording: true, durationSec: 80, watchCount: 2, watchPct: 85, slides: [] },
        delivery: { sentAt: hoursAgo(189), channels: ['email', 'sms'], emailStatus: 'delivered', smsStatus: 'delivered' },
        booking: { mode: 'deposit', bookedAt: hoursAgo(170), attended: true, paid: true,
                   value: 9500, depositPaid: true, stripePaymentId: 'pi_demo_bianca', note: '' },
        source: src({ utm_source: 'google', utm_campaign: 'rhinoplasty-miami', gclid: 'Cj0khQ_bianca', from: 'inline', ts: hoursAgo(200) }) }),

      /* abandoned partial leads (no contact) — still in queue (Recover) */
      lead({ id: 'lead_seed_11', createdAt: hoursAgo(3), updatedAt: hoursAgo(3), status: 'new', furthestStep: 'photos',
        taxonomySelections: ['lipo'], goalText: '',
        intake: { timeline: '3-6mo' }, photos: [], photoConsent: false,
        contact: { firstName: '', email: '', phone: '' },
        source: src({ utm_source: 'tiktok', utm_campaign: 'lipo-360', ttclid: 'tt.anon.91', from: 'floating', ts: hoursAgo(3) }) }),

      lead({ id: 'lead_seed_12', createdAt: hoursAgo(6), updatedAt: hoursAgo(6), status: 'new', furthestStep: 'goals',
        taxonomySelections: ['botox'], goalText: 'just looking',
        intake: {}, photos: [],
        contact: { firstName: '', email: '', phone: '' },
        source: src({ from: 'link-in-bio', referrer: 'https://instagram.com', ts: hoursAgo(6) }) }),

      /* cold / researching */
      lead({ id: 'lead_seed_13', createdAt: hoursAgo(50), updatedAt: hoursAgo(50), status: 'new', furthestStep: 'confirm',
        taxonomySelections: ['botox'], goalText: 'Curious about a refresh.',
        intake: { timeline: 'research', budget: 'exploring', priorSurgery: 'no', smoker: 'no' },
        photos: ['demo:front'], photoConsent: true,
        contactConsent: { email: true, sms: false, at: hoursAgo(50) },
        contact: { firstName: 'Olivia', email: 'olivia.p@example.com', phone: '' },
        source: src({ utm_source: 'instagram', utm_campaign: 'injectables', from: 'inline', ts: hoursAgo(50) }) }),

      /* no_response */
      lead({ id: 'lead_seed_14', createdAt: hoursAgo(260), updatedAt: hoursAgo(200), status: 'no_response', furthestStep: 'confirm',
        taxonomySelections: ['breast_aug'], goalText: '',
        intake: { timeline: '3-6mo', budget: 'exploring', priorSurgery: 'no', smoker: 'no' },
        photos: ['demo:front'], photoConsent: true, assignedTo: 'st_mara',
        contactConsent: { email: true, sms: true, at: hoursAgo(260) },
        contact: { firstName: 'Hannah', email: 'hannah.q@example.com', phone: '(305) 555-0123' },
        video: { recordedAt: hoursAgo(250), sentAt: hoursAgo(249), hasRecording: true, durationSec: 70, slides: [] },
        delivery: { sentAt: hoursAgo(249), channels: ['email', 'sms'], emailStatus: 'delivered', smsStatus: 'bounced' },
        source: src({ utm_source: 'facebook', utm_campaign: 'breast-aug', fbclid: 'fb.1.hannah.55', from: 'floating', ts: hoursAgo(260) }) })
    ];

    return { config: defaultConfig(), leads: leads };
  }

  R.defaultConfig = defaultConfig;
  R.seedData = seedData;
})();
