import { type ReactNode, useSyncExternalStore } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { getSyncState, subscribeSyncState } from '../sync/sync'

export const spring = { type: 'spring' as const, stiffness: 500, damping: 34, mass: 0.8 }

// ---- Muscle pills: primary = dark, secondary = light ------------------------
export function MusclePill({ muscle, primary }: { muscle: string; primary?: boolean }) {
  return (
    <span
      className={
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ' +
        (primary ? 'bg-ink text-white' : 'bg-inset text-sub')
      }
    >
      {muscle}
    </span>
  )
}

// ---- Cards ------------------------------------------------------------------
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-card rounded-card border border-hairline ${className}`}>{children}</div>
}

// ---- Buttons ----------------------------------------------------------------
export function PrimaryButton({
  children,
  onClick,
  disabled,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={spring}
      onClick={onClick}
      disabled={disabled}
      className={`bg-ink text-white rounded-btn px-5 py-3.5 text-[15px] font-semibold disabled:opacity-40 ${className}`}
    >
      {children}
    </motion.button>
  )
}

export function GhostButton({
  children,
  onClick,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={spring}
      onClick={onClick}
      className={`bg-inset text-ink rounded-btn px-4 py-3 text-[15px] font-medium ${className}`}
    >
      {children}
    </motion.button>
  )
}

// ---- Stepper (sized for gym thumbs) ----------------------------------------
export function Stepper({
  value,
  onChange,
  step,
  min = 0,
  format = (v: number) => String(v),
  label,
}: {
  value: number | null
  onChange: (v: number) => void
  step: number
  min?: number
  format?: (v: number) => string
  label?: string
}) {
  const dec = () => onChange(Math.max(min, round2((value ?? 0) - step)))
  const inc = () => onChange(round2((value ?? 0) + step))
  return (
    <div className="flex items-center gap-0.5">
      <motion.button
        whileTap={{ scale: 0.9 }}
        transition={spring}
        onClick={dec}
        className="w-11 h-11 rounded-btn bg-inset text-ink text-xl font-medium flex items-center justify-center"
        aria-label={`decrease ${label ?? ''}`}
      >
        −
      </motion.button>
      <div className="min-w-[3.75rem] text-center">
        <div className="text-[17px] font-semibold text-ink leading-none">
          {value === null ? '—' : format(value)}
        </div>
        {label && <div className="text-[10px] text-faint mt-1 uppercase tracking-wide">{label}</div>}
      </div>
      <motion.button
        whileTap={{ scale: 0.9 }}
        transition={spring}
        onClick={inc}
        className="w-11 h-11 rounded-btn bg-inset text-ink text-xl font-medium flex items-center justify-center"
        aria-label={`increase ${label ?? ''}`}
      >
        +
      </motion.button>
    </div>
  )
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ---- Budget bar -------------------------------------------------------------
export function BudgetBar({ totalSec, budgetSec }: { totalSec: number; budgetSec: number }) {
  const over = totalSec > budgetSec
  const pct = Math.min(100, (totalSec / budgetSec) * 100)
  const reduced = useReducedMotion()
  return (
    <div className="h-1.5 rounded-full bg-inset overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${over ? 'bg-warn' : 'bg-accent'}`}
        animate={{ width: `${pct}%` }}
        transition={reduced ? { duration: 0 } : spring}
      />
    </div>
  )
}

// ---- Sync chip --------------------------------------------------------------
export function SyncChip() {
  const state = useSyncExternalStore(subscribeSyncState, getSyncState)
  if (state.kind === 'local') return null
  const label =
    state.kind === 'synced'
      ? 'Synced'
      : state.kind === 'syncing'
        ? 'Syncing…'
        : state.queued > 0
          ? `Offline · ${state.queued} queued`
          : 'Offline'
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-inset px-2.5 py-1 text-[11px] font-medium text-sub">
      <span
        className={`w-1.5 h-1.5 rounded-full ${state.kind === 'synced' ? 'bg-accent' : 'bg-faint'}`}
      />
      {label}
    </span>
  )
}

// ---- Bottom sheet -----------------------------------------------------------
export function Sheet({
  open,
  onClose,
  children,
  title,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  title?: string
}) {
  const reduced = useReducedMotion()
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-ink/25 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 bg-surface rounded-t-card max-h-[92dvh] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]"
            initial={reduced ? { opacity: 0 } : { y: '100%' }}
            animate={reduced ? { opacity: 1 } : { y: 0 }}
            exit={reduced ? { opacity: 0 } : { y: '100%' }}
            transition={spring}
          >
            <div className="sticky top-0 bg-surface pt-3 pb-2 px-5 z-10">
              <div className="mx-auto w-9 h-1 rounded-full bg-hairline mb-3" />
              {title && <h2 className="text-[17px] font-semibold text-ink">{title}</h2>}
            </div>
            <div className="px-5">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ---- Skeleton row -----------------------------------------------------------
export function SkeletonRows({ n = 3 }: { n?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="skeleton h-16 w-full" />
      ))}
    </div>
  )
}
