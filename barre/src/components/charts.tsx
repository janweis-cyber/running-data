import type { WeekRow } from '../lib/load';
import type { DayPoint } from '../lib/types';

type Pt = DayPoint;

const W = 640;

function scale(min: number, max: number, a: number, b: number) {
  const span = max - min || 1;
  return (v: number) => a + ((v - min) / span) * (b - a);
}

/** Performance-management chart: daily load bars, CTL (fitness), ATL (fatigue), TSB (form) as a band underneath. */
export function PmcChart({ data }: { data: Pt[] }) {
  if (data.length < 2) return null;
  const H = 260;
  const top = 8;
  const split = 190; // y where the form panel starts
  const maxY = Math.max(10, ...data.map((d) => Math.max(d.ctl, d.atl, d.load)));
  const x = scale(0, data.length - 1, 36, W - 8);
  const y = scale(0, maxY, split - 14, top);
  const tsbMax = Math.max(10, ...data.map((d) => Math.abs(d.tsb)));
  const yf = scale(-tsbMax, tsbMax, H - 6, split + 8);
  const line = (k: 'ctl' | 'atl') => data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join(' ');
  const bw = Math.max(1, (W - 44) / data.length - 1);
  const ticks = [0, maxY / 2, maxY].map(Math.round);
  const dateTicks = [0, Math.floor(data.length / 2), data.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Fitness, fatigue and form over time" className="chart">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={36} x2={W - 8} y1={y(t)} y2={y(t)} className="grid" />
          <text x={32} y={y(t) + 4} textAnchor="end" className="axis">{t}</text>
        </g>
      ))}
      {data.map((d, i) => d.load > 0 && (
        <rect key={d.date} x={x(i) - bw / 2} y={y(d.load)} width={bw} height={y(0) - y(d.load)} className="bar" />
      ))}
      <path d={line('ctl')} className="ln ctl" fill="none" />
      <path d={line('atl')} className="ln atl" fill="none" />
      <line x1={36} x2={W - 8} y1={yf(0)} y2={yf(0)} className="grid" />
      {data.map((d, i) => (
        <rect key={'f' + d.date} x={x(i) - bw / 2} width={bw}
          y={Math.min(yf(0), yf(d.tsb))} height={Math.abs(yf(d.tsb) - yf(0))}
          className={d.tsb >= 0 ? 'form-pos' : 'form-neg'} />
      ))}
      <text x={32} y={yf(0) + 4} textAnchor="end" className="axis">0</text>
      <text x={40} y={split + 4} className="axis">Form (fitness − fatigue)</text>
      {dateTicks.map((i) => (
        <text key={i} x={x(i)} y={H - 0} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} className="axis">
          {data[i].date.slice(5)}
        </text>
      ))}
    </svg>
  );
}

export function WeekBars({ rows, metric }: { rows: WeekRow[]; metric: 'load' | 'srpe' | 'hours' }) {
  const H = 150;
  const max = Math.max(1, ...rows.map((r) => r[metric]));
  const bw = (W - 40) / rows.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Weekly ${metric}`} className="chart">
      {rows.map((r, i) => {
        const h = (r[metric] / max) * (H - 36);
        const cur = i === rows.length - 1;
        return (
          <g key={r.start}>
            <rect x={20 + i * bw + 4} y={H - 20 - h} width={bw - 8} height={Math.max(h, 1)} rx={3} className={cur ? 'bar cur' : 'bar'} />
            <text x={20 + i * bw + bw / 2} y={H - 22 - h} textAnchor="middle" className="axis">
              {metric === 'hours' ? r[metric].toFixed(1) : Math.round(r[metric])}
            </text>
            <text x={20 + i * bw + bw / 2} y={H - 5} textAnchor="middle" className="axis">{r.start.slice(5)}</text>
          </g>
        );
      })}
    </svg>
  );
}

const ZONE_NAMES = ['Z1 recovery', 'Z2 aerobic', 'Z3 tempo', 'Z4 threshold', 'Z5 VO₂', 'Z6 anaerobic', 'Z7 max'];

export function ZoneBar({ zones }: { zones: number[] }) {
  const total = zones.reduce((a, b) => a + b, 0) || 1;
  return (
    <div>
      <div className="zonebar" role="img" aria-label="Time in HR zones">
        {zones.map((z, i) => z > 0 && <span key={i} className={`z z${i + 1}`} style={{ flexGrow: z }} title={`${ZONE_NAMES[i]} ${Math.round(z / 60)} min`} />)}
      </div>
      <ul className="zlegend">
        {zones.map((z, i) => z > 0 && (
          <li key={i}><i className={`dot z${i + 1}`} />{ZONE_NAMES[i]} <b>{Math.round(z / 60)}′</b> <span className="muted">{Math.round((z / total) * 100)}%</span></li>
        ))}
      </ul>
    </div>
  );
}

export function Spark({ values, width = 120, height = 28 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const x = scale(0, values.length - 1, 1, width - 1);
  const y = scale(min, max, height - 2, 2);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden>
      <path d={values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} className="ln ctl" fill="none" />
    </svg>
  );
}
