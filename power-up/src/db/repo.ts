import { db, getDeviceId, uuid, type BaseRec, type SyncedTable } from './db'
import { requestFlush } from '../sync/sync'

// All writes go through here: stamp updated_at/device_id, write Dexie first,
// queue the mutation for sync, then poke the sync layer (no-op offline).
export async function put<T extends BaseRec>(
  table: SyncedTable,
  record: Omit<T, 'updated_at' | 'device_id' | 'deleted'> & Partial<BaseRec>,
): Promise<T> {
  const device_id = await getDeviceId()
  const full = {
    deleted: 0,
    ...record,
    updated_at: new Date().toISOString(),
    device_id,
  } as T
  await db.transaction('rw', [db.table(table), db._outbox], async () => {
    await db.table(table).put(full)
    await db._outbox.put({
      key: `${table}:${full.id}`,
      table,
      record_id: full.id,
      queued_at: new Date().toISOString(),
    })
  })
  requestFlush()
  return full
}

export async function patch<T extends BaseRec>(
  table: SyncedTable,
  id: string,
  changes: Partial<T>,
): Promise<void> {
  const existing = (await db.table(table).get(id)) as T | undefined
  if (!existing) return
  await put<T>(table, { ...existing, ...changes, id })
}

// Soft delete — tombstone so the deletion syncs to other devices.
export async function remove(table: SyncedTable, id: string): Promise<void> {
  const existing = (await db.table(table).get(id)) as BaseRec | undefined
  if (!existing) return
  await put(table, { ...existing, deleted: 1 })
}

export function newId(): string {
  return uuid()
}

export function todayStr(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
