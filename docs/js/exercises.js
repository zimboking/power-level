// Exercise library. A short curated core (stable ids the goals and progression lean on) plus the
// full free-exercise-db catalogue, loaded on demand. Any catalogue exercise you use is copied
// into your profile (profile.exercises) so history keeps working offline and without the file.
//
// Fields: eq (barbell | dumbbell | cable | machine | bodyweight | ez | trap | smith | kettlebell |
// band | other), p/s (primary/secondary body-map regions), mode ('reps' | 'time'), uni (logged
// per side), fdb (free-exercise-db id, for photos and instructions), cues (3 things to think of).
const E = (id, name, eq, p, s, fdb, cues, extra = {}) => ({ id, name, eq, p, s, ...(fdb ? { fdb } : {}), cues, mode: 'reps', ...extra })
const SPRINGS = 'Note your springs with the Note button'

export const EXERCISES = [
  E('bench', 'Bench press', 'barbell', ['chest'], ['triceps', 'deltoids'], 'Barbell_Bench_Press_-_Medium_Grip', ['Eyes under the bar, feet planted, slight arch', 'Squeeze shoulder blades together and down', 'Touch low chest, drive up and back toward your face']),
  E('incline', 'Incline bench press', 'barbell', ['chest'], ['deltoids', 'triceps'], 'Barbell_Incline_Bench_Press_-_Medium_Grip', ['Bench at 30–45°', 'Bar touches just under the collarbone', 'Elbows about 45° from your body']),
  E('dbbench', 'Dumbbell bench press', 'dumbbell', ['chest'], ['triceps', 'deltoids'], 'Dumbbell_Bench_Press', ['Kick the bells up off your knees', 'Lower until a stretch across the chest', 'Press up and slightly in'], { step: 2 }),
  E('dips', 'Dips', 'bodyweight', ['chest', 'triceps'], ['deltoids'], 'Dips_-_Chest_Version', ['Lean forward slightly for chest', 'Down until shoulders are just below elbows', 'Lock out without shrugging']),
  E('fly', 'Cable fly', 'cable', ['chest'], ['deltoids'], 'Cable_Crossover', ['Soft bend in the elbows, keep it fixed', 'Hug a big tree', 'Squeeze for a second at the middle']),
  E('squat', 'Back squat', 'barbell', ['quadriceps', 'gluteal'], ['hamstring', 'lower-back', 'adductors'], 'Barbell_Full_Squat', ['Bar on upper traps, big breath, brace', 'Knees track over toes, sit between your heels', 'Drive the floor away, chest leads up']),
  E('frontsquat', 'Front squat', 'barbell', ['quadriceps'], ['gluteal', 'abs'], 'Front_Barbell_Squat', ['Elbows high, bar on the front delts', 'Stay tall, sit straight down', 'Push knees out at the bottom']),
  E('deadlift', 'Deadlift', 'barbell', ['hamstring', 'gluteal', 'lower-back'], ['upper-back', 'trapezius', 'forearm', 'quadriceps'], 'Barbell_Deadlift', ['Bar over mid-foot, shins touch the bar', 'Pull the slack out, chest up, lats tight', 'Push the floor away, hips and shoulders rise together']),
  E('rdl', 'Romanian deadlift', 'barbell', ['hamstring'], ['gluteal', 'lower-back'], 'Romanian_Deadlift', ['Soft knees, push hips straight back', 'Bar slides down the thighs', 'Stop at a hamstring stretch, squeeze glutes up']),
  E('legpress', 'Leg press', 'machine', ['quadriceps'], ['gluteal', 'hamstring'], 'Leg_Press', ['Feet shoulder width, mid-plate', 'Lower until hips start to curl', 'Don’t lock the knees hard'], { step: 5 }),
  E('lunge', 'Walking lunge', 'dumbbell', ['quadriceps', 'gluteal'], ['hamstring', 'adductors'], 'Dumbbell_Lunges', ['Long stride, torso tall', 'Back knee kisses the floor', 'Drive through the front heel'], { step: 2, uni: true }),
  E('legcurl', 'Leg curl', 'machine', ['hamstring'], ['calves'], 'Lying_Leg_Curls', ['Pad just above the heels', 'Curl all the way, hold a beat', 'Slow on the way down']),
  E('legext', 'Leg extension', 'machine', ['quadriceps'], [], 'Leg_Extensions', ['Knee lined up with the machine pivot', 'Kick up and squeeze the quads', 'Control the drop']),
  E('calf', 'Standing calf raise', 'machine', ['calves'], [], 'Standing_Calf_Raises', ['Full stretch at the bottom', 'Up onto the big toe', 'Pause at the top'], { step: 5 }),
  E('hipthrust', 'Hip thrust', 'barbell', ['gluteal'], ['hamstring'], 'Barbell_Hip_Thrust', ['Upper back on the bench edge', 'Chin tucked, ribs down', 'Lock out with glutes, not lower back']),
  E('ohp', 'Overhead press', 'barbell', ['deltoids'], ['triceps', 'trapezius'], 'Standing_Military_Press', ['Grip just outside shoulders, glutes tight', 'Head back, press straight up', 'Head through at the top, shrug to finish']),
  E('dbohp', 'Dumbbell shoulder press', 'dumbbell', ['deltoids'], ['triceps'], 'Dumbbell_Shoulder_Press', ['Bells start at ear height', 'Press up and slightly in', 'No arching, ribs down'], { step: 2 }),
  E('lateral', 'Lateral raise', 'dumbbell', ['deltoids'], ['trapezius'], 'Side_Lateral_Raise', ['Lead with the elbows', 'Raise to shoulder height, no higher', 'Slow negatives, no swinging'], { step: 1 }),
  E('facepull', 'Face pull', 'cable', ['deltoids'], ['trapezius', 'upper-back'], 'Face_Pull', ['Rope at forehead height', 'Pull to your eyes, elbows high', 'Rotate hands back at the end']),
  E('pullup', 'Pull-up', 'bodyweight', ['upper-back'], ['biceps', 'forearm'], 'Pullups', ['Dead hang, shoulders packed', 'Drive elbows down to your pockets', 'Chin over the bar, control down']),
  E('row', 'Barbell row', 'barbell', ['upper-back'], ['biceps', 'lower-back', 'trapezius'], 'Bent_Over_Barbell_Row', ['Hinge to about 45°, flat back', 'Pull to the belly button', 'Squeeze shoulder blades, lower under control']),
  E('dbrow', 'Dumbbell row', 'dumbbell', ['upper-back'], ['biceps'], 'One-Arm_Dumbbell_Row', ['Hand and knee on the bench, flat back', 'Pull the bell to your hip', 'Full stretch at the bottom'], { step: 2, uni: true }),
  E('pulldown', 'Lat pulldown', 'cable', ['upper-back'], ['biceps'], 'Wide-Grip_Lat_Pulldown', ['Thighs locked under the pad', 'Pull to the top of the chest', 'Lean back only slightly']),
  E('cablerow', 'Seated cable row', 'cable', ['upper-back'], ['biceps', 'trapezius'], 'Seated_Cable_Rows', ['Sit tall, slight knee bend', 'Pull to the stomach, chest up', 'Let the shoulders reach forward on the return']),
  E('curl', 'Barbell curl', 'barbell', ['biceps'], ['forearm'], 'Barbell_Curl', ['Elbows pinned to your sides', 'Curl without swinging', 'Lower all the way down'], { step: 1.25 }),
  E('dbcurl', 'Dumbbell curl', 'dumbbell', ['biceps'], ['forearm'], 'Dumbbell_Bicep_Curl', ['Palms forward, elbows still', 'Squeeze at the top', 'Three seconds down'], { step: 1 }),
  E('hammer', 'Hammer curl', 'dumbbell', ['biceps', 'forearm'], [], 'Hammer_Curls', ['Thumbs up the whole way', 'Curl across or straight', 'No shoulder swing'], { step: 1 }),
  E('pushdown', 'Triceps pushdown', 'cable', ['triceps'], [], 'Triceps_Pushdown_-_Rope_Attachment', ['Elbows glued to your sides', 'Push until arms are locked', 'Stop at 90° on the way up']),
  E('skull', 'Skull crusher', 'ez', ['triceps'], [], 'EZ-Bar_Skullcrusher', ['Upper arms angled slightly back', 'Lower behind the forehead', 'Extend without flaring elbows'], { step: 1.25 }),
  E('plank', 'Plank', 'bodyweight', ['abs'], ['obliques'], 'Plank', ['Elbows under shoulders', 'Squeeze glutes, ribs down', 'Breathe, don’t sag'], { mode: 'time' }),
  E('hangleg', 'Hanging leg raise', 'bodyweight', ['abs'], ['hip-flexors'], 'Hanging_Leg_Raise', ['Dead hang, no swing', 'Curl the pelvis up', 'Lower slowly']),
  // Reformer Pilates: resistance is springs, which vary by machine, so these log reps or time
  // with no load, and your spring setting goes in the exercise note.
  E('ref-footwork', 'Reformer footwork', 'reformer', ['quadriceps', 'gluteal'], ['hamstring', 'calves'], null, ['Heels, arches, then toes on the bar', 'Press out to long legs without locking', SPRINGS]),
  E('ref-hundred', 'Reformer hundred', 'reformer', ['abs'], ['obliques', 'hip-flexors'], null, ['Head and chest curl up, arms long by your sides', 'Pump the arms, breathe in 5, out 5', SPRINGS]),
  E('ref-straps', 'Feet in straps (leg circles)', 'reformer', ['adductors', 'hamstring'], ['abs', 'gluteal'], null, ['Pelvis still and heavy on the carriage', 'Circle from the hips, both directions', SPRINGS]),
  E('ref-frog', 'Frog', 'reformer', ['adductors', 'gluteal'], ['hamstring', 'abs'], null, ['Heels together in the straps, knees wide', 'Press out to a long V, keep the back down', SPRINGS]),
  E('ref-bridge', 'Reformer bridge', 'reformer', ['gluteal', 'hamstring'], ['lower-back', 'abs'], null, ['Feet on the bar, peel the spine up', 'Hold the bridge as you press the carriage', 'Roll down one bone at a time']),
  E('ref-shortspine', 'Short spine', 'reformer', ['abs', 'hamstring'], ['lower-back', 'gluteal'], null, ['Legs up and over with control', 'Roll down slowly through the spine', SPRINGS]),
  E('ref-elephant', 'Elephant', 'reformer', ['abs', 'hamstring'], ['deltoids', 'calves'], null, ['Hands on the bar, heels to the stops', 'Move the carriage with your belly, not your arms', 'Back stays rounded and still']),
  E('ref-longstretch', 'Long stretch', 'reformer', ['abs', 'deltoids'], ['chest', 'gluteal'], null, ['Plank on the carriage, heels on the headrest', 'Push the carriage back from the shoulders', 'Keep a long straight line']),
  E('ref-knee', 'Knee stretches', 'reformer', ['abs', 'quadriceps'], ['hip-flexors', 'deltoids'], null, ['Kneel, hands on the bar, back rounded', 'Push the carriage out with the knees', 'Quick and controlled, abs pulled in']),
  E('ref-rowing', 'Reformer rowing', 'reformer', ['upper-back', 'deltoids'], ['biceps', 'abs'], null, ['Sit tall facing the straps', 'Draw the elbows back, shoulders down', SPRINGS]),
  E('ref-chest', 'Chest expansion', 'reformer', ['upper-back', 'deltoids'], ['triceps', 'trapezius'], null, ['Kneel facing the straps', 'Press the arms back past your hips', 'Hold, look left and right, release']),
  E('ref-pulling', 'Pulling straps', 'reformer', ['upper-back', 'lower-back'], ['deltoids', 'triceps'], null, ['Lie face down on the box', 'Pull the straps to your sides, lift the chest', SPRINGS]),
  E('ref-armkneel', 'Kneeling arm series', 'reformer', ['deltoids', 'biceps'], ['triceps', 'abs'], null, ['Kneel tall, hips over knees', 'Curls, presses and hugs with the straps', SPRINGS]),
  E('ref-lunge', 'Reformer lunge', 'reformer', ['quadriceps', 'gluteal'], ['hamstring', 'adductors'], null, ['Front foot on the platform, back foot on the carriage', 'Slide back to a deep lunge, hips square', SPRINGS], { uni: true }),
  E('ref-sidesplits', 'Side splits', 'reformer', ['adductors', 'gluteal'], ['abs'], null, ['Stand one foot on the platform, one on the carriage', 'Slide wide and draw back with the inner thighs', SPRINGS]),
  E('ref-mermaid', 'Mermaid', 'reformer', ['obliques'], ['upper-back', 'deltoids'], null, ['Sit side-on, hand on the bar', 'Reach long over the top and push the carriage out', 'Breathe into the stretch']),
  E('ref-teaser', 'Reformer teaser', 'reformer', ['abs'], ['hip-flexors', 'obliques'], null, ['Roll up to a V with legs long', 'Arms reach toward the toes', SPRINGS]),
  E('ref-plank', 'Reformer plank', 'reformer', ['abs'], ['deltoids', 'obliques'], null, ['Hands on the platform, feet on the carriage', 'Keep the carriage still', 'Ribs down, glutes on'], { mode: 'time' }),
  E('cablecrunch', 'Cable crunch', 'cable', ['abs'], ['obliques'], 'Cable_Crunch', ['Kneel, rope by your ears', 'Crunch ribs to hips', 'Hips stay still']),
]
export const EX_BY_ID = Object.fromEntries(EXERCISES.map(e => [e.id, e]))

