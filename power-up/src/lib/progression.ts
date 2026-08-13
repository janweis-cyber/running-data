import { db, type Exercise, type SetRec, type TemplateExercise } from '../db/db'

export interface Prefill {
  weight_kg: number | null // null = first-ever session, blank inputs
  reps: number | null
  progressed: boolean // this prefill is a +increment step up
  deload: boolean // this prefill is the accepted −30% deload
  stalled: boolean // show deload banner
}

export function roundToPlate(kg: number, rounding: number): number {
  return Math.round(kg / rounding) * rounding
}

// History for one exercise: completed sessions (newest first) with their sets.
async function history(exerciseId: string): Promise<{ sessionId: string; sets: SetRec[] }[]> {
  const sets = await db.sets
    .where('exercise_id')
    .equals(exerciseId)
    .filter((s) => !s.deleted)
    .toArray()
  if (sets.length === 0) return []
  const sessionIds = [...new Set(sets.map((s) => s.session_id))]
  const sessions = (await db.sessions.bulkGet(sessionIds)).filter(
    (s) => s && !s.deleted && s.completed_at,
  )
  const ordered = sessions
    .map((s) => s!)
    .sort((a, b) => b.completed_at!.localeCompare(a.completed_at!))
  return ordered.map((s) => ({
    sessionId: s.id,
    sets: sets
      .filter((x) => x.session_id === s.id)
      .sort((a, b) => a.set_number - b.set_number),
  }))
}

function topWeight(sets: SetRec[]): number {
  return Math.max(...sets.map((s) => s.weight_kg))
}

function allAtTop(sets: SetRec[], repMax: number, planned: number): boolean {
  return sets.length >= planned && sets.every((s) => s.reps >= repMax)
}

// Progression: all sets at top of rep range → +increment, reps reset to
// bottom of range. Stall: 2 consecutive completed sessions without
// progression → offer deload; accepted deload prefills −30%.
export async function getPrefill(
  exercise: Exercise,
  te: Pick<TemplateExercise, 'sets' | 'rep_min' | 'rep_max'>,
  plateRounding: number,
): Promise<Prefill> {
  const h = await history(exercise.id)
  if (h.length === 0) {
    return { weight_kg: null, reps: null, progressed: false, deload: false, stalled: false }
  }
  const last = h[0]
  const lastTop = topWeight(last.sets)

  if (exercise.deload_pending) {
    return {
      weight_kg: roundToPlate(lastTop * 0.7, plateRounding),
      reps: te.rep_min,
      progressed: false,
      deload: true,
      stalled: false,
    }
  }

  const hitTop = allAtTop(last.sets, te.rep_max, te.sets)
  if (hitTop) {
    return {
      weight_kg: roundToPlate(lastTop + exercise.increment_kg, plateRounding),
      reps: te.rep_min,
      progressed: true,
      deload: false,
      stalled: false,
    }
  }

  // Stall check: last 2 sessions, neither hit top, and weight didn't move up.
  let stalled = false
  if (h.length >= 2) {
    const prev = h[1]
    const prevTop = topWeight(prev.sets)
    const noProgressLast = !hitTop && lastTop <= prevTop
    const prevHitTop = allAtTop(prev.sets, te.rep_max, te.sets)
    stalled = noProgressLast && !prevHitTop
  }

  return {
    weight_kg: lastTop,
    reps: last.sets.length > 0 ? Math.max(...last.sets.map((s) => s.reps)) : te.rep_min,
    progressed: false,
    deload: false,
    stalled,
  }
}
