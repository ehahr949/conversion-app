/* ============================================================================
 * RELAY demo — Consult Studio (studio.js)  [REQUIREMENTS §8.4 — the A2 surface]
 * One recorder, two modes (intro / consult). Dead-simple default (open→record→use),
 * progressive depth (slides, PiP modes, teleprompter, orientation). Per-frame canvas
 * compositor draws active slide + webcam PiP; captureStream(30)+mic → MediaRecorder.
 * Must work on a phone. Camera-off → audio-reactive avatar pulse ring.
 * ========================================================================== */
(function () {
  'use strict';
  var R = window.RELAY, U = R.util, S = R.store, esc = U.esc;
  var track = function (n, p) { R.instrument.track(n, p); };

  var st = null; /* live session state */
  var CANVAS_FONT = '-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  function render(c, opts) {
    teardown();
    var cfg = S.config();
    var mode = opts.mode || 'consult';
    var lead = opts.leadId ? S.get(opts.leadId) : null;
    if (mode === 'consult' && !lead) { c.innerHTML = '<div class="wrap"><div class="card">Lead not found. <a href="#/queue">Back to queue</a></div></div>'; return; }

    st = {
      mode: mode, lead: lead, cfg: cfg,
      deck: buildDeck(mode, lead, cfg),
      active: 0, orientation: 'landscape', pipMode: 'corner',
      stream: null, recorder: null, chunks: [], recording: false, raf: null,
      startTs: 0, audioCtx: null, analyser: null, level: 0, recordedBlobUrl: null,
      openedAt: Date.now()
    };
    track('studio_opened', { mode: mode, lead: lead && lead.id });

    c.innerHTML =
      '<div class="wrap" style="max-width:100%;padding:0">' +
      '<div class="studio">' +
        deckPanel() +
        '<div class="studio__stage">' +
          '<div class="studio-canvas-wrap" data-cwrap><canvas data-canvas width="1280" height="720"></canvas>' +
            '<div class="teleprompter" data-teleprompter hidden></div></div>' +
          '<div class="studio__controls" data-controls></div>' +
          '<p class="muted" style="margin-top:10px;font-size:.78rem" data-status>Default path: hit record → talk → use. Everything else is optional.</p>' +
        '</div>' +
        rightPanel() +
      '</div></div>';

    st.canvas = U.qs('[data-canvas]', c);
    st.ctx = st.canvas.getContext('2d');
    wire(c);
    renderControls(c);
    startCamera(c);
    loop();
  }

  /* ---- auto-built deck from intake (the one-tap default) ---------------- */
  function buildDeck(mode, lead, cfg) {
    var p = cfg.provider;
    if (mode === 'intro') {
      return [{ type: 'intro', heading: 'Meet ' + p.name, body: p.credential + ' · ' + p.specialty,
        lines: ['Board-certified', String(p.reviews) + ' reviews · ★ ' + p.rating],
        note: 'Look into the camera. “Hi, I’m ' + p.name + '. I personally record a video for every patient about your specific goals…”' }];
    }
    var vert = S.vertical();
    var script = R.scriptgen.generate(lead, cfg);
    var procs = vert.taxonomy.filter(function (t) { return (lead.taxonomySelections || []).indexOf(t.id) >= 0; });
    var deck = [
      { type: 'intro', heading: 'Hi ' + ((lead.contact && lead.contact.firstName) || 'there') + ', I’m ' + p.name,
        body: p.credential, lines: [], note: script.blocks[0].line }
    ];
    if (lead.photos && lead.photos.length) {
      deck.push({ type: 'photos', heading: 'Your photos', body: 'Reviewing what you shared',
        photos: lead.photos.slice(), note: script.blocks[1].line });
    }
    deck.push({ type: 'beforeafter', heading: 'A result like yours',
      body: procs[0] ? procs[0].label : 'Similar case', note: script.blocks[2].line });
    deck.push({ type: 'plan', heading: 'Your plan & next step',
      lines: ['Personalized approach', 'Reserve your consult below'], note: script.blocks[3].line });
    return deck;
  }

  /* ---- panels ----------------------------------------------------------- */
  function deckPanel() {
    return '<div class="studio__deck"><div style="font-weight:650;margin-bottom:8px;font-size:.85rem">SLIDES</div>' +
      '<div data-deck></div>' +
      (st.mode === 'consult' ? '<button class="btn btn--ghost btn--sm btn--block" data-act="addslide" style="margin-top:8px">+ Text slide</button>' : '') +
      '</div>';
  }
  function rightPanel() {
    return '<div class="studio__panel">' +
      '<div class="card__title">' + (st.mode === 'intro' ? 'Intro video' : 'Consult recording') + '</div>' +
      '<div data-editor></div>' +
      '<div class="card__title" style="margin-top:18px">Camera</div>' +
      '<label class="field" style="margin:0"><span>Webcam position</span>' +
        '<select data-pip>' +
          '<option value="corner">Corner PiP</option><option value="large">Large PiP</option>' +
          '<option value="full">Full talking-head</option><option value="off">Camera off (avatar)</option>' +
        '</select></label>' +
      '<label class="field"><span>Orientation</span><select data-orient>' +
        '<option value="landscape">Landscape 1280×720</option><option value="portrait">Phone portrait 720×1280</option></select></label>' +
      '<label class="check"><input type="checkbox" data-tp> <span>Show teleprompter</span></label>' +
      '</div>';
  }

  function renderDeck(c) {
    var host = U.qs('[data-deck]', c);
    host.innerHTML = st.deck.map(function (s, i) {
      return '<div class="slide-thumb' + (i === st.active ? ' is-active' : '') + '" data-slide="' + i + '">' +
        '<div class="slide-thumb__n">SLIDE ' + (i + 1) + ' · ' + esc(s.type) + '</div>' + esc(s.heading || '') +
        (st.mode === 'consult' && st.deck.length > 1 ? ' <button class="btn btn--sm" data-del="' + i + '" style="float:right;padding:0 6px">✕</button>' : '') +
        '</div>';
    }).join('');
  }
  function renderEditor(c) {
    var s = st.deck[st.active]; var host = U.qs('[data-editor]', c);
    host.innerHTML =
      '<label class="field"><span>Heading</span><input type="text" data-f="heading" value="' + esc(s.heading || '') + '"></label>' +
      '<label class="field"><span>Body</span><input type="text" data-f="body" value="' + esc(s.body || '') + '"></label>' +
      '<label class="field"><span>Teleprompter note</span><textarea data-f="note">' + esc(s.note || '') + '</textarea></label>';
  }
  function renderControls(c) {
    var host = U.qs('[data-controls]', c);
    if (st.recording) {
      host.innerHTML = '<span class="rec-dot"></span><span class="num" data-timer>0:00</span>' +
        '<button class="btn btn--accent btn--lg" data-act="stop">■ Stop</button>';
    } else if (st.recordedBlobUrl) {
      host.innerHTML = '<button class="btn btn--ghost" data-act="rerecord">↻ Re-record</button>' +
        '<button class="btn btn--accent btn--lg" data-act="use">✓ Use this video</button>';
    } else {
      host.innerHTML = '<button class="btn btn--accent btn--lg" data-act="record">● Record</button>' +
        '<span class="muted" style="font-size:.8rem">' + (st.mode === 'intro' ? 'Reusable for every lead' : 'One take is plenty') + '</span>';
    }
  }

  /* ---- wiring ----------------------------------------------------------- */
  function wire(c) {
    renderDeck(c); renderEditor(c);
    U.on(c, 'click', '[data-slide]', function (e, t) { if (e.target.hasAttribute('data-del')) return; st.active = +t.getAttribute('data-slide'); renderDeck(c); renderEditor(c); });
    U.on(c, 'click', '[data-del]', function (e, t) { e.stopPropagation(); var i = +t.getAttribute('data-del'); st.deck.splice(i, 1); if (st.active >= st.deck.length) st.active = st.deck.length - 1; renderDeck(c); renderEditor(c); });
    U.on(c, 'click', '[data-act="addslide"]', function () { st.deck.push({ type: 'text', heading: 'New slide', body: '', note: '' }); st.active = st.deck.length - 1; renderDeck(c); renderEditor(c); });
    c.addEventListener('input', function (e) { if (e.target.matches('[data-f]')) { st.deck[st.active][e.target.getAttribute('data-f')] = e.target.value; renderDeck(c); } });
    U.on(c, 'change', '[data-pip]', function (e, t) { st.pipMode = t.value; });
    U.on(c, 'change', '[data-orient]', function (e, t) { setOrientation(c, t.value); });
    U.on(c, 'change', '[data-tp]', function (e, t) { U.qs('[data-teleprompter]', c).hidden = !t.checked; });
    U.on(c, 'click', '[data-act="record"]', function () { startRec(c); });
    U.on(c, 'click', '[data-act="stop"]', function () { stopRec(c); });
    U.on(c, 'click', '[data-act="rerecord"]', function () { st.recordedBlobUrl = null; renderControls(c); });
    U.on(c, 'click', '[data-act="use"]', function () { useVideo(c); });
  }

  function setOrientation(c, o) {
    st.orientation = o;
    var wrap = U.qs('[data-cwrap]', c);
    wrap.classList.toggle('portrait', o === 'portrait');
    if (o === 'portrait') { st.canvas.width = 720; st.canvas.height = 1280; }
    else { st.canvas.width = 1280; st.canvas.height = 720; }
  }

  /* ---- camera ----------------------------------------------------------- */
  function startCamera(c) {
    var status = U.qs('[data-status]', c);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      st.pipMode = 'off'; if (status) status.textContent = 'No camera API here — recording in avatar mode (audio-reactive).'; return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 1280 }, audio: true })
      .then(function (stream) {
        st.stream = stream;
        st.video = document.createElement('video');
        st.video.srcObject = stream; st.video.muted = true; st.video.playsInline = true; st.video.play();
        try {
          st.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          var src = st.audioCtx.createMediaStreamSource(stream);
          st.analyser = st.audioCtx.createAnalyser(); st.analyser.fftSize = 256; src.connect(st.analyser);
          st.audioData = new Uint8Array(st.analyser.frequencyBinCount);
        } catch (e) {}
      })
      .catch(function () { st.pipMode = 'off'; if (status) status.textContent = 'Camera blocked — recording in avatar mode. (Allow camera to use webcam PiP.)'; });
  }

  /* ---- compositor loop -------------------------------------------------- */
  function loop() {
    if (!st) return;
    draw();
    st.raf = requestAnimationFrame(loop);
  }
  function draw() {
    var ctx = st.ctx, W = st.canvas.width, H = st.canvas.height, s = st.deck[st.active] || {};
    var brand = st.cfg.brand;
    /* brand-themed slide background */
    var g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, brand.primary || '#1d2a52'); g.addColorStop(1, shade(brand.primary || '#1d2a52', -30));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    /* audio level for avatar pulse */
    if (st.analyser) { st.analyser.getByteFrequencyData(st.audioData); var sum = 0; for (var i = 0; i < st.audioData.length; i++) sum += st.audioData[i]; st.level = sum / st.audioData.length / 255; }

    if (st.pipMode === 'full' && st.video) {
      drawVideoCover(ctx, st.video, 0, 0, W, H);
      scrim(ctx, W, H);
    } else if (s.type === 'photos' && s.photos && s.photos.length) {
      drawPhotos(ctx, s.photos, W, H);
    } else if (s.type === 'beforeafter') {
      drawBeforeAfter(ctx, W, H);
    }

    /* lower-third text */
    if (st.pipMode !== 'full' || true) drawText(ctx, s, W, H, brand);

    /* logo */
    if (brand.videoFrame && brand.videoFrame.showLogo) {
      ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.font = '600 ' + Math.round(W * 0.022) + 'px ' + CANVAS_FONT;
      ctx.textAlign = 'right'; ctx.fillText(brand.wordmark || brand.name || '', W - 36, 52);
    }

    /* webcam PiP */
    if (st.pipMode === 'off') drawAvatar(ctx, W, H);
    else if (st.video && st.pipMode !== 'full') drawPip(ctx, W, H);
  }

  function drawText(ctx, s, W, H, brand) {
    ctx.textAlign = 'left';
    var pad = Math.round(W * 0.05);
    var y = H - Math.round(H * 0.20);
    ctx.fillStyle = '#fff';
    ctx.font = '650 ' + Math.round(W * 0.05) + 'px ' + (brand.font ? brand.font + ', ' : '') + CANVAS_FONT;
    wrapText(ctx, s.heading || '', pad, y, W - pad * 2, Math.round(W * 0.058));
    if (s.body) { ctx.font = '400 ' + Math.round(W * 0.028) + 'px ' + CANVAS_FONT; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillText(s.body, pad, y + Math.round(W * 0.06)); }
    if (s.lines) { ctx.font = '400 ' + Math.round(W * 0.024) + 'px ' + CANVAS_FONT; s.lines.forEach(function (ln, i) { ctx.fillText('•  ' + ln, pad, y + Math.round(W * 0.10) + i * Math.round(W * 0.035)); }); }
  }
  function drawPip(ctx, W, H) {
    var pw, ph, x, y;
    if (st.pipMode === 'large') { pw = W * 0.42; ph = pw * 0.66; x = W - pw - 30; y = 30; }
    else { pw = W * 0.26; ph = pw * 0.66; x = W - pw - 30; y = 30; }
    ctx.save();
    roundRect(ctx, x, y, pw, ph, 16); ctx.clip();
    drawVideoCover(ctx, st.video, x, y, pw, ph);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 3; roundRect(ctx, x, y, pw, ph, 16); ctx.stroke();
  }
  function drawAvatar(ctx, W, H) {
    var cx = W - W * 0.16, cy = H * 0.18, base = W * 0.07;
    var r = base * (1 + st.level * 0.5);
    ctx.beginPath(); ctx.arc(cx, cy, r + 14, 0, 7); ctx.fillStyle = 'rgba(255,255,255,' + (0.12 + st.level * 0.3) + ')'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, base, 0, 7); ctx.fillStyle = st.cfg.brand.accent || '#ff6a4d'; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '700 ' + Math.round(base * 0.8) + 'px sans-serif';
    ctx.fillText(U.initials(st.cfg.provider.name), cx, cy + base * 0.28);
    ctx.textAlign = 'left';
  }
  function drawPhotos(ctx, photos, W, H) {
    var n = Math.min(photos.length, 3), gap = 20, gw = (W - gap * (n + 1)) / n, gh = H * 0.5, y = H * 0.12;
    photos.slice(0, n).forEach(function (p, i) {
      var x = gap + i * (gw + gap);
      var src = typeof p === 'string' ? p : (p && p.src) || '';
      if (/^data:/.test(src)) { var img = imgCache(src); if (img.complete) { ctx.save(); roundRect(ctx, x, y, gw, gh, 12); ctx.clip(); drawImgCover(ctx, img, x, y, gw, gh); ctx.restore(); } }
      else { ctx.fillStyle = 'rgba(255,255,255,.12)'; roundRect(ctx, x, y, gw, gh, 12); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = '40px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🖼', x + gw / 2, y + gh / 2); ctx.textAlign = 'left'; }
    });
  }
  function drawBeforeAfter(ctx, W, H) {
    var y = H * 0.12, h = H * 0.5, w = (W - 60) / 2;
    ['BEFORE', 'AFTER'].forEach(function (lbl, i) {
      var x = 20 + i * (w + 20);
      ctx.fillStyle = i ? 'rgba(217,138,78,.25)' : 'rgba(255,255,255,.1)'; roundRect(ctx, x, y, w, h, 12); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '700 24px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(lbl, x + w / 2, y + 40); ctx.font = '40px sans-serif'; ctx.fillText('🙂', x + w / 2, y + h / 2);
      ctx.textAlign = 'left';
    });
  }

  /* ---- recording -------------------------------------------------------- */
  function startRec(c) {
    st.chunks = [];
    var canvasStream = st.canvas.captureStream(30);
    if (st.stream) { var at = st.stream.getAudioTracks()[0]; if (at) canvasStream.addTrack(at); }
    try {
      st.recorder = new MediaRecorder(canvasStream, { mimeType: pickMime() });
    } catch (e) { R.app && R.app.toast('Recording not supported here — try a recent Chrome/Safari.'); return; }
    st.recorder.ondataavailable = function (e) { if (e.data && e.data.size) st.chunks.push(e.data); };
    st.recorder.onstop = function () {
      var blob = new Blob(st.chunks, { type: 'video/webm' });
      st.recordedBlobUrl = URL.createObjectURL(blob);
      st.durationSec = Math.round((Date.now() - st.startTs) / 1000);
      track('recording_used', { mode: st.mode, durationSec: st.durationSec });
      renderControls(c);
    };
    st.recorder.start();
    st.recording = true; st.startTs = Date.now();
    track('recording_started', { mode: st.mode, lead: st.lead && st.lead.id });
    renderControls(c); tickTimer(c);
  }
  function stopRec(c) {
    if (st.recorder && st.recording) { st.recording = false; try { st.recorder.stop(); } catch (e) {} }
    renderControls(c);
  }
  function tickTimer(c) {
    if (!st || !st.recording) return;
    var el = U.qs('[data-timer]', c);
    if (el) { var s = Math.floor((Date.now() - st.startTs) / 1000); el.textContent = Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
    setTimeout(function () { tickTimer(c); }, 500);
  }

  function useVideo(c) {
    var now = new Date().toISOString();
    var ttr = Math.round((Date.now() - st.openedAt) / 1000);
    track('time_to_record', { mode: st.mode, seconds: ttr, lead: st.lead && st.lead.id });
    if (st.mode === 'intro') {
      S.saveConfig({ introVideo: { assetUrl: st.recordedBlobUrl || '', recordedAt: now, durationSec: st.durationSec || 0 } });
      R.app.toast('Intro video saved — it’ll play for every new lead.');
      R.app.go('#/settings');
    } else {
      S.patch(st.lead.id, {
        status: 'recorded',
        video: { recordedAt: now, hasRecording: true, durationSec: st.durationSec || 0,
                 assetUrl: st.recordedBlobUrl || '', slides: st.deck.map(function (s) { return { type: s.type, heading: s.heading }; }) }
      });
      R.app.toast('Recorded! Now send it from the lead drawer.');
      R.app.go('#/queue');
    }
    teardown();
  }

  /* ---- helpers ---------------------------------------------------------- */
  function pickMime() {
    var opts = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
    for (var i = 0; i < opts.length; i++) { try { if (window.MediaRecorder && MediaRecorder.isTypeSupported(opts[i])) return opts[i]; } catch (e) {} }
    return 'video/webm';
  }
  var _imgs = {};
  function imgCache(src) { if (!_imgs[src]) { var i = new Image(); i.src = src; _imgs[src] = i; } return _imgs[src]; }
  function drawImgCover(ctx, img, x, y, w, h) {
    var ir = img.width / img.height, r = w / h, sw, sh, sx, sy;
    if (ir > r) { sh = img.height; sw = sh * r; sx = (img.width - sw) / 2; sy = 0; }
    else { sw = img.width; sh = sw / r; sx = 0; sy = (img.height - sh) / 2; }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }
  function drawVideoCover(ctx, v, x, y, w, h) { if (!v || !v.videoWidth) { ctx.fillStyle = '#222'; ctx.fillRect(x, y, w, h); return; } drawImgCover(ctx, v, x, y, w, h); }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function scrim(ctx, W, H) { var g = ctx.createLinearGradient(0, H * 0.4, 0, H); g.addColorStop(0, 'transparent'); g.addColorStop(1, 'rgba(0,0,0,.6)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  function wrapText(ctx, text, x, y, maxW, lh) {
    var words = String(text).split(' '), line = '', yy = y;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i] + ' ';
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = words[i] + ' '; yy += lh; }
      else line = test;
    }
    ctx.fillText(line, x, yy);
  }
  function shade(hex, amt) {
    var c = U.hexToRgb(hex);
    function cl(v) { return Math.max(0, Math.min(255, v + amt)); }
    return 'rgb(' + cl(c.r) + ',' + cl(c.g) + ',' + cl(c.b) + ')';
  }

  function teardown() {
    if (!st) return;
    if (st.raf) cancelAnimationFrame(st.raf);
    if (st.recording && st.recorder) { try { st.recorder.stop(); } catch (e) {} }
    if (st.stream) st.stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
    if (st.audioCtx) { try { st.audioCtx.close(); } catch (e) {} }
    st = null;
  }
  window.addEventListener('hashchange', function () { /* leaving studio cleans camera */ if (st && location.hash.indexOf('studio') < 0) teardown(); });

  R.surfaces = R.surfaces || {};
  R.surfaces.studio = { render: render };
})();
