/* ============================================================================
 * RELAY demo — instrumentation (instrument.js)  [DEMO §6]
 * A thin funnel-event log written to localStorage. These event names map 1:1
 * to the real analytics() the backend will compute, so the Performance view
 * is built once and reused. Also mirrors to a visible in-page Dev Console.
 * ========================================================================== */
(function () {
  'use strict';
  var R = (window.RELAY = window.RELAY || {});
  var KEY = 'relay.demo.events.v1';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch (e) { return []; }
  }
  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
  }

  var listeners = [];

  /* track(name, props) — append an event with timestamp + parsed source. */
  function track(name, props) {
    var ev = {
      name: name,
      ts: new Date().toISOString(),
      props: props || {}
    };
    var list = load();
    list.push(ev);
    if (list.length > 2000) list = list.slice(-2000);
    save(list);
    listeners.forEach(function (fn) { try { fn(ev); } catch (e) {} });
    /* Mirror to the visible dev console (DEMO §3 — pixel/dev-console fidelity) */
    if (R.devconsole) R.devconsole.log('event', name, ev.props);
    return ev;
  }

  function all() { return load(); }
  function clear() { save([]); }
  function onTrack(fn) { listeners.push(fn); }

  /* Summaries used by the Performance view's funnel/engagement panels. */
  function counts() {
    var c = {};
    load().forEach(function (e) { c[e.name] = (c[e.name] || 0) + 1; });
    return c;
  }

  R.instrument = { track: track, all: all, clear: clear, onTrack: onTrack, counts: counts };
})();
