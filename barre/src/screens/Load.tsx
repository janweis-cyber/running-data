import { useState } from 'react';
import { PmcChart, WeekBars } from '../components/charts';
import { kindOf, weekly, zoneShare } from '../lib/load';
import { addDays } from '../lib/load';
import type { Dataset, DayPoint, Kind, Tag } from '../lib/types';

const RANGES = [42, 90, 180, 365] as const;
const METRICS = { load: 'HR load', srpe: 'RPE load (sRPE)', hours: 'Hours' } as const;

export default function Load({ data, series, tags, today }: { data: Dataset; series: DayPoint[]; tags: Record<string, Tag>; today: string }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(90);
  const [metric, setMetric] = useState<keyof typeof METRICS>('load');
  const weeks = weekly(data.sessions, tags, 12, today);

  const since = addDays(today, -28);
  const byKind = new Map<Kind, { min: number; load: number; n: number }>();
  let low = 0, mid = 0, high = 0;
  for (const s of data.sessions.filter((x) => x.date > since)) {
    const k = kindOf(s, tags);
    const e = byKind.get(k) ?? { min: 0, load: 0, n: 0 };
    e.min += s.durationMin; e.load += s.load; e.n += 1;
    byKind.set(k, e);
    const z = zoneShare(s.zones);
    low += z.low * s.durationMin; mid += z.mid * s.durationMin; high += z.high * s.durationMin;
  }
  const tot = low + mid + high || 1;

  return (
    <>
      <section className="card">
        <div className="row">
          <h2>Fitness · Fatigue · Form</h2>
          <div className="seg">{RANGES.map((r) => <button key={r} className={r === range ? 'on' : ''} onClick={() => setRange(r)}>{r}d</button>)}</div>
        </div>
        <PmcChart data={series.slice(-range)} />
        <p className="legend"><i className="dot ctl" />Fitness (CTL) <i className="dot atl" />Fatigue (ATL) <i className="dot bar" />Daily load <i className="dot form-pos" />Form</p>
      </section>

      <section className="card">
        <div className="row">
          <h2>Weekly</h2>
          <div className="seg">{(Object.keys(METRICS) as (keyof typeof METRICS)[]).map((m) => <button key={m} className={m === metric ? 'on' : ''} onClick={() => setMetric(m)}>{METRICS[m]}</button>)}</div>
        </div>
        <WeekBars rows={weeks} metric={metric} />
        {metric === 'srpe' && <p className="muted">Only sessions with an RPE count. Rate them in the Sessions tab.</p>}
      </section>

      <section className="card">
        <h2>Last 28 days</h2>
        <h3>Intensity distribution</h3>
        <div className="zonebar">
          <span className="z z1" style={{ flexGrow: low }} /><span className="z z3" style={{ flexGrow: mid }} /><span className="z z5" style={{ flexGrow: high }} />
        </div>
        <p className="muted">Z1–2 {Math.round((low / tot) * 100)}% · Z3 {Math.round((mid / tot) * 100)}% · Z4+ {Math.round((high / tot) * 100)}%</p>
        <h3>By session type</h3>
        <ul className="list">
          {[...byKind.entries()].sort((a, b) => b[1].load - a[1].load).map(([k, v]) => (
            <li key={k}><span>{k}</span><span className="muted">{v.n} sessions · {(v.min / 60).toFixed(1)} h · load {Math.round(v.load)}</span></li>
          ))}
        </ul>
      </section>
    </>
  );
}
