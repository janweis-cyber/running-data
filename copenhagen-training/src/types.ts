export interface ActivitySummary {
  id: string;
  date: string;
  name: string;
  distance_km: number;
  avg_hr: number;
  avg_pace_km: number;
  elevation_m: number;
  training_load: number;
  type?: string;
}

export interface IcuGroup {
  average_heartrate: number;
  gap: number;
  count: number;
  average_speed: number;
}

export interface IcuInterval {
  type: 'WORK' | 'RECOVERY';
  average_heartrate: number;
  gap: number;
  average_speed: number;
  distance: number;
}

export interface ActivityCore {
  average_heartrate: number;
  gap: number;
  average_temp?: number;
}

export interface ActivityDetail {
  activity: ActivityCore;
  laps: {
    icu_groups: IcuGroup[];
    icu_intervals: IcuInterval[];
  };
}

export interface WeekData {
  weekNum: number;
  startDate: string;
  endDate: string;
  tuesday?: ActivitySummary;
  sunday?: ActivitySummary;
  isKey: boolean;
  isTaper: boolean;
}
