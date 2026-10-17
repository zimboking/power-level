// Exercise library. `eq` drives the plate graphic (barbell only) and the load step.
// `cues` are the three things to think about mid-set: the "visual assistance" panel.
const E = (id, name, muscle, eq, cues, extra = {}) => ({ id, name, muscle, eq, cues, ...extra })

export const EXERCISES = [
  E('bench', 'Bench press', 'Chest', 'barbell', ['Eyes under the bar, feet planted, slight arch', 'Squeeze shoulder blades together and down', 'Touch low chest, drive up and back toward your face']),
  E('incline', 'Incline bench press', 'Chest', 'barbell', ['Bench at 30–45°', 'Bar touches just under the collarbone', 'Elbows about 45° from your body']),
  E('dbbench', 'Dumbbell bench press', 'Chest', 'dumbbell', ['Kick the bells up off your knees', 'Lower until a stretch across the chest', 'Press up and slightly in'], { step: 2 }),
  E('dips', 'Dips', 'Chest', 'bodyweight', ['Lean forward slightly for chest', 'Down until shoulders are just below elbows', 'Lock out without shrugging']),
  E('fly', 'Cable fly', 'Chest', 'cable', ['Soft bend in the elbows, keep it fixed', 'Hug a big tree', 'Squeeze for a second at the middle'], { step: 2.5 }),
  E('squat', 'Back squat', 'Legs', 'barbell', ['Bar on upper traps, big breath, brace', 'Knees track over toes, sit between your heels', 'Drive the floor away, chest leads up']),
  E('frontsquat', 'Front squat', 'Legs', 'barbell', ['Elbows high, bar on the front delts', 'Stay tall, sit straight down', 'Push knees out at the bottom']),
  E('deadlift', 'Deadlift', 'Back', 'barbell', ['Bar over mid-foot, shins touch the bar', 'Pull the slack out, chest up, lats tight', 'Push the floor away, hips and shoulders rise together']),
  E('rdl', 'Romanian deadlift', 'Legs', 'barbell', ['Soft knees, push hips straight back', 'Bar slides down the thighs', 'Stop at a hamstring stretch, squeeze glutes up']),
  E('legpress', 'Leg press', 'Legs', 'machine', ['Feet shoulder width, mid-plate', 'Lower until hips start to curl', 'Don’t lock the knees hard'], { step: 5 }),
  E('lunge', 'Walking lunge', 'Legs', 'dumbbell', ['Long stride, torso tall', 'Back knee kisses the floor', 'Drive through the front heel'], { step: 2 }),
  E('legcurl', 'Leg curl', 'Legs', 'machine', ['Pad just above the heels', 'Curl all the way, hold a beat', 'Slow on the way down'], { step: 2.5 }),
  E('legext', 'Leg extension', 'Legs', 'machine', ['Knee lined up with the machine pivot', 'Kick up and squeeze the quads', 'Control the drop'], { step: 2.5 }),
  E('calf', 'Standing calf raise', 'Legs', 'machine', ['Full stretch at the bottom', 'Up onto the big toe', 'Pause at the top'], { step: 5 }),
  E('hipthrust', 'Hip thrust', 'Legs', 'barbell', ['Upper back on the bench edge', 'Chin tucked, ribs down', 'Lock out with glutes, not lower back']),
  E('ohp', 'Overhead press', 'Shoulders', 'barbell', ['Grip just outside shoulders, glutes tight', 'Head back, press straight up', 'Head through at the top, shrug to finish']),
  E('dbohp', 'Dumbbell shoulder press', 'Shoulders', 'dumbbell', ['Bells start at ear height', 'Press up and slightly in', 'No arching, ribs down'], { step: 2 }),
  E('lateral', 'Lateral raise', 'Shoulders', 'dumbbell', ['Lead with the elbows', 'Raise to shoulder height, no higher', 'Slow negatives, no swinging'], { step: 1 }),
  E('facepull', 'Face pull', 'Shoulders', 'cable', ['Rope at forehead height', 'Pull to your eyes, elbows high', 'Rotate hands back at the end'], { step: 2.5 }),
  E('pullup', 'Pull-up', 'Back', 'bodyweight', ['Dead hang, shoulders packed', 'Drive elbows down to your pockets', 'Chin over the bar, control down']),
  E('row', 'Barbell row', 'Back', 'barbell', ['Hinge to about 45°, flat back', 'Pull to the belly button', 'Squeeze shoulder blades, lower under control']),
  E('dbrow', 'Dumbbell row', 'Back', 'dumbbell', ['Hand and knee on the bench, flat back', 'Pull the bell to your hip', 'Full stretch at the bottom'], { step: 2 }),
  E('pulldown', 'Lat pulldown', 'Back', 'cable', ['Thighs locked under the pad', 'Pull to the top of the chest', 'Lean back only slightly'], { step: 2.5 }),
  E('cablerow', 'Seated cable row', 'Back', 'cable', ['Sit tall, slight knee bend', 'Pull to the stomach, chest up', 'Let the shoulders reach forward on the return'], { step: 2.5 }),
  E('curl', 'Barbell curl', 'Arms', 'barbell', ['Elbows pinned to your sides', 'Curl without swinging', 'Lower all the way down'], { step: 1.25 }),
  E('dbcurl', 'Dumbbell curl', 'Arms', 'dumbbell', ['Palms forward, elbows still', 'Squeeze at the top', 'Three seconds down'], { step: 1 }),
  E('hammer', 'Hammer curl', 'Arms', 'dumbbell', ['Thumbs up the whole way', 'Curl across or straight', 'No shoulder swing'], { step: 1 }),
  E('pushdown', 'Triceps pushdown', 'Arms', 'cable', ['Elbows glued to your sides', 'Push until arms are locked', 'Stop at 90° on the way up'], { step: 2.5 }),
  E('skull', 'Skull crusher', 'Arms', 'barbell', ['Upper arms angled slightly back', 'Lower behind the forehead', 'Extend without flaring elbows'], { step: 1.25 }),
  E('plank', 'Plank', 'Core', 'bodyweight', ['Elbows under shoulders', 'Squeeze glutes, ribs down', 'Breathe, don’t sag']),
  E('hangleg', 'Hanging leg raise', 'Core', 'bodyweight', ['Dead hang, no swing', 'Curl the pelvis up', 'Lower slowly']),
  E('cablecrunch', 'Cable crunch', 'Core', 'cable', ['Kneel, rope by your ears', 'Crunch ribs to hips', 'Hips stay still'], { step: 2.5 }),
]

