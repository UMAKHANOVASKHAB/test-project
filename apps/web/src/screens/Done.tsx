import { useCallback, useEffect, useRef } from 'react'
import type { Order } from '../lib/api'
import { rub } from '../lib/money'
import { inTelegram, showMainButton } from '../lib/telegram'
import { Icon } from '../components/Icon'

export function DoneScreen({ order, onClose }: { order: Order; onClose: () => void }) {
  // второе касание двойного нажатия «Заказать» не должно сразу закрыть экран с номером заказа
  const shownAt = useRef(Date.now())
  const close = useCallback(() => {
    if (Date.now() - shownAt.current > 800) onClose()
  }, [onClose])
  useEffect(() => showMainButton('В меню', close), [close])
  return (
    <div className="screen screen--center">
      <div className="ticket" role="status">
        <div className="ticket__head">
          <span className="ticket__check"><Icon name="check" size={18} /></span>
          Заказ принят
        </div>
        <div className="ticket__no" aria-label={`Номер заказа ${order.id}`}>
          <span className="ticket__hash" aria-hidden>№</span>
          {order.id}
        </div>
        <div className="ticket__time">
          Будет готов к <b>{order.pickupAt}</b>
        </div>
        <div className="ticket__tear" aria-hidden />
        <div className="ticket__lines">
          {order.lines.map((l, i) => (
            <div key={i} className="ticket__line">
              <span>{[l.title, l.variant, ...l.addons].filter(Boolean).join(' · ')}{l.qty > 1 ? ` ×${l.qty}` : ''}</span>
              <span>{rub(l.price)}</span>
            </div>
          ))}
          <div className="ticket__line ticket__line--total"><span>Итого</span><span>{rub(order.total)}</span></div>
        </div>
        <div className="ticket__foot">Покажите этот экран бариста</div>
        {!inTelegram && <button className="btn btn--primary" onClick={close}>В меню</button>}
      </div>
    </div>
  )
}
