import { useCallback, useEffect, useRef } from 'react'
import type { Order } from '../lib/api'
import { rub } from '../lib/money'
import { inTelegram, showMainButton } from '../lib/telegram'

export function DoneScreen({ order, onClose }: { order: Order; onClose: () => void }) {
  // второе касание двойного нажатия «Заказать» не должно сразу закрыть экран с номером заказа
  const shownAt = useRef(Date.now())
  const close = useCallback(() => {
    if (Date.now() - shownAt.current > 800) onClose()
  }, [onClose])
  useEffect(() => showMainButton('В меню', close), [close])
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
        {!inTelegram && <button className="btn btn--primary" onClick={close}>В меню</button>}
      </div>
    </div>
  )
}
