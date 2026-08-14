import { db, getDeviceId, uuid, SETTINGS_ID, DEFAULT_SETTINGS, type Exercise, type Folder } from './db'

type SeedEx = [
  name: string,
  primary: string,
  secondary: string | null,
  folder: Folder,
  equipment: string,
  sets: number,
  repMin: number,
  repMax: number,
  rest: number,
  increment: number,
]

const EXERCISES: SeedEx[] = [
  // Hamstrings
  ['Romanian deadlift', 'Hamstrings', 'Glutes', 'Hamstrings', 'Barbell', 3, 6, 10, 90, 2.5],
  ['Seated leg curl', 'Hamstrings', null, 'Hamstrings', 'Machine', 2, 10, 10, 60, 2.5],
  ['Lying leg curl', 'Hamstrings', null, 'Hamstrings', 'Machine', 2, 8, 12, 60, 2.5],
  ['Nordic curl', 'Hamstrings', null, 'Hamstrings', 'Bodyweight', 3, 3, 6, 120, 1.25],
  ['Good morning', 'Hamstrings', 'Lower back', 'Hamstrings', 'Barbell', 3, 8, 12, 90, 2.5],
  ['Back extension', 'Hamstrings', 'Glutes', 'Hamstrings', 'Bench', 3, 10, 15, 60, 2.5],
  // Quads & Glutes
  ['Trap-bar deadlift', 'Glutes', 'Quads', 'Quads & Glutes', 'Trap bar', 3, 5, 8, 120, 2.5],
  ['Back squat', 'Quads', 'Glutes', 'Quads & Glutes', 'Barbell', 3, 5, 8, 120, 2.5],
  ['Front squat', 'Quads', 'Core', 'Quads & Glutes', 'Barbell', 3, 5, 8, 120, 2.5],
  ['Hack squat', 'Quads', 'Glutes', 'Quads & Glutes', 'Machine', 3, 6, 10, 120, 2.5],
  ['Leg press', 'Quads', 'Glutes', 'Quads & Glutes', 'Machine', 3, 8, 12, 90, 5],
  ['Bulgarian split squat', 'Quads', 'Glutes', 'Quads & Glutes', 'Dumbbells', 3, 8, 12, 90, 2.5],
  ['Hip thrust', 'Glutes', 'Hamstrings', 'Quads & Glutes', 'Barbell', 3, 8, 12, 90, 5],
  ['Walking lunge', 'Quads', 'Glutes', 'Quads & Glutes', 'Dumbbells', 3, 10, 12, 90, 2.5],
  ['Leg extension', 'Quads', null, 'Quads & Glutes', 'Machine', 2, 10, 15, 60, 2.5],
  ['Goblet squat', 'Quads', 'Glutes', 'Quads & Glutes', 'Dumbbell', 3, 8, 12, 90, 2.5],
  // Push
  ['DB bench press', 'Chest', 'Triceps', 'Push', 'Dumbbells', 3, 6, 10, 90, 2.5],
  ['Barbell bench press', 'Chest', 'Triceps', 'Push', 'Barbell', 3, 5, 8, 120, 2.5],
  ['Incline DB press', 'Chest', 'Shoulders', 'Push', 'Dumbbells', 3, 6, 10, 90, 2.5],
  ['Overhead press', 'Shoulders', 'Triceps', 'Push', 'Barbell', 3, 6, 10, 90, 1.25],
  ['Seated DB shoulder press', 'Shoulders', 'Triceps', 'Push', 'Dumbbells', 3, 6, 10, 90, 2.5],
  ['Dips', 'Chest', 'Triceps', 'Push', 'Bodyweight', 3, 6, 10, 90, 2.5],
  ['Push-up', 'Chest', 'Triceps', 'Push', 'Bodyweight', 3, 10, 20, 60, 1.25],
  ['Cable triceps pushdown', 'Triceps', null, 'Push', 'Cable', 2, 10, 15, 60, 2.5],
  ['Lateral raise', 'Shoulders', null, 'Push', 'Dumbbells', 2, 10, 15, 60, 1.25],
  // Pull
  ['Weighted pull-up', 'Lats', 'Biceps', 'Pull', 'Bodyweight + belt', 3, 5, 8, 120, 1.25],
  ['Lat pulldown', 'Lats', 'Biceps', 'Pull', 'Cable', 3, 5, 8, 120, 2.5],
  ['Chin-up', 'Lats', 'Biceps', 'Pull', 'Bodyweight', 3, 5, 8, 120, 1.25],
  ['Cable row', 'Back', 'Biceps', 'Pull', 'Cable', 3, 8, 10, 90, 2.5],
  ['Barbell row', 'Back', 'Biceps', 'Pull', 'Barbell', 3, 6, 10, 90, 2.5],
  ['One-arm DB row', 'Back', 'Biceps', 'Pull', 'Dumbbell', 3, 8, 12, 90, 2.5],
  ['Chest-supported row', 'Back', 'Biceps', 'Pull', 'Machine', 3, 8, 12, 90, 2.5],
  ['Face pull', 'Rear delts', 'Upper back', 'Pull', 'Cable', 2, 12, 15, 60, 1.25],
  ['Biceps curl', 'Biceps', null, 'Pull', 'Dumbbells', 2, 8, 12, 60, 1.25],
  ['Hammer curl', 'Biceps', 'Forearms', 'Pull', 'Dumbbells', 2, 8, 12, 60, 1.25],
  // Core
  ['Pallof press', 'Core', null, 'Core', 'Cable', 2, 10, 10, 60, 2.5],
  ['Hanging knee raise', 'Core', 'Hip flexors', 'Core', 'Bar', 3, 8, 12, 60, 1.25],
  ['Ab wheel rollout', 'Core', null, 'Core', 'Ab wheel', 3, 6, 12, 60, 1.25],
  ['Plank', 'Core', null, 'Core', 'Bodyweight', 3, 1, 1, 60, 1.25],
  ['Cable crunch', 'Core', null, 'Core', 'Cable', 3, 10, 15, 60, 2.5],
  // Calves
  ['Standing calf raise', 'Calves', null, 'Calves', 'Machine', 2, 10, 15, 90, 2.5],
  ['Seated calf raise', 'Calves', null, 'Calves', 'Machine', 2, 10, 15, 60, 2.5],
  ['Single-leg calf raise', 'Calves', null, 'Calves', 'Bodyweight', 2, 10, 15, 60, 1.25],
]

