import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion, AnimatePresence } from 'framer-motion'
import { db, SETTINGS_ID, type Exercise, type Session, type SetRec, type TemplateExercise } from '../db/db'
import { put, patch, newId, todayStr } from '../db/repo'
import { getPrefill, roundToPlate, type Prefill } from '../lib/progression'
import { computeStreak } from '../lib/stats'
import { nextRotationIndex } from '../lib/rotation'
import { costItems, fmtMin, totalCostSec } from '../lib/budget'
import { startRest } from '../lib/restTimer'
import { Card, MusclePill, PrimaryButton, GhostButton, SyncChip, Stepper, SkeletonRows, spring } from '../components/ui'
import { useNav } from '../App'

export default function Today() {
  const nav = useNav()
  const settings = useLiveQuery(() => db.settings.get(SETTINGS_ID))
  const rotation = useLiveQuery(() =>
    db.rotation.orderBy('position').filter((r) => !r.deleted).toArray(),
  )
  const templates = useLiveQuery(() =>
    db.session_templates.orderBy('sort_order').filter((t) => !t.deleted).toArray(),
  )
  const completedSessions = useLiveQuery(() =>
    db.sessions.filter((s) => !s.deleted && !!s.completed_at).toArray(),
  )
  const activeSession = useLiveQuery(() =>
    db.sessions.filter((s) => !s.deleted && !s.completed_at).first(),
  )

  if (!settings || !rotation || !templates || !completedSessions) {
    return (
      <div className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <SkeletonRows n={4} />
      </div>
    )
  }

  // Next template from rotation + history
  const nextIdx = nextRotationIndex(rotation, completedSessions)
  const nextSlot = rotation[nextIdx]
  const nextTemplate = templates.find((t) => t.id === nextSlot?.template_id)
  const streak = computeStreak(completedSessions, settings.week_start)

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-bold text-ink leading-tight">Today</h1>
          <div className="text-[13px] text-sub">{dateLabel}</div>
        </div>
        <SyncChip />
      </header>

      {activeSession ? (
        <ActiveSession session={activeSession} plateRounding={settings.plate_rounding} />
      ) : nextTemplate ? (
        <>
          {/* Hero card */}
          <Card className="p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-medium text-faint uppercase tracking-wider">
                Next session
              </span>
              {streak > 0 && (
                <span className="text-[12px] font-medium text-accent">
                  {streak} wk streak
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2.5 mb-1">
              <span className="w-9 h-9 rounded-btn bg-ink text-white flex items-center justify-center text-[17px] font-bold self-center">
                {nextTemplate.label}
              </span>
              <span className="text-[19px] font-semibold text-ink self-center">
                {nextTemplate.name}
              </span>
            </div>
            <RotationStrip
              labels={Array.from({ length: Math.min(4, rotation.length * 2) }, (_, i) => {
                const slot = rotation[(nextIdx + i) % rotation.length]
                return templates.find((t) => t.id === slot?.template_id)?.label ?? '?'
              })}
              onOpen={() => nav.push({ name: 'sessions' })}
            />
            <TemplatePreview templateId={nextTemplate.id} />
            <div className="flex gap-3 mt-4">
              <PrimaryButton
                className="flex-1"
                onClick={async () => {
                  await put<Session>('sessions', {
                    id: newId(),
                    date: todayStr(),
                    template_id: nextTemplate.id,
                    started_at: new Date().toISOString(),
                    completed_at: null,
                    notes: '',
                  })
                }}
              >
                Start session
              </PrimaryButton>
              <GhostButton onClick={() => nav.push({ name: 'editor', templateId: nextTemplate.id })}>
                Adjust
              </GhostButton>
            </div>
          </Card>
        </>
      ) : (
        <Card className="p-5 text-[14px] text-sub">No templates in rotation yet.</Card>
      )}
    </div>
  )
}

// Tapping the strip opens the full A → B → C overview.
function RotationStrip({ labels, onOpen }: { labels: string[]; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="flex items-center gap-1.5 mt-2 mb-1 w-full">
      {labels.map((l, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <span
            className={`text-[12px] font-semibold ${i === 0 ? 'text-ink' : 'text-faint'}`}
          >
            {l}
          </span>
          {i < labels.length - 1 && <span className="text-faint text-[10px]">→</span>}
        </span>
      ))}
      <span className="text-faint text-[10px]">→ …</span>
      <span className="ml-auto text-[12px] font-medium text-accent">All sessions ›</span>
    </button>
  )
}

function TemplatePreview({ templateId }: { templateId: string }) {
  const rows = useLiveQuery(
    () =>
      db.template_exercises
        .where('template_id')
        .equals(templateId)
        .filter((r) => !r.deleted)
        .sortBy('position'),
    [templateId],
  )
  const exercises = useLiveQuery(() => db.exercises.toArray())
  if (!rows || !exercises) return null
  const exOf = (id: string) => exercises.find((e) => e.id === id)
  return (
    <div className="mt-3 border-t border-hairline pt-3 space-y-1.5">
      {rows.map((r) => (
        <div key={r.id} className="flex items-baseline justify-between">
          <span className="text-[14px] text-ink">
            {r.superset_group && <span className="text-accent mr-1">⇅</span>}
            {exOf(r.exercise_id)?.name ?? '—'}
          </span>
          <span className="text-[13px] text-sub">
            {r.sets}×{r.rep_min}–{r.rep_max}
          </span>
        </div>
      ))}
      <div className="text-[12px] text-faint pt-1">{fmtMin(totalCostSec(rows))} est.</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Active session
// ---------------------------------------------------------------------------
interface PlanSet {
  teId: string
  exercise: Exercise
  te: TemplateExercise
  setNumber: number
}

function ActiveSession({ session, plateRounding }: { session: Session; plateRounding: number }) {
  const rows = useLiveQuery(
    () =>
      db.template_exercises
        .where('template_id')
        .equals(session.template_id)
        .filter((r) => !r.deleted)
        .sortBy('position'),
    [session.template_id],
  )
  const exercises = useLiveQuery(() => db.exercises.toArray())
  const loggedSets = useLiveQuery(
    () => db.sets.where('session_id').equals(session.id).filter((s) => !s.deleted).toArray(),
    [session.id],
  )
  const template = useLiveQuery(() => db.session_templates.get(session.template_id), [session.template_id])

  const [prefills, setPrefills] = useState<Record<string, Prefill>>({})
  const [inputs, setInputs] = useState<Record<string, { weight: number | null; reps: number | null }>>({})

  const exOf = (id: string) => exercises?.find((e) => e.id === id)

  useEffect(() => {
    if (!rows || !exercises) return
    let cancelled = false
    ;(async () => {
      const out: Record<string, Prefill> = {}
      for (const r of rows) {
        const ex = exercises.find((e) => e.id === r.exercise_id)
        if (ex) out[r.id] = await getPrefill(ex, r, plateRounding)
      }
      if (!cancelled) setPrefills(out)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows?.length, exercises?.length])

  // Flat set plan honoring superset alternation
  const plan: PlanSet[] = useMemo(() => {
    if (!rows || !exercises) return []
    const items = costItems(rows)
    const out: PlanSet[] = []
    for (const item of items) {
      const members = item.teIds
        .map((id) => rows.find((r) => r.id === id)!)
        .filter(Boolean)
      if (members.length === 1) {
        const te = members[0]
        const ex = exercises.find((e) => e.id === te.exercise_id)
        if (!ex) continue
        for (let s = 1; s <= te.sets; s++) out.push({ teId: te.id, exercise: ex, te, setNumber: s })
      } else {
        // alternate the pair: A1 B1 A2 B2 …
        const maxSets = Math.max(...members.map((m) => m.sets))
        for (let s = 1; s <= maxSets; s++) {
          for (const te of members) {
            if (s > te.sets) continue
            const ex = exercises.find((e) => e.id === te.exercise_id)
            if (ex) out.push({ teId: te.id, exercise: ex, te, setNumber: s })
          }
        }
      }
    }
    return out
  }, [rows, exercises])

  if (!rows || !exercises || !loggedSets) return <SkeletonRows n={4} />

  const isDone = (teId: string, setNumber: number) => {
    const r = rows.find((x) => x.id === teId)
    return loggedSets.some(
      (s) => s.exercise_id === r?.exercise_id && s.set_number === setNumber,
    )
  }
  const firstIncompleteIdx = plan.findIndex((p) => !isDone(p.teId, p.setNumber))
  const allDone = firstIncompleteIdx === -1

  const inputFor = (teId: string, setNumber: number) => {
    const key = `${teId}:${setNumber}`
    if (inputs[key]) return inputs[key]
    // Prefill: previous set this session, else progression prefill
    const r = rows.find((x) => x.id === teId)!
    const prevSets = loggedSets
      .filter((s) => s.exercise_id === r.exercise_id)
      .sort((a, b) => b.set_number - a.set_number)
    if (prevSets.length > 0) {
      return { weight: prevSets[0].weight_kg, reps: prevSets[0].reps }
    }
    const pf = prefills[teId]
    return { weight: pf?.weight_kg ?? null, reps: pf?.reps ?? null }
  }

  const setInput = (teId: string, setNumber: number, v: { weight: number | null; reps: number | null }) =>
    setInputs((prev) => ({ ...prev, [`${teId}:${setNumber}`]: v }))

  const completeSet = async (p: PlanSet, idx: number) => {
    const v = inputFor(p.teId, p.setNumber)
    if (v.weight === null || v.reps === null) return
    await put<SetRec>('sets', {
      id: newId(),
      session_id: session.id,
      exercise_id: p.exercise.id,
      set_number: p.setNumber,
      weight_kg: v.weight,
      reps: v.reps,
    })
    if (p.exercise.deload_pending) {
      await patch<Exercise>('exercises', p.exercise.id, { deload_pending: 0 })
    }
    // Next planned set after this one → rest timer "next up" card
    const next = plan.slice(idx + 1).find((q) => !isDone(q.teId, q.setNumber) && !(q.teId === p.teId && q.setNumber === p.setNumber))
    startRest(
      p.te.rest_sec,
      next
        ? {
            exercise: next.exercise.name,
            detail: `Set ${next.setNumber} · ${next.te.rep_min}–${next.te.rep_max} reps`,
          }
        : null,
    )
  }

  // Group plan back into display cards (one card per exercise row, pairs tagged)
  const displayRows = rows

  return (
    <div>
      <Card className="px-4 py-3 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-btn bg-ink text-white flex items-center justify-center text-[15px] font-bold">
            {template?.label ?? ''}
          </span>
          <span className="text-[15px] font-semibold text-ink">{template?.name ?? ''}</span>
        </div>
        <span className="text-[12px] text-sub">
          {loggedSets.length}/{plan.length} sets
        </span>
      </Card>

      <div className="space-y-3">
        {displayRows.map((r) => {
          const ex = exOf(r.exercise_id)
          if (!ex) return null
          const pf = prefills[r.id]
          return (
            <ExerciseCard
              key={r.id}
              te={r}
              exercise={ex}
              prefill={pf}
              plateRounding={plateRounding}
              setsDone={loggedSets.filter((s) => s.exercise_id === ex.id).length}
              isSetDone={(n) => isDone(r.id, n)}
              inputFor={(n) => inputFor(r.id, n)}
              setInput={(n, v) => setInput(r.id, n, v)}
              onComplete={(n) => {
                const idx = plan.findIndex((p) => p.teId === r.id && p.setNumber === n)
                void completeSet(plan[idx], idx)
              }}
            />
          )
        })}
      </div>

      <div className="mt-5 space-y-3">
        <PrimaryButton
          className="w-full"
          disabled={loggedSets.length === 0}
          onClick={async () => {
            await patch<Session>('sessions', session.id, {
              completed_at: new Date().toISOString(),
            })
          }}
        >
          {allDone ? 'Finish session' : `Finish early (${loggedSets.length} sets)`}
        </PrimaryButton>
        <button
          className="w-full text-center text-[13px] text-faint py-2"
          onClick={async () => {
            if (confirm('Discard this session and its sets?')) {
              const sets = await db.sets.where('session_id').equals(session.id).toArray()
              for (const s of sets) await patch('sets', s.id, { deleted: 1 })
              await patch<Session>('sessions', session.id, { deleted: 1 })
            }
          }}
        >
          Discard session
        </button>
      </div>
    </div>
  )
}

function ExerciseCard({
  te,
  exercise,
  prefill,
  plateRounding,
  setsDone,
  isSetDone,
  inputFor,
  setInput,
  onComplete,
}: {
  te: TemplateExercise
  exercise: Exercise
  prefill: Prefill | undefined
  plateRounding: number
  setsDone: number
  isSetDone: (n: number) => boolean
  inputFor: (n: number) => { weight: number | null; reps: number | null }
  setInput: (n: number, v: { weight: number | null; reps: number | null }) => void
  onComplete: (n: number) => void
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-1">
        <div>
          <div className="text-[16px] font-semibold text-ink leading-snug">
            {exercise.name}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <MusclePill muscle={exercise.primary_muscle} primary />
            {exercise.secondary_muscle && <MusclePill muscle={exercise.secondary_muscle} />}
            {te.superset_group && (
              <span className="text-[11px] font-medium text-accent">⇅ superset</span>
            )}
          </div>
        </div>
        <div className="text-right text-[12px] text-sub leading-tight">
          <div>
            {te.sets}×{te.rep_min}–{te.rep_max}
          </div>
          <div className="text-faint">{te.rest_sec} s rest</div>
        </div>
      </div>

      {prefill?.deload && (
        <div className="mt-2 rounded-btn bg-inset px-3 py-2 text-[13px] text-warn font-medium">
          Deload session — prefilled at −30%
        </div>
      )}
      {prefill?.stalled && !prefill.deload && (
        <DeloadBanner exercise={exercise} />
      )}
      {prefill?.progressed && (
        <div className="mt-2 text-[13px] text-accent font-medium">
          ↑ +{exercise.increment_kg} kg — all sets hit {te.rep_max} last time
        </div>
      )}

      <div className="mt-3 space-y-2">
        {Array.from({ length: te.sets }, (_, i) => i + 1).map((n) => (
          <SetRow
            key={n}
            n={n}
            done={isSetDone(n)}
            value={inputFor(n)}
            plateRounding={plateRounding}
            onChange={(v) => setInput(n, v)}
            onComplete={() => onComplete(n)}
          />
        ))}
      </div>
    </Card>
  )
}

function DeloadBanner({ exercise }: { exercise: Exercise }) {
  return (
    <div className="mt-2 rounded-btn border border-warn/30 bg-warn/5 px-3 py-2.5">
      <div className="text-[13px] text-warn font-medium mb-1.5">
        Stalled 2 sessions — deload −30%?
      </div>
      <button
        className="text-[13px] font-semibold text-ink bg-inset rounded-lg px-3 py-1.5"
        onClick={() => void patch<Exercise>('exercises', exercise.id, { deload_pending: 1 })}
      >
        Accept deload
      </button>
    </div>
  )
}

function SetRow({
  n,
  done,
  value,
  plateRounding,
  onChange,
  onComplete,
}: {
  n: number
  done: boolean
  value: { weight: number | null; reps: number | null }
  plateRounding: number
  onChange: (v: { weight: number | null; reps: number | null }) => void
  onComplete: () => void
}) {
  return (
    <div className={`flex items-center gap-2 ${done ? 'opacity-45' : ''}`}>
      <span className="w-6 text-[13px] text-faint font-medium">{n}</span>
      <div className="flex-1 flex items-center justify-between gap-1">
        <Stepper
          value={value.weight}
          step={plateRounding}
          onChange={(w) => onChange({ ...value, weight: roundToPlate(w, plateRounding) })}
          format={(v) => `${v % 1 === 0 ? v : v.toFixed(2).replace(/0$/, '')}`}
          label="kg"
        />
        <Stepper
          value={value.reps}
          step={1}
          min={1}
          onChange={(r) => onChange({ ...value, reps: Math.round(r) })}
          label="reps"
        />
      </div>
      <SetCheck done={done} disabled={value.weight === null || value.reps === null} onTap={onComplete} />
    </div>
  )
}

function SetCheck({ done, disabled, onTap }: { done: boolean; disabled: boolean; onTap: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      transition={spring}
      disabled={done || disabled}
      onClick={onTap}
      className={`w-11 h-11 rounded-btn flex items-center justify-center ${
        done ? 'bg-ink text-white' : 'bg-inset text-faint'
      } disabled:opacity-60`}
      aria-label="complete set"
    >
      <AnimatePresence mode="wait">
        <motion.svg
          key={done ? 'done' : 'todo'}
          initial={{ scale: done ? 0.4 : 1, opacity: done ? 0 : 1 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={spring}
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 12.5l5.5 5.5L20 7" />
        </motion.svg>
      </AnimatePresence>
    </motion.button>
  )
}
