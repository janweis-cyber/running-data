import type { DayPoint, Kind, Session, Tag } from './types';

const DAY = 86_400_000;

export const toISO = (d: Date) => d.toISOString().slice(0, 10);
export const parseISO = (s: string) => new Date(s + 'T00:00:00Z');
export const addDays = (s: string, n: number) => toISO(new Date(parseISO(s).getTime() + n * DAY));
export const daysBetween = (a: string, b: string) =>
  Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / DAY);

export function rangeDays(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

const KIND_RULES: [RegExp, Kind][] = [
  [/perform|show|stage|premi[eè]re|gala/i, 'performance'],
  [/rehears|probe|répét|repet|run-?through|tech/i, 'rehearsal'],
  [/class|barre|center|centre|technique|pointe|training/i, 'class'],
  [/run|ride|swim|cycl|row|bike|walk|hike/i, 'cross'],
];

export function guessKind(s: Pick<Session, 'name' | 'type'>): Kind {
  for (const [re, k] of KIND_RULES) if (re.test(s.name)) return k;
  if (/Run|Ride|Swim|Walk|Hike|Row/.test(s.type)) return 'cross';
  return 'other';
}

export const kindOf = (s: Session, tags: Record<string, Tag>): Kind =>
  tags[s.id]?.kind ?? guessKind(s);

export const rpeOf = (s: Session, tags: Record<string, Tag>): number | null =>
  tags[s.id]?.rpe ?? s.rpe;

/** Session-RPE load (Foster): RPE x minutes. A second load channel that HR can't see (jumps, pointe, isometrics). */
export const srpeLoad = (s: Session, tags: Record<string, Tag>): number => {
  const r = rpeOf(s, tags);
  return r == null ? 0 : r * s.durationMin;
};

/**
 * Daily series with exponentially-weighted CTL (42d) / ATL (7d) — the same
 * model intervals.icu uses. Where intervals.icu reported a CTL/ATL for the last
 * session of a day we anchor to it, so history before the window is respected.
 */
export function buildSeries(
  sessions: Session[],
  tags: Record<string, Tag>,
  from: string,
  to: string,
): DayPoint[] {
  const byDay = new Map<string, Session[]>();
  for (const s of sessions) {
    const a = byDay.get(s.date) ?? [];
    a.push(s);
    byDay.set(s.date, a);
  }
  const kc = 1 - Math.exp(-1 / 42);
  const ka = 1 - Math.exp(-1 / 7);

  // seed from the latest anchored session on/before `from`
  let ctl = 0;
  let atl = 0;
  const seed = sessions
    .filter((s) => s.date <= from && s.icuCtl != null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .pop();
  if (seed) {
    const gap = Math.max(0, daysBetween(seed.date, from));
    ctl = (seed.icuCtl ?? 0) * Math.pow(1 - kc, gap);
    atl = (seed.icuAtl ?? 0) * Math.pow(1 - ka, gap);
  }

  const out: DayPoint[] = [];
  for (const date of rangeDays(from, to)) {
    const ss = byDay.get(date) ?? [];
    const load = ss.reduce((t, s) => t + s.load, 0);
    const srpe = ss.reduce((t, s) => t + srpeLoad(s, tags), 0);
    const tsb = ctl - atl; // form going INTO the day, before today's load
    ctl += (load - ctl) * kc;
    atl += (load - atl) * ka;
    const anchored = ss.filter((s) => s.icuCtl != null).pop();
    if (anchored) {
      ctl = anchored.icuCtl as number;
      atl = anchored.icuAtl as number;
    }
    out.push({ date, load, srpe, ctl, atl, tsb });
  }
  return out;
}

const sum = (a: number[]) => a.reduce((t, x) => t + x, 0);
const mean = (a: number[]) => (a.length ? sum(a) / a.length : 0);
const sd = (a: number[]) => {
  const m = mean(a);
  return Math.sqrt(mean(a.map((x) => (x - m) ** 2)));
};

export interface Risk {
  acute: number; // 7-day load
  chronic: number; // 28-day avg weekly load
  acwr: number | null;
  monotony: number | null;
  strain: number | null;
  restDays7: number;
  status: 'spike' | 'high' | 'ok' | 'low' | 'unknown';
}

/** Acute:chronic ratio, Foster monotony/strain over the trailing week ending at series' last day. */
export function risk(series: DayPoint[], key: 'load' | 'srpe' = 'load'): Risk {
  const last7 = series.slice(-7).map((d) => d[key]);
  const last28 = series.slice(-28).map((d) => d[key]);
  const acute = sum(last7);
  const chronic = last28.length >= 28 ? sum(last28) / 4 : NaN;
  const acwr = chronic > 0 ? acute / chronic : null;
  const s = sd(last7);
  const monotony = s > 0 ? mean(last7) / s : null;
  const strain = monotony != null ? acute * monotony : null;
  let status: Risk['status'] = 'unknown';
  if (acwr != null) status = acwr > 1.5 ? 'spike' : acwr > 1.3 ? 'high' : acwr < 0.8 ? 'low' : 'ok';
  return { acute, chronic: Number.isNaN(chronic) ? 0 : chronic, acwr, monotony, strain, restDays7: last7.filter((x) => x === 0).length, status };
}

export interface Zones {
  low: number; // Z1-Z2, aerobic / "on your feet"
  mid: number; // Z3
  high: number; // Z4+
}
export function zoneShare(zones: number[]): Zones {
  const t = sum(zones) || 1;
  return { low: (zones[0] + zones[1]) / t, mid: zones[2] / t, high: sum(zones.slice(3)) / t };
}

export interface WeekRow {
  start: string; // Monday
  load: number;
  srpe: number;
  hours: number;
  sessions: number;
}
export function mondayOf(date: string): string {
  const dow = (parseISO(date).getUTCDay() + 6) % 7;
  return addDays(date, -dow);
}
export function weekly(sessions: Session[], tags: Record<string, Tag>, weeks: number, today: string): WeekRow[] {
  const thisWeek = mondayOf(today);
  const rows: WeekRow[] = [];
  for (let i = weeks - 1; i >= 0; i--) rows.push({ start: addDays(thisWeek, -7 * i), load: 0, srpe: 0, hours: 0, sessions: 0 });
  const idx = new Map(rows.map((r, i) => [r.start, i]));
  for (const s of sessions) {
    const i = idx.get(mondayOf(s.date));
    if (i == null) continue;
    rows[i].load += s.load;
    rows[i].srpe += srpeLoad(s, tags);
    rows[i].hours += s.durationMin / 60;
    rows[i].sessions += 1;
  }
  return rows;
}
