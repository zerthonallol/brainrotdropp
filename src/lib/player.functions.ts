import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

// Verifies Telegram WebApp initData (HMAC-SHA256, key = HMAC("WebAppData", botToken)).
async function verifyInitData(initData: string, botToken: string) {
  const params = new URLSearchParams(initData)
  const hash = params.get("hash")
  if (!hash) return null
  params.delete("hash")
  const dataCheck = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n")
  const enc = new TextEncoder()
  const k1 = await crypto.subtle.importKey("raw", enc.encode("WebAppData"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const secret = await crypto.subtle.sign("HMAC", k1, enc.encode(botToken))
  const k2 = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k2, enc.encode(dataCheck)))
  const hex = [...sig].map((b) => b.toString(16).padStart(2, "0")).join("")
  if (hex !== hash) return null
  const user = params.get("user")
  if (!user) return null
  const u = JSON.parse(user) as { id: number; first_name?: string; username?: string }
  return typeof u.id === "number" ? u : null
}

async function auth(initData: string) {
  const token = process.env["TELEGRAM_BOT_TOKEN"]
  if (!token) return null
  return verifyInitData(initData, token)
}

export const loadPlayer = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ initData: z.string().max(4096) }).parse(d))
  .handler(async ({ data }) => {
    const u = await auth(data.initData)
    if (!u) return { ok: false, state: null as string | null }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
    const { data: row } = await supabaseAdmin.from("players").select("state").eq("tg_id", u.id).maybeSingle()
    return { ok: true, state: row?.state ? JSON.stringify(row.state) : null }
  })

export const savePlayer = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ initData: z.string().max(4096), state: z.record(z.string(), z.unknown()) }).parse(d))
  .handler(async ({ data }) => {
    const u = await auth(data.initData)
    if (!u) return { ok: false }
    if (JSON.stringify(data.state).length > 500_000) return { ok: false }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
    const { error } = await supabaseAdmin.from("players").upsert({
      tg_id: u.id,
      first_name: u.first_name ?? "",
      username: u.username ?? null,
      state: data.state as never,
      updated_at: new Date().toISOString(),
    })
    if (error) console.error("savePlayer", error.message)
    return { ok: !error }
  })
