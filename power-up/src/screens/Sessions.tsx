import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { BUDGET_SEC, totalCostSec } from '../lib/budget'
import { addSessionToRotation, nextLabel, nextRotationIndex } from '../lib/rotation'
import { Card, SkeletonRows, SyncChip } from '../components/ui'
import { useNav } from '../App'

// Overview of every session in the rotation (A → B → C …) so any template
// can be reviewed or adjusted, not just the one that happens to be next.
export default function Sessions() {
  const nav = useNav()
  const rotation = useLiveQuery(() =>
    db.rotation.orderBy('position').filter((r) => !r.deleted).toArray(),
  )
  const templates = useLiveQuery(() =>
    db.session_templates.orderBy('sort_order').filter((t) => !t.deleted).toArray(),
  )
  const rows = useLiveQuery(() => db.template_exercises.filter((r) => !r.deleted).toArray())
  const exercises = useLiveQuery(() => db.exercises.toArray())
  const completed = useLiveQuery(() =>
    db.sessions.filter((s) => !s.deleted && !!s.completed_at).toArray(),
  )

  if (!rotation || !templates || !rows || !exercises || !completed) {
    return (
      <div className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <SkeletonRows n={4} />
      </div>
    )
  }

  const nextIdx = nextRotationIndex(rotation, completed)
  const nextTemplateId = rotation[nextIdx]?.template_id
  const exOf = (id: string) => exercises.find((e) => e.id === id)
  const rowsFor = (templateId: string) =>
    rows.filter((r) => r.template_id === templateId).sort((a, b) => a.position - b.position)

  // Rotation order, then any template not currently in the rotation.
  const inRotation = rotation
    .map((slot) => templates.find((t) => t.id === slot.template_id))
    .filter((t): t is NonNullable<typeof t> => !!t)
  const orphans = templates.filter((t) => !rotation.some((r) => r.template_id === t.id))

  const lastCompletedFor = (templateId: string) =>
    [...completed]
      .filter((s) => s.template_id === templateId)
      .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))[0]

  return (
    <div className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={nav.back}
            className="w-9 h-9 rounded-btn bg-inset flex items-center justify-center"
            aria-label="back"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#141412" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7"/></svg>
          </button>
          <h1 className="text-[22px] font-bold text-ink">Sessions</h1>
        </div>
        <SyncChip />
      </header>

      {/* The endless cycle, next one marked */}
      <Card className="px-4 py-3 mb-4">
        <div className="text-[11px] font-medium text-faint uppercase tracking-wider mb-2">
          Rotation
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {inRotation.map((t, i) => (
            <span key={t.id} className="flex items-center gap-1.5">
              <span
                className={`w-7 h-7 rounded-btn flex items-center justify-center text-[13px] font-bold ${
                  t.id === nextTemplateId ? 'bg-ink text-white' : 'bg-inset text-sub'
                }`}
              >
                {t.label}
              </span>
              {i < inRotation.length - 1 && <span className="text-faint text-[11px]">→</span>}
            </span>
          ))}
          <span className="text-faint text-[11px]">↻</span>
        </div>
      </Card>

      <div className="space-y-3">
        {[...inRotation, ...orphans].map((t) => {
          const tRows = rowsFor(t.id)
          const cost = totalCostSec(tRows)
          const isNext = t.id === nextTemplateId
          const last = lastCompletedFor(t.id)
          return (
            <Card key={t.id} className={`p-4 ${isNext ? 'border-l-2 border-l-accent' : ''}`}>
              <div className="flex items-start justify-between mb-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-btn bg-ink text-white flex items-center justify-center text-[15px] font-bold">
                    {t.label}
                  </span>
                  <div>
                    <div className="text-[16px] font-semibold text-ink leading-snug">{t.name}</div>
                    <div className="text-[12px] text-sub">
                      {isNext && <span className="text-accent font-medium">Next up · </span>}
                      {last
                        ? `Last ${new Date(last.date + 'T12:00:00').toLocaleDateString(undefined, {
                            day: 'numeric',
                            month: 'short',
                          })}`
                        : 'Not done yet'}
                    </div>
                  </div>
                </div>
                <span
                  className={`text-[11px] font-medium rounded-full px-2 py-1 ${
                    cost > BUDGET_SEC ? 'bg-warn/10 text-warn' : 'bg-inset text-sub'
                  }`}
                >
                  {Math.round(cost / 60)} min
                </span>
              </div>

              <div className="border-t border-hairline pt-2.5 space-y-1.5">
                {tRows.map((r) => (
                  <div key={r.id} className="flex items-baseline justify-between">
                    <span className="text-[14px] text-ink truncate pr-2">
                      {r.superset_group && <span className="text-accent mr-1">⇅</span>}
                      {exOf(r.exercise_id)?.name ?? '—'}
                    </span>
                    <span className="text-[13px] text-sub shrink-0">
                      {r.sets}×{r.rep_min}–{r.rep_max}
                    </span>
                  </div>
                ))}
                {tRows.length === 0 && (
                  <div className="text-[13px] text-faint py-1">No exercises yet.</div>
                )}
              </div>

              <button
                onClick={() => nav.push({ name: 'editor', templateId: t.id })}
                className="w-full mt-3 text-[14px] font-medium text-ink bg-inset rounded-btn py-2.5"
              >
                Adjust
              </button>
            </Card>
          )
        })}
      </div>

      <button
        className="w-full text-center text-[13px] text-accent font-medium py-4"
        onClick={async () => {
          const id = await addSessionToRotation(templates)
          nav.push({ name: 'editor', templateId: id })
        }}
      >
        + Add Session {nextLabel(templates)} to rotation
      </button>
    </div>
  )
}
