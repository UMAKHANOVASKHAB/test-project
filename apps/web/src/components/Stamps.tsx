import type { LoyaltyState } from '../lib/loyalty'
import { Icon } from './Icon'

const TILT = [-8, 5, -3, 9, -6]

export function Stamps({ state }: { state: LoyaltyState }) {
  return (
    <div className="stamps">
      {Array.from({ length: state.total }, (_, i) => {
        const last = i === state.total - 1
        const filled = i < state.filled
        return (
          // печати стоят чуть вразнобой, как поставленные рукой бариста
          <div
            key={i}
            className={`stamp ${filled ? 'is-filled' : ''} ${last ? 'is-gift' : ''} ${state.freeNow && last ? 'is-ready' : ''}`}
            style={filled ? { transform: `rotate(${TILT[i % TILT.length]}deg)` } : undefined}
          >
            {last ? <Icon name="gift" size={22} /> : filled ? <Icon name="cup" size={22} /> : null}
          </div>
        )
      })}
    </div>
  )
}
