import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Box, Dices, Plus, Rocket, TrendingUp, User } from 'lucide-react'
import { BRAINROT_BY_ID, TIER_META } from '@/data/brainrots'
import { randomFeedItem, type FeedItem } from '@/data/fixtures'
import { StoreProvider, useStore } from '@/lib/store'
import { haptic } from '@/lib/telegram'
import { cn } from '@/lib/utils'
import { CasesView } from '@/components/casino/CasesView'
import { UpgraderView } from '@/components/casino/UpgraderView'
import { DiceView } from '@/components/casino/DiceView'
import { CrashView } from '@/components/casino/CrashView'
import { ProfileView } from '@/components/casino/ProfileView'
import { BrainrotImg, Coin, CoinAmount, IncomeTag, cdnImage } from '@/components/casino/ui'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'BrainrotDrop — кейсы с брейнротами' },
      { name: 'description', content: 'Telegram Mini App: открывай тематические кейсы и выбивай брейнротов из Steal a Brainrot' },
      { property: 'og:title', content: 'BrainrotDrop — кейсы с брейнротами' },
      { property: 'og:description', content: 'Хеллуин, Кристальный, Морская братва и другие кейсы с брейнротами из Steal a Brainrot' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  component: App,
})

type TabId = 'cases' | 'upgrade' | 'dice' | 'crash' | 'profile'

const TABS: { id: TabId; label: string; icon: typeof Box }[] = [
  { id: 'cases', label: 'Кейсы', icon: Box },
  { id: 'upgrade', label: 'Апгрейд', icon: TrendingUp },
  { id: 'crash', label: 'Crash', icon: Rocket },
  { id: 'dice', label: 'Dice', icon: Dices },
  { id: 'profile', label: 'Профиль', icon: User },
]

function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}

function Shell() {
  const [tab, setTab] = useState<TabId>('cases')
  // Game views stay mounted so a running Crash round or upgrade isn't lost on tab switch.
  const [visited, setVisited] = useState<Set<TabId>>(() => new Set(['cases']))
  const go = (id: TabId) => {
    haptic()
    setTab(id)
    setVisited((v) => (v.has(id) ? v : new Set(v).add(id)))
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="bd-bg min-h-dvh pb-28">
      <Header onDeposit={() => go('profile')} />
      <LiveFeed />
      <main className="mx-auto max-w-xl px-4 pt-4">
        {tab === 'cases' && <Hero onPlay={() => go('upgrade')} />}
        {TABS.map(({ id }) =>
          visited.has(id) ? (
            <section key={id} hidden={tab !== id} className={cn(tab === 'cases' && id === 'cases' && 'mt-6')}>
              {id === 'cases' && <CasesView />}
              {id === 'upgrade' && <UpgraderView />}
              {id === 'crash' && <CrashView />}
              {id === 'dice' && <DiceView />}
              {id === 'profile' && <ProfileView />}
            </section>
          ) : null,
        )}
        <Footer />
      </main>
      <BottomNav tab={tab} onChange={go} />
    </div>
  )
}

