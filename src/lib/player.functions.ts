import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { authTelegram as auth } from "./tg-auth"

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
