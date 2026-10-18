// Demo fixtures for the product surface. Everything here is replaced by real
// API data (Telegram auth, Netlify Database) in the next milestones — see PLAN.md.
import { BRAINROTS } from "./brainrots"
import { TAG } from "./cases"

export const BOT_USERNAME = "brainrotdroppbot"
export const MINI_APP_LINK = `https://t.me/${BOT_USERNAME}?startapp=`

export interface DemoUser {
  id: number
  firstName: string
  lastName?: string
  username?: string
  photoUrl?: string
}

export const DEMO_USER: DemoUser = {
  id: 100200300,
  firstName: "Гость",
  lastName: TAG,
  username: "brainrot_guest",
}

export const DEMO_INVITED_FRIENDS = 1

const NAMES = ["Kirill", "Mila", "Den4ik", "Sasha_RB", "Lexa", "Vanya228", "Nastya", "Timur", "Egor", "Polina"]

export interface FeedItem {
  key: string
  user: string
  brainrotId: string
  source: string
}

export function randomFeedItem(): FeedItem {
  const pool = BRAINROTS.filter((b) => Math.random() < 1 / (1 + b.price / 900))
  const b = pool[Math.floor(Math.random() * pool.length)] ?? BRAINROTS[0]
  const sources = ["Кейс", "Апгрейд", "Crash", "Dice"]
  return {
    key: Math.random().toString(36).slice(2),
    user: NAMES[Math.floor(Math.random() * NAMES.length)],
    brainrotId: b.id,
    source: sources[Math.floor(Math.random() * sources.length)],
  }
}
