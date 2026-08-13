import { db, SYNCED_TABLES, type BaseRec, type SyncedTable } from '../db/db'
import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// Sync status — a tiny external store for the UI chip.
// ---------------------------------------------------------------------------
export type SyncState =
  | { kind: 'local' } // no Supabase configured / signed out
  | { kind: 'offline'; queued: number }
  | { kind: 'syncing' }
  | { kind: 'synced' }

let state: SyncState = { kind: 'local' }
const listeners = new Set<() => void>()

function setState(next: SyncState) {
  state = next
  listeners.forEach((l) => l())
}

export function getSyncState(): SyncState {
  return state
}

export function subscribeSyncState(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

async function refreshIdleState() {
  if (!supabase || !(await signedIn())) {
    setState({ kind: 'local' })
    return
  }
  const queued = await db._outbox.count()
  if (!navigator.onLine) setState({ kind: 'offline', queued })
  else if (queued > 0) setState({ kind: 'offline', queued })
  else setState({ kind: 'synced' })
}

async function signedIn(): Promise<boolean> {
  if (!supabase) return false
  const { data } = await supabase.auth.getSession()
  return !!data.session
}

// ---------------------------------------------------------------------------
// Push: flush the outbox. Each entry names a table + record id; we read the
// current local row and upsert it. Last-write-wins is enforced server-side
// by an updated_at guard in the upsert RPC-free path: we just upsert — the
// row we hold is the newest this device knows, and the pull step resolves
// true conflicts by comparing updated_at.
// ---------------------------------------------------------------------------
let flushing = false
let flushQueued = false

export function requestFlush() {
  // Fire and forget; callers are local writes that must never block.
  void flush()
}

async function flush(): Promise<void> {
  if (!supabase) return
  if (flushing) {
    flushQueued = true
    return
  }
  flushing = true
  try {
    if (!(await signedIn()) || !navigator.onLine) return
    const entries = await db._outbox.orderBy('queued_at').toArray()
    if (entries.length === 0) return
    setState({ kind: 'syncing' })
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) return
    for (const entry of entries) {
      const rec = (await db.table(entry.table).get(entry.record_id)) as BaseRec | undefined
      if (!rec) {
        await db._outbox.delete(entry.key)
        continue
      }
      // Guarded upsert: only overwrite a remote row that is older. We read
      // the remote updated_at first; single-user traffic makes races benign
      // and the pull pass re-converges any that slip through.
      const { data: remote, error: readErr } = await supabase
        .from(entry.table)
        .select('updated_at')
        .eq('id', rec.id)
        .maybeSingle()
      if (readErr) throw readErr
      if (remote && remote.updated_at >= rec.updated_at) {
        await db._outbox.delete(entry.key) // remote is newer; pull will bring it in
        continue
      }
      const { error } = await supabase
        .from(entry.table)
        .upsert({ ...rec, user_id: userId }, { onConflict: 'id' })
      if (error) throw error
      await db._outbox.delete(entry.key)
    }
  } catch {
    // Network or auth hiccup — leave the queue; we retry on reconnect.
  } finally {
    flushing = false
    await refreshIdleState()
    if (flushQueued) {
      flushQueued = false
      void flush()
    }
  }
}

// ---------------------------------------------------------------------------
// Pull: fetch remote rows with updated_at > cursor per table, merge with
// last-write-wins per record.
// ---------------------------------------------------------------------------
async function pullTable(table: SyncedTable): Promise<void> {
  if (!supabase) return
  const cursorKey = `cursor:${table}`
  const cursor = (await db._meta.get(cursorKey))?.value ?? '1970-01-01T00:00:00.000Z'
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .gt('updated_at', cursor)
    .order('updated_at', { ascending: true })
    .limit(1000)
  if (error) throw error
  if (!data || data.length === 0) return
  let maxSeen = cursor
  await db.transaction('rw', [db.table(table), db._outbox], async () => {
    for (const raw of data) {
      const { user_id: _drop, ...rec } = raw as BaseRec & { user_id: string }
      if (rec.updated_at > maxSeen) maxSeen = rec.updated_at
      const local = (await db.table(table).get(rec.id)) as BaseRec | undefined
      // Last-write-wins per record.
      if (!local || rec.updated_at > local.updated_at) {
        await db.table(table).put(rec)
        // Remote won — drop any stale queued push for this record.
        const queued = await db._outbox.get(`${table}:${rec.id}`)
        if (queued && local && rec.updated_at > local.updated_at) {
          await db._outbox.delete(`${table}:${rec.id}`)
        }
      }
    }
  })
  await db._meta.put({ key: cursorKey, value: maxSeen })
  if (data.length === 1000) await pullTable(table) // page through backlog
}

export async function syncNow(): Promise<void> {
  if (!supabase || !navigator.onLine || !(await signedIn())) {
    await refreshIdleState()
    return
  }
  setState({ kind: 'syncing' })
  try {
    for (const t of SYNCED_TABLES) await pullTable(t)
    await flush()
  } catch {
    // Offline mid-sync; state refresh below reflects reality.
  }
  await refreshIdleState()
}

// ---------------------------------------------------------------------------
// Wiring: sync on open, on reconnect, on tab foreground, on sign-in.
// ---------------------------------------------------------------------------
export function startSync(): void {
  void syncNow()
  window.addEventListener('online', () => void syncNow())
  window.addEventListener('offline', () => void refreshIdleState())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow()
  })
  supabase?.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') void syncNow()
    if (event === 'SIGNED_OUT') void refreshIdleState()
  })
}
