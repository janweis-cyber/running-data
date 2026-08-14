import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Reorder, motion } from 'framer-motion'
import { db, type Exercise, type SessionTemplate, type RotationSlot, type TemplateExercise } from '../db/db'
import { put, patch, remove, newId } from '../db/repo'
import { BUDGET_SEC, cheapestCut, rowCostSec, totalCostSec } from '../lib/budget'
import { addSessionToRotation, nextLabel } from '../lib/rotation'
import { BudgetBar, Card, MusclePill, Stepper, GhostButton, SkeletonRows } from '../components/ui'
import { useNav } from '../App'

export default function Editor({ templateId }: { templateId: string }) {
  const nav = useNav()
  const template = useLiveQuery(() => db.session_templates.get(templateId), [templateId])
  const rows = useLiveQuery(
    () =>
      db.template_exercises
        .where('template_id')
        .equals(templateId)
        .filter((r) => !r.deleted)
        .sortBy('position'),
    [templateId],
  )
  const exercises = useLiveQuery(() => db.exercises.filter((e) => !e.deleted).toArray())
  const templates = useLiveQuery(() =>
    db.session_templates.orderBy('sort_order').filter((t) => !t.deleted).toArray(),
  )
  const [expanded, setExpanded] = useState<string | null>(null)

  if (!template || !rows || !exercises || !templates) {
    return (
      <div className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <SkeletonRows n={5} />
      </div>
    )
  }

  const exOf = (id: string) => exercises.find((e) => e.id === id)
  const total = totalCostSec(rows)
  const over = total > BUDGET_SEC
  const headroomSec = BUDGET_SEC - total
  const cut = over ? cheapestCut(rows, (te) => exOf(te.exercise_id)?.name ?? '—') : null

  const onReorder = (ordered: TemplateExercise[]) => {
    ordered.forEach((r, i) => {
      if (r.position !== i) void patch<TemplateExercise>('template_exercises', r.id, { position: i })
    })
  }

  // Link/unlink adjacent rows as a superset pair.
  const toggleLink = async (a: TemplateExercise, b: TemplateExercise) => {
    if (a.superset_group && a.superset_group === b.superset_group) {
      await patch<TemplateExercise>('template_exercises', a.id, { superset_group: null })
      await patch<TemplateExercise>('template_exercises', b.id, { superset_group: null })
    } else if (!a.superset_group && !b.superset_group) {
      const g = newId()
      await patch<TemplateExercise>('template_exercises', a.id, { superset_group: g })
      await patch<TemplateExercise>('template_exercises', b.id, { superset_group: g })
    }
  }

  return (
    <div className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="flex items-center gap-3 mb-4">
        <button onClick={nav.back} className="w-9 h-9 rounded-btn bg-inset flex items-center justify-center" aria-label="back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#141412" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7"/></svg>
        </button>
        <div>
          <h1 className="text-[19px] font-bold text-ink leading-tight">
            Session {template.label}
          </h1>
          <div className="text-[13px] text-sub">{template.name}</div>
        </div>
      </header>

      {/* Budget bar — always visible and live */}
      <div className="sticky top-0 z-20 bg-page pt-1 pb-3 -mx-5 px-5">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className={`text-[13px] font-semibold ${over ? 'text-warn' : 'text-ink'}`}>
            {Math.round(total / 60)} of 30 min
          </span>
          <span className={`text-[12px] ${over ? 'text-warn' : 'text-sub'}`}>
            {over
              ? cut
                ? `${Math.round((total - BUDGET_SEC) / 60)} min over — drop ${cut}`
                : `${Math.round((total - BUDGET_SEC) / 60)} min over`
              : `${Math.floor(headroomSec / 60)} min headroom`}
          </span>
        </div>
        <BudgetBar totalSec={total} budgetSec={BUDGET_SEC} />
      </div>

      <Reorder.Group axis="y" values={rows} onReorder={onReorder} className="space-y-2.5">
        {rows.map((r, i) => {
          const ex = exOf(r.exercise_id)
          if (!ex) return null
          const next = rows[i + 1]
          const linkedWithNext = !!(r.superset_group && next && next.superset_group === r.superset_group)
          return (
            <Reorder.Item key={r.id} value={r} className="relative">
              <EditorRow
                te={r}
                exercise={ex}
                costSec={rowCostSec(rows, r.id)}
                expanded={expanded === r.id}
                onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
                onSwap={() =>
                  nav.push({
                    name: 'library',
                    templateId,
                    mode: 'swap',
                    swapTeId: r.id,
                    scopeFolder: ex.folder,
                  })
                }
                onRemove={() => void remove('template_exercises', r.id)}
              />
              {next && (
                <div className="flex justify-center -my-1 relative z-10">
                  <button
                    onClick={() => void toggleLink(r, next)}
                    className={`text-[11px] font-medium rounded-full px-2.5 py-0.5 border ${
                      linkedWithNext
                        ? 'bg-accent text-white border-accent'
                        : 'bg-card text-faint border-hairline'
                    }`}
                  >
                    {linkedWithNext ? '⇅ superset' : '⇅ link'}
                  </button>
                </div>
              )}
            </Reorder.Item>
          )
        })}
      </Reorder.Group>

      <div className="mt-4 space-y-2.5">
        <GhostButton
          className="w-full"
          onClick={() => nav.push({ name: 'library', templateId, mode: 'add' })}
        >
          + Add exercise
        </GhostButton>
        <button
          className="w-full text-center text-[13px] text-accent font-medium py-2"
          onClick={async () => {
            const id = await addSessionToRotation(templates)
            nav.push({ name: 'editor', templateId: id })
          }}
        >
          + Add Session {nextLabel(templates)} to rotation
        </button>
      </div>
    </div>
  )
}

