import Dexie, { type Table } from 'dexie'

// Every synced record carries id/updated_at/device_id/deleted for
// last-write-wins merging across devices.
export interface BaseRec {
  id: string
  updated_at: string // ISO timestamp
  device_id: string
  deleted: 0 | 1
}

export type Folder =
  | 'Hamstrings'
  | 'Quads & Glutes'
  | 'Push'
  | 'Pull'
  | 'Core'
  | 'Calves'
  | 'Custom'

export interface Exercise extends BaseRec {
  name: string
  primary_muscle: string
  secondary_muscle: string | null
  folder: Folder
  equipment: string
  default_sets: number
  rep_min: number
  rep_max: number
  rest_sec: number
  increment_kg: number
  is_custom: 0 | 1
  // Set when the user accepts a deload; cleared once a set is logged.
  deload_pending: 0 | 1
}

export interface SessionTemplate extends BaseRec {
  label: string // A / B / C…
  name: string
  sort_order: number
}

export interface TemplateExercise extends BaseRec {
  template_id: string
  exercise_id: string
  position: number
  sets: number
  rep_min: number
  rep_max: number
  rest_sec: number
  superset_group: string | null // same non-null value on two rows = superset pair
}

export interface RotationSlot extends BaseRec {
  template_id: string
  position: number
}

export interface Session extends BaseRec {
  date: string // YYYY-MM-DD
  template_id: string
  started_at: string
  completed_at: string | null
  notes: string
}

export interface SetRec extends BaseRec {
  session_id: string
  exercise_id: string
  set_number: number
  weight_kg: number
  reps: number
}

export interface BodyWeight extends BaseRec {
  date: string // YYYY-MM-DD
  kg: number
}

export interface Settings extends BaseRec {
  rest_default: number
  plate_rounding: 1.25 | 2.5
  sound_on: 0 | 1
  week_start: 'monday' | 'sunday'
}

// Local-only (never synced)
export interface OutboxEntry {
  key: string // `${table}:${record_id}`
  table: SyncedTable
  record_id: string
  queued_at: string
}

export interface Meta {
  key: string
  value: string
}

export type SyncedTable =
  | 'exercises'
  | 'session_templates'
  | 'template_exercises'
  | 'rotation'
  | 'sessions'
  | 'sets'
  | 'body_weight'
  | 'settings'

export const SYNCED_TABLES: SyncedTable[] = [
  'exercises',
  'session_templates',
  'template_exercises',
  'rotation',
  'sessions',
  'sets',
  'body_weight',
  'settings',
]

export class PowerUpDB extends Dexie {
  exercises!: Table<Exercise, string>
  session_templates!: Table<SessionTemplate, string>
  template_exercises!: Table<TemplateExercise, string>
  rotation!: Table<RotationSlot, string>
  sessions!: Table<Session, string>
  sets!: Table<SetRec, string>
  body_weight!: Table<BodyWeight, string>
  settings!: Table<Settings, string>
  _outbox!: Table<OutboxEntry, string>
  _meta!: Table<Meta, string>

  constructor() {
    super('power-up')
    this.version(1).stores({
      exercises: 'id, folder, name, updated_at',
      session_templates: 'id, sort_order, updated_at',
      template_exercises: 'id, template_id, exercise_id, updated_at',
      rotation: 'id, position, updated_at',
      sessions: 'id, date, template_id, completed_at, updated_at',
      sets: 'id, session_id, exercise_id, updated_at',
      body_weight: 'id, date, updated_at',
      settings: 'id, updated_at',
      _outbox: 'key, queued_at',
      _meta: 'key',
    })
  }
}

export const db = new PowerUpDB()

export function uuid(): string {
  return crypto.randomUUID()
}

let cachedDeviceId: string | null = null
export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId
  const existing = await db._meta.get('device_id')
  if (existing) {
    cachedDeviceId = existing.value
    return existing.value
  }
  const id = uuid()
  await db._meta.put({ key: 'device_id', value: id })
  cachedDeviceId = id
  return id
}

export const SETTINGS_ID = 'settings-singleton'

export const DEFAULT_SETTINGS: Omit<Settings, keyof BaseRec> = {
  rest_default: 90,
  plate_rounding: 2.5,
  sound_on: 0,
  week_start: 'monday',
}
