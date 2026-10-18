import { describe, expect, it } from "vitest"
import { BRAINROT_BY_ID } from "@/data/brainrots"
import { MUTATION_BY_ID, mutatedValue, tradeOptions } from "@/data/mutations"
import { isOwner } from "@/lib/tg-auth"

describe("brainrot rules", () => {
  it("Dragon Cannelloni costs 2156", () => {
    expect(BRAINROT_BY_ID["dragon-cannelloni"].price).toBe(2156)
  })
  it("Rainbow mutation multiplies value by 10", () => {
    expect(MUTATION_BY_ID.rainbow.mult).toBe(10)
    expect(mutatedValue(1000, "rainbow")).toBe(10000)
  })
  it("trade options stay within ±10% of value", () => {
    const opts = tradeOptions([{ id: "a", price: 950 }, { id: "b", price: 1200 }, { id: "c", price: 1080 }], 1000)
    expect(opts.map((o) => o.id).sort()).toEqual(["a", "c"])
  })
  it("only Telegram id 8459031923 is owner", () => {
    expect(isOwner(8459031923)).toBe(true)
    expect(isOwner(123)).toBe(false)
  })
})
