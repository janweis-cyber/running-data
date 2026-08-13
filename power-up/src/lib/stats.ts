import { db, type Session, type SetRec, type Settings } from '../db/db'

// Epley estimated 1RM
export function e1rm(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30)
}

export function bestE1rm(sets: SetRec[]): number {
  return sets.reduce((best, s) => Math.max(best, e1rm(s.weight_kg, s.reps)), 0)
}

// Start of the week containing `d`.
export function weekStart(d: Date, start: Settings['week_start']): Date {
  const day = d.getDay() // 0 = Sunday
  const offset = start === 'monday' ? (day + 6) % 7 : day
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset)
  return out
}

// Streak = consecutive weeks with ≥1 completed session, counting back from
// the current week (current week counts if it has one; if not it doesn't
// break the streak yet).
export function computeStreak(sessions: Session[], start: Settings['week_start']): number {
  const completed = sessions.filter((s) => s.completed_at && !s.deleted)
  if (completed.length === 0) return 0
  const weeks = new Set(
    completed.map((s) => weekStart(new Date(s.date + 'T12:00:00'), start).getTime()),
  )
  const now = weekStart(new Date(), start).getTime()
  const WEEK = 7 * 24 * 3600 * 1000
  let streak = 0
  let cursor = now
  if (!weeks.has(cursor)) cursor -= WEEK // current week may still be in progress
  while (weeks.has(cursor)) {
    streak++
    cursor -= WEEK
  }
  return streak
}

export async function weeklyTonnage(start: Settings['week_start']): Promise<number> {
  const from = weekStart(new Date(), start)
  const fromStr = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`
  const sessions = await db.sessions
    .where('date')
    .aboveOrEqual(fromStr)
    .filter((s) => !s.deleted && !!s.completed_at)
    .toArray()
  let total = 0
  for (const s of sessions) {
    const sets = await db.sets.where('session_id').equals(s.id).filter((x) => !x.deleted).toArray()
    total += sets.reduce((sum, x) => sum + x.weight_kg * x.reps, 0)
  }
  return total
}
