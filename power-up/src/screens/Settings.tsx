import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, SETTINGS_ID, type Settings as SettingsRec } from '../db/db'
import { patch } from '../db/repo'
import { supabase, syncConfigured } from '../sync/supabase'
import { syncNow } from '../sync/sync'
import { exportCSV, exportJSON } from '../lib/exporter'
import { Card, SyncChip, Stepper, SkeletonRows, PrimaryButton } from '../components/ui'

export default function Settings() {
  const settings = useLiveQuery(() => db.settings.get(SETTINGS_ID))
  const [email, setEmail] = useState('')
  const [authState, setAuthState] = useState<'unknown' | 'signedOut' | 'signedIn' | 'sent'>('unknown')
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      setAuthState('signedOut')
      return
    }
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setAuthState('signedIn')
        setUserEmail(data.session.user.email ?? null)
      } else setAuthState('signedOut')
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) {
        setAuthState('signedIn')
        setUserEmail(session.user.email ?? null)
      } else setAuthState('signedOut')
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!settings) {
    return (
      <div className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <SkeletonRows n={5} />
      </div>
    )
  }

  const set = (changes: Partial<SettingsRec>) => void patch<SettingsRec>('settings', SETTINGS_ID, changes)

  return (
    <div className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between mb-5">
        <h1 className="text-[22px] font-bold text-ink">Settings</h1>
        <SyncChip />
      </header>

      <div className="space-y-4">
        <Card className="divide-y divide-hairline">
          <Row label="Default rest">
            <Stepper
              value={settings.rest_default}
              step={15}
              min={15}
              onChange={(v) => set({ rest_default: Math.round(v) })}
              format={(v) => `${v}s`}
            />
          </Row>
          <Row label="Plate rounding">
            <div className="flex gap-1.5">
              {([1.25, 2.5] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => set({ plate_rounding: v })}
                  className={`rounded-btn px-3.5 py-2 text-[14px] font-medium ${
                    settings.plate_rounding === v ? 'bg-ink text-white' : 'bg-inset text-sub'
                  }`}
                >
                  {v} kg
                </button>
              ))}
            </div>
          </Row>
          <Row label="Timer chime">
            <Toggle on={!!settings.sound_on} onToggle={() => set({ sound_on: settings.sound_on ? 0 : 1 })} />
          </Row>
          <Row label="Week starts">
            <div className="flex gap-1.5">
              {(['monday', 'sunday'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => set({ week_start: v })}
                  className={`rounded-btn px-3.5 py-2 text-[14px] font-medium capitalize ${
                    settings.week_start === v ? 'bg-ink text-white' : 'bg-inset text-sub'
                  }`}
                >
                  {v.slice(0, 3)}
                </button>
              ))}
            </div>
          </Row>
        </Card>

        {/* Sync / auth */}
        <Card className="p-4">
          <div className="text-[11px] font-medium text-faint uppercase tracking-wider mb-3">Sync</div>
          {!syncConfigured ? (
            <p className="text-[13px] text-sub">
              Supabase is not configured — the app is running local-only. Set{' '}
              <span className="font-medium">VITE_SUPABASE_URL</span> and{' '}
              <span className="font-medium">VITE_SUPABASE_ANON_KEY</span> to enable multi-device
              sync.
            </p>
          ) : authState === 'signedIn' ? (
            <div className="space-y-3">
              <div className="text-[14px] text-ink">
                Signed in{userEmail ? ` as ${userEmail}` : ''}
              </div>
              <div className="flex gap-2">
                <button
                  className="flex-1 text-[13px] font-medium text-ink bg-inset rounded-btn py-2.5"
                  onClick={() => void syncNow()}
                >
                  Sync now
                </button>
                <button
                  className="flex-1 text-[13px] font-medium text-warn bg-inset rounded-btn py-2.5"
                  onClick={() => void supabase?.auth.signOut()}
                >
                  Sign out
                </button>
              </div>
            </div>
          ) : authState === 'sent' ? (
            <p className="text-[13px] text-sub">
              Magic link sent — check your email on this device and tap the link.
            </p>
          ) : (
            <div className="space-y-2.5">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-inset rounded-btn px-4 py-3 text-[15px] text-ink placeholder:text-faint outline-none"
              />
              <PrimaryButton
                className="w-full"
                disabled={!email.includes('@')}
                onClick={async () => {
                  const { error } = await supabase!.auth.signInWithOtp({
                    email,
                    options: { emailRedirectTo: window.location.origin },
                  })
                  if (!error) setAuthState('sent')
                }}
              >
                Send magic link
              </PrimaryButton>
            </div>
          )}
        </Card>

        {/* Export */}
        <Card className="p-4">
          <div className="text-[11px] font-medium text-faint uppercase tracking-wider mb-3">
            Export
          </div>
          <div className="flex gap-2">
            <button
              className="flex-1 text-[13px] font-medium text-ink bg-inset rounded-btn py-2.5"
              onClick={() => void exportCSV()}
            >
              Sets CSV
            </button>
            <button
              className="flex-1 text-[13px] font-medium text-ink bg-inset rounded-btn py-2.5"
              onClick={() => void exportJSON()}
            >
              Full JSON
            </button>
          </div>
        </Card>

        <button
          className="w-full text-center text-[13px] text-warn py-3"
          onClick={async () => {
            if (
              confirm('Reset the local database? Unsynced data will be lost.') &&
              confirm('Really delete everything on this device?')
            ) {
              await db.delete()
              location.reload()
            }
          }}
        >
          Reset local data
        </button>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <span className="text-[14px] text-ink">{label}</span>
      {children}
    </div>
  )
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`w-12 h-7 rounded-full transition-colors ${on ? 'bg-accent' : 'bg-hairline'}`}
      role="switch"
      aria-checked={on}
    >
      <span
        className={`block w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
          on ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}
