# Barre

Training-load and heart-rate analysis for dancers. A Strava/intervals.icu-style analysis view (no social), built around how
ballet load actually looks: stop-start classes, rehearsals and shows, where HR alone under-reads the real effort.

**Data path:** watch / chest strap → Garmin / COROS / Polar / Wahoo → **intervals.icu** → Barre.

- Fitness / fatigue / form (CTL 42d, ATL 7d, TSB), anchored to intervals.icu's own values
- Acute:chronic ratio, Foster monotony, rest days, resting-HR drift
- HR-zone distribution per session and over 28 days
- Session type (class / rehearsal / performance / cross) auto-guessed from the name, editable
- Session-RPE load (RPE × minutes) as a second channel next to HR load; RPE entry is local to the device

```sh
cd barre
npm install
npm run dev     # http://localhost:5173
npm test
npm run build
```

Without credentials the app loads the repo's JSON mirror (`index.json`, written by `sync.py`) as demo data.
To use your own data: Settings → athlete ID + intervals.icu API key (kept in `localStorage`).

## Known limits

- Direct browser → intervals.icu calls depend on their CORS policy, which has **not** been verified from this build
  environment. If the live connection fails, the fix is a small proxy or a per-user mirror via `sync.py`.
- ACWR / monotony thresholds come from team-sport research and are unvalidated for ballet. Not medical advice.
- No HR-stream analysis yet (HR recovery, per-exercise intensity); only per-session summaries.
