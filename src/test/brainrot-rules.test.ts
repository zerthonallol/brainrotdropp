import { describe, expect, it } from "vitest"
import { BRAINROTS } from "@/data/brainrots"
import { CASES } from "@/data/cases"
import { START_BALANCE } from "@/lib/store"

describe("brainrot rules", () => {
  it("has no brainrots under 21M/s", () => {
    expect(BRAINROTS.every((b) => b.incomePerSec >= 21_000_000)).toBe(true)
  })

  it("hand-tuned prices are applied", () => {
    const byId = Object.fromEntries(BRAINROTS.map((b) => [b.id, b.price]))
    expect(byId["sammyni-spookyni"]).toBe(954)
    expect(byId["phoenix"]).toBe(6501)
    expect(byId["polaroidini"]).toBe(82123)
    expect(byId["queen-bee"]).toBe(200)
    expect(byId["garama-and-madundung"]).toBe(150)
  })

  it("has themed cases including Halloween, Crystal and Sea", () => {
    const ids = CASES.map((c) => c.id)
    expect(ids).toEqual(expect.arrayContaining(["halloween", "crystal", "sea"]))
    for (const c of CASES) expect(c.entries.length).toBeGreaterThan(2)
  })

  it("new players start with zero coins", () => {
    expect(START_BALANCE).toBe(0)
  })
})