export const EX_BY_ID = Object.fromEntries(EXERCISES.map(e => [e.id, e]))
export const exName = (id, custom = []) => EX_BY_ID[id]?.name || custom.find(c => c.id === id)?.name || id
export const exInfo = (id, custom = []) => EX_BY_ID[id] || custom.find(c => c.id === id) || { id, name: id, muscle: 'Other', eq: 'other', cues: [] }
export const stepFor = ex => ex?.step || (ex?.eq === 'barbell' ? 2.5 : ex?.eq === 'dumbbell' ? 2 : 2.5)

export const MUSCLES = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core']

// Starter templates so a first workout is one tap away.
export const STARTER_TEMPLATES = [
  { id: 't-push', name: 'Push', items: [
    { exId: 'bench', sets: 3, repsMin: 5, repsMax: 8, rir: 2 },
    { exId: 'ohp', sets: 3, repsMin: 6, repsMax: 10, rir: 2 },
    { exId: 'lateral', sets: 3, repsMin: 10, repsMax: 15, rir: 1, group: 'a' },
    { exId: 'pushdown', sets: 3, repsMin: 10, repsMax: 15, rir: 1, group: 'a' },
  ] },
  { id: 't-pull', name: 'Pull', items: [
    { exId: 'deadlift', sets: 2, repsMin: 3, repsMax: 6, rir: 2 },
    { exId: 'pullup', sets: 3, repsMin: 6, repsMax: 12, rir: 2 },
    { exId: 'cablerow', sets: 3, repsMin: 8, repsMax: 12, rir: 2 },
    { exId: 'facepull', sets: 3, repsMin: 12, repsMax: 20, rir: 1, group: 'a' },
    { exId: 'dbcurl', sets: 3, repsMin: 8, repsMax: 12, rir: 1, group: 'a' },
  ] },
  { id: 't-legs', name: 'Legs', items: [
    { exId: 'squat', sets: 3, repsMin: 5, repsMax: 8, rir: 2 },
    { exId: 'rdl', sets: 3, repsMin: 6, repsMax: 10, rir: 2 },
    { exId: 'legpress', sets: 3, repsMin: 10, repsMax: 15, rir: 2 },
    { exId: 'legcurl', sets: 3, repsMin: 10, repsMax: 15, rir: 1, group: 'a' },
    { exId: 'calf', sets: 3, repsMin: 10, repsMax: 15, rir: 1, group: 'a' },
  ] },
]
