# RELAY — clickable demo

A static, dependency-free, client-side prototype of **RELAY** (the conversion
layer for high-value services). It implements the clickable demo specified in
`DEMO_AND_VALIDATION.md`, built against the real store API contract from
`REQUIREMENTS.md` so the front end carries forward to v1.

**Vertical:** plastic surgery, single seeded account (*Lumière Plastic Surgery*).
No backend, no secrets, no real sends/payments — runs entirely in the browser.

## Run it

```bash
python3 -m http.server 8099
# open http://localhost:8099/pricing.html   (or jump straight to a surface below)
```

Or just open `index.html` from disk (`file://`) — everything is client-side.

## Surfaces (where each spec section lives)

| Page | What it is | Spec |
|---|---|---|
| `pricing.html` | Fake "Start" page → provisions the local account | REQUIREMENTS §3.4 |
| `flow.html` | Patient capture flow — earned commitment + intro-video/recap reward + **guided per-treatment photo capture** | §8.2, §4 |
| `portal.html` | Delivered patient portal — watch video, book deposit | §8.5, §8.6 |
| `index.html` | Provider console (SPA): **Queue**, **Performance**, **Settings**, **Studio** | §8.3, §8.4, §8.7, §8.8 |
| `widgets.html` | Widget gallery (inline / floating / takeover) + copy-paste snippets | §8.1 |
| `bio.html` | Link-in-bio page | §8.1 |
| `embed.js` | The embeddable widget script | §8.1 |

The console routes by hash: `#/queue` · `#/performance` · `#/settings` ·
`#/studio/<leadId>` · `#/studio-intro`.

## The demo loop (sales walkthrough — DEMO §7)

1. Open `flow.html?utm_source=instagram&utm_campaign=mommy-makeover&fbclid=abc123`
   and complete the funnel → a tier-ranked lead lands at the top of the queue.
2. In `index.html` open that lead → **Open Consult Studio** → record (one tap) →
   **Send** (SMS/email preview logged to the dev console, copy the portal link).
3. Open the portal link as the patient → watch → **reserve with a refundable deposit**.
4. **Performance** shows the funnel, by-channel ROAS, and the **offline-conversion
   export** (real CSV, keyed to the click ID).

The **⌁ Dev console** (bottom-right of every page) makes the fakes verifiable:
fake sends, pixel fires (full payload), and instrumentation events.

## Architecture (DEMO §4)

- **`js/store.js`** implements the real store API (`config/saveConfig/all/get/
  upsert/patch/onChange/seed/analytics`) over `localStorage`. **Every surface calls
  only this API** — swap the implementation for an HTTP client and surfaces don't
  change. This is the key decision that makes the front-end non-throwaway.
- **`css/tokens.css`** — one design-token system; white-label overrides only the
  `--brand-*` tokens at runtime (`js/brand.js`), deriving WCAG-AA ink colors.
- **`js/verticals.js`** — the plastics vertical as *data* (taxonomy, intake,
  qualify model, copy). **`js/seed.js`** — the authored account + 14 rich leads.
- **`js/photoguide.js`** — per-treatment guided photo capture: each selected
  procedure maps to an ordered set of shots, each with an illustrated SVG
  silhouette frame (used as the live on-camera alignment overlay) and a
  pose/expression instruction (e.g. face → resting/smiling/brows/profiles;
  breast → front/oblique/side; body → front/oblique/side/back).
- **Design system** — one warm-neutral, deep-evergreen token set
  (`css/tokens.css`) modeled on calm modern finance apps; sans throughout,
  soft shadows, generously rounded. White-label still re-themes patient surfaces.
- **Built for real** (not faked): attribution parse-in + channel resolution
  (`js/attribution.js`), the offline-conversion export, the ScriptGen template
  (`js/scriptgen.js`), consent capture, and the whole conversion experience.
- **Instrumentation** (`js/instrument.js`) writes the funnel events that map 1:1
  to the real `analytics()` and power the Performance view.

## Verification

```bash
# syntax-check every JS file
for f in $(find js embed.js -name '*.js'); do node --check "$f"; done

# headless end-to-end smoke test (needs playwright + a server on :8099)
python3 -m http.server 8099 &
NODE_PATH=$(npm root -g) node smoke.js
```

`smoke.js` loads every page, drives the full capture → record → send → portal →
book loop, and asserts attribution parsing, qualification, instrumentation, and
zero console errors.
