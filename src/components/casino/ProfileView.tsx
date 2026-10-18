import { useMemo, useState } from "react"
import { ArrowDownToLine, ArrowUpFromLine, Backpack, CheckCircle2, Clock3, Search, ShieldCheck, Users, XCircle } from "lucide-react"
import { toast } from "sonner"
import { BRAINROTS, BRAINROT_BY_ID, wikiLink } from "@/data/brainrots"
import { itemValue, useStore, type InvItem } from "@/lib/store"
import { tradeOptions } from "@/data/mutations"
import { Repeat } from "lucide-react"
import { haptic, notify } from "@/lib/telegram"
import { cn } from "@/lib/utils"
import { InviteButton } from "./CasesView"
import { BrainrotCard, BrainrotImg, CoinAmount, IncomeTag, formatCoins } from "./ui"

type Tab = "inventory" | "deposit" | "requests"

export function ProfileView({ initialTab = "inventory" }: { initialTab?: Tab }) {
  const store = useStore()
  const [tab, setTab] = useState<Tab>(initialTab)
  const ownedValue = store.inventory.reduce((s, i) => s + itemValue(i), 0)
  const pending = store.requests.filter((r) => r.status === "pending").length

  return (
    <div className="space-y-5">
      <div className="bd-panel flex items-center gap-3 p-4">
        <Avatar />
        <div className="min-w-0 flex-1">
          <div className="truncate font-heading text-base font-extrabold">
            {store.user.firstName} {store.user.lastName}
          </div>
          <div className="text-xs text-white/50">
            {store.user.username ? `@${store.user.username}` : `ID ${store.user.id}`}
            {!store.inTelegram && " · демо-режим"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase text-white/45">Инвентарь</div>
          <CoinAmount value={ownedValue} size={14} className="text-sm" />
        </div>
      </div>

      <div className="bd-panel flex items-center gap-3 p-4">
        <div className="grid size-10 place-items-center rounded-xl bg-pink-500/15 text-pink-400">
          <Users className="size-5" />
        </div>
        <div className="flex-1 text-sm">
          <div className="font-bold">Друзей приглашено: {store.invitedFriends}</div>
          <div className="text-xs text-white/50">Реферальный кейс — каждые 12 часов</div>
        </div>
        <div className="w-40">
          <InviteButton userId={store.user.id} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-black/30 p-1">
        {(
          [
            ["inventory", "Инвентарь", <Backpack key="i" className="size-4" />],
            ["deposit", "Депозит", <ArrowDownToLine key="d" className="size-4" />],
            ["requests", `Заявки${pending ? ` · ${pending}` : ""}`, <Clock3 key="r" className="size-4" />],
          ] as const
        ).map(([id, label, icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              haptic()
              setTab(id)
            }}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-colors",
              tab === id ? "bg-white/12 text-white" : "text-white/50",
            )}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {tab === "inventory" && <Inventory />}
      {tab === "deposit" && <Deposit onDone={() => setTab("requests")} />}
      {tab === "requests" && <Requests />}
    </div>
  )
}

function Avatar() {
  const { user } = useStore()
  if (user.photoUrl) return <img src={user.photoUrl} alt="" className="size-12 rounded-2xl object-cover" />
  return (
    <div className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-700 font-heading text-lg font-extrabold">
      {user.firstName.slice(0, 1)}
    </div>
  )
}

function Inventory() {
  const store = useStore()
  const [withdrawing, setWithdrawing] = useState<InvItem | null>(null)
  const [trading, setTrading] = useState<InvItem | null>(null)
  if (store.inventory.length === 0)
    return <div className="bd-panel p-6 text-center text-sm text-white/55">Пока пусто. Открой кейс или задепозить брейнрота из Roblox.</div>
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {store.inventory.map((i) => {
          const b = BRAINROT_BY_ID[i.brainrotId]
          return (
            <BrainrotCard
              key={i.uid}
              b={b}
              mutation={i.mutation}
              footer={
                i.mutation && i.status === "owned" ? (
                  <button type="button" className="bd-btn mt-2 flex w-full items-center justify-center gap-1 py-1.5 text-[11px]" onClick={() => setTrading(i)}>
                    <Repeat className="size-3" /> Обменять
                  </button>
                ) : i.status === "withdrawing" ? (
                  <div className="mt-2 w-full rounded-lg bg-amber-400/12 py-1.5 text-center text-[11px] font-bold text-amber-300">Выводится…</div>
                ) : (
                  <div className="mt-2 grid w-full grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      className="bd-btn py-1.5 text-[11px]"
                      onClick={() => {
                        haptic()
                        store.sellItem(i.uid)
                        toast.success(`Продано за ${formatCoins(b.price)} монет`)
                      }}
                    >
                      Продать
                    </button>
                    <button type="button" className="bd-btn-ghost py-1.5 text-[11px] font-bold" onClick={() => setWithdrawing(i)}>
                      Вывести
                    </button>
                  </div>
                )
              }
            />
          )
        })}
      </div>
      {withdrawing && <WithdrawSheet item={withdrawing} onClose={() => setWithdrawing(null)} />}
      {trading && <TradeSheet item={trading} onClose={() => setTrading(null)} />}
    </>
  )
}

