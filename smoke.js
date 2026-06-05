/* Headless smoke test: loads each page, drives the core loop, reports console errors.
   Run: NODE_PATH=$(npm root -g) node smoke.js   (server must be on :8099) */
const { chromium } = require('playwright');
const BASE = 'http://localhost:8099';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ permissions: [] });
  const errors = [];
  let failures = 0;

  function watch(page, tag) {
    page.on('console', m => { if (m.type() === 'error') errors.push(`[${tag}] console.error: ${m.text()}`); });
    page.on('pageerror', e => errors.push(`[${tag}] pageerror: ${e.message}`));
  }
  function check(cond, msg) { if (!cond) { failures++; console.log('  ✗ ' + msg); } else { console.log('  ✓ ' + msg); } }

  // ---- 1. Pages return content & render --------------------------------
  for (const [path, sel, tag] of [
    ['/index.html', '.sidebar', 'console'],
    ['/flow.html', '.phone__body', 'flow'],
    ['/portal.html', '.portal', 'portal'],
    ['/widgets.html', '.relay-inline', 'widgets'],
    ['/bio.html', '.linklist', 'bio'],
    ['/pricing.html', '[data-plan]', 'pricing']
  ]) {
    const page = await ctx.newPage(); watch(page, tag);
    const resp = await page.goto(BASE + path, { waitUntil: 'networkidle' });
    console.log(`\n# ${path} (${resp.status()})`);
    check(resp.status() === 200, 'HTTP 200');
    check(await page.$(sel) !== null, `rendered ${sel}`);
    await page.close();
  }

  // ---- 2. Console: queue alive, drawer, performance, settings ----------
  {
    const page = await ctx.newPage(); watch(page, 'console');
    await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
    console.log('\n# console deep checks');
    const rows = await page.$$('.qrow');
    check(rows.length >= 10, `queue has ${rows.length} seeded leads`);
    // open drawer
    await rows[0].click();
    await page.waitForSelector('.drawer.is-open', { timeout: 2000 });
    check(await page.$('.nextaction') !== null, 'drawer shows next-action');
    check(await page.$('.ring') !== null, 'drawer shows qualification ring');
    check(await page.$('.script') !== null, 'drawer shows AI script');
    // performance
    await page.goto(BASE + '/index.html#/performance', { waitUntil: 'networkidle' });
    await page.waitForSelector('.funnel', { timeout: 2000 });
    check(await page.$('.funnel') !== null, 'performance funnel renders');
    check(await page.$('table.data') !== null, 'by-channel table renders');
    check(await page.$('[data-export="meta"]') !== null, 'offline-conversion export present');
    // settings
    await page.goto(BASE + '/index.html#/settings', { waitUntil: 'networkidle' });
    await page.waitForSelector('.settings__nav', { timeout: 2000 });
    check(await page.$('.checklist') !== null, 'onboarding checklist renders');
    await page.click('[data-sec="brand"]');
    check(await page.$('[data-brandpreview]') !== null, 'brand live preview renders');
    await page.close();
  }

  // ---- 3. Full patient loop: flow -> contact -> reward -> portal -> book
  {
    const page = await ctx.newPage(); watch(page, 'flow');
    await page.goto(BASE + '/flow.html?utm_source=instagram&utm_campaign=smoke&fbclid=fb.smoke.1', { waitUntil: 'networkidle' });
    console.log('\n# patient capture loop');
    await page.click('[data-act="start"]');
    await page.waitForSelector('[data-tax]');
    await page.click('[data-tax="mommy"]');
    await page.click('[data-act="next"]'); // goals -> photos
    await page.waitForSelector('[data-photoconsent]');
    await page.click('[data-photoconsent]');
    await page.click('[data-act="skipphotos"]');
    // questions
    await page.waitForSelector('[data-q]');
    await page.click('[data-q="timeline"][data-v="asap"]');
    await page.click('[data-q="budget"][data-v="ready"]');
    await page.click('[data-act="next"]');
    // contact
    await page.waitForSelector('[data-c="firstName"]');
    await page.fill('[data-c="firstName"]', 'SmokeTester');
    await page.fill('[data-c="email"]', 'smoke@example.com');
    await page.fill('[data-c="phone"]', '5550000000');
    await page.click('[data-consent="sms"]');
    const unlockDisabled = await page.$eval('[data-act="unlock"]', b => b.disabled);
    check(!unlockDisabled, 'unlock enabled after valid contact + consent');
    await page.click('[data-act="unlock"]');
    await page.waitForSelector('.recap');
    check(await page.$('.recap') !== null, 'reward recap card renders');
    check(await page.$('[data-introvideo]') !== null, 'intro video present at reward');
    await page.click('[data-act="finish"]');
    await page.waitForSelector('[data-act="portal"]');
    check(true, 'reached confirm step');

    // verify lead landed in store with attribution
    const lead = await page.evaluate(() => {
      const ls = RELAY.store.all();
      return ls.find(l => l.contact && l.contact.firstName === 'SmokeTester');
    });
    check(!!lead, 'lead persisted to store');
    check(lead && lead.source.utm_source === 'instagram', 'attribution parsed (utm_source=instagram)');
    check(lead && lead.source.fbclid === 'fb.smoke.1', 'click id captured (fbclid)');
    check(lead && lead.qual.tier === 'hot', `qualified hot (tier=${lead && lead.qual.tier}, score=${lead && lead.qual.score})`);

    // go to portal for that lead, play + book
    await page.goto(BASE + '/portal.html?lead=' + lead.id, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-act="play"]');
    await page.click('[data-act="play"]');
    await page.click('[data-act="book"]');
    await page.waitForTimeout(300);
    const booked = await page.evaluate((id) => RELAY.store.get(id), lead.id);
    check(booked.status === 'booked' && booked.booking.paid, 'deposit booked + paid in portal');
    await page.close();
  }

  // ---- 4. instrumentation fired --------------------------------------
  {
    const page = await ctx.newPage(); watch(page, 'instr');
    await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
    const counts = await page.evaluate(() => RELAY.instrument.counts());
    console.log('\n# instrumentation events: ' + JSON.stringify(counts));
    check(counts.flow_start >= 1, 'flow_start fired');
    check(counts.contact_submitted >= 1, 'contact_submitted fired');
    check(counts.booked >= 1, 'booked fired');
    await page.close();
  }

  console.log('\n===== console errors (' + errors.length + ') =====');
  errors.forEach(e => console.log('  ' + e));
  console.log('\n===== RESULT: ' + (failures === 0 && errors.length === 0 ? 'PASS ✓' : `FAIL (${failures} checks, ${errors.length} errors)`) + ' =====');
  await browser.close();
  process.exit(failures === 0 && errors.length === 0 ? 0 : 1);
})();
