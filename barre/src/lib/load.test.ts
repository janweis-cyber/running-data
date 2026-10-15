import { describe, expect, it } from 'vitest';
import { buildSeries, guessKind, mondayOf, risk, srpeLoad, weekly } from './load';
import type { Session } from './types';

const mk = (date: string, load: number, extra: Partial<Session> = {}): Session => ({
  id: date + load, date, name: 'x', type: 'Workout', durationMin: 60, avgHr: 100, maxHr: 150,
  zones: [3000, 600, 0, 0, 0, 0, 0], load, rpe: null, icuCtl: null, icuAtl: null, ...extra,
});

describe('load model', () => {
  it('ATL reacts faster than CTL', () => {
    const s = buildSeries([mk('2026-01-01', 100)], {}, '2026-01-01', '2026-01-05');
    expect(s[1].atl).toBeGreaterThan(s[1].ctl);
    expect(s[4].atl).toBeLessThan(s[1].atl);
  });
  it('anchors to intervals.icu values', () => {
    const s = buildSeries([mk('2026-01-02', 50, { icuCtl: 40, icuAtl: 60 })], {}, '2026-01-01', '2026-01-03');
    expect(s[1].ctl).toBe(40);
    expect(s[1].atl).toBe(60);
    expect(s[2].atl).toBeLessThan(60);
  });
  it('flags an acute spike', () => {
    const sessions: Session[] = [];
    for (let i = 0; i < 21; i++) sessions.push(mk(`2026-01-${String(i + 1).padStart(2, '0')}`, i % 2 ? 0 : 40));
    for (let i = 21; i < 28; i++) sessions.push(mk(`2026-01-${String(i + 1).padStart(2, '0')}`, 120));
    const r = risk(buildSeries(sessions, {}, '2026-01-01', '2026-01-28'));
    expect(r.status).toBe('spike');
  });
  it('needs 28 days before an ACWR', () => {
    expect(risk(buildSeries([mk('2026-01-05', 50)], {}, '2026-01-01', '2026-01-10')).acwr).toBeNull();
  });
  it('sRPE = rpe x minutes, tag overrides source', () => {
    const s = mk('2026-01-01', 10, { rpe: 3 });
    expect(srpeLoad(s, {})).toBe(180);
    expect(srpeLoad(s, { [s.id]: { rpe: 8 } })).toBe(480);
  });
  it('guesses kinds from names', () => {
    expect(guessKind({ name: 'Morning Barre', type: 'Workout' })).toBe('class');
    expect(guessKind({ name: 'Swan Lake rehearsal', type: 'Workout' })).toBe('rehearsal');
    expect(guessKind({ name: 'Evening show', type: 'Workout' })).toBe('performance');
    expect(guessKind({ name: 'Easy', type: 'Run' })).toBe('cross');
  });
  it('weeks start Monday', () => {
    expect(mondayOf('2026-10-05')).toBe('2026-10-05'); // Monday
    expect(mondayOf('2026-10-11')).toBe('2026-10-05'); // Sunday
    expect(weekly([mk('2026-10-06', 30)], {}, 2, '2026-10-08')[1].load).toBe(30);
  });
});
