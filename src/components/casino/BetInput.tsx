import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Coin } from "./ui"

export function BetInput({
  value,
  onChange,
  disabled,
  className,
}: {
  value: number
  onChange: (n: number) => void
  disabled?: boolean
  className?: string
}) {
  const { balance } = useStore()
  const set = (n: number) => onChange(Math.max(1, Math.min(Math.floor(n) || 1, Math.max(1, balance))))
  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative">
        <Coin size={18} className="absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="number"
          inputMode="numeric"
          min={1}
          className="bd-input pl-10 font-heading font-bold tabular-nums"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        />
      </div>
      <div className="grid grid-cols-5 gap-1.5 text-xs font-bold">
        {[
          ["½", () => set(value / 2)],
          ["x2", () => set(value * 2)],
          ["+50", () => set(value + 50)],
          ["+250", () => set(value + 250)],
          ["MAX", () => set(balance)],
        ].map(([label, fn]) => (
          <button key={label as string} type="button" disabled={disabled} onClick={fn as () => void} className="bd-btn-ghost py-1.5">
            {label as string}
          </button>
        ))}
      </div>
    </div>
  )
}
