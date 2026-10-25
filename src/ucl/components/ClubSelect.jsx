import { useModalA11y } from '../../hooks/useModalA11y.js'
import Crest from './Crest.jsx'

// Single-select club picker shown as a modal over the match list (the Champions
// League twin of the World Cup's CountrySelect). The caller owns the selected
// club and clears it via the row's ✕.
export default function ClubSelect({ clubs, selected, onSelect, onClose }) {
  const cardRef = useModalA11y(onClose)
  const choose = (club) => {
    onSelect(club)
    onClose()
  }

  return (
    <div className="md-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Filter by club">
      <div className="cs-card md-card" ref={cardRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <button className="md-close" onClick={onClose} aria-label="Close">✕</button>
        <h2 className="cs-title">Filter by club</h2>
        <div className="cs-list">
          <button
            type="button"
            className={`cs-item cs-item-all${selected == null ? ' active' : ''}`}
            onClick={() => choose(null)}
          >
            <span className="cs-flag">⭐</span>
            <span className="cs-name">All clubs</span>
          </button>
          {clubs.map((c) => (
            <button
              type="button"
              key={c.id}
              className={`cs-item${selected?.id === c.id ? ' active' : ''}`}
              aria-pressed={selected?.id === c.id}
              onClick={() => choose(c)}
            >
              <Crest club={c} className="cs-crest" />
              <span className="cs-name">{c.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
