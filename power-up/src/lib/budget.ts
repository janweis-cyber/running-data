import type { TemplateExercise } from '../db/db'

// Tuned so seeded Session A ≈ 27 min:
// A = 3×(35+120)+60 + (3+3)×(35+90)+60 + 2×(35+90)+60 = 1645 s ≈ 27.4 min
export const WORK_SEC = 35
export const TRANSITION_SEC = 60
export const BUDGET_SEC = 30 * 60

export interface CostItem {
  // A superset pair is one item covering both rows; costSec counted once.
  teIds: string[]
  costSec: number
}

// Cost of a standalone exercise with `sets` sets at `restSec` rest.
export function exerciseCostSec(sets: number, restSec: number): number {
  return sets * (WORK_SEC + restSec) + TRANSITION_SEC
}

// Group template rows into cost items (superset pairs merge into one).
export function costItems(rows: TemplateExercise[]): CostItem[] {
  const sorted = [...rows].sort((a, b) => a.position - b.position)
  const items: CostItem[] = []
  const grouped = new Set<string>()
  for (const row of sorted) {
    if (grouped.has(row.id)) continue
    if (row.superset_group) {
      const partners = sorted.filter(
        (r) => r.superset_group === row.superset_group && !grouped.has(r.id),
      )
      partners.forEach((p) => grouped.add(p.id))
      const combinedSets = partners.reduce((s, p) => s + p.sets, 0)
      const rest = Math.max(...partners.map((p) => p.rest_sec))
      items.push({
        teIds: partners.map((p) => p.id),
        costSec: combinedSets * (WORK_SEC + rest) + TRANSITION_SEC,
      })
    } else {
      grouped.add(row.id)
      items.push({ teIds: [row.id], costSec: exerciseCostSec(row.sets, row.rest_sec) })
    }
  }
  return items
}

export function totalCostSec(rows: TemplateExercise[]): number {
  return costItems(rows).reduce((s, i) => s + i.costSec, 0)
}

// Per-row cost for display: superset pairs split the shared cost… no — the
// mockup shows the pair's combined cost on each linked row, counted once in
// the total. Expose the item cost for a given row.
export function rowCostSec(rows: TemplateExercise[], teId: string): number {
  const item = costItems(rows).find((i) => i.teIds.includes(teId))
  return item ? item.costSec : 0
}

export function minutes(sec: number): number {
  return sec / 60
}

export function fmtMin(sec: number): string {
  return `${Math.round(sec / 60)} min`
}

// Marginal cost of adding an exercise to an existing template.
export function addedCostSec(rows: TemplateExercise[], sets: number, restSec: number): number {
  return exerciseCostSec(sets, restSec)
}

// Cheapest cut suggestion when over budget: the single row (or pair member)
// whose removal saves the most toward getting under budget — we name the
// cheapest-to-lose exercise, i.e. the one with the smallest cost that still
// brings us under, else the largest.
export function cheapestCut(
  rows: TemplateExercise[],
  nameOf: (te: TemplateExercise) => string,
): string | null {
  const total = totalCostSec(rows)
  if (total <= BUDGET_SEC) return null
  const over = total - BUDGET_SEC
  let best: { name: string; cost: number } | null = null
  for (const row of rows) {
    const without = rows.filter((r) => r.id !== row.id)
    const saving = total - totalCostSec(without)
    if (saving >= over) {
      if (!best || saving < best.cost) best = { name: nameOf(row), cost: saving }
    }
  }
  if (!best) {
    // No single removal is enough — name the most expensive one.
    let max: { name: string; cost: number } | null = null
    for (const row of rows) {
      const without = rows.filter((r) => r.id !== row.id)
      const saving = total - totalCostSec(without)
      if (!max || saving > max.cost) max = { name: nameOf(row), cost: saving }
    }
    return max?.name ?? null
  }
  return best.name
}
