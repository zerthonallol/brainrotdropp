// Thin wrapper over the Telegram WebApp SDK (telegram-web-app.js loaded in __root).
interface TgUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
}

interface TgWebApp {
  initData: string
  initDataUnsafe: { user?: TgUser; start_param?: string }
  ready: () => void
  expand: () => void
  setHeaderColor?: (c: string) => void
  setBackgroundColor?: (c: string) => void
  openTelegramLink: (url: string) => void
  HapticFeedback?: {
    impactOccurred: (s: "light" | "medium" | "heavy" | "rigid" | "soft") => void
    notificationOccurred: (s: "error" | "success" | "warning") => void
  }
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp }
  }
}

export function tg(): TgWebApp | undefined {
  if (typeof window === "undefined") return undefined
  const app = window.Telegram?.WebApp
  return app && app.initData ? app : undefined
}

export function initTelegram() {
  const app = tg()
  if (!app) return null
  app.ready()
  app.expand()
  app.setHeaderColor?.("#0b0716")
  app.setBackgroundColor?.("#0b0716")
  return app.initDataUnsafe.user ?? null
}

export function haptic(kind: "light" | "medium" | "heavy" = "light") {
  tg()?.HapticFeedback?.impactOccurred(kind)
}

export function notify(kind: "error" | "success" | "warning") {
  tg()?.HapticFeedback?.notificationOccurred(kind)
}

export function openShare(url: string, text: string) {
  const share = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
  const app = tg()
  if (app) app.openTelegramLink(share)
  else window.open(share, "_blank", "noopener")
}
