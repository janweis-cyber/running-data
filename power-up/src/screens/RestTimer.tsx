import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { getRestTimer, subscribeRestTimer, addRest, stopRest, chime } from '../lib/restTimer'
import { db, SETTINGS_ID } from '../db/db'
import { spring } from '../components/ui'

const R = 132
const CIRC = 2 * Math.PI * R

export default function RestTimer() {
  const timer = useSyncExternalStore(subscribeRestTimer, getRestTimer)
  const [, force] = useState(0)
  const chimed = useRef(false)
  const reduced = useReducedMotion()

  // Recompute from the timestamp — never accumulate ticks, so returning from
  // background shows the true remaining time.
  useEffect(() => {
    if (!timer) return
    chimed.current = false
    const id = setInterval(() => force((n) => n + 1), 200)
    const onVisible = () => force((n) => n + 1)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [timer?.endsAt])

  const remainingMs = timer ? Math.max(0, timer.endsAt - Date.now()) : 0
  const remaining = Math.ceil(remainingMs / 1000)

  useEffect(() => {
    if (timer && remaining === 0 && !chimed.current) {
      chimed.current = true
      void db.settings.get(SETTINGS_ID).then((s) => {
        if (s?.sound_on) chime()
      })
    }
  }, [remaining, timer])

  const progress = timer ? 1 - remainingMs / (timer.totalSec * 1000) : 0
  const mm = Math.floor(remaining / 60)
  const ss = String(remaining % 60).padStart(2, '0')

  return (
    <AnimatePresence>
      {timer && (
        <motion.div
          className="fixed inset-0 z-[60] bg-surface flex flex-col items-center px-6"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={spring}
        >
          <div className="pt-[max(2.5rem,env(safe-area-inset-top))] text-[13px] font-medium text-sub uppercase tracking-wider">
            Rest
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="relative">
              <svg width="300" height="300" viewBox="0 0 300 300">
                {/* hairline track */}
                <circle cx="150" cy="150" r={R} fill="none" stroke="#E5E5E0" strokeWidth="2" />
                {/* blue progress */}
                <circle
                  cx="150"
                  cy="150"
                  r={R}
                  fill="none"
                  stroke="#0B5FCC"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={CIRC}
                  strokeDashoffset={CIRC * progress}
                  transform="rotate(-90 150 150)"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-[64px] font-semibold text-ink leading-none tracking-tight">
                  {mm}:{ss}
                </div>
              </div>
            </div>
          </div>

          {timer.nextUp && (
            <div className="w-full max-w-sm bg-card border border-hairline rounded-card px-4 py-3 mb-5">
              <div className="text-[11px] font-medium text-faint uppercase tracking-wider mb-0.5">
                Next up
              </div>
              <div className="flex items-baseline justify-between">
                <div className="text-[15px] font-semibold text-ink">{timer.nextUp.exercise}</div>
                <div className="text-[13px] text-sub">{timer.nextUp.detail}</div>
              </div>
            </div>
          )}

          <div className="w-full max-w-sm flex gap-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <motion.button
              whileTap={{ scale: 0.97 }}
              transition={spring}
              onClick={() => addRest(15)}
              className="flex-1 bg-inset text-ink rounded-btn py-3.5 text-[15px] font-medium"
            >
              +15 s
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              transition={spring}
              onClick={stopRest}
              className="flex-[2] bg-ink text-white rounded-btn py-3.5 text-[15px] font-semibold"
            >
              Start set
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
