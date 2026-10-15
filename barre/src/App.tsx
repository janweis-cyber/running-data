import { useMemo, useState } from 'react';
import { addDays, buildSeries, toISO } from './lib/load';
import { DEFAULT_MIRROR, loadFromIntervals, loadFromMirror } from './lib/intervals';
import { useAsync, useCreds, useMirrorUrl, useTags } from './lib/store';
import Today from './screens/Today';
import Load from './screens/Load';
import Sessions from './screens/Sessions';
import Settings from './screens/Settings';

const TABS = ['Today', 'Load', 'Sessions', 'Settings'] as const;
type Tab = (typeof TABS)[number];
const HISTORY_DAYS = 400;

export default function App() {
  const [tab, setTab] = useState<Tab>('Today');
  const [creds, setCreds] = useCreds();
  const [mirror, setMirror] = useMirrorUrl(DEFAULT_MIRROR);
  const [tags, setTags] = useTags();
  const [nonce, setNonce] = useState(0);

  const today = toISO(new Date());
  const { data, error, loading } = useAsync(
    () =>
      creds?.athleteId && creds.apiKey
        ? loadFromIntervals(creds, addDays(today, -HISTORY_DAYS), today)
        : loadFromMirror(mirror),
    [creds, mirror, nonce],
  );

  const series = useMemo(
    () => (data ? buildSeries(data.sessions, tags, addDays(today, -HISTORY_DAYS), today) : []),
    [data, tags, today],
  );

  return (
    <div className="app">
      <header>
        <h1>Barre</h1>
        <span className="muted">{data ? (data.source === 'intervals' ? 'intervals.icu · live' : 'demo mirror') : loading ? 'loading…' : 'offline'}</span>
      </header>
      <main>
        {error && <p className="banner err">Couldn’t load data: {error}. Check Settings.</p>}
        {data && tab === 'Today' && <Today data={data} series={series} tags={tags} today={today} />}
        {data && tab === 'Load' && <Load data={data} series={series} tags={tags} today={today} />}
        {data && tab === 'Sessions' && <Sessions data={data} tags={tags} setTags={setTags} />}
        {tab === 'Settings' && (
          <Settings creds={creds} setCreds={setCreds} mirror={mirror} setMirror={setMirror} source={data?.source} reload={() => setNonce((n) => n + 1)} />
        )}
        {!data && loading && tab !== 'Settings' && <p className="muted">Loading sessions…</p>}
      </main>
      <nav>
        {TABS.map((t) => (
          <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>
    </div>
  );
}
