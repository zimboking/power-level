# Power Level

A gym tracker built for a group of mates. Live at **https://zimboking.github.io/power-level/**.
Open it on your phone and add it to your home screen.

- **Goal journeys**: pick a lift and a target (say a 140 kg bench) and get a week-by-week plan in
  4-week blocks (volume, strength, intensity, then a deload), re-planned from your real lifts.
- **Smart adjustments**: log reps and reps in reserve (RIR); the rest of today's sets and next
  session's targets adjust themselves. Not feeling 100 %? Today's loads ease off.
- **No maths at the gym**: estimated 1RM on every set, warm-up sets, plate loading picture,
  supersets, and a rest countdown with a beep.
- **Progress**: 1RM trends with a rolling average, weekly volume, body weight, PRs, and a
  running total of everything you've lifted (blue whale → Eiffel Tower → volcano).
- **An anime fighter** who powers up through seven tiers as you get stronger.
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
