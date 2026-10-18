import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { authTelegram, isOwner } from "./tg-auth"

export interface PublicSettings {
  priceOverrides: Record<string, number>
  announcement: string | null
  announcementId: string | null
  announcementBy: number | null
}

export const getSettings = createServerFn({ method: "GET" }).handler(async (): Promise<PublicSettings> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
  const { data } = await supabaseAdmin.from("app_settings").select("*").eq("id", 1).maybeSingle()
  return {
    priceOverrides: (data?.price_overrides as Record<string, number> | null) ?? {},
    announcement: data?.announcement ?? null,
    announcementId: data?.announcement_id ?? null,
    announcementBy: data?.announcement_by ?? null,
  }
})

async function requireOwner(initData: string) {
  const u = await authTelegram(initData)
  if (!u || !isOwner(u.id)) throw new Error("Нет доступа")
  return u
}

export const ownerSetPrice = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ initData: z.string().max(4096), id: z.string().max(80), price: z.number().int().min(1).max(100_000_000).nullable() }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireOwner(data.initData)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
    const { data: row } = await supabaseAdmin.from("app_settings").select("price_overrides").eq("id", 1).maybeSingle()
    const map = { ...((row?.price_overrides as Record<string, number> | null) ?? {}) }
    if (data.price === null) delete map[data.id]
    else map[data.id] = data.price
    const { error } = await supabaseAdmin.from("app_settings").upsert({ id: 1, price_overrides: map, updated_at: new Date().toISOString() })
    if (error) throw new Error(error.message)
    return { ok: true, priceOverrides: map }
  })

export const ownerAnnounce = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ initData: z.string().max(4096), text: z.string().max(300).nullable() }).parse(d))
  .handler(async ({ data }) => {
    const u = await requireOwner(data.initData)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
    const text = data.text?.trim() || null
    const { error } = await supabaseAdmin.from("app_settings").upsert({
      id: 1,
      announcement: text,
      announcement_id: text ? crypto.randomUUID() : null,
      announcement_by: text ? u.id : null,
      updated_at: new Date().toISOString(),
    })
    if (error) throw new Error(error.message)
    return { ok: true }
  })