// Deterministic ids so two devices seeding independently produce identical
// records and merge cleanly instead of duplicating the library.
function seedId(kind: string, key: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  const s = `${kind}:${key}`
  for (let i = 0; i < s.length; i++) {
    h1 = Math.imul(h1 ^ s.charCodeAt(i), 0x01000193) >>> 0
    h2 = (Math.imul(h2 + s.charCodeAt(i), 0x85ebca6b) ^ (h2 >>> 13)) >>> 0
  }
  const hex = (n: number) => n.toString(16).padStart(8, '0')
  return `00000000-${hex(h1).slice(0, 4)}-4${hex(h1).slice(4, 7)}-8${hex(h2).slice(0, 3)}-${hex(h2)}${hex(h1).slice(0, 4)}`
}

export async function seedIfEmpty(): Promise<void> {
  const count = await db.exercises.count()
  if (count > 0) return
  const device_id = await getDeviceId()
  // Epoch timestamp so any real user edit (now()) wins the LWW merge over seed data.
  const updated_at = new Date(0).toISOString()
  const base = { updated_at, device_id, deleted: 0 as const }

  const exercises: Exercise[] = EXERCISES.map((e) => ({
    id: seedId('ex', e[0]),
    name: e[0],
    primary_muscle: e[1],
    secondary_muscle: e[2],
    folder: e[3],
    equipment: e[4],
    default_sets: e[5],
    rep_min: e[6],
    rep_max: e[7],
    rest_sec: e[8],
    increment_kg: e[9],
    is_custom: 0,
    deload_pending: 0,
    ...base,
  }))

  const exId = (name: string) => exercises.find((e) => e.name === name)!.id

  const tmplA = { id: seedId('tmpl', 'A'), label: 'A', name: 'Lower + press', sort_order: 0, ...base }
  const tmplB = { id: seedId('tmpl', 'B'), label: 'B', name: 'Upper + hinge accessory', sort_order: 1, ...base }

  type TE = [ex: string, pos: number, sets: number, repMin: number, repMax: number, rest: number, ss: string | null]
  const teA: TE[] = [
    ['Trap-bar deadlift', 0, 3, 5, 8, 120, null],
    ['Romanian deadlift', 1, 3, 6, 10, 90, 'a1'],
    ['DB bench press', 2, 3, 6, 10, 90, 'a1'],
    ['Standing calf raise', 3, 2, 10, 15, 90, null],
  ]
  const teB: TE[] = [
    ['Weighted pull-up', 0, 3, 5, 8, 120, null],
    ['Overhead press', 1, 3, 6, 10, 90, 'b1'],
    ['Cable row', 2, 3, 8, 10, 90, 'b1'],
    ['Seated leg curl', 3, 2, 10, 10, 60, 'b2'],
    ['Pallof press', 4, 2, 10, 10, 60, 'b2'],
  ]

  const templateExercises = [
    ...teA.map((t) => ({
      id: seedId('te', `A:${t[0]}`),
      template_id: tmplA.id,
      exercise_id: exId(t[0]),
      position: t[1], sets: t[2], rep_min: t[3], rep_max: t[4], rest_sec: t[5],
      superset_group: t[6],
      ...base,
    })),
    ...teB.map((t) => ({
      id: seedId('te', `B:${t[0]}`),
      template_id: tmplB.id,
      exercise_id: exId(t[0]),
      position: t[1], sets: t[2], rep_min: t[3], rep_max: t[4], rest_sec: t[5],
      superset_group: t[6],
      ...base,
    })),
  ]

  const rotation = [
    { id: seedId('rot', '0'), template_id: tmplA.id, position: 0, ...base },
    { id: seedId('rot', '1'), template_id: tmplB.id, position: 1, ...base },
  ]

  const settings = { id: SETTINGS_ID, ...DEFAULT_SETTINGS, ...base }

  await db.transaction(
    'rw',
    [db.exercises, db.session_templates, db.template_exercises, db.rotation, db.settings],
    async () => {
      await db.exercises.bulkPut(exercises)
      await db.session_templates.bulkPut([tmplA, tmplB])
      await db.template_exercises.bulkPut(templateExercises)
      await db.rotation.bulkPut(rotation)
      await db.settings.put(settings)
    },
  )
}

export { uuid }
