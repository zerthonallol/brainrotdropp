import { useMemo, useState } from "react"
import { ArrowUpRight, Search, TrendingUp } from "lucide-react"
import { toast } from "sonner"
import { BRAINROTS, BRAINROT_BY_ID } from "@/data/brainrots"
import { useStore } from "@/lib/store"
import { haptic, notify } from "@/lib/telegram"
import { cn } from "@/lib/utils"
import { SectionTitle } from "./CasesView"
import { BrainrotCard, BrainrotImg, Coin, CoinAmount, IncomeTag, formatCoins } from "./ui"

const HOUSE = 0.95
const MAX_CHANCE = 0.8
const R = 92
const CIRC = 2 * Math.PI * R

export function UpgraderView() {
  const store = useStore()
  const [inputUid, setInputUid] = useState<string | null>(null)
  const [extraCoins, setExtraCoins] = useState(0)
  const [targetId, setTargetId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<"win" | "lose" | null>(null)

  const owned = store.inventory.filter((i) => i.status === "owned" && !i.mutation)
  const input = owned.find((i) => i.uid === inputUid)
  const inputBrainrot = input ? BRAINROT_BY_ID[input.brainrotId] : null
  const inputValue = (inputBrainrot?.price ?? 0) + extraCoins
  const target = targetId ? BRAINROT_BY_ID[targetId] : null
  const chance = target && inputValue > 0 ? Math.min(MAX_CHANCE, (inputValue / target.price) * HOUSE) : 0

  const targets = useMemo(
    () =>
      BRAINROTS.filter((b) => b.price > Math.max(inputValue, 1) && b.name.toLowerCase().includes(query.toLowerCase())).slice(0, 30),
    [inputValue, query],
  )

  const multiplier = target && inputValue ? target.price / inputValue : 0

  const go = () => {
    if (!target || inputValue <= 0 || spinning) return
    if (extraCoins > 0 && !store.spend(extraCoins)) {
      toast.error("Недостаточно монет")
      return
    }
    if (input) store.removeItems([input.uid])
    haptic("medium")
    setResult(null)
    setSpinning(true)
    const landing = Math.random() * 360
    const win = landing < chance * 360
    // Pointer travels clockwise from 12 o'clock; success arc covers [0, chance*360).
    const base = rotation - (rotation % 360)
    setRotation(base + 360 * 6 + landing)
    window.setTimeout(() => {
      setSpinning(false)
      setResult(win ? "win" : "lose")
      if (win) {
        store.grant({ kind: "brainrot", id: target.id })
        notify("success")
        toast.success(`Апгрейд удался! ${target.name} в инвентаре`)
      } else {
        notify("error")
      }
      setInputUid(null)
      setExtraCoins(0)
    }, 4200)
  }

  return (
    <div className="space-y-5">
      <SectionTitle icon={<TrendingUp className="size-4" />} title="Апгрейдер MusorDrop" hint="Обменяй мусор на легенду" />

      <div className="bd-panel relative overflow-hidden p-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <Slot label="Ставка" empty="Выбери предмет">
            {inputBrainrot ? (
              <>
                <BrainrotImg b={inputBrainrot} size={64} />
                <div className="mt-1 max-w-full truncate text-[11px] font-bold">{inputBrainrot.name}</div>
              </>
            ) : extraCoins > 0 ? (
              <Coin size={52} />
            ) : null}
            {inputValue > 0 && <CoinAmount value={inputValue} size={12} className="mt-1 text-xs" />}
          </Slot>

          <Gauge chance={chance} rotation={rotation} spinning={spinning} result={result} />

          <Slot label="Цель" empty="Выбери цель">
            {target && (
              <>
                <BrainrotImg b={target} size={64} />
                <div className="mt-1 max-w-full truncate text-[11px] font-bold">{target.name}</div>
                <div className="mt-1 flex flex-col items-center gap-1">
                  <CoinAmount value={target.price} size={12} className="text-xs" />
                  <IncomeTag perSec={target.incomePerSec} />
                </div>
              </>
            )}
          </Slot>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <label className="flex-1 text-[11px] text-white/55">
            Добавить монеты: <b className="text-[var(--bd-gold)]">{formatCoins(extraCoins)}</b>
            <input
              type="range"
              min={0}
              max={Math.max(0, Math.min(store.balance, 5000))}
              step={10}
              value={extraCoins}
              onChange={(e) => setExtraCoins(Number(e.target.value))}
              disabled={spinning}
              className="mt-1 w-full accent-[var(--bd-lime)]"
            />
          </label>
          <div className="text-right">
            <div className="text-[10px] uppercase text-white/45">Множитель</div>
            <div className="font-heading text-lg font-extrabold text-[var(--bd-lime)]">x{multiplier ? multiplier.toFixed(2) : "—"}</div>
          </div>
        </div>

        <button type="button" className="bd-btn mt-4 w-full py-3.5 text-base" disabled={!target || inputValue <= 0 || spinning} onClick={go}>
          {spinning ? "Апгрейдим…" : target ? `Апгрейд · шанс ${(chance * 100).toFixed(2)}%` : "Выбери цель"}
        </button>
      </div>

      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">1. Твой предмет</div>
        {owned.length === 0 ? (
          <div className="bd-panel p-4 text-center text-sm text-white/55">Инвентарь пуст — открой кейс или поставь монеты ползунком выше.</div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {owned.map((i) => (
              <div key={i.uid} className="w-[118px] shrink-0">
                <BrainrotCard
                  b={BRAINROT_BY_ID[i.brainrotId]}
                  compact
                  selected={inputUid === i.uid}
                  onClick={() => {
                    if (spinning) return
                    haptic()
                    setInputUid(inputUid === i.uid ? null : i.uid)
                    setResult(null)
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-xs font-bold uppercase tracking-wider text-white/50">2. Цель апгрейда</div>
          <div className="relative w-44">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-white/40" />
            <input className="bd-input py-1.5 pl-8 text-xs" placeholder="Поиск" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {targets.map((b) => (
            <BrainrotCard
              key={b.id}
              b={b}
              compact
              selected={targetId === b.id}
              chance={inputValue ? Math.min(MAX_CHANCE, (inputValue / b.price) * HOUSE) : undefined}
              onClick={() => {
                if (spinning) return
                haptic()
                setTargetId(b.id)
                setResult(null)
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function Slot({ label, empty, children }: { label: string; empty: string; children: React.ReactNode }) {
  const has = Boolean(children) && !(Array.isArray(children) && children.every((c) => !c))
  return (
    <div className="flex min-h-[150px] min-w-0 flex-col items-center justify-center rounded-2xl border border-dashed border-white/12 bg-black/25 p-2 text-center">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-white/40">{label}</div>
      {has ? children : <div className="px-1 text-[11px] text-white/35">{empty}</div>}
    </div>
  )
}

function Gauge({ chance, rotation, spinning, result }: { chance: number; rotation: number; spinning: boolean; result: "win" | "lose" | null }) {
  const color = result === "lose" ? "#ef4444" : "#b6ff3b"
  return (
    <div className="relative size-[132px] sm:size-[168px]">
      <svg viewBox="0 0 220 220" className="size-full -rotate-90">
        <circle cx="110" cy="110" r={R} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="16" />
        <circle
          cx="110"
          cy="110"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${CIRC * chance} ${CIRC}`}
          style={{ transition: "stroke-dasharray .4s ease", filter: `drop-shadow(0 0 8px ${color})` }}
        />
        {Array.from({ length: 36 }, (_, i) => (
          <line
            key={i}
            x1="110"
            y1="8"
            x2="110"
            y2={i % 3 === 0 ? 16 : 13}
            stroke="rgba(255,255,255,.25)"
            strokeWidth="2"
            transform={`rotate(${i * 10} 110 110)`}
          />
        ))}
      </svg>
      <div
        className="absolute inset-0"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: spinning ? "transform 4s cubic-bezier(.12,.75,.15,1)" : "none",
          willChange: "transform",
        }}
      >
        <div className="absolute left-1/2 top-[2px] h-0 w-0 -translate-x-1/2 border-x-[9px] border-t-[18px] border-x-transparent border-t-white drop-shadow-[0_0_6px_#fff]" />
      </div>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className={cn("font-heading text-2xl font-extrabold tabular-nums", result === "lose" ? "text-red-400" : "text-white")}>
            {result === "win" ? "WIN" : result === "lose" ? "LOSE" : `${(chance * 100).toFixed(1)}%`}
          </div>
          <div className="flex items-center justify-center gap-1 text-[10px] uppercase text-white/45">
            {result ? "результат" : "шанс"} <ArrowUpRight className="size-3" />
          </div>
        </div>
      </div>
    </div>
  )
}
