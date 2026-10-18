import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Clock, Gift, Lock, Share2, Sparkles, Tag, Users, X, Zap } from "lucide-react"
import { toast } from "sonner"
import { CASES, TAG, rollCase, sortedEntries, type CaseDef, type Drop } from "@/data/cases"
import { MINI_APP_LINK } from "@/data/fixtures"
import { useStore } from "@/lib/store"
import { haptic, notify, openShare } from "@/lib/telegram"
import { cn } from "@/lib/utils"
import { CoinAmount, DropCard, cdnImage, dropLabel, dropValue, Coin, formatCoins } from "./ui"

const STRIP_LEN = 56
const WIN_INDEX = 48
const CELL = 112 // px, card width + gap

function useNow(interval = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), interval)
    return () => clearInterval(t)
  }, [interval])
  return now
}

function fmtLeft(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
}

export function CasesView() {
  const [open, setOpen] = useState<CaseDef | null>(null)
  const bonus = CASES.filter((c) => c.kind !== "paid")
  const paid = CASES.filter((c) => c.kind === "paid")

  return (
    <div className="space-y-6">
      <section>
        <SectionTitle icon={<Gift className="size-4" />} title="Бонусные кейсы" hint="Бесплатно по таймеру" />
        <div className="grid grid-cols-3 gap-2.5">
          {bonus.map((c) => (
            <CaseTile key={c.id} c={c} onOpen={() => setOpen(c)} />
          ))}
        </div>
      </section>
      <section>
        <SectionTitle icon={<Sparkles className="size-4" />} title="Кейсы" hint="Шансы честно указаны внутри" />
        <div className="grid grid-cols-2 gap-3">
          {paid.map((c) => (
            <CaseTile key={c.id} c={c} onOpen={() => setOpen(c)} />
          ))}
        </div>
      </section>
      {open && typeof document !== "undefined" && createPortal(<CaseModal c={open} onClose={() => setOpen(null)} />, document.body)}
    </div>
  )
}

export function SectionTitle({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <h2 className="flex items-center gap-2 font-heading text-base font-extrabold">
        <span className="grid size-7 place-items-center rounded-lg bg-white/8 text-[var(--bd-lime)]">{icon}</span>
        {title}
      </h2>
      {hint && <span className="text-[11px] text-white/45">{hint}</span>}
    </div>
  )
}

function CaseTile({ c, onOpen }: { c: CaseDef; onOpen: () => void }) {
  const { caseReadyAt } = useStore()
  const now = useNow()
  const readyAt = caseReadyAt(c)
  const locked = readyAt > now
  const small = c.kind !== "paid"
  return (
    <button
      type="button"
      onClick={() => {
        haptic()
        onOpen()
      }}
      className="group relative flex flex-col items-center overflow-hidden rounded-2xl border border-white/8 p-3 text-center transition-transform active:scale-[.97]"
      style={{ background: `radial-gradient(110% 70% at 50% 15%, ${c.accent}55, transparent 70%), linear-gradient(180deg,#1f1638,#120b22)` }}
    >
      <div className="relative">
        <div className="absolute inset-0 -z-0 scale-125 rounded-full blur-2xl" style={{ background: c.accent, opacity: 0.35 }} />
        <img
          src={cdnImage(c.cover, small ? 160 : 240)}
          alt=""
          loading="lazy"
          decoding="async"
          className={cn("relative object-contain transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3", small ? "size-16" : "size-28")}
        />
      </div>
      <div className={cn("mt-2 font-heading font-extrabold leading-tight", small ? "text-[11px]" : "text-sm")}>{c.name}</div>
      {!small && <div className="mt-0.5 text-[11px] text-white/50">{c.subtitle}</div>}
      <div className="mt-2">
        {c.kind === "paid" ? (
          <span className="inline-flex items-center rounded-lg bg-black/35 px-2.5 py-1">
            <CoinAmount value={c.price} size={15} className="text-sm" />
          </span>
        ) : locked ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-black/35 px-2 py-1 text-[10px] font-bold tabular-nums text-white/70">
            <Clock className="size-3" /> {fmtLeft(readyAt - now)}
          </span>
        ) : (
          <span className="rounded-lg px-2 py-1 text-[10px] font-extrabold text-black" style={{ background: c.accent }}>
            ОТКРЫТЬ
          </span>
        )}
      </div>
    </button>
  )
}

