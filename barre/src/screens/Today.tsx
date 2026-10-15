import { Spark } from '../components/charts';
import { addDays, kindOf, risk, rpeOf, zoneShare } from '../lib/load';
import type { Dataset, DayPoint, Tag } from '../lib/types';

interface Props {
  data: Dataset;
  series: DayPoint[];
  tags: Record<string, Tag>;
  today: string;
}

const STATUS_TEXT: Record<string, [string, string]> = {
  spike: ['bad', 'Load spike — this week is >1.5× your 4-week norm. Injury risk is highest here; trim volume or add a rest day.'],
  high: ['warn', 'Ramping fast (1.3–1.5×). Fine for a deliberate build, not for a show week on top of it.'],
  ok: ['good', 'Load is in your sweet spot (0.8–1.3× your 4-week norm).'],
  low: ['muted', 'Below your 4-week norm — you’re detraining or tapering. Intended?'],
  unknown: ['muted', 'Need 28 days of history for a load ratio.'],
};

export default function Today({ data, series, tags, today }: Props) {
  const r = risk(series);
  const rs = risk(series, 'srpe');
  const last = series[series.length - 1];
  const form = last ? last.ctl - last.atl : 0;
  const [cls, text] = STATUS_TEXT[r.status];

  // resting HR: latest 7-day mean vs prior 28-day mean (wellness, else per-activity)
  const rhr = data.wellness.filter((w) => w.restingHr != null).sort((a, b) => a.date.localeCompare(b.date));
  const recent = rhr.filter((w) => w.date > addDays(today, -7)).map((w) => w.restingHr as number);
  const base = rhr.filter((w) => w.date <= addDays(today, -7) && w.date > addDays(today, -35)).map((w) => w.restingHr as number);
  const avg = (a: number[]) => a.reduce((t, x) => t + x, 0) / a.length;
  const rhrDelta = recent.length && base.length ? avg(recent) - avg(base) : null;

  const recentSessions = data.sessions
    .filter((s) => s.date > addDays(today, -7))
    .sort((a, b) => b.date.localeCompare(a.date));
  const hardMin = recentSessions.reduce((t, s) => t + (zoneShare(s.zones).high + zoneShare(s.zones).mid) * s.durationMin, 0);
  const rated = recentSessions.filter((s) => rpeOf(s, tags) != null).length;

  return (
    <>
      <section className={`card status ${cls}`}>
        <h2>Training load</h2>
        <div className="big">{r.acwr != null ? r.acwr.toFixed(2) : '—'}<small> acute : chronic</small></div>
        <p>{text}</p>
      </section>

      <section className="grid">
        <div className="card"><h3>Fitness</h3><div className="num">{Math.round(last?.ctl ?? 0)}</div><Spark values={series.slice(-42).map((d) => d.ctl)} /><p className="muted">42-day load</p></div>
        <div className="card"><h3>Fatigue</h3><div className="num">{Math.round(last?.atl ?? 0)}</div><Spark values={series.slice(-14).map((d) => d.atl)} /><p className="muted">7-day load</p></div>
        <div className="card"><h3>Form</h3><div className={`num ${form < -20 ? 'neg' : ''}`}>{form > 0 ? '+' : ''}{Math.round(form)}</div><p className="muted">{form < -25 ? 'Very fatigued' : form < -10 ? 'Productive' : form < 5 ? 'Neutral' : 'Fresh'}</p></div>
        <div className="card"><h3>Rest days</h3><div className="num">{r.restDays7}<small>/7</small></div><p className="muted">{r.restDays7 === 0 ? 'No day off this week' : 'in the last 7 days'}</p></div>
      </section>

      <section className="card">
        <h3>Signals</h3>
        <ul className="signals">
          <li>
            <b>Monotony</b> {r.monotony != null ? r.monotony.toFixed(1) : '—'}
            <span className="muted"> — {r.monotony != null && r.monotony > 2 ? 'same load every day, no hard/easy variation (Foster: >2 is a red flag)' : 'daily load varies'}</span>
          </li>
          <li>
            <b>Resting HR</b> {rhrDelta == null ? '—' : `${rhrDelta > 0 ? '+' : ''}${rhrDelta.toFixed(1)} bpm vs 4-week baseline`}
            <span className="muted"> {rhrDelta != null && rhrDelta >= 5 ? '— elevated: poor sleep, illness or under-recovery' : ''}</span>
          </li>
          <li><b>Time at Z3+ this week</b> {Math.round(hardMin)} min</li>
          <li>
            <b>Session RPE</b> {rated}/{recentSessions.length} rated · {Math.round(rs.acute)} AU this week
            <span className="muted"> — rate sessions in the Sessions tab</span>
          </li>
        </ul>
      </section>

      <section className="card dancer-note">
        <h3>Why HR alone lies for dancers</h3>
        <p>
          Class and rehearsal are stop-start and heavy on jumps, pointe work and held positions. Mechanical load there is
          high while heart rate stays in Z1–Z2, so HR-based load <b>underestimates</b> it. Treat the HR load as the
          cardiovascular channel and add RPE as the second channel (Sessions tab).
        </p>
      </section>

      {recentSessions.length > 0 && (
        <section className="card">
          <h3>Last 7 days</h3>
          <ul className="list">
            {recentSessions.map((s) => (
              <li key={s.id}>
                <span>{s.date.slice(5)} · {s.name}</span>
                <span className="muted">{kindOf(s, tags)} · {Math.round(s.durationMin)}′ · {s.avgHr ?? '—'} bpm · load {Math.round(s.load)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
