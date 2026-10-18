import { useEffect, useRef, useState } from "react"
import { Rocket } from "lucide-react"
import { toast } from "sonner"
import { BRAINROTS } from "@/data/brainrots"
import { useStore } from "@/lib/store"
import { haptic, notify } from "@/lib/telegram"
import { cn } from "@/lib/utils"
import { SectionTitle } from "./CasesView"
import { BetInput } from "./BetInput"
import { CoinAmount, cdnImage } from "./ui"

const GROWTH = 0.00011 // multiplier = e^(GROWTH * ms)
const FLYERS = BRAINROTS.filter((b) => b.incomePerSec >= 150e6)

type Phase = "idle" | "running" | "crashed" | "cashed"

function rollCrashPoint() {
  // 3% instant bust, otherwise house-edged inverse distribution.
  const r = Math.random()
  if (r < 0.03) return 1
  return Math.max(1, Math.floor((0.97 / (1 - r)) * 100) / 100)
}

export function CrashView() {
  const store = useStore()
  const [bet, setBet] = useState(50)
  const [auto, setAuto] = useState(2)
  const [autoOn, setAutoOn] = useState(false)
  const [phase, setPhase] = useState<Phase>("idle")
  const [history, setHistory] = useState<number[]>([1.84, 3.2, 1.02, 7.45, 1.5, 2.11, 12.6, 1.17])
  const [cashedAt, setCashedAt] = useState<number | null>(null)

  const canvas = useRef<HTMLCanvasElement>(null)
  const multEl = useRef<HTMLDivElement>(null)
  const raf = useRef(0)
  const round = useRef({ start: 0, crash: 1, mult: 1, cashed: false, bet: 0, autoAt: 0 })
  const flyer = useRef<HTMLImageElement | null>(null)
  const [flyerIdx, setFlyerIdx] = useState(0)

  useEffect(() => {
    const img = new Image()
    img.decoding = "async"
    img.src = cdnImage(FLYERS[flyerIdx].image, 160)
    flyer.current = img
  }, [flyerIdx])

  useEffect(() => {
    draw(1, 0, "idle")
    const onResize = () => draw(round.current.mult, 0, "idle")
    window.addEventListener("resize", onResize)
    return () => {
      window.removeEventListener("resize", onResize)
      cancelAnimationFrame(raf.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function draw(mult: number, elapsed: number, ph: Phase) {
    const c = canvas.current
    if (!c) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = c.clientWidth
    const h = c.clientHeight
    if (c.width !== w * dpr || c.height !== h * dpr) {
      c.width = w * dpr
      c.height = h * dpr
    }
    const ctx = c.getContext("2d")
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const pad = 28
    const maxT = Math.max(8000, elapsed * 1.15)
    const maxM = Math.max(2, mult * 1.2)
    const X = (t: number) => pad + (t / maxT) * (w - pad * 2)
    const Y = (m: number) => h - pad - ((m - 1) / (maxM - 1)) * (h - pad * 2)

    ctx.strokeStyle = "rgba(255,255,255,.06)"
    ctx.lineWidth = 1
    ctx.fillStyle = "rgba(255,255,255,.35)"
    ctx.font = "600 10px Manrope, sans-serif"
    for (let i = 0; i <= 4; i++) {
      const m = 1 + ((maxM - 1) * i) / 4
      const y = Y(m)
      ctx.beginPath()
      ctx.moveTo(pad, y)
      ctx.lineTo(w - pad / 2, y)
      ctx.stroke()
      ctx.fillText(`${m.toFixed(1)}x`, 2, y + 3)
    }

    if (elapsed <= 0) return
    const color = ph === "crashed" ? "#ef4444" : "#b6ff3b"
    const steps = 60
    ctx.beginPath()
    ctx.moveTo(X(0), Y(1))
    for (let i = 1; i <= steps; i++) {
      const t = (elapsed * i) / steps
      ctx.lineTo(X(t), Y(Math.exp(GROWTH * t)))
    }
    const tipX = X(elapsed)
    const tipY = Y(mult)
    const grad = ctx.createLinearGradient(0, tipY, 0, h - pad)
    grad.addColorStop(0, ph === "crashed" ? "rgba(239,68,68,.35)" : "rgba(182,255,59,.35)")
    grad.addColorStop(1, "rgba(0,0,0,0)")
    ctx.save()
    ctx.lineTo(tipX, h - pad)
    ctx.lineTo(X(0), h - pad)
    ctx.closePath()
    ctx.fillStyle = grad
    ctx.fill()
    ctx.restore()

    ctx.beginPath()
    ctx.moveTo(X(0), Y(1))
    for (let i = 1; i <= steps; i++) {
      const t = (elapsed * i) / steps
      ctx.lineTo(X(t), Y(Math.exp(GROWTH * t)))
    }
    ctx.strokeStyle = color
    ctx.lineWidth = 4
    ctx.lineCap = "round"
    ctx.shadowColor = color
    ctx.shadowBlur = 14
    ctx.stroke()
    ctx.shadowBlur = 0

    const img = flyer.current
    if (img && img.complete && img.naturalWidth) {
      const prevT = elapsed * 0.97
      const angle = Math.atan2(Y(Math.exp(GROWTH * prevT)) - tipY, X(prevT) - tipX) + Math.PI
      const size = 64
      ctx.save()
      ctx.translate(tipX, tipY)
      ctx.rotate(ph === "crashed" ? angle + 0.8 : angle * 0.35)
      ctx.globalAlpha = ph === "crashed" ? 0.55 : 1
      ctx.drawImage(img, -size / 2, -size / 2, size, size)
      ctx.restore()
    }
  }

  const setMultText = (m: number, ph: Phase) => {
    const el = multEl.current
    if (!el) return
    el.textContent = `${m.toFixed(2)}x`
    el.style.color = ph === "crashed" ? "#f87171" : ph === "cashed" ? "#ffc83d" : "#ffffff"
  }

  const start = () => {
    if (phase === "running") return
    if (!store.spend(bet)) {
      notify("error")
      toast.error("Недостаточно монет")
      return
    }
    haptic("medium")
    setFlyerIdx(Math.floor(Math.random() * FLYERS.length))
    setCashedAt(null)
    round.current = { start: performance.now(), crash: rollCrashPoint(), mult: 1, cashed: false, bet, autoAt: autoOn ? auto : 0 }
    setPhase("running")
    const tick = (now: number) => {
      const r = round.current
      const elapsed = now - r.start
      const m = Math.exp(GROWTH * elapsed)
      if (m >= r.crash) {
        r.mult = r.crash
        draw(r.crash, Math.log(r.crash) / GROWTH, "crashed")
        setMultText(r.crash, "crashed")
        setPhase(r.cashed ? "cashed" : "crashed")
        setHistory((h) => [r.crash, ...h].slice(0, 12))
        if (!r.cashed) notify("error")
        return
      }
      r.mult = m
      if (!r.cashed && r.autoAt > 1 && m >= r.autoAt) doCashout(r.autoAt)
      draw(m, elapsed, "running")
      setMultText(m, r.cashed ? "cashed" : "running")
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }

  const doCashout = (at?: number) => {
    const r = round.current
    if (r.cashed) return
    r.cashed = true
    const m = at ?? r.mult
    const win = Math.floor(r.bet * m)
    store.credit(win)
    setCashedAt(m)
    notify("success")
    toast.success(`Забрал x${m.toFixed(2)} → +${win} монет`)
  }

  const running = phase === "running"
  const canCash = running && cashedAt === null

  return (
    <div className="space-y-5">
      <SectionTitle icon={<Rocket className="size-4" />} title="Crash" hint="Забери до взрыва" />

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {history.map((m, i) => (
          <span
            key={i}
            className={cn(
              "shrink-0 rounded-lg px-2 py-1 text-[11px] font-extrabold tabular-nums",
              m >= 10 ? "bg-[var(--bd-gold)]/15 text-[var(--bd-gold)]" : m >= 2 ? "bg-[var(--bd-lime)]/12 text-[var(--bd-lime)]" : "bg-red-500/12 text-red-400",
            )}
          >
            {m.toFixed(2)}x
          </span>
        ))}
      </div>

      <div className="bd-panel relative h-64 overflow-hidden">
        <canvas ref={canvas} className="absolute inset-0 size-full" />
        <div className="pointer-events-none absolute inset-x-0 top-6 text-center">
          <div ref={multEl} className="font-heading text-5xl font-extrabold tabular-nums drop-shadow-[0_4px_20px_rgba(0,0,0,.6)]">
            1.00x
          </div>
          <div className="mt-1 text-xs font-bold uppercase tracking-widest text-white/50">
            {phase === "idle" && "Сделай ставку"}
            {phase === "running" && (cashedAt ? `Забрано на x${cashedAt.toFixed(2)}` : "Летим!")}
            {phase === "crashed" && <span className="text-red-400">Взрыв!</span>}
            {phase === "cashed" && <span className="text-[var(--bd-gold)]">Ты успел на x{cashedAt?.toFixed(2)}</span>}
          </div>
        </div>
      </div>

      <div className="bd-panel space-y-4 p-4">
        <BetInput value={bet} onChange={setBet} disabled={running} />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-bold text-white/70">
            <input type="checkbox" checked={autoOn} onChange={(e) => setAutoOn(e.target.checked)} disabled={running} className="size-4 accent-[var(--bd-lime)]" />
            Автовывод на
          </label>
          <input
            type="number"
            step={0.1}
            min={1.01}
            value={auto}
            disabled={running || !autoOn}
            onChange={(e) => setAuto(Math.max(1.01, Number(e.target.value) || 1.01))}
            className="bd-input w-24 py-1.5 text-sm font-bold"
          />
          <span className="text-xs text-white/50">x</span>
        </div>
        {canCash ? (
          <button type="button" className="bd-btn w-full py-3.5 text-base" style={{ background: "linear-gradient(180deg,#ffe680,#ffb300)", boxShadow: "0 4px 0 #a86a00" }} onClick={() => doCashout()}>
            Забрать
          </button>
        ) : (
          <button type="button" className="bd-btn w-full py-3.5 text-base" disabled={running || bet <= 0 || bet > store.balance} onClick={start}>
            {running ? "Раунд идёт…" : (
              <span className="inline-flex items-center gap-2">
                Ставка <CoinAmount value={bet} size={16} className="text-[#160b2e]" />
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
