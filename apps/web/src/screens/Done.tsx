import { useEffect } from 'react'
import type { Order } from '../lib/api'
import { rub } from '../lib/money'
import { inTelegram, showMainButton } from '../lib/telegram'

export function DoneScreen({ order, onClose }: { order: Order; onClose: () => void }) {
  useEffect(() => showMainButton('В меню', onClose), [onClose])
  return (
    <div className="screen screen--center">
      <div className="done">
        <div className="done__icon">✅</div>
        <div className="done__title">Заказ №{order.id} принят</div>
        <div className="done__text">
          Будет готов к <b>{order.pickupAt}</b>. Покажите этот экран бариста.
        </div>
        <div className="done__lines">
          {order.lines.map((l, i) => (
            <div key={i} className="done__line">
              <span>{[l.title, l.variant, ...l.addons].filter(Boolean).join(' · ')}{l.qty > 1 ? ` ×${l.qty}` : ''}</span>
              <span>{rub(l.price)}</span>
            </div>
          ))}
          <div className="done__line done__line--total"><span>Итого</span><span>{rub(order.total)}</span></div>
        </div>
        {!inTelegram && <button className="btn btn--primary" onClick={onClose}>В меню</button>}
      </div>
    </div>
  )
}
