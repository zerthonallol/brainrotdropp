import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { BRAINROT_BY_ID } from "@/data/brainrots"
import { TAG, type CaseDef, type Drop } from "@/data/cases"
import {
  DEMO_INVITED_FRIENDS,
  DEMO_USER,
  type DemoUser,
} from "@/data/fixtures"
import { initTelegram, tg } from "./telegram"
import { loadPlayer, savePlayer } from "./player.functions"
import { getSettings } from "./owner.functions"
import { applyPriceOverrides, initStreamer, useLive } from "./live"
import { rollMutation, mutatedValue, type MutationId } from "@/data/mutations"

// New players start from zero: no coins, no brainrots.
export const START_BALANCE = 0
const LS_KEY = "brainrotdrop:state:v2"
const SAVE_EVERY_MS = 5000

interface SavedState {
  balance: number
  inventory: InvItem[]
  requests: TransferRequest[]
  cooldowns: Record<string, number>
  savedAt: number
}

export interface InvItem {
  uid: string
  brainrotId: string
  obtainedAt: number
  status: "owned" | "withdrawing"
  mutation?: MutationId
}

export function itemValue(i: InvItem) {
  return mutatedValue(BRAINROT_BY_ID[i.brainrotId]?.price ?? 0, i.mutation)
}

export interface Announcement {
  id: string
  text: string
  by: number | null
}

export interface TransferRequest {
  id: string
  type: "deposit" | "withdraw"
  brainrotId: string
  robloxNick: string
  creditAs?: "coins" | "brainrot"
  status: "pending" | "approved" | "rejected"
  createdAt: number
}

interface Store {
  user: DemoUser
  inTelegram: boolean
  balance: number
  inventory: InvItem[]
  requests: TransferRequest[]
  invitedFriends: number
  cooldowns: Record<string, number>
  hasTag: boolean
  canAfford: (n: number) => boolean
  spend: (n: number) => boolean
  credit: (n: number) => void
  grant: (d: Drop, opts?: { mutate?: boolean }) => InvItem | null
  tradeItem: (uid: string, brainrotId: string) => void
  announcement: Announcement | null
  refreshSettings: () => Promise<void>
  priceVersion: number
  removeItems: (uids: string[]) => void
  sellItem: (uid: string) => void
  claimCase: (c: CaseDef) => void
  caseReadyAt: (c: CaseDef) => number
  requestDeposit: (brainrotId: string, robloxNick: string, creditAs: "coins" | "brainrot") => void
  requestWithdraw: (uid: string, robloxNick: string) => void
}

