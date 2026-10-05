export type Kind = 'class' | 'rehearsal' | 'performance' | 'cross' | 'other';

export interface Session {
  id: string;
  date: string; // YYYY-MM-DD (local)
  name: string;
  type: string; // intervals.icu activity type
  durationMin: number;
  avgHr: number | null;
  maxHr: number | null;
  zones: number[]; // seconds in Z1..Z7
  load: number; // HR-based training load (hrTSS-like) from intervals.icu
  rpe: number | null; // 1-10 from the source, if recorded
  icuCtl: number | null;
  icuAtl: number | null;
}

export interface Wellness {
  date: string;
  restingHr: number | null;
  hrv: number | null;
}

export interface Dataset {
  sessions: Session[];
  wellness: Wellness[];
  lthr: number | null;
  restingHr: number | null;
  source: 'intervals' | 'mirror';
}

export interface Tag {
  kind?: Kind;
  rpe?: number;
}

export interface DayPoint {
  date: string;
  load: number;
  srpe: number;
  ctl: number;
  atl: number;
  tsb: number;
}
