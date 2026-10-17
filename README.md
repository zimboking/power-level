# Power Level

A gym tracker built for a group of mates. Live at **https://zimboking.github.io/power-level/**.
Open it on your phone and add it to your home screen.

- **Guided sessions**: your week (fixed days or an A/B/C rotation) starts today's workout for you,
  weights pre-filled from last time, one exercise at a time with photos, a rest timer between sets,
  PRs as you go. On a rest day it tells you when the next session is. Move a single session
  without touching the plan.
- **A quiet workout screen**: guided or list view; the set number is its own menu; swipe a set
  left to delete (with Undo) or right to copy; colour-coded effort as RIR or RPE; warm-ups,
  supersets, sets to failure, pyramid sets with their own reps and rest, and a scroll wheel for
  any rest time up to 15 minutes. The screen stays awake and can flash when rest ends.
- **Smart adjustments**: log reps and effort and the rest of today's sets re-weight themselves.
  Progression rules per exercise: double, linear, Greyskull LP, triple, add time, or manual.
  Every target says why; missed reps never add load; stalls trigger a deload.
- **No maths at the gym**: estimated 1RM on every set, warm-up ramps, plate loading for barbell,
  EZ bar, trap bar and Smith machine from the plates you own, per-side reps, bodyweight + belt.
- **Goal journeys**: pick a lift and a target (say a 140 kg bench) and get a week-by-week plan in
  4-week blocks, re-planned from your real lifts.
- **Exercise library**: 750+ exercises with photos, instructions and the muscles they work,
  filterable by tapping the body map. Add your own.
- **Stats**: workouts, streak, a 6-month activity heatmap, a muscle map in three modes (volume,
  recovery, untrained), 1RM curves, strength-balance ratios, body weight against a goal,
  progress photos with a before/after slider, and history you can edit, re-date or back-fill.
- **An anime fighter** who powers up through seven tiers, and a running total of everything
  you've lifted (blue whale → Eiffel Tower → volcano).
- **Food**: calorie and macro targets from your profile, logging in kcal or kJ.

Data stays on each person's phone (browser storage). Use **Settings → Download backup** now
and then.

## Layout

| Path | What it is |
| --- | --- |
| `index.html`, `js/` | The app (Preact + htm from a pinned CDN build, no bundler) |
| `js/strength.js`, `js/journey.js`, `js/nutrition.js` | The maths: 1RM, progression, goal plans, food targets |
| `test/` | Logic tests (`npm test`, Node 22+) |
| `tools/build-site.mjs` | Builds the hostable site with manifest, icons and offline cache |
| `tools/build-data.mjs` | Regenerates `js/data/` (exercise catalogue, body outlines); see NOTICE.md |
| `docs/` | Built site, served by GitHub Pages. Don't edit by hand |

## Making a change

```bash
npm test
npm run build
git add -A && git commit -m "feat: ..." && git push
```

GitHub Pages republishes `docs/` a minute or so after each push. The offline cache updates
itself on the next visit.

Progression ideas are adapted from [openGym](https://github.com/DuarteSantos8/openGym) (AGPL-3.0):
deriving every target from the workout log, and the RTS reps-in-reserve %1RM table.
