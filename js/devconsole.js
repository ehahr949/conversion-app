/* ============================================================================
 * RELAY demo — visible Dev Console (devconsole.js)  [DEMO §3]
 * A floating, toggleable panel that makes the FAKES verifiable on a sales call:
 * fake SMS/email "sends", pixel fires (full payload), and instrumentation events
 * are all logged here with timestamps. Proves the wiring without infrastructure.
 * ========================================================================== */
(function () {
  'use strict';
  var R = (window.RELAY = window.RELAY || {});
  var esc = function (s) { return R.util ? R.util.esc(s) : String(s); };
  var rows = [];
  var panel, body, badge;

  function mount() {
    if (panel) return;
    panel = document.createElement('div');
    panel.className = 'devconsole';
    panel.innerHTML =
      '<button class="devconsole__tab" type="button" aria-label="Toggle dev console">' +
        '⌁ Dev console <span class="devconsole__badge">0</span></button>' +
      '<div class="devconsole__body" hidden>' +
        '<div class="devconsole__head"><strong>RELAY dev console</strong>' +
          '<span class="devconsole__hint">fake sends · pixel fires · funnel events (DEMO §3)</span>' +
          '<button class="devconsole__clear" type="button">clear</button></div>' +
        '<div class="devconsole__log"></div></div>';
    document.body.appendChild(panel);
    body = panel.querySelector('.devconsole__body');
    badge = panel.querySelector('.devconsole__badge');
    var logEl = panel.querySelector('.devconsole__log');
    panel.querySelector('.devconsole__tab').addEventListener('click', function () {
      body.hidden = !body.hidden;
    });
    panel.querySelector('.devconsole__clear').addEventListener('click', function () {
      rows = []; logEl.innerHTML = ''; badge.textContent = '0';
    });
    render();
  }

  var ICON = { event: '◇', send: '✉', pixel: '◎', deposit: '$', info: '·' };

  function log(kind, label, payload) {
    if (!panel) mount();
    var row = { kind: kind, label: label, payload: payload, ts: new Date() };
    rows.push(row);
    if (rows.length > 300) rows = rows.slice(-300);
    render(row);
    badge.textContent = String(rows.length);
  }

  function render(single) {
    var logEl = panel.querySelector('.devconsole__log');
    function html(r) {
      var t = r.ts.toLocaleTimeString('en-US', { hour12: false });
      var pay = r.payload != null
        ? '<code>' + esc(typeof r.payload === 'string' ? r.payload : JSON.stringify(r.payload)) + '</code>'
        : '';
      return '<div class="devconsole__row devconsole__row--' + esc(r.kind) + '">' +
        '<span class="devconsole__t">' + esc(t) + '</span>' +
        '<span class="devconsole__k">' + (ICON[r.kind] || '·') + '</span>' +
        '<span class="devconsole__l">' + esc(r.label) + '</span>' + pay + '</div>';
    }
    if (single) { logEl.insertAdjacentHTML('beforeend', html(single)); logEl.scrollTop = logEl.scrollHeight; }
    else logEl.innerHTML = rows.map(html).join('');
  }

  R.devconsole = {
    mount: mount, log: log,
    /* Convenience wrappers used across surfaces */
    send: function (channel, to, preview) { log('send', 'SEND ' + channel + ' → ' + to, preview); },
    pixel: function (platform, event, payload) { log('pixel', 'PIXEL ' + platform + ' · ' + event, payload); },
    info: function (msg, payload) { log('info', msg, payload); }
  };
})();
