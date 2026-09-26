import type { Shop } from '../types/menu'

export function Header({ shop }: { shop: Shop }) {
  return (
    <header className="header">
      <div className="header__logo">
        B<span className="header__nine">9</span>R
      </div>
      <div className="header__info">
        <div className="header__name">{shop.name}</div>
        <div className="header__meta">
          {shop.address} · {shop.hours.open}–{shop.hours.close}
        </div>
        {shop.phone && (
          <a className="header__phone" href={`tel:${shop.phone.replace(/[^+\d]/g, '')}`}>
            {shop.phone}
          </a>
        )}
      </div>
    </header>
  )
}
