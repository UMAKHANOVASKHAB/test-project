import { useState } from 'react'
import menuData from './data/menu.json'
import type { Menu } from './types/menu'
import { CartProvider } from './state/CartContext'
import { BottomNav, type Tab } from './components/BottomNav'
import { MenuScreen } from './screens/Menu'
import { CartScreen } from './screens/Cart'
import { LoyaltyScreen } from './screens/Loyalty'
import { DoneScreen } from './screens/Done'
import type { Order } from './lib/api'

export const menu = menuData as Menu

export default function App() {
  const [tab, setTab] = useState<Tab>('menu')
  const [done, setDone] = useState<Order | null>(null)

  return (
    <CartProvider>
      <div className="app">
        {done ? (
          <DoneScreen order={done} onClose={() => { setDone(null); setTab('menu') }} />
        ) : (
          <>
            {tab === 'menu' && <MenuScreen menu={menu} />}
            {tab === 'cart' && <CartScreen menu={menu} onDone={setDone} onBack={() => setTab('menu')} />}
            {tab === 'loyalty' && <LoyaltyScreen menu={menu} />}
            <BottomNav tab={tab} onChange={setTab} />
          </>
        )}
      </div>
    </CartProvider>
  )
}
