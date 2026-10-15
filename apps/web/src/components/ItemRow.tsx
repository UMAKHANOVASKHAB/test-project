import { priceLabel, volumeLabel } from '../lib/menuView'
import type { MenuItem } from '../types/menu'

export function ItemRow({
  item,
  showVolume,
  inCart,
  onAdd,
}: {
  item: MenuItem
  showVolume: boolean
  inCart: number
  onAdd: () => void
}) {
  const volume = showVolume ? volumeLabel(item) : ''
  return (
    <button className={`row ${item.desc ? 'row--food' : ''}`} onClick={onAdd} aria-label={`${item.title}${volume ? `, ${volume}` : ''}, ${priceLabel(item)}${inCart ? `, в заказе ${inCart}` : ''}. Добавить`}>
      <span className="row__name">
        {item.hit && <sup className="row__hit">хит</sup>}
        {item.title}
        {item.cold && <span className="row__cold" aria-label="холодный"> ❄︎</span>}
        {volume && <sup className="row__vol">{volume}</sup>}
      </span>
      <span className="row__price">{priceLabel(item)}</span>
      <span className={`row__add ${inCart ? 'is-in' : ''}`} aria-hidden>
        {inCart || '+'}
      </span>
      {item.desc && <span className="row__desc">{item.desc}</span>}
    </button>
  )
}
