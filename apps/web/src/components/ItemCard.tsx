import { rub } from '../lib/money'
import type { MenuItem } from '../types/menu'

export function ItemCard({ item, emoji, onAdd }: { item: MenuItem; emoji: string; onAdd: () => void }) {
  const min = Math.min(...item.variants.map((v) => v.price))
  const many = item.variants.length > 1
  return (
    <div className="card">
      <div className="card__pic" aria-hidden>
        {emoji}
      </div>
      <div className="card__body">
        <div className="card__title">
          {item.title}
          {item.hit && <span className="badge">хит</span>}
          {item.cold && <span className="badge badge--cold">❄︎</span>}
        </div>
        {item.desc && <div className="card__desc">{item.desc}</div>}
        {!item.desc && item.variants[0].label && (
          <div className="card__desc">{item.variants.map((v) => v.label).join(' / ')}</div>
        )}
        <div className="card__row">
          <div className="card__price">
            {many && <span className="card__from">от </span>}
            {rub(min)}
          </div>
          <button className="btn btn--add" onClick={onAdd} aria-label={`Добавить ${item.title}`}>
            +
          </button>
        </div>
      </div>
    </div>
  )
}
