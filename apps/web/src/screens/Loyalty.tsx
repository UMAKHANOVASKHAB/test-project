import { useEffect, useMemo, useState } from 'react'
import { Stamps } from '../components/Stamps'
import { api, type Order } from '../lib/api'
import { loyaltyState } from '../lib/loyalty'
import { rub } from '../lib/money'
import { currentUser } from '../lib/telegram'
import type { Menu } from '../types/menu'

export function LoyaltyScreen({ menu }: { menu: Menu }) {
  const user = useMemo(currentUser, [])
  const [stamps, setStamps] = useState(0)
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    api.getStamps(user.id).then(setStamps)
    api.listOrders(user.id).then(setOrders)
  }, [user.id])

  const s = loyaltyState(stamps, menu.shop.loyalty.stampsForFree)

  return (
    <div className="screen">
      <h1 className="h1">Карта гостя</h1>
      <div className="loyalty-card">
        <div className="loyalty-card__name">{user.name}</div>
        <Stamps state={s} />
        <div className="loyalty-card__text">
          {s.freeNow
            ? 'Следующий кофе за наш счёт 🎉'
            : `Ещё ${s.left} ${plural(s.left, 'кофе', 'кофе', 'кофе')} до бесплатного`}
        </div>
        <div className="loyalty-card__hint">Каждый {menu.shop.loyalty.stampsForFree}-й кофе бесплатно. Штамп за любой кофейный напиток.</div>
      </div>

      <h2 className="h2">Мои заказы</h2>
      {orders.length === 0 && <div className="muted">Заказов пока не было</div>}
      <div className="list">
        {orders.map((o) => (
          <div key={o.id} className="order">
            <div className="order__head">
              <span>№{o.id} · {new Date(o.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} · {o.pickupAt}</span>
              <span>{rub(o.total)}</span>
            </div>
            <div className="muted">{o.lines.map((l) => `${l.title}${l.qty > 1 ? ` ×${l.qty}` : ''}`).join(', ')}</div>
          </div>
        ))}
      </div>
      <div className="spacer" />
    </div>
  )
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}
