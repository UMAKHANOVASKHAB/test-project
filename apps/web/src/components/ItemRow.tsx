import { priceLabel, volumeLabel } from '../lib/menuView'
import type { MenuItem } from '../types/menu'
import { Icon } from './Icon'

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
  const cut = item.title.lastIndexOf(' ') + 1
  const head = item.title.slice(0, cut)
  const last = item.title.slice(cut)
  return (
    <button className={`row ${item.desc ? 'row--food' : ''}`} onClick={onAdd} aria-label={`${item.title}${volume ? `, ${volume}` : ''}, ${priceLabel(item)}${inCart ? `, в заказе ${inCart}` : ''}. Добавить`}>
      <span className="row__name">
        {item.hit && <sup className="row__hit">хит</sup>}
        {head}
        {/* значок и объём переносятся только вместе с последним словом названия */}
        <span className="row__tail">
          {last}
          {item.cold && <Icon name="snow" size={14} className="row__cold" />}
          {volume && <sup className="row__vol">{volume}</sup>}
        </span>
      </span>
      <span className="row__price">{priceLabel(item)}</span>
      <span className={`row__add ${inCart ? 'is-in' : ''}`} aria-hidden>
        {inCart || <Icon name="plus" size={16} />}
      </span>
      {item.desc && <span className="row__desc">{item.desc}</span>}
    </button>
  )
}
