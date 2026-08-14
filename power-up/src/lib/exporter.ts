import { db, SYNCED_TABLES } from '../db/db'

function download(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportJSON(): Promise<void> {
  const out: Record<string, unknown[]> = {}
  for (const t of SYNCED_TABLES) {
    out[t] = await db.table(t).filter((r) => !(r as { deleted: number }).deleted).toArray()
  }
  download(
    `power-up-${new Date().toISOString().slice(0, 10)}.json`,
    'application/json',
    JSON.stringify(out, null, 2),
  )
}

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// One CSV of all logged sets joined with session + exercise context.
export async function exportCSV(): Promise<void> {
  const sets = await db.sets.filter((s) => !s.deleted).toArray()
  const sessions = await db.sessions.toArray()
  const exercises = await db.exercises.toArray()
  const sesOf = new Map(sessions.map((s) => [s.id, s]))
  const exOf = new Map(exercises.map((e) => [e.id, e]))
  const header = ['date', 'exercise', 'set_number', 'weight_kg', 'reps']
  const rows = sets
    .map((s) => ({
      date: sesOf.get(s.session_id)?.date ?? '',
      exercise: exOf.get(s.exercise_id)?.name ?? '',
      set_number: s.set_number,
      weight_kg: s.weight_kg,
      reps: s.reps,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.exercise.localeCompare(b.exercise) || a.set_number - b.set_number)
  const csv = [
    header.join(','),
    ...rows.map((r) => header.map((h) => csvEscape(r[h as keyof typeof r])).join(',')),
  ].join('\n')
  download(`power-up-sets-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv', csv)
}
