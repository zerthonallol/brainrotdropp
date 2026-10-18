import { useMemo, useState } from "react"
import { Crown, Megaphone, RotateCcw, Search } from "lucide-react"
import { toast } from "sonner"
import { BRAINROTS } from "@/data/brainrots"
import { originalPrice, useLive } from "@/lib/live"
import { ownerAnnounce, ownerSetPrice } from "@/lib/owner.functions"
import { useStore } from "@/lib/store"
import { tg } from "@/lib/telegram"
import { BrainrotImg, formatCoins } from "./ui"

export function OwnerView() {
  const store = useStore()
  useLive()
  const [q, setQ] = useState("")
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const list = useMemo(() => BRAINROTS.filter((b) => b.name.toLowerCase().includes(q.toLowerCase())).slice(0, 60), [q])

  const initData = () => {
    const app = tg()
    if (!app) {
      toast.error("Открой приложение в Telegram")
      return null
    }
    return app.initData
  }

  const savePrice = async (id: string, price: number | null) => {
    const d = initData()
    if (!d) return
    setBusy(true)
    try {
      await ownerSetPrice({ data: { initData: d, id, price } })
      await store.refreshSettings()
      setEdits((e) => ({ ...e, [id]: "" }))
      toast.success("Цена обновлена у всех")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setBusy(false)
    }
  }

  const announce = async (value: string | null) => {
    const d = initData()
    if (!d) return
    setBusy(true)
    try {
      await ownerAnnounce({ data: { initData: d, text: value } })
      await store.refreshSettings()
      setText("")
      toast.success(value ? "Плашка показана всем, кроме тебя" : "Плашка убрана")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="bd-panel flex items-center gap-3 p-4">
        <div className="grid size-10 place-items-center rounded-xl bg-[var(--bd-gold)]/15 text-[var(--bd-gold)]">
          <Crown className="size-5" />
        </div>
        <div>
          <div className="font-heading font-extrabold">Панель владельца</div>
          <div className="text-xs text-white/50">Изменения применяются у всех пользователей</div>
        </div>
      </div>

      <div className="bd-panel space-y-3 p-4">
        <div className="flex items-center gap-2 font-bold">
          <Megaphone className="size-4 text-[var(--bd-lime)]" /> Плашка об обновлении
        </div>
        {store.announcement && (
          <div className="rounded-xl bg-black/30 p-3 text-xs text-white/70">
            Сейчас: <b className="text-white">{store.announcement.text}</b>
          </div>
        )}
        <textarea
          className="bd-input min-h-20"
          maxLength={300}
          placeholder="Например: Вышло обновление! Добавили мутации и Dragon Cannelloni"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex gap-2">
          <button type="button" className="bd-btn flex-1 py-2.5 text-sm" disabled={busy || !text.trim()} onClick={() => announce(text)}>
            Показать всем
          </button>
          {store.announcement && (
            <button type="button" className="bd-btn-ghost px-4 py-2.5 text-sm font-bold" disabled={busy} onClick={() => announce(null)}>
              Убрать
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="font-heading font-extrabold">Цены брейнротов</div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40" />
          <input className="bd-input pl-9" placeholder="Найти брейнрота" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {list.map((b) => {
          const orig = originalPrice(b.id)
          const changed = b.price !== orig
          const v = edits[b.id] ?? ""
          const n = Number(v)
          return (
            <div key={b.id} className="bd-panel flex items-center gap-2 p-2.5">
              <BrainrotImg b={b} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-bold">{b.name}</div>
                <div className="text-[11px] text-white/50">
                  {formatCoins(b.price)} 🪙{changed && <span className="text-white/35"> · было {formatCoins(orig)}</span>}
                </div>
              </div>
              <input
                className="bd-input !w-24 !py-1.5 text-xs"
                inputMode="numeric"
                placeholder="Цена"
                value={v}
                onChange={(e) => setEdits((s) => ({ ...s, [b.id]: e.target.value.replace(/\D/g, "") }))}
              />
              <button type="button" className="bd-btn px-3 py-1.5 text-xs" disabled={busy || !(n >= 1)} onClick={() => savePrice(b.id, n)}>
                ОК
              </button>
              {changed && (
                <button type="button" className="bd-btn-ghost grid size-8 place-items-center" disabled={busy} onClick={() => savePrice(b.id, null)} aria-label="Сбросить">
                  <RotateCcw className="size-3.5" />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