// Keep one context across hot reloads so the provider and consumers always match.
const g = globalThis as { __bdStoreCtx?: import("react").Context<Store | null> }
const Ctx = (g.__bdStoreCtx ??= createContext<Store | null>(null))
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DemoUser>(DEMO_USER)
  const [inTelegram, setInTelegram] = useState(false)
  const [balance, setBalance] = useState(START_BALANCE)
  const [inventory, setInventory] = useState<InvItem[]>([])
  const [requests, setRequests] = useState<TransferRequest[]>([])
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({})
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const { priceVersion } = useLive()

  const refreshSettings = useCallback(async () => {
    try {
      const s = await getSettings()
      applyPriceOverrides(s.priceOverrides)
      setAnnouncement(s.announcement && s.announcementId ? { id: s.announcementId, text: s.announcement, by: s.announcementBy } : null)
    } catch (e) {
      console.error("getSettings failed", e)
    }
  }, [])

  useEffect(() => {
    initStreamer()
    refreshSettings()
    const t = setInterval(refreshSettings, 30_000)
    return () => clearInterval(t)
  }, [refreshSettings])

  useEffect(() => {
    // telegram-web-app.js may finish loading after hydration, so retry briefly.
    let tries = 0
    let timer: ReturnType<typeof setTimeout>
    const attempt = () => {
      const u = initTelegram()
      if (u) {
        setInTelegram(true)
        setUser({ id: u.id, firstName: u.first_name, lastName: u.last_name, username: u.username, photoUrl: u.photo_url })
      } else if (!window.Telegram && tries++ < 30) {
        timer = setTimeout(attempt, 100)
      }
    }
    attempt()
    return () => clearTimeout(timer)
  }, [])

  // ---- persistence: restore once, then autosave every 5s and when the app is hidden ----
  const [loaded, setLoaded] = useState(false)
  const apply = useCallback((st: Partial<SavedState> | null | undefined) => {
    if (!st) return
    if (typeof st.balance === "number") setBalance(st.balance)
    if (Array.isArray(st.inventory)) setInventory(st.inventory.filter((i) => BRAINROT_BY_ID[i.brainrotId]))
    if (Array.isArray(st.requests)) setRequests(st.requests)
    if (st.cooldowns && typeof st.cooldowns === "object") setCooldowns(st.cooldowns)
  }, [])

  useEffect(() => {
    let local: SavedState | null = null
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) local = JSON.parse(raw)
    } catch {
      /* ignore */
    }
    apply(local)
    let cancelled = false
    const waitTg = async () => {
      for (let i = 0; i < 30 && !tg(); i++) await new Promise((r) => setTimeout(r, 100))
      const app = tg()
      if (!app) return
      try {
        const res = await loadPlayer({ data: { initData: app.initData } })
        const remote = (res.state ? JSON.parse(res.state) : null) as Partial<SavedState> | null
        if (!cancelled && remote && (remote.savedAt ?? 0) >= (local?.savedAt ?? 0)) apply(remote)
      } catch (e) {
        console.error("loadPlayer failed", e)
      }
    }
    waitTg().finally(() => !cancelled && setLoaded(true))
    return () => {
      cancelled = true
    }
  }, [apply])

  const snapshot = useRef<SavedState | null>(null)
  snapshot.current = { balance, inventory, requests, cooldowns, savedAt: Date.now() }
  const lastSent = useRef("")

  const persist = useCallback(() => {
    const st = snapshot.current
    if (!st) return
    const body = JSON.stringify({ ...st, savedAt: 0 })
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(st))
    } catch {
      /* ignore */
    }
    if (body === lastSent.current) return
    const app = tg()
    if (!app) return
    lastSent.current = body
    savePlayer({ data: { initData: app.initData, state: st as unknown as Record<string, unknown> } }).catch((e) => {
      lastSent.current = ""
      console.error("savePlayer failed", e)
    })
  }, [])

  useEffect(() => {
    if (!loaded) return
    const t = setInterval(persist, SAVE_EVERY_MS)
    const onHide = () => document.visibilityState === "hidden" && persist()
    document.addEventListener("visibilitychange", onHide)
    window.addEventListener("pagehide", persist)
    return () => {
      clearInterval(t)
      document.removeEventListener("visibilitychange", onHide)
      window.removeEventListener("pagehide", persist)
    }
  }, [loaded, persist])

  const hasTag = `${user.firstName} ${user.lastName ?? ""}`.toLowerCase().includes(TAG)

  // Ref mirrors balance so rapid consecutive bets can't overspend between renders.
  const balanceRef = useRef(balance)
  balanceRef.current = balance
  const spend = useCallback((n: number) => {
    if (n <= 0 || balanceRef.current < n) return false
    balanceRef.current -= n
    setBalance((b) => b - n)
    return true
  }, [])

  const credit = useCallback((n: number) => setBalance((b) => b + n), [])

  const grant = useCallback((d: Drop, opts?: { mutate?: boolean }) => {
    if (d.kind === "coins") {
      setBalance((b) => b + d.amount)
      return null
    }
    const mutation = opts?.mutate ? rollMutation() : undefined
    const item: InvItem = { uid: uid(), brainrotId: d.id, obtainedAt: Date.now(), status: "owned", ...(mutation ? { mutation } : {}) }
    setInventory((inv) => [item, ...inv])
    return item
  }, [])

  const removeItems = useCallback((uids: string[]) => {
    setInventory((inv) => inv.filter((i) => !uids.includes(i.uid)))
  }, [])

  const sellItem = useCallback(
    (id: string) => {
      const it = inventory.find((i) => i.uid === id && i.status === "owned")
      if (!it || it.mutation) return
      setInventory((inv) => inv.filter((i) => i.uid !== id))
      setBalance((b) => b + (BRAINROT_BY_ID[it.brainrotId]?.price ?? 0))
    },
    [inventory],
  )

  const caseReadyAt = useCallback(
    (c: CaseDef) => {
      const last = cooldowns[c.id]
      if (!last || !c.cooldownHours) return 0
      return last + c.cooldownHours * 3600_000
    },
    [cooldowns],
  )

  const claimCase = useCallback((c: CaseDef) => {
    setCooldowns((cd) => ({ ...cd, [c.id]: Date.now() }))
  }, [])

  const requestDeposit = useCallback((brainrotId: string, robloxNick: string, creditAs: "coins" | "brainrot") => {
    setRequests((r) => [
      { id: uid(), type: "deposit", brainrotId, robloxNick, creditAs, status: "pending", createdAt: Date.now() },
      ...r,
    ])
  }, [])

  const requestWithdraw = useCallback(
    (itemUid: string, robloxNick: string) => {
      const it = inventory.find((i) => i.uid === itemUid && i.status === "owned")
      if (!it || it.mutation) return
      setInventory((inv) => inv.map((i) => (i.uid === itemUid ? { ...i, status: "withdrawing" } : i)))
      setRequests((r) => [
        { id: uid(), type: "withdraw", brainrotId: it.brainrotId, robloxNick, status: "pending", createdAt: Date.now() },
        ...r,
      ])
    },
    [inventory],
  )

  const tradeItem = useCallback((itemUid: string, brainrotId: string) => {
    setInventory((inv) =>
      inv.map((i) =>
        i.uid === itemUid && i.mutation && i.status === "owned" && BRAINROT_BY_ID[brainrotId]
          ? { uid: uid(), brainrotId, obtainedAt: Date.now(), status: "owned" }
          : i,
      ),
    )
  }, [])

  const value = useMemo<Store>(
    () => ({
      user,
      inTelegram,
      balance,
      inventory,
      requests,
      invitedFriends: DEMO_INVITED_FRIENDS,
      cooldowns,
      hasTag,
      canAfford: (n) => balance >= n,
      spend,
      credit,
      grant,
      removeItems,
      sellItem,
      claimCase,
      caseReadyAt,
      requestDeposit,
      requestWithdraw,
      tradeItem,
      announcement,
      refreshSettings,
      priceVersion,
    }),
    [tradeItem, announcement, refreshSettings, priceVersion, user, inTelegram, balance, inventory, requests, cooldowns, hasTag, spend, credit, grant, removeItems, sellItem, claimCase, caseReadyAt, requestDeposit, requestWithdraw],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error("useStore must be used inside StoreProvider")
  return s
}
