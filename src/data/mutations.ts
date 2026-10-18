// Mutations from the Steal a Brainrot wiki. Multiplier boosts the coin value of a brainrot.
// Mutated brainrots can't be sold or withdrawn — only traded for a plain brainrot of similar value.
export type MutationId =
  | "gold"
  | "diamond"
  | "bloodrot"
  | "candy"
  | "lava"
  | "galaxy"
  | "yinyang"
  | "radioactive"
  | "cursed"
  | "rainbow"

export interface Mutation {
  id: MutationId
  name: string
  mult: number
  chance: number // per brainrot drop from a case
  color: string
}

export const MUTATIONS: Mutation[] = [
  { id: "gold", name: "Gold", mult: 1.25, chance: 0.03, color: "#ffc83d" },
  { id: "diamond", name: "Diamond", mult: 1.5, chance: 0.015, color: "#5eead4" },
  { id: "bloodrot", name: "Bloodrot", mult: 2, chance: 0.006, color: "#ef4444" },
  { id: "candy", name: "Candy", mult: 4, chance: 0.003, color: "#f9a8d4" },
  { id: "lava", name: "Lava", mult: 6, chance: 0.002, color: "#fb923c" },
  { id: "galaxy", name: "Galaxy", mult: 7, chance: 0.0015, color: "#a855f7" },
  { id: "yinyang", name: "Yin Yang", mult: 7.5, chance: 0.0012, color: "#e5e7eb" },
  { id: "radioactive", name: "Radioactive", mult: 8.5, chance: 0.001, color: "#84cc16" },
  { id: "cursed", name: "Cursed", mult: 9, chance: 0.0008, color: "#7f1d1d" },
  { id: "rainbow", name: "Rainbow", mult: 10, chance: 0.0005, color: "#ff4fd8" },
]

export const MUTATION_BY_ID = Object.fromEntries(MUTATIONS.map((m) => [m.id, m])) as Record<MutationId, Mutation>

export function rollMutation(rand: () => number = Math.random): MutationId | undefined {
  let r = rand()
  for (const m of MUTATIONS) {
    if (r < m.chance) return m.id
    r -= m.chance
  }
  return undefined
}

export function mutatedValue(price: number, mutation?: MutationId) {
  return mutation ? Math.round(price * MUTATION_BY_ID[mutation].mult) : price
}

/** Plain brainrots a mutated one can be traded for: value within ±10%. */
export function tradeOptions<T extends { id: string; price: number }>(list: T[], value: number, excludeId?: string) {
  const near = list.filter((b) => b.id !== excludeId && b.price >= value * 0.9 && b.price <= value * 1.1)
  if (near.length) return near.sort((a, b) => b.price - a.price)
  return [...list]
    .filter((b) => b.id !== excludeId && b.price <= value * 1.1)
    .sort((a, b) => Math.abs(a.price - value) - Math.abs(b.price - value))
    .slice(0, 3)
}