// Exercises picked from the catalogue live in the profile; the app keeps this registry in sync.
let registry = {}
export const setRegistry = r => { registry = r || {} }

export const exInfo = id => EX_BY_ID[id] || registry[id] || { id, name: id, eq: 'other', p: [], s: [], mode: 'reps', cues: [] }
export const exName = id => exInfo(id).name
export const isReformer = ex => ex?.eq === 'reformer'
export const isBodyweight = ex => ex?.eq === 'bodyweight' || isReformer(ex)
export const isTimed = ex => ex?.mode === 'time'
export const stepFor = ex => ex?.step || ({ barbell: 2.5, ez: 2.5, trap: 2.5, smith: 2.5, dumbbell: 2, kettlebell: 4, machine: 2.5, cable: 2.5 })[ex?.eq] || 2.5

// Loaded bars. The plate picture uses these; weights come from Settings.
export const BAR_TYPES = { barbell: 'Barbell', ez: 'EZ bar', trap: 'Trap bar', smith: 'Smith machine' }
export const DEFAULT_BARS = { barbell: 20, ez: 10, trap: 25, smith: 15 }
export const usesPlates = ex => Object.hasOwn(BAR_TYPES, ex?.eq)
export const barWeight = (ex, settings) => (usesPlates(ex) ? Number(settings?.bars?.[ex.eq] ?? (ex.eq === 'barbell' ? settings?.bar : null) ?? DEFAULT_BARS[ex.eq]) : 0)

