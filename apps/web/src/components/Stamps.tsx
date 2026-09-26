import type { LoyaltyState } from '../lib/loyalty'

export function Stamps({ state }: { state: LoyaltyState }) {
  return (
    <div className="stamps">
      {Array.from({ length: state.total }, (_, i) => {
        const last = i === state.total - 1
        const filled = i < state.filled
        return (
          <div key={i} className={`stamp ${filled ? 'is-filled' : ''} ${last ? 'is-gift' : ''} ${state.freeNow && last ? 'is-ready' : ''}`}>
            {last ? '🎁' : filled ? '☕️' : ''}
          </div>
        )
      })}
    </div>
  )
}