function CaseModal({ c, onClose }: { c: CaseDef; onClose: () => void }) {
  const store = useStore()
  const now = useNow()
  const [strip, setStrip] = useState<Drop[]>(() => buildStrip(c))
  const [spinning, setSpinning] = useState(false)
  const [offset, setOffset] = useState(0)
  const [won, setWon] = useState<Drop | null>(null)
  const [wonUid, setWonUid] = useState<string | null>(null)
  const [fast, setFast] = useState(false)
  const viewport = useRef<HTMLDivElement>(null)
  const entries = useMemo(() => sortedEntries(c), [c])

  const readyAt = store.caseReadyAt(c)
  const cooldownLeft = readyAt - now
  const gate = gateReason(c, store)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const spin = () => {
    if (spinning) return
    if (c.kind === "paid") {
      if (!store.spend(c.price)) {
        notify("error")
        toast.error("Недостаточно монет", { description: "Пополни баланс через депозит брейнрота" })
        return
      }
    } else {
      if (gate || cooldownLeft > 0) return
      store.claimCase(c)
    }
    haptic("medium")
    const result = rollCase(c)
    const next = buildStrip(c)
    next[WIN_INDEX] = result
    setWon(null)
    setOffset(0)
    setStrip(next)
    setSpinning(true)
    viewport.current?.scrollIntoView({ block: "center", behavior: "smooth" })
    const width = viewport.current?.clientWidth ?? 360
    const jitter = (Math.random() - 0.5) * (CELL - 24)
    const target = 4 + WIN_INDEX * CELL - width / 2 + (CELL - 8) / 2 + jitter
    // Two frames so the reset to 0 paints before the long transition starts.
    requestAnimationFrame(() => requestAnimationFrame(() => setOffset(target)))
    window.setTimeout(
      () => {
        setSpinning(false)
        setWon(result)
        notify("success")
        setWonUid(store.grant(result)?.uid ?? null)
      },
      fast ? 1300 : 6000,
    )
  }

  const sellWon = () => {
    if (!won || won.kind !== "brainrot" || !wonUid) return
    store.sellItem(wonUid)
    toast.success(`Продано за ${formatCoins(dropValue(won))} монет`)
    setWon(null)
  }

  const disabled =
    spinning || (c.kind === "paid" ? !store.canAfford(c.price) : Boolean(gate) || cooldownLeft > 0)

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#07040f]/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col overflow-y-auto px-4 pb-8 pt-4 no-scrollbar">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-heading text-lg font-extrabold">{c.name}</div>
            <div className="text-xs text-white/50">{c.subtitle}</div>
          </div>
          <button type="button" onClick={onClose} disabled={spinning} className="bd-btn-ghost grid size-10 place-items-center" aria-label="Закрыть">
            <X className="size-5" />
          </button>
        </div>

        <div ref={viewport} className="relative mt-5 h-[172px] shrink-0 overflow-hidden rounded-2xl border border-white/8 bg-black/40">
          <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-[3px] -translate-x-1/2 bg-[var(--bd-lime)] shadow-[0_0_16px_var(--bd-lime)]" />
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-14 bg-gradient-to-r from-[#07040f] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-14 bg-gradient-to-l from-[#07040f] to-transparent" />
          <div
            className="flex h-full items-center gap-2 px-1"
            style={{
              transform: `translate3d(${-offset}px,0,0)`,
              transition: offset === 0 ? "none" : `transform ${fast ? 1.2 : 5.8}s cubic-bezier(.08,.6,.12,1)`,
              willChange: "transform",
            }}
          >
            {strip.map((d, i) => (
              <div key={i} className="w-[104px] shrink-0">
                <DropCard drop={d} compact />
              </div>
            ))}
          </div>
        </div>

        {won && <WinBanner drop={won} onSell={sellWon} onClose={() => setWon(null)} />}

        <div className="mt-5 space-y-3">
          {gate ? (
            <GateNotice c={c} />
          ) : c.kind !== "paid" && cooldownLeft > 0 ? (
            <div className="bd-panel flex items-center justify-center gap-2 p-3 text-sm text-white/70">
              <Lock className="size-4" /> Доступно через <b className="tabular-nums text-white">{fmtLeft(cooldownLeft)}</b>
            </div>
          ) : null}
          <div className="flex gap-2">
            <button type="button" className="bd-btn flex-1 py-3.5 text-base" onClick={spin} disabled={disabled}>
              {spinning ? (
                "Крутим…"
              ) : c.kind === "paid" ? (
                <span className="inline-flex items-center gap-2">
                  Открыть за <Coin size={18} /> {formatCoins(c.price)}
                </span>
              ) : (
                "Открыть бесплатно"
              )}
            </button>
            <button
              type="button"
              onClick={() => setFast((f) => !f)}
              className={cn("bd-btn-ghost grid w-14 place-items-center", fast && "border-[var(--bd-lime)] text-[var(--bd-lime)]")}
              aria-pressed={fast}
              title="Быстрое открытие"
            >
              <Zap className="size-5" />
            </button>
          </div>
        </div>

        <div className="mt-7">
          <div className="mb-3 font-heading text-sm font-extrabold text-white/80">Содержимое кейса</div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {entries.map((e, i) => (
              <DropCard key={i} drop={e.drop} chance={e.weight} compact />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function WinBanner({ drop, onSell, onClose }: { drop: Drop; onSell: () => void; onClose: () => void }) {
  return (
    <div className="bd-pop relative mt-5 overflow-hidden rounded-2xl border border-[var(--bd-lime)]/40 bg-gradient-to-b from-[#1d2a0c] to-[#120b22] p-4">
      <div className="bd-rays pointer-events-none absolute -top-40 left-1/2 size-80 -translate-x-1/2 opacity-60" />
      <div className="relative flex items-center gap-4">
        <div className="w-28 shrink-0">
          <DropCard drop={drop} compact />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--bd-lime)]">Твой дроп</div>
          <div className="truncate font-heading text-lg font-extrabold">{dropLabel(drop)}</div>
          <div className="mt-1">
            <CoinAmount value={dropValue(drop)} />
          </div>
          <div className="mt-3 flex gap-2">
            {drop.kind === "brainrot" ? (
              <>
                <button type="button" className="bd-btn px-3 py-2 text-xs" onClick={onSell}>
                  Продать
                </button>
                <button type="button" className="bd-btn-ghost px-3 py-2 text-xs font-bold" onClick={onClose}>
                  В инвентарь
                </button>
              </>
            ) : (
              <button type="button" className="bd-btn-ghost px-3 py-2 text-xs font-bold" onClick={onClose}>
                Зачислено на баланс
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function gateReason(c: CaseDef, store: ReturnType<typeof useStore>) {
  if (c.kind === "tag" && !store.hasTag) return "tag"
  if (c.kind === "referral" && store.invitedFriends < 1) return "referral"
  return null
}

function GateNotice({ c }: { c: CaseDef }) {
  const { user } = useStore()
  if (c.kind === "tag") {
    return (
      <div className="bd-panel space-y-2 p-4 text-sm">
        <div className="flex items-center gap-2 font-bold">
          <Tag className="size-4 text-sky-400" /> Добавь тег в имя Telegram
        </div>
        <p className="text-white/60">
          Допиши <b className="text-white">{TAG}</b> к имени или фамилии в настройках Telegram и перезапусти приложение — кейс откроется.
        </p>
        <button
          type="button"
          className="bd-btn-ghost w-full py-2 text-xs font-bold"
          onClick={() => {
            navigator.clipboard?.writeText(TAG)
            toast.success("Тег скопирован")
          }}
        >
          Скопировать {TAG}
        </button>
      </div>
    )
  }
  return (
    <div className="bd-panel space-y-2 p-4 text-sm">
      <div className="flex items-center gap-2 font-bold">
        <Users className="size-4 text-pink-400" /> Пригласи друга
      </div>
      <p className="text-white/60">Кейс открывается каждые 12 часов, когда по твоей ссылке заходит новый друг.</p>
      <InviteButton userId={user.id} />
    </div>
  )
}

export function InviteButton({ userId }: { userId: number }) {
  const link = `${MINI_APP_LINK}ref_${userId}`
  return (
    <button
      type="button"
      className="bd-btn flex w-full items-center justify-center gap-2 py-2.5 text-sm"
      onClick={() => {
        haptic()
        openShare(link, "🧠 Залетай в BrainrotDrop! Бесплатные кейсы с брейнротами из Steal a Brainrot, апгрейдер и Crash. Забирай бонус по моей ссылке 👇")
      }}
    >
      <Share2 className="size-4" /> Пригласить друга
    </button>
  )
}

function buildStrip(c: CaseDef): Drop[] {
  return Array.from({ length: STRIP_LEN }, () => rollCase(c))
}

