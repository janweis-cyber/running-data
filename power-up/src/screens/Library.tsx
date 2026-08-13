import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Exercise, type Folder, type TemplateExercise } from '../db/db'
import { put, patch, newId } from '../db/repo'
import { addedCostSec, totalCostSec, BUDGET_SEC } from '../lib/budget'
import { Card, MusclePill, Sheet, PrimaryButton, Stepper, SkeletonRows } from '../components/ui'
import { useNav } from '../App'

const FOLDERS: Folder[] = ['Hamstrings', 'Quads & Glutes', 'Push', 'Pull', 'Core', 'Calves', 'Custom']

export default function Library({
  templateId,
  mode,
  swapTeId,
  scopeFolder,
}: {
  templateId: string
  mode: 'add' | 'swap'
  swapTeId?: string
  scopeFolder?: Folder
}) {
  const nav = useNav()
  const [query, setQuery] = useState('')
  // Swap opens scoped to the same folder first; user can back out to all.
  const [folder, setFolder] = useState<Folder | null>(scopeFolder ?? null)
  const [customOpen, setCustomOpen] = useState(false)

  const exercises = useLiveQuery(() => db.exercises.filter((e) => !e.deleted).toArray())
  const rows = useLiveQuery(
    () =>
      db.template_exercises
        .where('template_id')
        .equals(templateId)
        .filter((r) => !r.deleted)
        .sortBy('position'),
    [templateId],
  )

  const currentTotal = rows ? totalCostSec(rows) : 0

  const filtered = useMemo(() => {
    if (!exercises) return []
    const q = query.trim().toLowerCase()
    if (q) return exercises.filter((e) => e.name.toLowerCase().includes(q))
    if (folder) return exercises.filter((e) => e.folder === folder)
    return []
  }, [exercises, query, folder])

  if (!exercises || !rows) {
    return (
      <div className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <SkeletonRows n={6} />
      </div>
    )
  }

  const pick = async (ex: Exercise) => {
    if (mode === 'swap' && swapTeId) {
      await patch<TemplateExercise>('template_exercises', swapTeId, {
        exercise_id: ex.id,
        sets: ex.default_sets,
        rep_min: ex.rep_min,
        rep_max: ex.rep_max,
        rest_sec: ex.rest_sec,
      })
    } else {
      await put<TemplateExercise>('template_exercises', {
        id: newId(),
        template_id: templateId,
        exercise_id: ex.id,
        position: rows.length,
        sets: ex.default_sets,
        rep_min: ex.rep_min,
        rep_max: ex.rep_max,
        rest_sec: ex.rest_sec,
        superset_group: null,
      })
    }
    nav.back()
  }

  const showingList = query.trim() !== '' || folder !== null

  return (
    <div className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="flex items-center gap-3 mb-4">
        <button
          onClick={() => {
            if (folder && !query && !scopeFolder) setFolder(null)
            else nav.back()
          }}
          className="w-9 h-9 rounded-btn bg-inset flex items-center justify-center"
          aria-label="back"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#141412" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7"/></svg>
        </button>
        <h1 className="text-[19px] font-bold text-ink">
          {mode === 'swap' ? 'Swap exercise' : 'Add exercise'}
        </h1>
      </header>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search exercises"
        className="w-full bg-card border border-hairline rounded-btn px-4 py-3 text-[15px] text-ink placeholder:text-faint mb-4 outline-none focus:border-faint"
      />

      {!showingList ? (
        // App Library-style two-column folder grid
        <div className="grid grid-cols-2 gap-3">
          {FOLDERS.map((f) => {
            const inFolder = exercises.filter((e) => e.folder === f)
            return (
              <button key={f} onClick={() => setFolder(f)} className="text-left">
                <Card className="p-3.5 h-full">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-[14px] font-semibold text-ink">{f}</span>
                    <span className="text-[12px] text-faint">{inFolder.length}</span>
                  </div>
                  <div className="space-y-0.5">
                    {inFolder.slice(0, 3).map((e) => (
                      <div key={e.id} className="text-[12px] text-sub truncate">
                        {e.name}
                      </div>
                    ))}
                    {f === 'Custom' && (
                      <div className="text-[12px] text-accent font-medium">New…</div>
                    )}
                  </div>
                </Card>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="space-y-2.5">
          {scopeFolder && folder === scopeFolder && !query && (
            <button
              className="text-[13px] text-accent font-medium mb-1"
              onClick={() => setFolder(null)}
            >
              Browse all folders →
            </button>
          )}
          {folder === 'Custom' && !query && (
            <button className="w-full" onClick={() => setCustomOpen(true)}>
              <Card className="p-3.5 flex items-center gap-3">
                <span className="w-9 h-9 rounded-btn bg-inset text-accent flex items-center justify-center text-xl font-medium">+</span>
                <span className="text-[15px] font-semibold text-accent">New custom exercise…</span>
              </Card>
            </button>
          )}
          {filtered.map((ex) => {
            const delta = addedCostSec(rows, ex.default_sets, ex.rest_sec)
            const newTotal = currentTotal + delta
            return (
              <Card key={ex.id} className="p-3.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-semibold text-ink truncate">{ex.name}</div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <MusclePill muscle={ex.primary_muscle} primary />
                    {ex.secondary_muscle && <MusclePill muscle={ex.secondary_muscle} />}
                    <span className="text-[12px] text-sub">
                      {ex.default_sets}×{ex.rep_min}–{ex.rep_max}
                    </span>
                  </div>
                  <div className={`text-[12px] mt-1 ${newTotal > BUDGET_SEC ? 'text-warn' : 'text-sub'}`}>
                    +{Math.round(delta / 60)} min → {Math.round(newTotal / 60)} min total
                  </div>
                </div>
                <button
                  onClick={() => void pick(ex)}
                  className="w-11 h-11 rounded-btn bg-ink text-white flex items-center justify-center text-xl font-medium shrink-0"
                  aria-label={`add ${ex.name}`}
                >
                  +
                </button>
              </Card>
            )
          })}
          {filtered.length === 0 && (
            <div className="text-[14px] text-faint text-center py-8">No exercises found.</div>
          )}
        </div>
      )}

      <CustomExerciseSheet
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        onSaved={(ex) => {
          setCustomOpen(false)
          void pick(ex)
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Custom exercise bottom sheet — live time estimate, fully progression-enabled
// ---------------------------------------------------------------------------
const MUSCLES = ['Quads', 'Glutes', 'Hamstrings', 'Calves', 'Chest', 'Shoulders', 'Triceps', 'Lats', 'Back', 'Biceps', 'Core', 'Forearms']

export function CustomExerciseSheet({
  open,
  onClose,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  onSaved: (ex: Exercise) => void
}) {
  const [name, setName] = useState('')
  const [primary, setPrimary] = useState<string | null>(null)
  const [secondary, setSecondary] = useState<string | null>(null)
  const [sets, setSets] = useState(3)
  const [repMin, setRepMin] = useState(8)
  const [repMax, setRepMax] = useState(12)
  const [rest, setRest] = useState(90)
  const [increment, setIncrement] = useState(2.5)
  const [equipment, setEquipment] = useState('')

  const estimate = addedCostSec([], sets, rest)

  const save = async () => {
    if (!name.trim() || !primary) return
    const ex = await put<Exercise>('exercises', {
      id: newId(),
      name: name.trim(),
      primary_muscle: primary,
      secondary_muscle: secondary,
      folder: 'Custom',
      equipment: equipment.trim() || 'Other',
      default_sets: sets,
      rep_min: repMin,
      rep_max: repMax,
      rest_sec: rest,
      increment_kg: increment,
      is_custom: 1,
      deload_pending: 0,
    })
    onSaved(ex)
  }

  return (
    <Sheet open={open} onClose={onClose} title="New custom exercise">
      <div className="space-y-4 pt-2 pb-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Exercise name"
          className="w-full bg-card border border-hairline rounded-btn px-4 py-3 text-[15px] text-ink placeholder:text-faint outline-none focus:border-faint"
        />

        <div>
          <div className="text-[12px] font-medium text-sub mb-2">Primary muscle</div>
          <div className="flex flex-wrap gap-1.5">
            {MUSCLES.map((m) => (
              <button
                key={m}
                onClick={() => setPrimary(m)}
                className={`rounded-full px-3 py-1.5 text-[13px] font-medium ${
                  primary === m ? 'bg-ink text-white' : 'bg-inset text-sub'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[12px] font-medium text-sub mb-2">Secondary (optional)</div>
          <div className="flex flex-wrap gap-1.5">
            {MUSCLES.filter((m) => m !== primary).map((m) => (
              <button
                key={m}
                onClick={() => setSecondary(secondary === m ? null : m)}
                className={`rounded-full px-3 py-1.5 text-[13px] font-medium ${
                  secondary === m ? 'bg-ink text-white' : 'bg-inset text-sub'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[13px] text-sub">Sets</span>
          <Stepper value={sets} step={1} min={1} onChange={(v) => setSets(Math.round(v))} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-sub">Rep range</span>
          <div className="flex items-center gap-2">
            <Stepper value={repMin} step={1} min={1} onChange={(v) => setRepMin(Math.min(Math.round(v), repMax))} />
            <span className="text-faint">–</span>
            <Stepper value={repMax} step={1} min={1} onChange={(v) => setRepMax(Math.max(Math.round(v), repMin))} />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-sub">Rest</span>
          <Stepper value={rest} step={15} min={15} onChange={(v) => setRest(v)} format={(v) => `${v}s`} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-sub">Increment step</span>
          <Stepper value={increment} step={1.25} min={1.25} onChange={(v) => setIncrement(v)} format={(v) => `${v} kg`} />
        </div>

        <input
          value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
          placeholder="Equipment (optional)"
          className="w-full bg-card border border-hairline rounded-btn px-4 py-3 text-[15px] text-ink placeholder:text-faint outline-none focus:border-faint"
        />

        <div className="flex items-center justify-between rounded-btn bg-inset px-4 py-3">
          <span className="text-[13px] text-sub">Time cost in a session</span>
          <span className="text-[15px] font-semibold text-accent">
            ≈ {Math.round(estimate / 60)} min
          </span>
        </div>

        <PrimaryButton className="w-full" disabled={!name.trim() || !primary} onClick={() => void save()}>
          Save exercise
        </PrimaryButton>
      </div>
    </Sheet>
  )
}
