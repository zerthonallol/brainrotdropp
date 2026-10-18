// Small global store for things every card needs without prop drilling:
// streamer mode (hide coin values) and owner price overrides.
import { useSyncExternalStore } from "react"
import { BRAINROTS } from "@/data/brainrots"

const ORIGINAL: Record<string, number> = Object.fromEntries(BRAINROTS.map((b) => [b.id, b.price]))
const LS_STREAMER = "brainrotdrop:streamer"

let state = { streamer: false, priceVersion: 0 }
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())
const subscribe = (f: () => void) => {
  subs.add(f)
  return () => subs.delete(f)
}

export function useLive() {
  return useSyncExternalStore(subscribe, () => state, () => state)
}

export function initStreamer() {
  try {
    if (localStorage.getItem(LS_STREAMER) === "1") setStreamer(true)
  } catch {
    /* ignore */
  }
}

export function setStreamer(on: boolean) {
  state = { ...state, streamer: on }
  try {
    localStorage.setItem(LS_STREAMER, on ? "1" : "0")
  } catch {
    /* ignore */
  }
  emit()
}

export function originalPrice(id: string) {
  return ORIGINAL[id]
}

/** Owner price overrides apply to everyone; brainrot objects are updated in place. */
export function applyPriceOverrides(map: Record<string, number>) {
  let changed = false
  for (const b of BRAINROTS) {
    const next = map[b.id] ?? ORIGINAL[b.id]
    if (b.price !== next) {
      b.price = next
      changed = true
    }
  }
  if (changed) {
    state = { ...state, priceVersion: state.priceVersion + 1 }
    emit()
  }
}
