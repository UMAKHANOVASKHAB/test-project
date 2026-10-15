import { cartCount } from '../state/cart'
import { useCart } from '../state/CartContext'
import { Icon, type IconName } from './Icon'

export type Tab = 'menu' | 'cart' | 'loyalty'

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const { cart } = useCart()
  const n = cartCount(cart)
  const items: { id: Tab; label: string; icon: IconName }[] = [
    { id: 'menu', label: 'Меню', icon: 'cup' },
    { id: 'cart', label: 'Заказ', icon: 'bag' },
    { id: 'loyalty', label: 'Штампы', icon: 'gift' },
  ]
  return (
    <nav className="nav">
      {items.map((it) => (
        <button
          key={it.id}
          className={`nav__btn ${tab === it.id ? 'is-active' : ''}`}
          aria-current={tab === it.id ? 'page' : undefined}
          aria-label={it.id === 'cart' && n > 0 ? `${it.label}, позиций: ${n}` : it.label}
          onClick={() => onChange(it.id)}
        >
          <span className="nav__icon" aria-hidden>
            <Icon name={it.icon} />
            {it.id === 'cart' && n > 0 && <span className="nav__badge">{n}</span>}
          </span>
          <span aria-hidden>{it.label}</span>
        </button>
      ))}
    </nav>
  )
}
