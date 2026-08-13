import { useLiveQuery } from 'dexie-react-hooks'
import { db, SETTINGS_ID } from '../db/db'
import { weekStart } from '../lib/stats'
import { Card, SyncChip, SkeletonRows } from '../components/ui'
import { useNav } from '../App'

export default function History() {
  const nav = useNav()
  const sessions = useLiveQuery(() =>
    db.sessions
      .filter((s) => !s.deleted && !!s.completed_at)
      .toArray()
      .then((arr) => arr.sort((a, b) => b.date.localeCompare(a.date))),
  )
  const templates = useLiveQuery(() => db.session_templates.toArray())
  const settings = useLiveQuery(() => db.settings.get(SETTINGS_ID))
  const allSets = useLiveQuery(() => db.sets.filter((s) => !s.deleted).toArray())

  if (!sessions || !templates || !settings || !allSets) {
    return (
      <div className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <SkeletonRows n={5} />
      </div>
    )
  }

  const tmplOf = (id: string) => templates.find((t) => t.id === id)

  return (
    <div className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between mb-5">
        <h1 className="text-[22px] font-bold text-ink">History</h1>
        <SyncChip />
      </header>

      <Card className="p-4 mb-4">
        <div className="text-[11px] font-medium text-faint uppercase tracking-wider mb-3">
          Last 26 weeks
        </div>
        <HeatStrip
          dates={sessions.map((s) => s.date)}
          weekStartsOn={settings.week_start}
        />
      </Card>

      <div className="space-y-2.5">
        {sessions.map((s) => {
          const t = tmplOf(s.template_id)
          const setCount = allSets.filter((x) => x.session_id === s.id).length
          return (
            <button
              key={s.id}
              className="w-full text-left"
              onClick={() => nav.push({ name: 'sessionDetail', sessionId: s.id })}
            >
              <Card className="p-4 flex items-center gap-3">
                <span className="w-9 h-9 rounded-btn bg-inset text-ink flex items-center justify-center text-[15px] font-bold">
                  {t?.label ?? '?'}
                </span>
                <div className="flex-1">
                  <div className="text-[15px] font-semibold text-ink">{t?.name ?? 'Session'}</div>
                  <div className="text-[13px] text-sub">
                    {new Date(s.date + 'T12:00:00').toLocaleDateString(undefined, {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                    {' · '}
                    {setCount} sets
                  </div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A6A69E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7"/></svg>
              </Card>
            </button>
          )
        })}
        {sessions.length === 0 && (
          <div className="text-[14px] text-faint text-center py-10">
            Completed sessions will appear here.
          </div>
        )}
      </div>
    </div>
  )
}

// Calendar heat strip: 26 columns (weeks), 7 rows (days).
function HeatStrip({
  dates,
  weekStartsOn,
}: {
  dates: string[]
  weekStartsOn: 'monday' | 'sunday'
}) {
  const WEEKS = 26
  const counts = new Map<string, number>()
  for (const d of dates) counts.set(d, (counts.get(d) ?? 0) + 1)

  const thisWeek = weekStart(new Date(), weekStartsOn)
  const cells: { key: string; count: number; future: boolean }[][] = []
  for (let w = WEEKS - 1; w >= 0; w--) {
    const col: { key: string; count: number; future: boolean }[] = []
    for (let d = 0; d < 7; d++) {
      const day = new Date(thisWeek)
      day.setDate(day.getDate() - w * 7 + d)
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
      col.push({ key, count: counts.get(key) ?? 0, future: day > new Date() })
    }
    cells.push(col)
  }

  return (
    <div className="flex gap-[3px] overflow-x-auto">
      {cells.map((col, i) => (
        <div key={i} className="flex flex-col gap-[3px]">
          {col.map((c) => (
            <div
              key={c.key}
              className={`w-[9px] h-[9px] rounded-[2.5px] ${
                c.future ? 'bg-transparent' : c.count > 0 ? 'bg-accent' : 'bg-inset'
              }`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