function EditorRow({
  te,
  exercise,
  costSec,
  expanded,
  onToggle,
  onSwap,
  onRemove,
}: {
  te: TemplateExercise
  exercise: Exercise
  costSec: number
  expanded: boolean
  onToggle: () => void
  onSwap: () => void
  onRemove: () => void
}) {
  return (
    <Card className="p-3.5">
      <div className="flex items-center gap-3">
        <span className="text-faint cursor-grab touch-none select-none" aria-label="drag to reorder">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#A6A69E"><circle cx="8" cy="6" r="1.7"/><circle cx="16" cy="6" r="1.7"/><circle cx="8" cy="12" r="1.7"/><circle cx="16" cy="12" r="1.7"/><circle cx="8" cy="18" r="1.7"/><circle cx="16" cy="18" r="1.7"/></svg>
        </span>
        <button className="flex-1 text-left" onClick={onToggle}>
          <div className="text-[15px] font-semibold text-ink leading-snug">{exercise.name}</div>
          <div className="flex items-center gap-1.5 mt-1">
            <MusclePill muscle={exercise.primary_muscle} primary />
            {exercise.secondary_muscle && <MusclePill muscle={exercise.secondary_muscle} />}
            <span className="text-[12px] text-sub ml-0.5">
              {te.sets}×{te.rep_min}–{te.rep_max} · {te.rest_sec}s
            </span>
          </div>
        </button>
        <span className="text-[11px] font-medium text-sub bg-inset rounded-full px-2 py-1">
          {Math.round(costSec / 60)} min
        </span>
      </div>

      {expanded && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 pt-3 border-t border-hairline space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-sub">Sets</span>
            <Stepper
              value={te.sets}
              step={1}
              min={1}
              onChange={(v) => void patch<TemplateExercise>('template_exercises', te.id, { sets: Math.round(v) })}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-sub">Rep range</span>
            <div className="flex items-center gap-2">
              <Stepper
                value={te.rep_min}
                step={1}
                min={1}
                onChange={(v) =>
                  void patch<TemplateExercise>('template_exercises', te.id, {
                    rep_min: Math.min(Math.round(v), te.rep_max),
                  })
                }
              />
              <span className="text-faint">–</span>
              <Stepper
                value={te.rep_max}
                step={1}
                min={1}
                onChange={(v) =>
                  void patch<TemplateExercise>('template_exercises', te.id, {
                    rep_max: Math.max(Math.round(v), te.rep_min),
                  })
                }
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-sub">Rest</span>
            <Stepper
              value={te.rest_sec}
              step={15}
              min={15}
              onChange={(v) => void patch<TemplateExercise>('template_exercises', te.id, { rest_sec: Math.round(v) })}
              format={(v) => `${v}s`}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onSwap} className="flex-1 text-[13px] font-medium text-ink bg-inset rounded-btn py-2.5">
              Swap
            </button>
            <button onClick={onRemove} className="flex-1 text-[13px] font-medium text-warn bg-inset rounded-btn py-2.5">
              Remove
            </button>
          </div>
        </motion.div>
      )}
    </Card>
  )
}