function TradeSheet({ item, onClose }: { item: InvItem; onClose: () => void }) {
  const store = useStore()
  const b = BRAINROT_BY_ID[item.brainrotId]
  const value = itemValue(item)
  const options = useMemo(() => tradeOptions(BRAINROTS, value, item.brainrotId), [value, item.brainrotId])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bd-pop bd-panel max-h-[80dvh] w-full max-w-xl overflow-y-auto rounded-b-none p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="text-xs font-bold uppercase text-white/45">Трейд мутированного брейнрота</div>
        <div className="font-heading text-lg font-extrabold">{b.name}</div>
        <p className="mt-1 text-[11px] text-white/50">
          Брейнрота с мутацией нельзя продать или вывести. Обменяй его на обычного примерно такой же стоимости (±10%).
        </p>
        <div className="mt-3 flex items-center gap-1 text-xs text-white/60">
          Стоимость: <CoinAmount value={value} size={13} className="text-xs" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {options.map((x) => (
            <BrainrotCard
              key={x.id}
              b={x}
              compact
              onClick={() => {
                store.tradeItem(item.uid, x.id)
                notify("success")
                toast.success(`Обменено на ${x.name}`)
                onClose()
              }}
            />
          ))}
        </div>
        {options.length === 0 && <div className="mt-4 text-center text-sm text-white/50">Нет подходящих брейнротов</div>}
      </div>
    </div>
  )
}

function WithdrawSheet({ item, onClose }: { item: InvItem; onClose: () => void }) {
  const store = useStore()
  const [nick, setNick] = useState("")
  const b = BRAINROT_BY_ID[item.brainrotId]
  const valid = /^[A-Za-z0-9_]{3,20}$/.test(nick)
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bd-pop bd-panel w-full max-w-xl rounded-b-none p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <BrainrotImg b={b} size={64} eager />
          <div>
            <div className="text-xs font-bold uppercase text-white/45">Вывод в Roblox</div>
            <div className="font-heading text-lg font-extrabold">{b.name}</div>
            <IncomeTag perSec={b.incomePerSec} />
          </div>
        </div>
        <label className="mt-4 block text-xs font-bold text-white/60">
          Ник в Roblox
          <input className="bd-input mt-1.5" placeholder="Например, BrainrotKing_228" value={nick} onChange={(e) => setNick(e.target.value.trim())} />
        </label>
        <p className="mt-2 text-[11px] text-white/45">
          Администратор получит заявку в Telegram и передаст брейнрота в Steal a Brainrot. Будь онлайн в игре.
        </p>
        <button
          type="button"
          className="bd-btn mt-4 w-full py-3"
          disabled={!valid}
          onClick={() => {
            store.requestWithdraw(item.uid, nick)
            notify("success")
            toast.success("Заявка на вывод отправлена администратору")
            onClose()
          }}
        >
          <span className="inline-flex items-center gap-2">
            <ArrowUpFromLine className="size-4" /> Отправить заявку
          </span>
        </button>
      </div>
    </div>
  )
}

