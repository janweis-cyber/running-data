import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { e1rm } from '../lib/stats'
import { Card, MusclePill, SkeletonRows } from '../components/ui'
import { useNav } from '../App'

export default function SessionDetail({ sessionId }: { sessionId: string }) {
  const nav = useNav()
  const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId])
  const template = useLiveQuery(
    () => (session ? db.session_templates.get(session.template_id) : undefined),
    [session?.template_id],
  )
  const sets = useLiveQuery(
    () =>
      db.sets
        .where('session_id')
        .equals(sessionId)
        .filter((s) => !s.deleted)
        .toArray(),
    [sessionId],
  )
  const exercises = useLiveQuery(() => db.exercises.toArray())

  if (!session || !sets || !exercises) {
    return (
      <div className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <SkeletonRows n={4} />
      </div>
    )
  }

  // Group sets by exercise, preserving first-seen order
  const byExercise: { exerciseId: string; sets: typeof sets }[] = []
  for (const s of [...sets].sort((a, b) => a.updated_at.localeCompare(b.updated_at))) {
    let g = byExercise.find((x) => x.exerciseId === s.exercise_id)
    if (!g) {
      g = { exerciseId: s.exercise_id, sets: [] }
      byExercise.push(g)
    }
    g.sets.push(s)
  }

  return (
    <div className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="flex items-center gap-3 mb-4">
        <button onClick={nav.back} className="w-9 h-9 rounded-btn bg-inset flex items-center justify-center" aria-label="back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#141412" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7"/></svg>
        </button>
        <div>
          <h1 className="text-[19px] font-bold text-ink leading-tight">
            {template ? `Session ${template.label} — ${template.name}` : 'Session'}
          </h1>
          <div className="text-[13px] text-sub">
            {new Date(session.date + 'T12:00:00').toLocaleDateString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </div>
        </div>
      </header>

      <div className="space-y-3">
        {byExercise.map((g) => {
          const ex = exercises.find((e) => e.id === g.exerciseId)
          const best = g.sets.reduce((b, s) => Math.max(b, e1rm(s.weight_kg, s.reps)), 0)
          return (
            <Card key={g.exerciseId} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-[15px] font-semibold text-ink">{ex?.name ?? '—'}</div>
                  {ex && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <MusclePill muscle={ex.primary_muscle} primary />
                      {ex.secondary_muscle && <MusclePill muscle={ex.secondary_muscle} />}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-faint uppercase tracking-wider">e1RM</div>
                  <div className="text-[15px] font-semibold text-accent">{best.toFixed(1)} kg</div>
                </div>
              </div>
              <div className="space-y-1">
                {[...g.sets]
                  .sort((a, b) => a.set_number - b.set_number)
                  .map((s) => (
                    <div key={s.id} className="flex items-baseline justify-between text-[14px]">
                      <span className="text-faint">Set {s.set_number}</span>
                      <span className="text-ink font-medium">
                        {s.weight_kg} kg × {s.reps}
                      </span>
                    </div>
                  ))}
              </div>
            </Card>
          )
        })}
      </div>

      {session.notes && (
        <Card className="p-4 mt-3 text-[14px] text-sub">{session.notes}</Card>
      )}
    </div>
  )
}
