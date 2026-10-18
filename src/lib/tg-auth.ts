// Verifies Telegram WebApp initData (HMAC-SHA256, key = HMAC("WebAppData", botToken)).
export const OWNER_TG_ID = 8459031923

export async function verifyInitData(initData: string, botToken: string) {
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

export async function authTelegram(initData: string) {
  const token = process.env["TELEGRAM_BOT_TOKEN"]
  if (!token) return null
  return verifyInitData(initData, token)
}

export function isOwner(id: number | undefined | null) {
  return id === OWNER_TG_ID
}
