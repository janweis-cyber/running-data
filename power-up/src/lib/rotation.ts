import { db, type RotationSlot, type Session, type SessionTemplate } from '../db/db'
import { put, newId } from '../db/repo'

// Position in the rotation whose turn is next: the slot after the one the
// most recently completed session used. Falls back to the start.
export function nextRotationIndex(
  rotation: { template_id: string }[],
  completedSessions: Session[],
): number {
  if (rotation.length === 0) return 0
  const last = [...completedSessions]
    .filter((s) => s.completed_at)
    .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))[0]
  if (!last) return 0
  const pos = rotation.findIndex((r) => r.template_id === last.template_id)
  return pos >= 0 ? (pos + 1) % rotation.length : 0
}

// Next free label in the A, B, C… sequence.
export function nextLabel(templates: { label: string }[]): string {
  const used = new Set(templates.map((t) => t.label))
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i)
    if (!used.has(letter)) return letter
  }
  return `S${templates.length + 1}`
}

// Create an empty session template and append it to the endless rotation.
export async function addSessionToRotation(
  templates: SessionTemplate[],
): Promise<string> {
  const id = newId()
  const label = nextLabel(templates)
  await put<SessionTemplate>('session_templates', {
    id,
    label,
    name: `Session ${label}`,
    sort_order: templates.length,
  })
  const slots = await db.rotation.filter((r) => !r.deleted).toArray()
  await put<RotationSlot>('rotation', {
    id: newId(),
    template_id: id,
    position: slots.length,
  })
  return id
}