const FDB = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'
export const imageUrls = ex => (ex?.fdb ? Array.from({ length: ex.img || 2 }, (_, i) => `${FDB}${encodeURIComponent(ex.fdb)}/${i}.jpg`) : [])

export const EQUIPMENT_NAMES = { barbell: 'Barbell', dumbbell: 'Dumbbell', cable: 'Cable', machine: 'Machine', bodyweight: 'Bodyweight', reformer: 'Reformer', ez: 'EZ bar', trap: 'Trap bar', smith: 'Smith machine', kettlebell: 'Kettlebell', band: 'Band', other: 'Other' }

// The catalogue: ~750 exercises, fetched once (the service worker keeps it for offline use).
let catalogPromise = null
export function loadCatalog() {
  catalogPromise = catalogPromise || fetch(new URL('./data/catalog.json', import.meta.url)).then(r => {
    if (!r.ok) throw new Error('catalog ' + r.status)
    return r.json()
  }).then(list => list.map(c => ({
    id: 'fdb:' + c.id, name: c.n, eq: c.eq, p: c.p, s: c.s, fdb: c.id, img: c.img, ins: c.ins, level: c.lv, category: c.c,
    mode: /plank|hold|wall sit/i.test(c.n) || c.c === 'cardio' ? 'time' : 'reps', uni: /one[- ]arm|single[- ]|alternat|lunge|split squat|step[- ]up/i.test(c.n), cues: [],
    // Cardio: minutes, plus distance where it means something.
    ...(c.c === 'cardio' ? { timeUnit: 'min', ...(/rope|stair|step mill/i.test(c.n) ? {} : { distance: true, distUnit: /rowing|prowler|sled/i.test(c.n) ? 'm' : 'km' }) } : {}),
  }))).catch(err => { catalogPromise = null; throw err })
  return catalogPromise
}
// What gets stored in profile.exercises when you pick a catalogue exercise (no long instructions).
export const registryEntry = ex => ({ id: ex.id, name: ex.name, eq: ex.eq, p: ex.p, s: ex.s, fdb: ex.fdb, img: ex.img, mode: ex.mode, uni: ex.uni, cues: [], custom: ex.custom || false, ...(ex.timeUnit ? { timeUnit: ex.timeUnit } : {}), ...(ex.distance ? { distance: true, distUnit: ex.distUnit || 'km' } : {}) })

