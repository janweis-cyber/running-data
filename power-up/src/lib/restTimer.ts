// Timestamp-based rest timer store: survives backgrounding because the UI
// recomputes remaining time from endsAt on every tick / on return.
export interface RestTimerState {
  endsAt: number // epoch ms
  totalSec: number
  nextUp: { exercise: string; detail: string } | null
}

let timer: RestTimerState | null = null
const listeners = new Set<() => void>()

export function startRest(totalSec: number, nextUp: RestTimerState['nextUp']) {
  timer = { endsAt: Date.now() + totalSec * 1000, totalSec, nextUp }
  emit()
}

export function addRest(sec: number) {
  if (!timer) return
  timer = { ...timer, endsAt: timer.endsAt + sec * 1000, totalSec: timer.totalSec + sec }
  emit()
}

export function stopRest() {
  timer = null
  emit()
}

export function getRestTimer(): RestTimerState | null {
  return timer
}

export function subscribeRestTimer(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function emit() {
  listeners.forEach((l) => l())
}

// Optional chime at zero (settings, default off) — a soft two-tone blip.
export function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const play = (freq: number, at: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, ctx.currentTime + at)
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + 0.4)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + at)
      osc.stop(ctx.currentTime + at + 0.45)
    }
    play(880, 0)
    play(1174.66, 0.18)
    setTimeout(() => void ctx.close(), 1200)
  } catch {
    // Audio unavailable — silence is fine.
  }
}
