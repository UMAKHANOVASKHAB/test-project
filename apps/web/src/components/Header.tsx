import type { Shop } from '../types/menu'

export function Header({ shop }: { shop: Shop }) {
  return (
    <header className="header">
      <div className="logo" aria-label={shop.name}>
        <span>B</span>
        <span className="logo__a">
          A<span className="logo__tail" />
        </span>
        <span>R</span>
      </div>
      <div className="header__info">
        <div>{shop.address}</div>
        <div>
          Ежедневно {shop.hours.open}–{shop.hours.close}
          {shop.phone && (
            <>
              ,{' '}
              <a className="header__phone" href={`tel:${shop.phone.replace(/[^+\d]/g, '')}`}>
                {shop.phone}
              </a>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
