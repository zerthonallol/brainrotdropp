import { memo, useId } from "react"
import { BRAINROT_BY_ID, TIER_META, type Brainrot } from "@/data/brainrots"
import { dropValue, type Drop } from "@/data/cases"
import { cn } from "@/lib/utils"
import { useLive } from "@/lib/live"
import { MUTATION_BY_ID, mutatedValue, type MutationId } from "@/data/mutations"

export function formatIncome(perSec: number) {
  if (perSec >= 1e9) return `${+(perSec / 1e9).toFixed(2)}B/s`
  return `${+(perSec / 1e6).toFixed(1)}M/s`
}

export function formatCoins(n: number) {
  return Math.floor(n).toLocaleString("ru-RU")
}

export function cdnImage(src: string, w: number) {
  void w
  return src
}

/** Flat 2D gold coin with a soft gradient, rim and glow. */
export const Coin = memo(function Coin({ size = 18, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "")
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={cn("inline-block shrink-0", className)}
      style={{ filter: `drop-shadow(0 0 ${Math.max(2, size / 6)}px rgba(255,200,61,.55))` }}
      aria-hidden
    >
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe680" />
          <stop offset=".55" stopColor="#ffc83d" />
          <stop offset="1" stopColor="#f08c00" />
        </linearGradient>
        <linearGradient id={`r${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset="1" stopColor="#c46a00" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill={`url(#r${id})`} />
      <circle cx="16" cy="16" r="12.2" fill={`url(#g${id})`} />
      <circle cx="16" cy="16" r="9.4" fill="none" stroke="#d27a00" strokeOpacity=".55" strokeWidth="1.2" />
      <path
        d="M13 10.5h4.6c2.1 0 3.4 1.1 3.4 2.8 0 1.1-.6 1.9-1.6 2.3 1.3.3 2.1 1.3 2.1 2.6 0 1.9-1.5 3.3-3.8 3.3H13zm2.4 4.4h1.9c.9 0 1.4-.5 1.4-1.2s-.5-1.2-1.4-1.2h-1.9zm0 4.6h2.2c1 0 1.6-.5 1.6-1.3s-.6-1.3-1.6-1.3h-2.2z"
        fill="#a85400"
        fillOpacity=".85"
      />
      <ellipse cx="11" cy="9" rx="4.5" ry="2.2" fill="#fff" fillOpacity=".45" transform="rotate(-30 11 9)" />
    </svg>
  )
})

export function CoinAmount({ value, size = 16, className }: { value: number; size?: number; className?: string }) {
  const { streamer } = useLive()
  if (streamer)
    return (
      <span className={cn("inline-flex items-center gap-1 font-heading font-bold text-[var(--bd-gold)]", className)} title="Режим стримера">
        <Coin size={size} />
        •••
      </span>
    )
  return (
    <span className={cn("inline-flex items-center gap-1 font-heading font-bold tabular-nums text-[var(--bd-gold)]", className)}>
      <Coin size={size} />
      {formatCoins(value)}
    </span>
  )
}

export function IncomeTag({ perSec, className }: { perSec: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md bg-[var(--bd-lime)]/12 px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-[var(--bd-lime)] ring-1 ring-[var(--bd-lime)]/30",
        className,
      )}
      title="Доход в Steal a Brainrot"
    >
      ⚡ {formatIncome(perSec)}
    </span>
  )
}

export const BrainrotImg = memo(function BrainrotImg({
  b,
  size,
  className,
  eager,
}: {
  b: Brainrot
  size: number
  className?: string
  eager?: boolean
}) {
  return (
    <img
      src={cdnImage(b.image, size * 2)}
      alt={b.name}
      width={size}
      height={size}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      className={cn("object-contain select-none", className)}
      style={{ width: size, height: size }}
    />
  )
})