function Deposit({ onDone }: { onDone: () => void }) {
  const store = useStore()
  const [q, setQ] = useState("")
  const [selected, setSelected] = useState<string | null>(null)
  const [nick, setNick] = useState("")
  const [creditAs, setCreditAs] = useState<"coins" | "brainrot">("brainrot")
  const list = useMemo(() => BRAINROTS.filter((b) => b.name.toLowerCase().includes(q.toLowerCase())), [q])
  const b = selected ? BRAINROT_BY_ID[selected] : null
  const valid = b && /^[A-Za-z0-9_]{3,20}$/.test(nick)

  return (
    <div className="space-y-4">
      <div className="bd-panel space-y-2 p-4 text-sm">
        <div className="flex items-center gap-2 font-bold">
          <ShieldCheck className="size-4 text-[var(--bd-lime)]" /> Как работает депозит
        </div>
        <ol className="list-decimal space-y-1 pl-5 text-xs text-white/60">
          <li>Выбери брейнрота (от 21M/s) и укажи ник в Roblox.</li>
          <li>Админ получит заявку в Telegram и примет трейд в Steal a Brainrot.</li>
          <li>После подтверждения на баланс придут монеты или сам брейнрот.</li>
        </ol>
      </div>

      {b && (
        <div className="bd-panel bd-pop space-y-3 p-4">
          <div className="flex items-center gap-3">
            <BrainrotImg b={b} size={60} eager />
            <div className="min-w-0 flex-1">
              <div className="truncate font-heading font-extrabold">{b.name}</div>
              <div className="mt-1 flex items-center gap-1.5">
                <CoinAmount value={b.price} size={14} className="text-sm" />
                <IncomeTag perSec={b.incomePerSec} />
              </div>
              <a href={wikiLink(b)} target="_blank" rel="noreferrer" className="text-[11px] text-white/40 underline">
                Страница на Вики
              </a>
            </div>
          </div>
          <input className="bd-input" placeholder="Твой ник в Roblox" value={nick} onChange={(e) => setNick(e.target.value.trim())} />
          <div className="grid grid-cols-2 gap-2 text-xs font-bold">
            {(
              [
                ["brainrot", "Зачислить брейнротом"],
                ["coins", `Зачислить ${formatCoins(b.price)} 🪙`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setCreditAs(id)}
                className={cn("bd-btn-ghost py-2", creditAs === id && "border-[var(--bd-lime)] text-[var(--bd-lime)]")}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="bd-btn w-full py-3"
            disabled={!valid}
            onClick={() => {
              store.requestDeposit(b.id, nick, creditAs)
              notify("success")
              toast.success("Заявка отправлена администратору", { description: "Жди трейд в Steal a Brainrot" })
              setSelected(null)
              onDone()
            }}
          >
            Отправить заявку на депозит
          </button>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40" />
        <input className="bd-input pl-9" placeholder="Найти брейнрота с Вики" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {list.map((x) => (
          <BrainrotCard
            key={x.id}
            b={x}
            compact
            selected={selected === x.id}
            onClick={() => {
              haptic()
              setSelected(x.id)
              window.scrollTo({ top: 0, behavior: "smooth" })
            }}
          />
        ))}
      </div>
    </div>
  )
}

function Requests() {
  const { requests } = useStore()
  if (requests.length === 0)
    return <div className="bd-panel p-6 text-center text-sm text-white/55">Заявок пока нет.</div>
  return (
    <div className="space-y-2">
      {requests.map((r) => {
        const b = BRAINROT_BY_ID[r.brainrotId]
        return (
          <div key={r.id} className="bd-panel flex items-center gap-3 p-3">
            <BrainrotImg b={b} size={44} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-white/45">
                {r.type === "deposit" ? <ArrowDownToLine className="size-3" /> : <ArrowUpFromLine className="size-3" />}
                {r.type === "deposit" ? "Депозит" : "Вывод"} · {r.robloxNick}
              </div>
              <div className="truncate text-sm font-bold">{b.name}</div>
            </div>
            <StatusBadge status={r.status} />
          </div>
        )
      })}
    </div>
  )
}

function StatusBadge({ status }: { status: "pending" | "approved" | "rejected" }) {
  if (status === "approved")
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--bd-lime)]/12 px-2 py-1 text-[11px] font-bold text-[var(--bd-lime)]">
        <CheckCircle2 className="size-3.5" /> Готово
      </span>
    )
  if (status === "rejected")
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-red-500/12 px-2 py-1 text-[11px] font-bold text-red-400">
        <XCircle className="size-3.5" /> Отклонено
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-amber-400/12 px-2 py-1 text-[11px] font-bold text-amber-300">
      <Clock3 className="size-3.5" /> У админа
    </span>
  )
}
