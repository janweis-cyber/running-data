import { useState } from 'react';
import { DEFAULT_MIRROR, type Creds } from '../lib/intervals';

interface Props {
  creds: Creds | null;
  setCreds: (c: Creds | null) => void;
  mirror: string;
  setMirror: (u: string) => void;
  source?: 'intervals' | 'mirror';
  reload: () => void;
}

export default function Settings({ creds, setCreds, mirror, setMirror, source, reload }: Props) {
  const [id, setId] = useState(creds?.athleteId ?? '');
  const [key, setKey] = useState(creds?.apiKey ?? '');
  const [url, setUrl] = useState(mirror);

  return (
    <>
      <section className="card">
        <h2>intervals.icu</h2>
        <p className="muted">
          Connect your own account. Your watch or chest strap syncs to intervals.icu (via Garmin, COROS, Polar, Wahoo, Strava…) and Barre
          reads from there. In intervals.icu: Settings → Developer Settings → API key. Your athlete ID looks like <code>i12345</code>.
        </p>
        <label>Athlete ID<input value={id} onChange={(e) => setId(e.target.value)} placeholder="i12345" autoCapitalize="none" /></label>
        <label>API key<input type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" /></label>
        <div className="row">
          <button className="primary" onClick={() => { setCreds(id && key ? { athleteId: id.trim(), apiKey: key.trim() } : null); reload(); }}>Save &amp; load</button>
          {creds && <button onClick={() => { setCreds(null); setKey(''); reload(); }}>Disconnect</button>}
        </div>
        <p className="muted">The key is kept in this browser’s storage and sent only to intervals.icu. Currently using: <b>{source === 'intervals' ? 'live intervals.icu' : 'demo mirror'}</b>.</p>
      </section>

      <section className="card">
        <h2>Demo / mirror data</h2>
        <p className="muted">
          Used when no account is connected. Defaults to a public JSON mirror of someone’s intervals.icu history
          (a runner, not a dancer) so you can see the app working.
        </p>
        <label>Mirror URL<input value={url} onChange={(e) => setUrl(e.target.value)} /></label>
        <div className="row">
          <button onClick={() => { setMirror(url); reload(); }}>Load</button>
          <button onClick={() => { setUrl(DEFAULT_MIRROR); setMirror(DEFAULT_MIRROR); reload(); }}>Reset</button>
        </div>
      </section>

      <section className="card">
        <h2>How load is computed</h2>
        <ul className="signals">
          <li><b>HR load</b> — intervals.icu’s per-session training load (HRSS, from your HR zones and LTHR).</li>
          <li><b>Fitness / Fatigue</b> — exponentially weighted averages of daily load, 42 and 7 days. Form = fitness − fatigue.</li>
          <li><b>Acute:chronic</b> — last 7 days of load ÷ average weekly load over 28 days. Spike &gt; 1.5, sweet spot 0.8–1.3.</li>
          <li><b>RPE load</b> — RPE (1–10) × minutes. Captures the jumps, pointe and held positions that HR misses.</li>
        </ul>
        <p className="muted">These are screening signals from population research in athletes. They have not been validated for ballet; treat them as a prompt for a conversation with your coach or physio, not a verdict. This is not medical advice.</p>
      </section>
    </>
  );
}