export const BrainrotCard = memo(function BrainrotCard({
  b,
  selected,
  onClick,
  compact,
  footer,
  chance,
  mutation,
}: {
  mutation?: MutationId
  b: Brainrot
  selected?: boolean
  onClick?: () => void
  compact?: boolean
  footer?: React.ReactNode
  chance?: number
}) {
  useLive() // re-render when owner changes prices
  const t = TIER_META[b.tier]
  const mut = mutation ? MUTATION_BY_ID[mutation] : null
  const className = cn(
    "group relative flex flex-col items-center overflow-hidden rounded-2xl border p-2 text-left transition-transform duration-150",
    onClick && "active:scale-[.97] hover:-translate-y-0.5",
    selected ? "border-[var(--bd-lime)] ring-2 ring-[var(--bd-lime)]/60" : "border-white/8",
    mut && "bd-mutated",
  )
  const style = {
    background: `radial-gradient(120% 80% at 50% 0%, ${mut ? mut.color + "88" : t.glow}, transparent 65%), linear-gradient(180deg,#1f1638,#130c24)`,
    contain: "layout paint",
    ...(mut ? { borderColor: mut.color } : {}),
  } as const
  const body = (
    <>
      <span className="absolute inset-x-0 bottom-0 h-1" style={{ background: t.color }} />
      <div className="flex w-full items-center justify-between gap-1">
        <span className="text-[9px] font-extrabold uppercase tracking-wider" style={{ color: t.color }}>
          {t.label}
        </span>
        {chance !== undefined && <span className="text-[9px] font-bold text-white/55">{formatChance(chance)}</span>}
      </div>
      {mut && (
        <span className="absolute left-1/2 top-6 z-10 -translate-x-1/2 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase text-black" style={{ background: mut.color }}>
          {mut.name} ×{mut.mult}
        </span>
      )}
      <BrainrotImg b={b} size={compact ? 64 : 84} eager={compact} className="my-1 transition-transform duration-300 group-hover:scale-110" />
      <div className={cn("w-full truncate text-center font-bold", compact ? "text-[11px]" : "text-xs")}>{b.name}</div>
      <div className="mt-1 flex w-full flex-wrap items-center justify-center gap-1">
        <CoinAmount value={mutatedValue(b.price, mutation)} size={13} className="text-xs" />
        <IncomeTag perSec={b.incomePerSec} />
      </div>
      {footer}
    </>
  )
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={className} style={style}>
        {body}
      </button>
    )
  return (
    <div className={className} style={style}>
      {body}
    </div>
  )
})

export function formatChance(p: number) {
  const pct = p * 100
  if (pct >= 10) return `${pct.toFixed(1)}%`
  if (pct >= 0.1) return `${pct.toFixed(2)}%`
  return `${pct.toFixed(3)}%`
}

/** Card for any case drop: brainrot or a coin pile. */
export function DropCard({ drop, chance, compact }: { drop: Drop; chance?: number; compact?: boolean }) {
  if (drop.kind === "brainrot") {
    const b = BRAINROT_BY_ID[drop.id]
    return <BrainrotCard b={b} chance={chance} compact={compact} />
  }
  return (
    <div
      className="relative flex flex-col items-center overflow-hidden rounded-2xl border border-white/8 p-2"
      style={{ background: "radial-gradient(120% 80% at 50% 0%, rgba(255,200,61,.35), transparent 65%), linear-gradient(180deg,#1f1638,#130c24)" }}
    >
      <span className="absolute inset-x-0 bottom-0 h-1 bg-[var(--bd-gold)]" />
      <div className="flex w-full items-center justify-between">
        <span className="text-[9px] font-extrabold uppercase tracking-wider text-[var(--bd-gold)]">Монеты</span>
        {chance !== undefined && <span className="text-[9px] font-bold text-white/55">{formatChance(chance)}</span>}
      </div>
      <div className={cn("relative my-1 grid place-items-center", compact ? "size-16" : "size-[84px]")}>
        <Coin size={compact ? 40 : 52} className="absolute -translate-x-3 translate-y-2 opacity-80" />
        <Coin size={compact ? 46 : 60} className="relative" />
      </div>
      <div className="font-heading text-sm font-extrabold text-[var(--bd-gold)]">+{formatCoins(drop.amount)}</div>
      <div className="mt-1 text-[10px] text-white/50">на баланс</div>
    </div>
  )
}

export function dropLabel(d: Drop) {
  return d.kind === "coins" ? `${formatCoins(d.amount)} монет` : BRAINROT_BY_ID[d.id].name
}

export { dropValue }
