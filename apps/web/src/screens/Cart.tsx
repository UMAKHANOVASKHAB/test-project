import { useEffect, useMemo, useState } from 'react'
import { api, type NewOrder, type Order } from '../lib/api'
import { loyaltyState, stampsForOrder } from '../lib/loyalty'
import { rub } from '../lib/money'
import { pickupSlots } from '../lib/slots'
import { currentUser, haptic, inTelegram, showBackButton, showMainButton } from '../lib/telegram'
import { cartTotal, linePrice } from '../state/cart'
import { useCart } from '../state/CartContext'
import type { Menu } from '../types/menu'

export function CartScreen({ menu, onDone, onBack }: { menu: Menu; onDone: (o: Order) => void; onBack: () => void }) {
  const { cart, dispatch } = useCart()
  const user = useMemo(currentUser, [])
  const slots = useMemo(() => pickupSlots(new Date(), menu.shop.hours.open, menu.shop.hours.close, menu.shop.pickupStepMin), [menu])
  const [slot, setSlot] = useState(slots[0] ?? '')
  const [comment, setComment] = useState('')
  const [stamps, setStamps] = useState(0)
  const [useFree, setUseFree] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.getStamps(user.id).then(setStamps)
  }, [user.id])

  const loyalty = loyaltyState(stamps, menu.shop.loyalty.stampsForFree)
  const coffeeLines = cart.lines.filter((l) => menu.shop.loyalty.countsCategories.includes(l.item.category))
  const canUseFree = loyalty.freeNow && coffeeLines.length > 0
  // бесплатный кофе: самый дешёвый кофейный напиток в корзине
  const discount = useFree && canUseFree ? Math.min(...coffeeLines.map((l) => l.variant.price)) : 0
  const total = cartTotal(cart) - discount
  const empty = cart.lines.length === 0
  const closed = slots.length === 0

  const submit = async () => {
    if (empty || closed || busy) return
    setBusy(true)
    const order: NewOrder = {
      userId: user.id,
      userName: user.name,
      lines: cart.lines.map((l) => ({
        itemId: l.item.id,
        title: l.item.title,
        variant: l.variant.label,
        addons: l.addons.map((a) => a.title),
        qty: l.qty,
        price: linePrice(l),
        category: l.item.category,
      })),
      total,
      pickupAt: slot,
      comment: comment.trim(),
      useFreeCoffee: useFree && canUseFree,
    }
    const earned = stampsForOrder(order.lines, menu.shop.loyalty.countsCategories)
    try {
      const saved = await api.createOrder(order, earned)
      dispatch({ type: 'clear' })
      haptic('success')
      onDone(saved)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => showBackButton(onBack), [onBack])
  useEffect(() => {
    if (empty || closed) return
    return showMainButton(`Заказать · ${rub(total)}`, submit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, slot, comment, useFree, empty, closed])

  if (empty) {
    return (
      <div className="screen screen--center">
        <div className="empty">
          <div className="empty__icon">🛍</div>
          <div className="empty__title">Пока пусто</div>
          <div className="empty__text">Добавьте что-нибудь из меню</div>
          <button className="btn btn--primary" onClick={onBack}>В меню</button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <h1 className="h1">Ваш заказ</h1>

      <div className="list">
        {cart.lines.map((l) => (
          <div key={l.key} className="line">
            <div className="line__body">
              <div className="line__title">{l.item.title}</div>
              <div className="line__meta">
                {[l.variant.label, ...l.addons.map((a) => a.title)].filter(Boolean).join(' · ')}
              </div>
            </div>
            <div className="qty">
              <button className="qty__btn" onClick={() => dispatch({ type: 'dec', key: l.key })}>−</button>
              <span className="qty__n">{l.qty}</span>
              <button className="qty__btn" onClick={() => dispatch({ type: 'inc', key: l.key })}>+</button>
            </div>
            <div className="line__price">{rub(linePrice(l))}</div>
          </div>
        ))}
      </div>

      {canUseFree && (
        <label className="free">
          <input type="checkbox" checked={useFree} onChange={(e) => setUseFree(e.target.checked)} />
          <span>🎁 Использовать бесплатный кофе (−{rub(Math.min(...coffeeLines.map((l) => l.variant.price)))})</span>
        </label>
      )}

      <div className="block">
        <div className="block__label">Заберу в</div>
        {closed ? (
          <div className="muted">Сегодня кофейня уже закрыта. Работаем {menu.shop.hours.open}–{menu.shop.hours.close}.</div>
        ) : (
          <div className="chips chips--scroll">
            {slots.slice(0, 16).map((s) => (
              <button key={s} className={`chip ${s === slot ? 'is-active' : ''}`} onClick={() => setSlot(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="block">
        <div className="block__label">Комментарий бариста</div>
        <textarea
          className="input"
          rows={2}
          placeholder="Например: без сахара, поменьше льда"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>

      <div className="block">
        <div className="block__label">Кто заберёт</div>
        <div className="muted">{user.name}{user.username ? ` · @${user.username}` : ''}</div>
      </div>

      <div className="total">
        {discount > 0 && <div className="total__row muted"><span>Бесплатный кофе</span><span>−{rub(discount)}</span></div>}
        <div className="total__row"><span>Итого</span><span>{rub(total)}</span></div>
        <div className="muted">Оплата при получении</div>
      </div>

      {!inTelegram && (
        <button className="btn btn--primary" disabled={closed || busy} onClick={submit}>
          {busy ? 'Отправляем…' : `Заказать · ${rub(total)}`}
        </button>
      )}
      <div className="spacer" />
    </div>
  )
}