function Header({ onDeposit }: { onDeposit: () => void }) {
  const { balance } = useStore()
  return (
    <header className="sticky top-0 z-40 border-b border-white/6 bg-[#0b0716]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="relative grid size-9 place-items-center rounded-xl bg-gradient-to-br from-[#ff4fd8] to-[#7c3aed] shadow-[0_0_20px_rgba(255,79,216,.45)]">
            <img src={cdnImage(BRAINROT_BY_ID['strawberry-elephant'].image, 72)} alt="" className="size-8 object-contain" />
          </div>
          <div className="font-heading text-[17px] font-extrabold leading-none tracking-tight">
            Brainrot<span className="text-[var(--bd-lime)]">Drop</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-xl border border-white/8 bg-black/35 p-1 pl-3">
          <CoinAmount value={balance} size={18} className="text-[15px]" />
          <button type="button" onClick={onDeposit} className="bd-btn grid size-8 place-items-center !rounded-lg !shadow-none" aria-label="Пополнить">
            <Plus className="size-4" />
          </button>
        </div>
      </div>
    </header>
  )
}

function LiveFeed() {
  const [items, setItems] = useState<FeedItem[]>([])
  useEffect(() => {
    setItems(Array.from({ length: 14 }, randomFeedItem))
    const t = setInterval(() => setItems((it) => [randomFeedItem(), ...it].slice(0, 14)), 4500)
    return () => clearInterval(t)
  }, [])
  if (items.length === 0) return <div className="h-[58px]" />
  const loop = [...items, ...items]
  return (
    <div className="overflow-hidden border-b border-white/6 bg-black/20">
      <div className="bd-ticker flex w-max gap-2 px-2 py-2">
        {loop.map((f, i) => {
          const b = BRAINROT_BY_ID[f.brainrotId]
          return (
            <div
              key={f.key + i}
              className="flex h-[42px] w-[150px] shrink-0 items-center gap-2 rounded-xl border border-white/6 px-2"
              style={{ background: `linear-gradient(90deg, ${TIER_META[b.tier].glow}, transparent)` }}
            >
              <BrainrotImg b={b} size={34} />
              <div className="min-w-0 leading-tight">
                <div className="truncate text-[11px] font-bold">{b.name}</div>
                <div className="truncate text-[9px] text-white/45">
                  {f.user} · {f.source}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Hero({ onPlay }: { onPlay: () => void }) {
  const hero = BRAINROT_BY_ID['strawberry-elephant']
  const side = BRAINROT_BY_ID['la-supreme-combinasion']
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 p-5" style={{ background: 'linear-gradient(135deg,#3b0f5c 0%,#1a0b33 55%,#0f2a0a 130%)' }}>
      <div className="bd-rays pointer-events-none absolute -right-24 -top-24 size-80 opacity-40" />
      <div className="relative z-10 max-w-[58%]">
        <div className="inline-flex items-center gap-1 rounded-full bg-black/35 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--bd-lime)]">
          Steal a Brainrot · Telegram
        </div>
        <h1 className="mt-3 font-heading text-[26px] font-extrabold leading-[1.05]">
          Выбивай <span className="text-[#ff7ad9]">OG</span> брейнротов
        </h1>
        <p className="mt-2 text-xs text-white/65">Кейсы, апгрейдер, Crash и Dice. Депозит и вывод прямо в Roblox через админа.</p>
        <button type="button" onClick={onPlay} className="bd-btn mt-4 px-5 py-2.5 text-sm">
          Апгрейднуть
        </button>
      </div>
      <div className="pointer-events-none absolute -right-2 bottom-2 flex flex-col items-end">
        <img
          src={cdnImage(hero.image, 360)}
          alt={hero.name}
          fetchPriority="high"
          className="bd-float size-40 object-contain drop-shadow-[0_12px_30px_rgba(255,79,216,.55)]"
        />
        <div className="mr-3 -mt-2 flex items-center gap-1">
          <IncomeTag perSec={hero.incomePerSec} />
        </div>
      </div>
      <img src={cdnImage(side.image, 140)} alt="" className="pointer-events-none absolute bottom-3 right-36 size-14 rotate-[-8deg] object-contain opacity-90" />
      <Coin size={30} className="bd-float absolute right-6 top-6" />
      <Coin size={18} className="absolute right-44 top-10 opacity-80" />
    </div>
  )
}

function Footer() {
  return (
    <p className="mt-10 text-center text-[10px] leading-relaxed text-white/30">
      BrainrotDrop — фан-проект, не связан с Roblox Corporation. Монеты — внутриигровая валюта сайта и не выводятся в деньги.
      Данные и изображения персонажей — Steal a Brainrot Wiki (Fandom). 18+
    </p>
  )
}

function BottomNav({ tab, onChange }: { tab: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/8 bg-[#0b0716]/92 pb-[max(env(safe-area-inset-bottom),8px)] backdrop-blur-md">
      <div className="mx-auto grid max-w-xl grid-cols-5 px-2 pt-2">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={cn('flex flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] font-bold transition-colors', active ? 'text-[var(--bd-lime)]' : 'text-white/45')}
            >
              <span className={cn('grid size-9 place-items-center rounded-xl transition-all', active && 'bg-[var(--bd-lime)]/12 shadow-[0_0_18px_rgba(182,255,59,.25)]')}>
                <Icon className="size-5" />
              </span>
              {label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
