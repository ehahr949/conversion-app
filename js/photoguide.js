/* ============================================================================
 * RELAY demo — guided photo capture (photoguide.js)  [REQUIREMENTS §8.2, §6.3]
 * Per-treatment, illustrated photo guidance. Each selected procedure maps to an
 * ordered set of SHOTS; each shot carries an illustrated silhouette frame
 * (rendered as inline SVG, used both as the on-camera alignment overlay and in
 * the guide list) plus a pose/expression instruction. Data-driven per vertical.
 * ========================================================================== */
(function () {
  'use strict';
  var R = (window.RELAY = window.RELAY || {});

  /* ---- shot library: id → { label, region, view, expr, instruction } ---- */
  var SHOTS = {
    /* FACE */
    face_front_rest:  { label: 'Front — resting',       region: 'face', view: 'front',  expr: 'rest',
      instruction: 'Face the camera straight on and fit your face inside the outline. Relax completely — lips together, neutral expression.' },
    face_front_smile: { label: 'Front — smiling',       region: 'face', view: 'front',  expr: 'smile',
      instruction: 'Same framing — now give a big, natural smile.' },
    face_front_brows: { label: 'Front — brows raised',  region: 'face', view: 'front',  expr: 'brows',
      instruction: 'Raise your eyebrows as high as you can. This shows us how your muscles move.' },
    face_front_frown: { label: 'Front — frowning',      region: 'face', view: 'front',  expr: 'frown',
      instruction: 'Frown and squint, as if concentrating, to reveal the lines between your brows.' },
    face_eyes_closed: { label: 'Front — eyes closed',   region: 'face', view: 'front',  expr: 'eyes',
      instruction: 'Gently close your eyes and keep your face relaxed.' },
    face_left:        { label: 'Left profile',          region: 'face', view: 'left',   expr: 'rest',
      instruction: 'Turn your head 90° to show your LEFT profile. Look straight ahead, chin level.' },
    face_right:       { label: 'Right profile',         region: 'face', view: 'right',  expr: 'rest',
      instruction: 'Turn your head 90° to show your RIGHT profile. Look straight ahead, chin level.' },
    face_base:        { label: 'Base view',             region: 'face', view: 'base',   expr: 'rest',
      instruction: 'Tilt your head back slightly so the camera sees the base of your nose. Keep it centered.' },

    /* BREAST / chest */
    bust_front_down:  { label: 'Front — arms relaxed',  region: 'breast', view: 'front',
      instruction: 'Frame from your collarbone to your waist, facing the camera with arms relaxed at your sides.' },
    bust_front_hips:  { label: 'Front — hands on hips', region: 'breast', view: 'front',
      instruction: 'Same framing — place your hands on your hips, elbows back.' },
    bust_left_obl:    { label: 'Left 45°',              region: 'breast', view: 'oblique-left',
      instruction: 'Turn 45° to show a three-quarter view of your LEFT side.' },
    bust_right_obl:   { label: 'Right 45°',             region: 'breast', view: 'oblique-right',
      instruction: 'Turn 45° to show a three-quarter view of your RIGHT side.' },
    bust_left_side:   { label: 'Left side',             region: 'breast', view: 'side-left',
      instruction: 'Turn 90° for a full LEFT side view, arm slightly forward.' },
    bust_right_side:  { label: 'Right side',            region: 'breast', view: 'side-right',
      instruction: 'Turn 90° for a full RIGHT side view, arm slightly forward.' },

    /* BODY / abdomen */
    body_front:       { label: 'Front',                 region: 'body', view: 'front',
      instruction: 'Face the camera from chest to upper thighs, arms held slightly away from your body.' },
    body_left_obl:    { label: 'Left 45°',              region: 'body', view: 'oblique-left',
      instruction: 'Turn 45° to your right for a three-quarter LEFT view.' },
    body_right_obl:   { label: 'Right 45°',             region: 'body', view: 'oblique-right',
      instruction: 'Turn 45° to your left for a three-quarter RIGHT view.' },
    body_left_side:   { label: 'Left side',             region: 'body', view: 'side-left',
      instruction: 'Turn 90° for a full LEFT side view.' },
    body_right_side:  { label: 'Right side',            region: 'body', view: 'side-right',
      instruction: 'Turn 90° for a full RIGHT side view.' },
    body_back:        { label: 'Back',                  region: 'body', view: 'back',
      instruction: 'Turn around for a back view — especially important for buttock procedures.' }
  };

  /* ---- procedure → ordered shot ids ------------------------------------- */
  var PROCEDURE_SHOTS = {
    rhino:       ['face_front_rest', 'face_base', 'face_left', 'face_right'],
    face:        ['face_front_rest', 'face_front_smile', 'face_left', 'face_right'],
    eyes:        ['face_front_rest', 'face_eyes_closed', 'face_front_brows'],
    botox:       ['face_front_rest', 'face_front_frown', 'face_front_brows', 'face_front_smile'],
    breast_aug:  ['bust_front_down', 'bust_front_hips', 'bust_left_obl', 'bust_right_obl', 'bust_left_side', 'bust_right_side'],
    breast_lift: ['bust_front_down', 'bust_left_obl', 'bust_right_obl', 'bust_left_side', 'bust_right_side'],
    tummy:       ['body_front', 'body_left_obl', 'body_right_obl', 'body_left_side', 'body_right_side'],
    lipo:        ['body_front', 'body_left_obl', 'body_right_obl', 'body_left_side', 'body_right_side'],
    bbl:         ['body_front', 'body_back', 'body_left_side', 'body_right_side'],
    mommy:       ['bust_front_down', 'bust_left_side', 'bust_right_side', 'body_front', 'body_left_side', 'body_right_side']
  };

  /* canonical ordering so multi-procedure leads get a sensible sequence */
  var ORDER = Object.keys(SHOTS);

  /* shotsFor(lead) → ordered, deduped shot specs for the selected procedures */
  function shotsFor(lead) {
    var sels = (lead && lead.taxonomySelections) || [];
    var ids = {};
    sels.forEach(function (proc) { (PROCEDURE_SHOTS[proc] || []).forEach(function (id) { ids[id] = true; }); });
    if (!Object.keys(ids).length) { ids.face_front_rest = true; } /* sensible default */
    return ORDER.filter(function (id) { return ids[id]; }).map(function (id) {
      return R.util.deepMerge({ id: id }, SHOTS[id]);
    });
  }

  /* ---- illustrated frames (inline SVG, stroke=currentColor) ------------- */
  var DASH = 'stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"';
  var GHOST = 'stroke="currentColor" stroke-width="2.4" fill="none" stroke-dasharray="7 8" stroke-linecap="round"';
  var THIN = 'stroke="currentColor" stroke-width="1.6" fill="none" opacity=".55" stroke-linecap="round"';

  function centerline() {
    return '<line x1="120" y1="26" x2="120" y2="320" stroke="currentColor" stroke-width="1.2" stroke-dasharray="3 8" opacity=".3"/>';
  }

  function faceFrame(view, expr) {
    var s = centerline();
    /* head + shoulders ghost outline */
    s += '<ellipse cx="120" cy="132" rx="62" ry="80" ' + GHOST + '/>';
    s += '<path d="M44,300 Q120,234 196,300" ' + GHOST + '/>';
    s += '<path d="M99,206 V232 M141,206 V232" ' + GHOST + '/>';

    if (view === 'left' || view === 'right') {
      /* nose bump on the facing side + ear dot to read as a profile */
      var nose = view === 'left'
        ? '<path d="M58,124 l-12,12 l12,10" ' + DASH + '/>'
        : '<path d="M182,124 l12,12 l-12,10" ' + DASH + '/>';
      s += nose;
      s += '<circle cx="' + (view === 'left' ? 150 : 90) + '" cy="138" r="5" ' + THIN + '/>';
      s += turnArrow(view === 'left' ? 'left' : 'right', '90°');
    } else if (view === 'base') {
      s += '<path d="M104,150 q16,14 32,0" ' + THIN + '/>';     /* nostrils */
      s += '<circle cx="110" cy="146" r="3.5" ' + THIN + '/><circle cx="130" cy="146" r="3.5" ' + THIN + '/>';
      s += tiltArrow();
    } else {
      /* FRONT — eyes, nose, mouth driven by expression */
      if (expr === 'eyes') {
        s += '<path d="M88,120 q14,7 28,0 M124,120 q14,7 28,0" ' + THIN + '/>';
      } else if (expr === 'brows') {
        s += '<path d="M86,116 h28 M126,116 h28" ' + THIN + '/>';
        s += '<path d="M92,104 l6,-9 M148,104 l-6,-9 M120,100 v-9" ' + DASH + ' opacity=".8"/>'; /* up ticks */
      } else {
        s += '<path d="M88,120 h26 M126,120 h26" ' + THIN + '/>';
      }
      if (expr !== 'eyes' && expr !== 'brows') {
        if (expr === 'frown') s += '<path d="M114,104 v10 M126,104 v10" ' + THIN + '/>'; /* glabella */
      }
      s += '<path d="M120,128 V156 M111,156 q9,8 18,0" ' + THIN + '/>'; /* nose */
      s += mouth(expr);
    }
    return svg(s);
  }
  function mouth(expr) {
    if (expr === 'smile') return '<path d="M100,176 q20,18 40,0" ' + DASH + ' opacity=".85"/>';
    if (expr === 'frown') return '<path d="M100,184 q20,-12 40,0" ' + DASH + ' opacity=".85"/>';
    return '<path d="M102,180 h36" ' + THIN + '/>';
  }

  function bustFrame(view) {
    /* neckline → shoulders → torso to waist */
    var s = centerline();
    s += '<path d="M96,64 q24,26 48,0" ' + GHOST + '/>';
    s += '<path d="M40,92 Q120,66 200,92 L182,300 Q120,322 58,300 Z" ' + GHOST + '/>';
    if (view.indexOf('oblique') === 0) s += turnArrow(view.indexOf('left') >= 0 ? 'left' : 'right', '45°');
    else if (view.indexOf('side') === 0) s += turnArrow(view.indexOf('left') >= 0 ? 'left' : 'right', '90°');
    if (view === 'front') s += '<path d="M86,116 v8 M154,116 v8" ' + THIN + '/>'; /* subtle landmarks */
    return svg(s);
  }

  function bodyFrame(view) {
    /* shoulders → waist pinch → hips → thighs */
    var s = centerline();
    var d = 'M56,72 Q120,56 184,72 L176,150 Q200,178 182,232 L168,316 Q120,336 72,316 L58,232 Q40,178 64,150 Z';
    s += '<path d="' + d + '" ' + GHOST + '/>';
    s += '<path d="M70,176 Q120,190 170,176" ' + THIN + '/>'; /* waist line */
    if (view.indexOf('oblique') === 0) s += turnArrow(view.indexOf('left') >= 0 ? 'left' : 'right', '45°');
    else if (view.indexOf('side') === 0) s += turnArrow(view.indexOf('left') >= 0 ? 'left' : 'right', '90°');
    else if (view === 'back') s += backBadge();
    return svg(s);
  }

  /* directional hints */
  function turnArrow(dir, deg) {
    var path = dir === 'left'
      ? '<path d="M196,52 a30,30 0 0 0 -30,-30" ' + DASH + ' marker-end="url(#ah)"/>'
      : '<path d="M44,52 a30,30 0 0 1 30,-30" ' + DASH + ' marker-end="url(#ah)"/>';
    var x = dir === 'left' ? 168 : 50;
    return defsArrow() + path + '<text x="' + x + '" y="64" fill="currentColor" font-size="15" font-weight="700" text-anchor="middle">' + deg + '</text>';
  }
  function tiltArrow() {
    return defsArrow() + '<path d="M120,40 v-18" ' + DASH + ' marker-end="url(#ah)"/>' +
      '<text x="120" y="20" fill="currentColor" font-size="13" font-weight="700" text-anchor="middle">tilt back</text>';
  }
  function backBadge() {
    return defsArrow() + '<path d="M150,40 a26,26 0 1 1 -26,-22" ' + DASH + ' marker-end="url(#ah)"/>' +
      '<text x="120" y="30" fill="currentColor" font-size="13" font-weight="700" text-anchor="middle">turn around</text>';
  }
  function defsArrow() {
    return '<defs><marker id="ah" markerWidth="9" markerHeight="9" refX="5" refY="4.5" orient="auto">' +
      '<path d="M0,0 L9,4.5 L0,9 z" fill="currentColor"/></marker></defs>';
  }

  function svg(inner) {
    return '<svg class="pg-svg" viewBox="0 0 240 340" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + inner + '</svg>';
  }

  /* frameSVG(shot) → illustrated frame for a shot */
  function frameSVG(shot) {
    if (!shot) return '';
    if (shot.region === 'face') return faceFrame(shot.view, shot.expr);
    if (shot.region === 'breast') return bustFrame(shot.view);
    return bodyFrame(shot.view);
  }

  var consentText = 'I consent to share these medical images with the practice for my ' +
    'consultation. I understand they are stored securely and used only for my care.';

  R.photoguide = { shotsFor: shotsFor, frameSVG: frameSVG, SHOTS: SHOTS, consentText: consentText };
})();