// Core exercises show their dataset instructions too, once the catalogue has loaded.
export async function instructionsFor(ex) {
  if (ex.ins) return ex.ins
  if (!ex.fdb) return []
  try { return (await loadCatalog()).find(c => c.fdb === ex.fdb)?.ins || [] } catch { return [] }
}

export const allKnown = () => [...EXERCISES, ...Object.values(registry)]

// Starter routines, loaded as ordinary editable routines.
const it = (exId, sets, repsMin, repsMax, rir = 2, extra = {}) => ({ exId, sets, repsMin, repsMax, rir, ...extra })
export const STARTER_PLANS = [
  { id: 'ppl', name: 'Push / Pull / Legs', blurb: '3 days, or 6 if you run it twice', days: [1, 3, 5], routines: [
    { id: 'r-push', name: 'Push', items: [it('bench', 3, 5, 8), it('ohp', 3, 6, 10), it('incline', 3, 8, 12), it('lateral', 3, 10, 15, 1, { group: 'a' }), it('pushdown', 3, 10, 15, 1, { group: 'a' })] },
    { id: 'r-pull', name: 'Pull', items: [it('deadlift', 2, 3, 6, 2, { rest: 210 }), it('pullup', 3, 6, 12), it('cablerow', 3, 8, 12), it('facepull', 3, 12, 20, 1, { group: 'a' }), it('dbcurl', 3, 8, 12, 1, { group: 'a' })] },
    { id: 'r-legs', name: 'Legs', items: [it('squat', 3, 5, 8, 2, { rest: 180 }), it('rdl', 3, 6, 10), it('legpress', 3, 10, 15), it('legcurl', 3, 10, 15, 1, { group: 'a' }), it('calf', 3, 10, 15, 1, { group: 'a' })] },
  ] },
  { id: 'ul', name: 'Upper / Lower', blurb: '4 days a week', days: [1, 2, 4, 5], routines: [
    { id: 'r-upper', name: 'Upper', items: [it('bench', 4, 5, 8), it('row', 4, 6, 10), it('dbohp', 3, 8, 12), it('pulldown', 3, 8, 12), it('dbcurl', 2, 10, 15, 1, { group: 'a' }), it('pushdown', 2, 10, 15, 1, { group: 'a' })] },
    { id: 'r-lower', name: 'Lower', items: [it('squat', 4, 5, 8, 2, { rest: 180 }), it('rdl', 3, 6, 10), it('lunge', 3, 8, 12), it('legcurl', 3, 10, 15), it('calf', 3, 10, 15), it('plank', 3, 30, 60, 1)] },
  ] },
  { id: 'fb', name: 'Full body', blurb: '3 days a week, great for starting out', days: [1, 3, 5], routines: [
    { id: 'r-fba', name: 'Full body A', items: [it('squat', 3, 5, 8), it('bench', 3, 5, 8), it('row', 3, 8, 10), it('plank', 3, 30, 60, 1)] },
    { id: 'r-fbb', name: 'Full body B', items: [it('deadlift', 2, 3, 6), it('ohp', 3, 6, 10), it('pullup', 3, 6, 12), it('lunge', 2, 8, 12)] },
  ] },
  { id: 'reformer', name: 'Reformer Pilates', blurb: 'A full-body reformer class, 2–3 days a week', days: [2, 4], routines: [
    { id: 'r-ref', name: 'Reformer flow', items: [it('ref-footwork', 2, 10, 10, 2, { prog: 'off' }), it('ref-hundred', 1, 10, 10, 2, { prog: 'off' }), it('ref-straps', 2, 8, 10, 2, { prog: 'off' }), it('ref-bridge', 2, 8, 10, 2, { prog: 'off' }),
      it('ref-rowing', 2, 8, 10, 2, { prog: 'off' }), it('ref-knee', 2, 10, 10, 2, { prog: 'off' }), it('ref-lunge', 2, 8, 8, 2, { prog: 'off' }), it('ref-mermaid', 1, 6, 6, 2, { prog: 'off' })] },
  ] },
  { id: '5x5', name: '5 × 5', blurb: 'Classic linear strength, 3 days a week', days: [1, 3, 5], rotation: true, routines: [
    { id: 'r-5a', name: '5×5 A', items: [it('squat', 5, 5, 5, 1, { prog: 'linear', rest: 180 }), it('bench', 5, 5, 5, 1, { prog: 'linear', rest: 180 }), it('row', 5, 5, 5, 1, { prog: 'linear' })] },
    { id: 'r-5b', name: '5×5 B', items: [it('squat', 5, 5, 5, 1, { prog: 'linear', rest: 180 }), it('ohp', 5, 5, 5, 1, { prog: 'linear', rest: 180 }), it('deadlift', 1, 5, 5, 1, { prog: 'linear', rest: 240 })] },
  ] },
]
