import { BLOCK_START, RACE_DATE, TOTAL_WEEKS, MP_HR_MIN, MP_HR_MAX, THRESHOLD_HR_MIN } from './constants';
import { ActivitySummary, WeekData } from './types';

export function gapToMinPerKm(gapMs: number): number {
  return (1 / gapMs) * 1000 / 60;
}

export function formatPaceFromGap(gapMs: number): string {
  return formatPace(gapToMinPerKm(gapMs));
}

export function formatPace(minPerKm: number): string {
  if (!minPerKm || !isFinite(minPerKm)) return '--:--';
  const mins = Math.floor(minPerKm);
  const secs = Math.round((minPerKm % 1) * 60);
  if (secs === 60) return `${mins + 1}:00`;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function getDaysToRace(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const race = new Date(RACE_DATE);
  race.setHours(0, 0, 0, 0);
  return Math.ceil((race.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function getWeekNumber(dateStr: string): number | null {
  const date = new Date(dateStr);
  const diffMs = date.getTime() - BLOCK_START.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const weekNum = Math.floor(diffDays / 7) + 1;
  if (weekNum < 1 || weekNum > TOTAL_WEEKS) return null;
  return weekNum;
}

export function getWeekDateRange(weekNum: number): { start: Date; end: Date } {
  const start = new Date(BLOCK_START);
  start.setDate(start.getDate() + (weekNum - 1) * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start, end };
}

export function formatShortDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function buildWeekGrid(activities: ActivitySummary[]): WeekData[] {
  const weeks: WeekData[] = [];

  for (let w = 1; w <= TOTAL_WEEKS; w++) {
    const { start, end } = getWeekDateRange(w);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    const inRange = activities.filter(a => a.date >= startStr && a.date <= endStr);
    const tuesday = inRange.find(a => new Date(a.date).getDay() === 2 && (a.distance_km ?? 0) > 3);
    const sunday = inRange.find(a => new Date(a.date).getDay() === 0 && (a.distance_km ?? 0) > 5);

    weeks.push({
      weekNum: w,
      startDate: startStr,
      endDate: endStr,
      tuesday,
      sunday,
      isKey: [11, 13, 14].includes(w),
      isTaper: [15, 16].includes(w),
    });
  }

  return weeks;
}

export function hrColor(hr: number): string {
  if (hr >= MP_HR_MIN && hr <= MP_HR_MAX) return '#4caf50';
  if (hr > MP_HR_MAX && hr < THRESHOLD_HR_MIN) return '#ff9800';
  if (hr >= THRESHOLD_HR_MIN) return '#f44336';
  return '#777777';
}

export function sessionVerdict(avgHr: number): string {
  if (avgHr >= MP_HR_MIN && avgHr <= MP_HR_MAX) return 'On target';
  if (avgHr > MP_HR_MAX && avgHr <= 172) return 'Slightly overcooked';
  if (avgHr > 172) return 'Overcooked — threshold effort';
  return 'Below target';
}
