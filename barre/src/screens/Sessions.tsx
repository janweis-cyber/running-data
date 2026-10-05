import { useMemo, useState } from 'react';
import { ZoneBar } from '../components/charts';
import { guessKind, kindOf, rpeOf, srpeLoad } from '../lib/load';
import type { Dataset, Kind, Session, Tag } from '../lib/types';

const KINDS: Kind[] = ['class', 'rehearsal', 'performance', 'cross', 'other'];
const RPE_LABEL = ['', 'very easy', 'easy', 'light', 'moderate', 'somewhat hard', 'hard', 'harder', 'very hard', 'near max', 'max'];

export default function Sessions({ data, tags, setTags }: { data: Dataset; tags: Record<string, Tag>; setTags: (t: Record<string, Tag>) => void }) {
  const [filter, setFilter] = useState<Kind | 'all'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(30);

  const rows = useMemo(
    () =>
      data.sessions
        .filter((s) => filter === 'all' || kindOf(s, tags) === filter)
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [data, tags, filter],
  );

  const patch = (s: Session, p: Tag) => setTags({ ...tags, [s.id]: { ...tags[s.id], ...p } });

  return (
    <>
      <div className="seg wide">
        {(['all', ...KINDS] as const).map((k) => <button key={k} className={k === filter ? 'on' : ''} onClick={() => setFilter(k)}>{k}</button>)}
      </div>
      <ul className="sessions">
        {rows.slice(0, limit).map((s) => {
          const rpe = rpeOf(s, tags);
          const isOpen = open === s.id;
          return (
            <li key={s.id} className="card">
              <button className="head" onClick={() => setOpen(isOpen ? null : s.id)} aria-expanded={isOpen}>
                <span><b>{s.name}</b><br /><span className="muted">{s.date} · {kindOf(s, tags)}</span></span>
                <span className="right">{Math.round(s.durationMin)}′<br /><span className="muted">load {Math.round(s.load)}{rpe ? ` · RPE ${rpe}` : ''}</span></span>
              </button>
              {isOpen && (
                <div className="detail">
                  <p className="muted">Avg {s.avgHr ?? '—'} · max {s.maxHr ?? '—'} bpm{rpe ? ` · sRPE ${Math.round(srpeLoad(s, tags))} AU` : ''}</p>
                  <ZoneBar zones={s.zones} />
                  <label>Type
                    <select value={kindOf(s, tags)} onChange={(e) => patch(s, { kind: e.target.value as Kind })}>
                      {KINDS.map((k) => <option key={k} value={k}>{k}{k === guessKind(s) ? ' (auto)' : ''}</option>)}
                    </select>
                  </label>
                  <label>How hard did it feel? <b>{rpe ?? '—'}</b> <span className="muted">{rpe ? RPE_LABEL[rpe] : ''}</span>
                    <input type="range" min={1} max={10} value={rpe ?? 5} onChange={(e) => patch(s, { rpe: Number(e.target.value) })} />
                  </label>
                  <p className="muted">Type and RPE are stored on this device only.</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {rows.length > limit && <button className="more" onClick={() => setLimit(limit + 30)}>Show more ({rows.length - limit})</button>}
      {rows.length === 0 && <p className="muted">No sessions.</p>}
    </>
  );
}
