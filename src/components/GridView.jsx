import { useState } from 'react';
import { objMatchesActiveTags, getMatchingColors } from '../utils/met';

function GridCard({ obj, dimmed, borderStyle, onCardClick }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showPlaceholder = !obj.primaryImageSmall || imgFailed;

  return (
    <div
      className={`grid-card${dimmed ? ' dimmed' : ''}`}
      style={{ ...borderStyle, cursor: showPlaceholder ? 'default' : 'pointer' }}
      onClick={() => { if (!showPlaceholder) onCardClick(obj); }}
    >
      {showPlaceholder
        ? <div className="grid-placeholder">
            <span className="grid-placeholder-title">{obj.title}</span>
            {obj.artistDisplayName && (
              <span className="grid-placeholder-artist">{obj.artistDisplayName}</span>
            )}
            {obj.objectDate && (
              <span className="grid-placeholder-date">{obj.objectDate}</span>
            )}
          </div>
        : <img
            src={obj.primaryImageSmall}
            alt={obj.title}
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
      }
    </div>
  );
}

export default function GridView({ objects, activeTags, tagColors, onCardClick }) {
  const anyActive = activeTags.size > 0;

  return (
    <div id="view-grid">
      <div id="grid-body">
        {objects.map(obj => {
          const hit = objMatchesActiveTags(obj, activeTags);
          let borderStyle;
          if (anyActive && hit) {
            const colors = getMatchingColors(obj, activeTags, tagColors);
            if (colors.length >= 2) {
              borderStyle = { borderImage: `linear-gradient(to right, ${colors[0]}, ${colors[1]}) 1` };
            } else if (colors.length === 1) {
              borderStyle = { borderBottomColor: colors[0] };
            }
          }
          return (
            <GridCard
              key={obj.objectID}
              obj={obj}
              dimmed={anyActive && !hit}
              borderStyle={borderStyle}
              onCardClick={onCardClick}
            />
          );
        })}
      </div>
    </div>
  );
}
