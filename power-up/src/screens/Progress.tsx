import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, SETTINGS_ID, type BodyWeight, type SetRec } from '../db/db'
import { put, newId, todayStr } from '../db/repo'
import { e1rm, computeStreak, weeklyTonnage, weekStart } from '../lib/stats'
import { Card, SyncChip, SkeletonRows, PrimaryButton } from '../components/ui'

const BW_BASELINE_KG = 66.4
const BW_TARGET_MIN_PER_MONTH = 0.2
const BW_TARGET_MAX_PER_MONTH = 0.5

export default function Progress() {
  const settings = useLiveQuery(() => db.settings.get(SETTINGS_ID))
  const sessions = useLiveQuery(() =>
    db.sessions.filter((s) => !s.deleted && !!s.completed_at).toArray(),
  )
  const sets = useLiveQuery(() => db.sets.filter((s) => !s.deleted).toArray())
  const exercises = useLiveQuery(() => db.exercises.filter((e) => !e.deleted).toArray())
  const bodyWeights = useLiveQuery(() =>
    db.body_weight
      .filter((b) => !b.deleted)
      .toArray()
      .then((a) => a.sort((x, y) => x.date.localeCompare(y.date))),
  )
  const rotation = useLiveQuery(() => db.rotation.filter((r) => !r.deleted).toArray())
  const tonnage = useLiveQuery(async () => {
    const s = await db.settings.get(SETTINGS_ID)
    return s ? weeklyTonnage(s.week_start) : 0
  })

  const [selectedLift, setSelectedLift] = useState<string | null>(null)

  // Per-exercise chronological session bests (for PRs + chart)
  const liftSeries = useMemo(() => {
    if (!sessions || !sets) return new Map<string, { date: string; e1rm: number }[]>()
    const byId = new Map(sessions.map((s) => [s.id, s]))
    const perLift = new Map<string, Map<string, number>>() // exercise → date → best e1rm
    for (const s of sets) {
      const session = byId.get(s.session_id)
      if (!session) continue
      let m = perLift.get(s.exercise_id)
      if (!m) {
        m = new Map()
        perLift.set(s.exercise_id, m)
      }
      const v = e1rm(s.weight_kg, s.reps)
      if (v > (m.get(session.date) ?? 0)) m.set(session.date, v)
    }
    const out = new Map<string, { date: string; e1rm: number }[]>()
    for (const [ex, m] of perLift) {
      out.set(
        ex,
        [...m.entries()].map(([date, v]) => ({ date, e1rm: v })).sort((a, b) => a.date.localeCompare(b.date)),
      )
    }
    return out
  }, [sessions, sets])

  // Latest PR across all lifts
  const latestPR = useMemo(() => {
    if (!exercises) return null
    let best: { name: string; date: string; value: number; delta: number } | null = null
    for (const [exId, series] of liftSeries) {
      let runningBest = 0
      let pr: { date: string; value: number; delta: number } | null = null
      for (const p of series) {
        if (p.e1rm > runningBest) {
          if (runningBest > 0) pr = { date: p.date, value: p.e1rm, delta: p.e1rm - runningBest }
          runningBest = p.e1rm
        }
      }
      if (pr && (!best || pr.date > best.date)) {
        const ex = exercises.find((e) => e.id === exId)
        if (ex) best = { name: ex.name, ...pr }
      }
    }
    return best
  }, [liftSeries, exercises])

  if (!settings || !sessions || !sets || !exercises || !bodyWeights || !rotation) {
    return (
      <div className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <SkeletonRows n={5} />
      </div>
    )
  }

  const streak = computeStreak(sessions, settings.week_start)
  const thisWeekStart = weekStart(new Date(), settings.week_start)
  const sessionsThisWeek = sessions.filter(
    (s) => new Date(s.date + 'T12:00:00') >= thisWeekStart,
  ).length
  const cadence = Math.max(rotation.length, 1)

  const liftsWithData = exercises
    .filter((e) => (liftSeries.get(e.id)?.length ?? 0) >= 2)
    .sort((a, b) => (liftSeries.get(b.id)?.length ?? 0) - (liftSeries.get(a.id)?.length ?? 0))
  const chartLift = selectedLift ?? liftsWithData[0]?.id ?? null
  const chartSeries = chartLift ? (liftSeries.get(chartLift) ?? []) : []

  return (
    <div className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between mb-5">
        <h1 className="text-[22px] font-bold text-ink">Progress</h1>
        <SyncChip />
      </header>

      {/* PR card — quiet blue left rule, no glow, no confetti */}
      {latestPR && (
        <Card className="p-4 mb-4 border-l-2 border-l-accent">
          <div className="text-[11px] font-medium text-faint uppercase tracking-wider mb-1">
            Latest PR
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-[16px] font-semibold text-ink">{latestPR.name}</span>
            <span className="text-[16px] font-semibold text-ink">
              {latestPR.value.toFixed(1)} kg
              <span className="text-accent text-[13px] ml-1.5">
                ↑ {latestPR.delta.toFixed(1)}
              </span>
            </span>
          </div>
          <div className="text-[12px] text-sub mt-0.5">
            e1RM ·{' '}
            {new Date(latestPR.date + 'T12:00:00').toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
            })}
          </div>
        </Card>
      )}

      {/* Stat row */}
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <Card className="p-3 text-center">
          <div className="text-[19px] font-bold text-ink">
            {sessionsThisWeek}
            <span className="text-[13px] text-faint font-medium">/{cadence}</span>
          </div>
          <div className="text-[11px] text-sub mt-0.5">this week</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-[19px] font-bold text-ink">
            {tonnage !== undefined ? (tonnage >= 1000 ? `${(tonnage / 1000).toFixed(1)}t` : Math.round(tonnage)) : '—'}
          </div>
          <div className="text-[11px] text-sub mt-0.5">kg this week</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-[19px] font-bold text-ink">{streak}</div>
          <div className="text-[11px] text-sub mt-0.5">wk streak</div>
        </Card>
      </div>

      {/* e1RM chart */}
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] font-medium text-faint uppercase tracking-wider">
            e1RM · 6 months
          </div>
        </div>
        {liftsWithData.length > 0 ? (
          <>
            <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 -mx-1 px-1">
              {liftsWithData.slice(0, 8).map((e) => (
                <button
                  key={e.id}
                  onClick={() => setSelectedLift(e.id)}
                  className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-medium ${
                    chartLift === e.id ? 'bg-ink text-white' : 'bg-inset text-sub'
                  }`}
                >
                  {e.name}
                </button>
              ))}
            </div>
            <LineChart
              points={chartSeries
                .filter((p) => monthsAgo(p.date) <= 6)
                .map((p) => ({ x: new Date(p.date + 'T12:00:00').getTime(), y: p.e1rm }))}
              unit="kg"
            />
          </>
        ) : (
          <div className="text-[13px] text-faint py-6 text-center">
            Charts appear after two sessions of a lift.
          </div>
        )}
      </Card>

      {/* Body weight */}
      <Card className="p-4 mb-4">
        <div className="text-[11px] font-medium text-faint uppercase tracking-wider mb-3">
          Body weight
        </div>
        {bodyWeights.length >= 2 ? (
          <BodyWeightChart data={bodyWeights.map((b) => ({ date: b.date, kg: b.kg }))} />
        ) : (
          <div className="text-[13px] text-faint py-4 text-center">
            Log weigh-ins to see the trend against the +0.2–0.5 kg/month band.
          </div>
        )}
        <WeighIn />
      </Card>
    </div>
  )
}

function monthsAgo(date: string): number {
  return (Date.now() - new Date(date + 'T12:00:00').getTime()) / (30.44 * 24 * 3600 * 1000)
}

// ---------------------------------------------------------------------------
// Hand-rolled SVG line chart
// ---------------------------------------------------------------------------
const W = 320
const H = 140
const PAD = { l: 34, r: 8, t: 8, b: 18 }

function scale(points: { x: number; y: number }[]) {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const yMin = Math.min(...ys)
  const yMax = Math.max(...ys)
  const pad = Math.max((yMax - yMin) * 0.15, 1)
  const y0 = yMin - pad
  const y1 = yMax + pad
  const sx = (x: number) => PAD.l + ((x - x0) / Math.max(x1 - x0, 1)) * (W - PAD.l - PAD.r)
  const sy = (y: number) => PAD.t + (1 - (y - y0) / (y1 - y0)) * (H - PAD.t - PAD.b)
  return { sx, sy, y0, y1, x0, x1 }
}

function LineChart({ points, unit }: { points: { x: number; y: number }[]; unit: string }) {
  if (points.length < 2) {
    return <div className="text-[13px] text-faint py-6 text-center">Not enough data yet.</div>
  }
  const { sx, sy, y0, y1 } = scale(points)
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ')
  const ticks = [y0 + (y1 - y0) * 0.15, (y0 + y1) / 2, y1 - (y1 - y0) * 0.15]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} stroke="#E5E5E0" strokeWidth="1" />
          <text x={PAD.l - 5} y={sy(t) + 3} textAnchor="end" fontSize="9" fill="#A6A69E">
            {Math.round(t)}
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke="#0B5FCC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="2.5" fill="#0B5FCC" />
      ))}
      <text x={W - PAD.r} y={H - 4} textAnchor="end" fontSize="9" fill="#A6A69E">
        {unit}
      </text>
    </svg>
  )
}

// Body-weight chart with target band from the 66.4 kg baseline
function BodyWeightChart({ data }: { data: { date: string; kg: number }[] }) {
  const pts = data.map((d) => ({ x: new Date(d.date + 'T12:00:00').getTime(), y: d.kg }))
  const baseT = pts[0].x
  const MONTH = 30.44 * 24 * 3600 * 1000
  // Include band endpoints in the scale
  const lastT = pts[pts.length - 1].x
  const months = (lastT - baseT) / MONTH
  const bandPts = [
    { x: baseT, y: BW_BASELINE_KG },
    { x: lastT, y: BW_BASELINE_KG + months * BW_TARGET_MIN_PER_MONTH },
    { x: lastT, y: BW_BASELINE_KG + months * BW_TARGET_MAX_PER_MONTH },
  ]
  const { sx, sy, y0, y1 } = scale([...pts, ...bandPts])
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ')
  const band = `M${sx(baseT)},${sy(BW_BASELINE_KG)} L${sx(lastT)},${sy(BW_BASELINE_KG + months * BW_TARGET_MIN_PER_MONTH)} L${sx(lastT)},${sy(BW_BASELINE_KG + months * BW_TARGET_MAX_PER_MONTH)} Z`
  const ticks = [y0 + (y1 - y0) * 0.15, (y0 + y1) / 2, y1 - (y1 - y0) * 0.15]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} stroke="#E5E5E0" strokeWidth="1" />
          <text x={PAD.l - 5} y={sy(t) + 3} textAnchor="end" fontSize="9" fill="#A6A69E">
            {t.toFixed(1)}
          </text>
        </g>
      ))}
      <path d={band} fill="#0B5FCC" opacity="0.08" />
      <path d={path} fill="none" stroke="#0B5FCC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="2.5" fill="#0B5FCC" />
      ))}
    </svg>
  )
}

// Friday weigh-in quick-entry
function WeighIn() {
  const [value, setValue] = useState('')
  const isFriday = new Date().getDay() === 5
  const today = todayStr()
  const existing = useLiveQuery(() => db.body_weight.where('date').equals(today).filter((b) => !b.deleted).first(), [today])

  return (
    <div className={`mt-3 rounded-btn px-3.5 py-3 ${isFriday ? 'bg-accent/5 border border-accent/20' : 'bg-inset'}`}>
      <div className="text-[12px] font-medium text-sub mb-2">
        {isFriday ? 'Friday weigh-in' : 'Log weigh-in'}
        {existing && <span className="text-accent ml-2">✓ {existing.kg} kg today</span>}
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="kg"
          className="flex-1 bg-card border border-hairline rounded-btn px-3.5 py-2.5 text-[15px] text-ink placeholder:text-faint outline-none focus:border-faint"
        />
        <PrimaryButton
          className="!py-2.5"
          disabled={!value || isNaN(parseFloat(value))}
          onClick={async () => {
            const kg = parseFloat(value)
            if (isNaN(kg)) return
            if (existing) {
              await put<BodyWeight>('body_weight', { ...existing, kg })
            } else {
              await put<BodyWeight>('body_weight', { id: newId(), date: today, kg })
            }
            setValue('')
          }}
        >
          Save
        </PrimaryButton>
      </div>
    </div>
  )
}
