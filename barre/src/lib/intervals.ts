import type { Dataset, Session, Wellness } from './types';

const API = 'https://intervals.icu/api/v1';
export const DEFAULT_MIRROR = 'https://raw.githubusercontent.com/janweis-cyber/running-data/main/index.json';

export interface Creds {
  athleteId: string;
  apiKey: string;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const zones7 = (v: unknown): number[] => {
  const a = Array.isArray(v) ? v.map((x) => (typeof x === 'number' ? x : 0)) : [];
  while (a.length < 7) a.push(0);
  return a.slice(0, 7);
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export function fromApiActivity(a: any): Session {
  return {
    id: String(a.id),
    date: String(a.start_date_local).slice(0, 10),
    name: a.name ?? 'Session',
    type: a.type ?? 'Workout',
    durationMin: Math.round(((num(a.moving_time) ?? num(a.elapsed_time) ?? 0) / 60) * 10) / 10,
    avgHr: num(a.average_heartrate),
    maxHr: num(a.max_heartrate),
    zones: zones7(a.icu_hr_zone_times),
    load: num(a.icu_training_load) ?? num(a.hr_load) ?? 0,
    rpe: num(a.icu_rpe) ?? num(a.session_rpe),
    icuCtl: num(a.icu_ctl),
    icuAtl: num(a.icu_atl),
  };
}

/** Reads the repo's `index.json` summary format (what sync.py writes). */
export function fromMirrorActivity(a: any): Session {
  return {
    id: String(a.id),
    date: String(a.date),
    name: a.name ?? 'Session',
    type: a.type ?? 'Workout',
    durationMin: num(a.duration_min) ?? 0,
    avgHr: num(a.avg_hr),
    maxHr: num(a.max_hr),
    zones: zones7(a.hr_zone_times),
    load: num(a.training_load) ?? 0,
    rpe: num(a.rpe),
    icuCtl: num(a.ctl),
    icuAtl: num(a.atl),
  };
}

const authHeader = (c: Creds) => ({ Authorization: 'Basic ' + btoa('API_KEY:' + c.apiKey) });

async function getJson(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} — ${url.split('?')[0]}`);
  return r.json();
}

export async function loadFromIntervals(c: Creds, oldest: string, newest: string): Promise<Dataset> {
  const id = encodeURIComponent(c.athleteId.trim());
  const q = `?oldest=${oldest}&newest=${newest}`;
  const h = { headers: authHeader(c) };
  const [acts, well] = await Promise.all([
    getJson(`${API}/athlete/${id}/activities${q}`, h),
    getJson(`${API}/athlete/${id}/wellness${q}`, h).catch(() => []),
  ]);
  const sessions = (acts as any[]).filter((a) => a.start_date_local).map(fromApiActivity);
  const wellness: Wellness[] = (well as any[]).map((w) => ({ date: String(w.id), restingHr: num(w.restingHR), hrv: num(w.hrv) }));
  const last = (acts as any[]).slice().sort((a, b) => String(a.start_date_local).localeCompare(b.start_date_local)).pop();
  return { sessions, wellness, lthr: num(last?.lthr), restingHr: num(last?.icu_resting_hr), source: 'intervals' };
}

export async function loadFromMirror(url: string): Promise<Dataset> {
  const j = await getJson(url);
  const raw: any[] = j.activities ?? [];
  const sessions = raw.map(fromMirrorActivity);
  const wellness: Wellness[] = raw
    .filter((a) => num(a.resting_hr))
    .map((a) => ({ date: a.date, restingHr: a.resting_hr, hrv: null }));
  const latest = raw[0];
  return { sessions, wellness, lthr: num(latest?.lthr), restingHr: num(latest?.resting_hr), source: 'mirror' };
}
