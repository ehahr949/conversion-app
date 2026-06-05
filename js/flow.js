/* ============================================================================
 * RELAY demo — patient capture flow (flow.js)  [REQUIREMENTS §8.2 / §4 — the bet]
 * Mobile phone-frame micro-funnel. Earned commitment: contact ask comes AFTER
 * investment; instant reward (intro video + recap card) unlocks it.
 * persist() upserts at EVERY step → abandoned leads still land in the queue.
 * ========================================================================== */
(function () {
  'use strict';
  var R = window.RELAY, U = R.util, S = R.store, esc = U.esc;
  var track = function (n, p) { R.instrument.track(n, p); };

  var cfg, vert, leadId = null, source = null;
  var state = { taxonomySelections: [], goalText: '', intake: {}, photos: [], photoConsent: false,
                contact: { firstName: '', email: '', phone: '' }, consent: { email: false, sms: false } };
  var steps = [], stepIdx = 0, root;
  /* A5 toggle: ?introVideo=off disables the intro video at the reward moment */
  var introVideoOn = new URLSearchParams(location.search).get('introVideo') !== 'off';

  function buildSteps() {
    steps = ['welcome', 'goals'];
    if (vert.photoPolicy.required) steps.push('photos');
    steps.push('questions', 'contact', 'reward', 'confirm');
  }

  /* persist(furthestStep) — upsert partial lead at every step (§8.2) */
  function persist(furthestStep) {
    var partial = {
      id: leadId, vertical: vert.id, status: 'new', furthestStep: furthestStep,
      taxonomySelections: state.taxonomySelections.slice(), goalText: state.goalText,
      intake: state.intake, photos: state.photos.slice(), photoConsent: state.photoConsent,
      contact: state.contact, source: source
    };
    if (state.consent.email || state.consent.sms) {
      partial.contactConsent = { email: state.consent.email, sms: state.consent.sms, at: new Date().toISOString() };
    }
    var saved = S.upsert(partial);
    leadId = saved.id;
    return saved;
  }

  function go(name) {
    stepIdx = steps.indexOf(name);
    render();
  }
  function next() {
    if (stepIdx < steps.length - 1) { stepIdx++; render(); }
  }

  function progress() { return Math.round((stepIdx / (steps.length - 1)) * 100); }

  /* ---- render ----------------------------------------------------------- */
  function render() {
    var name = steps[stepIdx];
    var body = root.querySelector('.phone__body');
    var foot = root.querySelector('.phone__foot');
    root.querySelector('.phone__progress > i').style.width = progress() + '%';
    body.scrollTop = 0;
    var r = RENDER[name](body, foot);
    foot.innerHTML = (r && r.foot) || '';
    if (r && r.afterFoot) r.afterFoot();
  }

  var RENDER = {
    welcome: function (body, foot) {
      var p = cfg.provider, c = cfg.copyPack || vert.copyPack;
      body.innerHTML =
        '<div class="provider-hero">' +
          '<div class="avatar avatar--lg">' + esc(U.initials(p.name)) + '</div>' +
          '<h1 class="display">' + esc(vert.copyPack.welcome) + '</h1>' +
          '<p class="dim">' + esc(p.name) + ', ' + esc(p.credential) + ' · ' + esc(p.specialty) + '</p>' +
          '<p class="stars">★ ' + esc(p.rating) + ' <span class="muted">(' + esc(p.reviews) + ' reviews)</span></p>' +
          '<div class="howto">' +
            howStep(1, 'Tell us your goals', 'A few quick taps — no forms, no pressure.') +
            howStep(2, 'Get a personal video', esc(p.name) + ' records a video about <em>your</em> situation.') +
            howStep(3, 'Decide on your terms', 'Watch on your own time, then book if it feels right.') +
          '</div>' +
          '<div class="trustpills">' +
            '<span class="pill">🔒 Private &amp; secure</span>' +
            '<span class="pill">⚡ Reply within 24h</span>' +
            '<span class="pill">🎥 Real surgeon, on camera</span>' +
          '</div>' +
        '</div>';
      return { foot: '<button class="btn btn--accent btn--lg btn--block" data-act="start">Start my consult</button>' };
    },

    goals: function (body) {
      var c = vert.copyPack;
      var chips = vert.taxonomy.map(function (t) {
        var on = state.taxonomySelections.indexOf(t.id) >= 0;
        return '<button class="chip' + (on ? ' chip--on' : '') + '" data-tax="' + esc(t.id) + '" aria-pressed="' + on + '">' +
          esc(t.icon) + ' ' + esc(t.label) + '</button>';
      }).join('');
      body.innerHTML =
        '<h2>' + esc(c.goalsPrompt) + '</h2>' +
        '<div class="chipwrap">' + chips + '</div>' +
        '<label class="field" style="margin-top:24px"><span>Anything in your own words? (optional)</span>' +
          '<textarea data-goaltext placeholder="e.g. I want to feel like myself again…">' + esc(state.goalText) + '</textarea></label>';
      return { foot: contBtn(state.taxonomySelections.length > 0 || state.goalText.trim()) };
    },

    photos: function (body) {
      var sels = vert.taxonomy.filter(function (t) { return state.taxonomySelections.indexOf(t.id) >= 0; });
      var requests = [];
      sels.forEach(function (t) { (t.photoRequests || []).forEach(function (r) { if (requests.indexOf(r) < 0) requests.push(r); }); });
      if (!requests.length) requests = ['Front', 'Side'];
      var tiles = requests.map(function (label, i) {
        var have = state.photos[i];
        return '<div class="photo-thumb" data-shot="' + i + '" title="' + esc(label) + '" ' +
          (have ? 'style="background-image:url(' + esc(have) + ')"' : '') + '>' +
          (have ? '' : '<div style="text-align:center"><div>＋</div><div style="font-size:.6rem">' + esc(label) + '</div></div>') + '</div>';
      }).join('');
      body.innerHTML =
        '<h2>Add a few photos</h2>' +
        '<p class="dim">These help ' + esc(cfg.provider.name) + ' give you specific, personal guidance. They’re private.</p>' +
        '<div class="photo-thumbs" style="margin:16px 0">' + tiles + '</div>' +
        '<input type="file" accept="image/*" capture="environment" data-photoinput hidden>' +
        '<label class="check" style="margin-top:18px"><input type="checkbox" data-photoconsent ' + (state.photoConsent ? 'checked' : '') + '>' +
          '<span>I consent to share these medical images with the practice for the purpose of my consultation. ' +
          'I understand they are stored securely and used only for my care.</span></label>';
      return { foot: contBtn(state.photoConsent, 'photoconsent') +
        '<button class="btn btn--ghost btn--block" data-act="skipphotos" style="margin-top:8px">Skip photos for now</button>' };
    },

    questions: function (body) {
      var html = vert.intakeSchema.map(function (q) {
        var opts = q.options.map(function (o) {
          var on = state.intake[q.key] === o.value;
          return '<div class="optrow' + (on ? ' is-on' : '') + '" data-q="' + esc(q.key) + '" data-v="' + esc(o.value) + '">' +
            '<span class="optrow__radio"></span><span>' + esc(o.label) + '</span></div>';
        }).join('');
        return '<div style="margin-bottom:22px"><h3>' + esc(q.label) +
          (q.required ? '' : ' <span class="muted" style="font-weight:400">(optional)</span>') + '</h3>' + opts + '</div>';
      }).join('');
      body.innerHTML = '<h2>A few quick questions</h2>' + html;
      var required = vert.intakeSchema.filter(function (q) { return q.required; });
      var done = required.every(function (q) { return state.intake[q.key]; });
      return { foot: contBtn(done) };
    },

    contact: function (body) {
      var c = vert.copyPack, p = cfg.provider;
      body.innerHTML =
        '<h2>' + esc(c.contactPrompt) + '</h2>' +
        '<p class="dim">' + esc(p.name) + ' ' + esc(vert.copyPack.rewardPromise) + ' We’ll send it here.</p>' +
        '<label class="field"><span>First name</span><input type="text" data-c="firstName" value="' + esc(state.contact.firstName) + '" placeholder="Your first name"></label>' +
        '<label class="field"><span>Email</span><input type="email" data-c="email" value="' + esc(state.contact.email) + '" placeholder="you@email.com"></label>' +
        '<label class="field"><span>Mobile (to text you the video)</span><input type="tel" data-c="phone" value="' + esc(state.contact.phone) + '" placeholder="(555) 555-5555"></label>' +
        '<label class="check"><input type="checkbox" data-consent="sms" ' + (state.consent.sms ? 'checked' : '') + '>' +
          '<span>I agree to receive my consult video and related messages by <strong>text</strong> from ' + esc(cfg.brand.name) +
          '. Msg &amp; data rates may apply; reply STOP to opt out. (TCPA consent)</span></label>' +
        '<label class="check" style="margin-top:10px"><input type="checkbox" data-consent="email" ' + (state.consent.email ? 'checked' : '') + '>' +
          '<span>I agree to receive my consult video and related emails. You can unsubscribe anytime.</span></label>';
      return { foot: '<button class="btn btn--accent btn--lg btn--block" data-act="unlock">🎬 Unlock my personal video</button>' +
        '<p class="muted center" style="font-size:.72rem;margin:8px 0 0">No spam. Your info is shared only with the practice.</p>',
        afterFoot: validateContact };
    },

    reward: function (body) {
      var p = cfg.provider, c = vert.copyPack;
      var vid = introVideoOn
        ? '<div class="reward-video" data-introvideo>' +
            '<div class="reward-video__play" data-act="playintro"><span>▶</span></div>' +
            '<div style="position:absolute;bottom:0;left:0;right:0;padding:14px;background:linear-gradient(transparent,rgba(0,0,0,.8));text-align:left">' +
              '<strong style="color:#fff">' + esc(p.name) + '</strong><br><span style="color:#cbd3e0;font-size:.8rem">' + esc(p.credential) + ' · ' + esc(c.rewardPromise) + '</span>' +
            '</div></div>'
        : '';
      var sels = vert.taxonomy.filter(function (t) { return state.taxonomySelections.indexOf(t.id) >= 0; })
        .map(function (t) { return t.label; }).join(', ') || 'Your goals';
      var tl = (vert.intakeSchema[0].options.filter(function (o) { return o.value === state.intake.timeline; })[0] || {}).label || '—';
      var bud = (vert.intakeSchema[1].options.filter(function (o) { return o.value === state.intake.budget; })[0] || {}).label || '—';
      body.innerHTML =
        '<h2 class="display">' + esc(c.rewardHeading) + '</h2>' + vid +
        '<div class="recap"><h4>Here’s what you told us</h4>' +
          recapRow('Interested in', sels) +
          recapRow('Timeline', tl) +
          recapRow('Investment', bud) +
          (state.goalText ? recapRow('In your words', '“' + state.goalText + '”') : '') +
          '<p style="margin:12px 0 0;font-size:.85rem">' + esc(p.name) + ' will address all of this in your personal video.</p>' +
        '</div>';
      return { foot: '<button class="btn btn--accent btn--lg btn--block" data-act="finish">Got it — what’s next?</button>' };
    },

    confirm: function (body) {
      var p = cfg.provider, c = vert.copyPack;
      body.innerHTML =
        '<div class="provider-hero">' +
          '<div style="font-size:3rem">🎥</div>' +
          '<h1 class="display">' + esc(c.confirm) + '</h1>' +
          '<p class="dim">' + esc(p.name) + ' is recording a personal video about your goals. ' +
            'You’ll get it by text and email — usually within 24 hours.</p>' +
          '<div class="recap" style="text-align:left;margin-top:20px"><h4>What happens now</h4>' +
            '<p style="font-size:.88rem;margin:0">1. ' + esc(p.name) + ' reviews what you shared.<br>' +
            '2. They record a short video just for you.<br>' +
            '3. You watch it on your private page and book if it’s right.</p></div>' +
          '<button class="btn btn--primary btn--lg btn--block" data-act="portal" style="margin-top:20px">Preview my private page →</button>' +
          '<p class="muted" style="font-size:.74rem;margin-top:10px">(In the real product this link arrives by text/email once your video is ready.)</p>' +
        '</div>';
      return { foot: '' };
    }
  };

  function howStep(n, t, d) {
    return '<div class="howto__step"><div class="howto__n">' + n + '</div><div><strong>' + t + '</strong><br><span class="dim" style="font-size:.85rem">' + d + '</span></div></div>';
  }
  function recapRow(k, v) { return '<div class="recap__row"><span class="muted">' + esc(k) + '</span><strong>' + esc(v) + '</strong></div>'; }
  function contBtn(enabled, gate) {
    return '<button class="btn btn--accent btn--lg btn--block" data-act="next"' + (enabled ? '' : ' disabled') + '>Continue</button>';
  }
  function validateContact() {
    var btn = root.querySelector('[data-act="unlock"]');
    var ok = state.contact.firstName.trim() && /@/.test(state.contact.email) && (state.consent.sms || state.consent.email);
    if (btn) btn.disabled = !ok;
  }

  /* ---- events ----------------------------------------------------------- */
  function wire() {
    var body = root.querySelector('.phone__body');
    var foot = root.querySelector('.phone__foot');

    function handleAct(act, e) {
      if (act === 'start') { track('flow_start', { source: channelName() }); persist('welcome'); next(); }
      else if (act === 'next') { stepAdvance(); }
      else if (act === 'skipphotos') { persist('photos'); next(); }
      else if (act === 'unlock') { doUnlock(); }
      else if (act === 'playintro') { playIntro(); }
      else if (act === 'finish') { persist('reward'); track('confirm', { lead: leadId }); next(); }
      else if (act === 'portal') { location.href = 'portal.html?lead=' + encodeURIComponent(leadId); }
    }

    U.on(root, 'click', '[data-act]', function (e, t) { e.preventDefault(); handleAct(t.getAttribute('data-act'), e); });
    U.on(root, 'click', '[data-tax]', function (e, t) {
      var id = t.getAttribute('data-tax'); var i = state.taxonomySelections.indexOf(id);
      if (i >= 0) state.taxonomySelections.splice(i, 1); else state.taxonomySelections.push(id);
      render();
    });
    U.on(root, 'click', '[data-q]', function (e, t) {
      state.intake[t.getAttribute('data-q')] = t.getAttribute('data-v'); render();
    });
    U.on(root, 'click', '.photo-thumb', function (e, t) {
      window._shotIdx = +t.getAttribute('data-shot');
      root.querySelector('[data-photoinput]').click();
    });
    root.addEventListener('input', function (e) {
      var t = e.target;
      if (t.matches('[data-goaltext]')) state.goalText = t.value;
      if (t.matches('[data-c]')) { state.contact[t.getAttribute('data-c')] = t.value; validateContact(); }
    });
    root.addEventListener('change', function (e) {
      var t = e.target;
      if (t.matches('[data-photoconsent]')) { state.photoConsent = t.checked; var b = foot.querySelector('[data-act="next"]'); if (b) b.disabled = !t.checked; }
      if (t.matches('[data-consent]')) { state.consent[t.getAttribute('data-consent')] = t.checked; validateContact(); }
      if (t.matches('[data-photoinput]')) handlePhoto(t);
    });
  }

  function stepAdvance() {
    var name = steps[stepIdx];
    if (name === 'goals') { persist('goals'); track('goals_set', { count: state.taxonomySelections.length }); }
    else if (name === 'photos') { persist('photos'); track('photos_added', { count: state.photos.length }); }
    else if (name === 'questions') { persist('questions'); track('questions_done', {}); }
    next();
  }

  function doUnlock() {
    state.contact.firstName = state.contact.firstName.trim();
    var saved = persist('contact');
    track('contact_submitted', { source: channelName(), tier: saved.qual.tier });
    /* §5.2 fire the conversion pixel(s) at the unlock moment */
    R.attribution.firePixels(cfg.analytics, 'Lead', {
      lead_id: leadId, channel: channelName(), value: saved.qual.value, currency: 'USD'
    });
    /* §3.3 RELAY-owned send is queued for the provider; show nothing patient-side yet */
    track('reward_viewed', { introVideo: introVideoOn });
    next();
  }

  function playIntro() {
    var box = root.querySelector('[data-introvideo]');
    if (!box) return;
    track('intro_video_played', { lead: leadId });
    box.querySelector('.reward-video__play').innerHTML = '<span style="background:transparent;color:#fff">●</span>';
    box.insertAdjacentHTML('beforeend', '<div class="reward-sim" style="position:absolute;inset:0;display:grid;place-items:center;background:#0c1116;color:#fff;text-align:center;padding:20px">' +
      '<div><div class="avatar avatar--lg" style="margin:0 auto 12px;background:var(--brand-primary)">' + esc(U.initials(cfg.provider.name)) + '</div>' +
      '<p style="max-width:260px">“Hi, I’m ' + esc(cfg.provider.name) + '. I’m personally going to make you a video about your specific situation.”</p>' +
      '<div class="phone__progress" style="margin-top:14px"><i style="width:0;transition:width 3s linear"></i></div></div></div>');
    var bar = box.querySelector('.reward-sim i');
    requestAnimationFrame(function () { bar.style.width = '100%'; });
    setTimeout(function () { track('intro_video_completed', { lead: leadId }); }, 3000);
  }

  /* camera/file: downscale before store (prototype convention §3.2) */
  function handlePhoto(input) {
    var file = input.files && input.files[0]; if (!file) return;
    var idx = window._shotIdx || 0;
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 900, scale = Math.min(1, max / Math.max(img.width, img.height));
        var cv = document.createElement('canvas');
        cv.width = img.width * scale; cv.height = img.height * scale;
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        state.photos[idx] = cv.toDataURL('image/jpeg', 0.8);
        render();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  function channelName() { return R.attribution.resolveChannel(source, cfg.sourceAliases); }

  /* ---- boot ------------------------------------------------------------- */
  function init(mountEl) {
    root = mountEl;
    S.seed();
    cfg = S.config(); vert = S.vertical();
    R.brand.applyBrand(cfg.brand);
    source = R.attribution.parseSource();   /* §5.1 parse-in at first step */
    R.devconsole && R.devconsole.info('Attribution parsed', { channel: R.attribution.resolveChannel(source, cfg.sourceAliases), source: source });
    buildSteps();
    /* paint brand bar */
    var bb = root.querySelector('[data-brandbar]');
    if (bb) bb.innerHTML = '<span class="brandmark">' + R.brand.logoMark(cfg.brand) + '</span>' +
      '<span class="muted" style="margin-left:auto;font-size:.72rem">Secured by RELAY</span>';
    wire();
    render();
  }

  R.flow = { init: init };
})();
