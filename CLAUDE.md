---
ontology: true
type: project-guide
domain: power-level
summary: How the Power Level gym app is built, tested and deployed, and the gotchas learned building it
tags: [power-level, gym-app, preact, htm, github-pages, pwa, service-worker, offline]
status: active
discovered: 2026-10-17
workspace: power-level
---

# Power Level

A gym tracker for a group of mates, live at https://zimboking.github.io/power-level/
(repo `zimboking/power-level`). Static site, no backend: each person's data lives in their own
browser (localStorage, plus IndexedDB for progress photos). Inspired by
[openGym](https://github.com/DuarteSantos8/openGym) (AGPL): ideas only, none of its code.

## Stack

- Preact + htm from a pinned CDN build (`https://unpkg.com/htm@3.1.1/preact/standalone.module.js`).
  No bundler, no TypeScript, no npm dependencies. Plain ES modules.
- Node 22+ only for tests and build scripts.
- Style: iOS-like dark/light system modelled on openGym. All colours are tokens on `:root` in
  `index.html`, which holds the whole stylesheet.

## Layout

| Path | What |
| --- | --- |
| `index.html` | Page body and the full stylesheet (no `<head>`; the build adds one) |
| `js/app.js` | Shell: state, saving, tabs, rest timer, toasts, editing past workouts |
| `js/strength.js` | 1RM (RTS RIR table, RIR capped at 3), next-set advice, warm-ups, plates, volume |
| `js/progression.js` | Policies: double, linear, Greyskull, triple, time, manual; effort labels |
| `js/plan.js` | Today's target per exercise (goal journey → policy → feeling), building entries |
| `js/journey.js` | Goal journey planner (4-week blocks, deload, test day) |
| `js/schedule.js` | Weekly / rotation plans, overrides, next session, starter plans |
| `js/muscles.js`, `js/stats.js` | Muscle-map maths, heatmap, streaks, strength balance |
| `js/nutrition.js` | Quick-pick foods (estimates, `src: 'est'`), Mifflin-St Jeor targets, kcal/kJ |
| `js/foods.js` | Food sources, AFCD loader, search ranking across saved / AFCD / estimates |
| `js/off.js` | Open Food Facts barcode lookup and name search (online only) |
| `js/exercises.js` | 32 core exercises + catalogue loader + registry of picked exercises |
| `js/store.js` | Persistence (Claude artifact db or localStorage), backups |
| `js/water.js` | CapySpa water tracker: drink logs per day, hydration ratios, stages, streak, mood insight |
| `js/data/catalog.json`, `body.json` | Generated; see `tools/build-data.mjs` and NOTICE.md |
| `js/data/foods.json` | Generated from FSANZ AFCD Release 3; see `tools/build-foods.mjs` |
| `js/ui/*.js` | Views: home, plan-tab, workout, exercise-card, set-row, stats-tab, food, library… |
| `js/ui/capyspa.js`, `capy-stats.js`, `onsen.js` | CapySpa tab (Spa / Log / Stats), its Home card, the onsen SVG |
| `tools/xlsx.mjs` | Tiny dependency-free .xlsx reader for build scripts |
| `tools/build-site.mjs` | Builds `docs/` (head, manifest, icons, service worker) |
| `docs/` | Built site served by GitHub Pages. Never edit by hand |
| `test/*.test.mjs` | Logic tests |

## Commands

```bash
npm test          # node --test test/logic.test.mjs test/features.test.mjs test/foods.test.mjs test/water.test.mjs
npm run build     # node tools/build-site.mjs docs
git push          # Pages republishes docs/ in ~1 minute
```

Data files (only when the sources change):
`node tools/build-data.mjs <free-exercise-db exercises.json> <openGym frontend/src/lib/body-paths.js>`
`node tools/build-foods.mjs "<AFCD Release 3 - Nutrient profiles.xlsx>"` (from the FSANZ AFCD download page)

## Testing in a browser

- Test the **built** site, not the source folder: `node tools/build-site.mjs ../site` then serve
  `../site`. The source `index.html` has no viewport meta, so phone emulation lays it out at 980px.
- Check phone widths 320, 344 (folded Galaxy Z Fold cover screen), 375 and 430. Narrow-screen
  rules for the set row live in `@media (max-width: 420px)` and `(max-width: 340px)`.
- Before reloading a test page, unregister the service worker and clear caches, or you'll see the
  old build.

## Gotchas

- **Service worker updates:** GitHub Pages sends `Cache-Control: max-age=600`. The worker caches
  with `new Request(url, { cache: 'reload' })` so an update never mixes in stale files, and the
  app reloads once on `controllerchange`. `VERSION` hashes the built files plus the build script.
- **New files in `js/`** (including `.json`) are picked up automatically by the build and cached.
- **Windows:** the repo needs `git config core.longpaths true`. Pass test files explicitly
  (`node --test test/` fails on this machine).
- **Exercise ids:** core ids (`bench`, `squat`…) are stable and used by goals and history.
  Catalogue exercises are `fdb:<id>` and are copied into `profile.exercises` when first used.
- **State is immutable**: `app.update(fn, keys)` with save keys `'profile'`, `'w:<workoutId>'`,
  `'f:<date>'`, `'h:<date>'` (CapySpa water day).
- **CapySpa** (ported from zimboking/Water-habit-app-2, Apache 2.0) is on unless
  `settings.capyspa === false`. On, the bar is Home · Plan · Start · Food · More (Stats, CapySpa),
  so the centre button stays centred; off, it's the original five tabs. Its colours are `--cs-*`
  tokens (the onsen is daytime in light theme, dusk in dark). The original's Squad tab was
  simulated friends, so it wasn't ported; it needs a backend to be real.
- **Backups without `water`** (made before CapySpa) leave the water log on the device alone.
- **Food values in `js/nutrition.js` are approximate.** They were written from general knowledge,
  not a cited table. Don't present them as sourced. Every food carries `src` (`afcd`, `off`,
  `custom`, `est`) and the UI shows it; keep it that way for any new source.
- **Open Food Facts search** (`/cgi/search.pl`) allows ~10 searches/min per person and sheds
  anonymous traffic with 503s that carry no CORS headers (seen as "Failed to fetch"). The
  `X-User-Agent` header makes the browser send a CORS preflight per new URL, and those can 503
  too. So name search runs only on a button, retries once after 3 s, and points people to the
  barcode, which (`/api/v2/product`) is reliable. `search.openfoodfacts.org` has no CORS at all.

## Conventions

- Conventional commits (`feat:`, `fix:`…). Keep `docs/` rebuilt in the same commit as source.
- Attribution for data sources goes in NOTICE.md and the Settings footer.
- Copy is plain and friendly (Australian users: kJ, "sooky", Coles/Woolies products).
