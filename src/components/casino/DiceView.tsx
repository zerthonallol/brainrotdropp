import { useState } from "react"
import { Dices } from "lucide-react"
import { toast } from "sonner"
import { useStore } from "@/lib/store"
import { haptic, notify } from "@/lib/telegram"
import { cn } from "@/lib/utils"
import { SectionTitle } from "./CasesView"
import { BetInput } from "./BetInput"
import { CoinAmount } from "./ui"

type Color = "red" | "blue" | "gold"

const COLORS: Record<Color, { label: string; mult: number; faces: number; bg: string; ring: string }> = {
  red: { label: "Красный", mult: 1.9, faces: 3, bg: "linear-gradient(145deg,#ff6b6b,#d61f3c)", ring: "#ff4d6d" },
  blue: { label: "Синий", mult: 2.85, faces: 2, bg: "linear-gradient(145deg,#5cc8ff,#2563eb)", ring: "#38bdf8" },
  gold: { label: "Золотой", mult: 5.7, faces: 1, bg: "linear-gradient(145deg,#ffe680,#f08c00)", ring: "#ffc83d" },
}

// Each face: its color, the transform that places it, and the cube rotation that shows it.
const FACES: { color: Color; place: string; show: [number, number] }[] = [
  { color: "red", place: "rotateY(0deg)", show: [0, 0] },
  { color: "red", place: "rotateY(180deg)", show: [0, 180] },
  { color: "red", place: "rotateY(90deg)", show: [0, -90] },
  { color: "blue", place: "rotateY(-90deg)", show: [0, 90] },
  { color: "blue", place: "rotateX(90deg)", show: [-90, 0] },
  { color: "gold", place: "rotateX(-90deg)", show: [90, 0] },
]

export function DiceView() {
  const store = useStore()
  const [bet, setBet] = useState(50)
  const [pick, setPick] = useState<Color>("red")
  const [rot, setRot] = useState<[number, number]>([-20, 30])
  const [rolling, setRolling] = useState(false)
  const [history, setHistory] = useState<Color[]>(["red", "blue", "red", "gold", "red", "blue"])
  const [last, setLast] = useState<{ color: Color; win: boolean; payout: number } | null>(null)

  const roll = () => {
    if (rolling) return
    if (!store.spend(bet)) {
      notify("error")
      toast.error("Недостаточно монет")
      return
    }
    haptic("medium")
    setRolling(true)
    setLast(null)
    const face = FACES[Math.floor(Math.random() * FACES.length)]
    const spinsX = 360 * (3 + Math.floor(Math.random() * 2))
    const spinsY = 360 * (3 + Math.floor(Math.random() * 2))
    setRot(([x, y]) => [x - (x % 360) + spinsX + face.show[0], y - (y % 360) + spinsY + face.show[1]])
    window.setTimeout(() => {
      const win = face.color === pick
      const payout = win ? Math.floor(bet * COLORS[pick].mult) : 0
      if (win) {
        store.credit(payout)
        notify("success")
      } else notify("error")
      setLast({ color: face.color, win, payout })
      setHistory((h) => [face.color, ...h].slice(0, 14))
      setRolling(false)
    }, 1700)
  }

  return (
    <div className="space-y-5">
      <SectionTitle icon={<Dices className="size-4" />} title="Color Dice" hint="Угадай цвет грани" />

      <div className="bd-panel relative overflow-hidden p-5">
        <div className="flex gap-1.5 overflow-hidden">
          {history.map((c, i) => (
            <span key={i} className="size-5 shrink-0 rounded-md" style={{ background: COLORS[c].bg, opacity: 1 - i * 0.06 }} />
          ))}
        </div>

        <div className="dice-scene grid h-52 place-items-center">
          <div className="dice-cube" style={{ transform: `rotateX(${rot[0]}deg) rotateY(${rot[1]}deg)` }}>
            {FACES.map((f, i) => (
              <div key={i} className="dice-face grid place-items-center" style={{ background: COLORS[f.color].bg, transform: `${f.place} translateZ(48px)` }}>
                <span className="font-heading text-3xl font-extrabold text-white/90 drop-shadow">{f.color === "gold" ? "★" : "●"}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="h-10 text-center">
          {last && (
            <div className={cn("bd-pop font-heading text-lg font-extrabold", last.win ? "text-[var(--bd-lime)]" : "text-red-400")}>
              {last.win ? (
                <span className="inline-flex items-center gap-2">
                  Выигрыш <CoinAmount value={last.payout} size={18} />
                </span>
              ) : (
                `Выпал ${COLORS[last.color].label.toLowerCase()} — мимо`
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(COLORS) as Color[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                haptic()
                setPick(c)
              }}
              disabled={rolling}
              className={cn(
                "rounded-xl border-2 p-2.5 text-center transition-transform active:scale-95",
                pick === c ? "scale-[1.03]" : "border-transparent opacity-70",
              )}
              style={{ background: COLORS[c].bg, borderColor: pick === c ? "#fff" : "transparent", boxShadow: pick === c ? `0 0 22px ${COLORS[c].ring}` : "none" }}
            >
              <div className="font-heading text-sm font-extrabold text-white drop-shadow">x{COLORS[c].mult}</div>
              <div className="text-[10px] font-bold text-white/85">
                {COLORS[c].label} · {COLORS[c].faces}/6
              </div>
            </button>
          ))}
        </div>

        <BetInput value={bet} onChange={setBet} disabled={rolling} className="mt-4" />

        <button type="button" className="bd-btn mt-4 w-full py-3.5 text-base" disabled={rolling || bet <= 0 || bet > store.balance} onClick={roll}>
          {rolling ? "Бросаем…" : `Бросить · выигрыш ${Math.floor(bet * COLORS[pick].mult)}`}
        </button>
      </div>
    </div>
  )
}
