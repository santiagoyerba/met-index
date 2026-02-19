import { useState, useEffect, useRef } from 'react';
import { objMatchesActiveTags, getMatchingColors } from '../utils/met';

// Which positions in a repeating cycle get a 2×2 featured card
const SPAN_PATTERN = [1, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1];

function GridCard({ obj, span, dimmed, borderStyle, onCardClick }) {
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [visible, setVisible] = useState(false);
  const cardRef = useRef(null);
  const showPlaceholder = !obj.primaryImageSmall || imgFailed;

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.05 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const spanStyle = span > 1
    ? { gridColumn: `span ${span}`, gridRow: `span ${span}` }
    : {};

  return (
    <div
      ref={cardRef}
      className={`grid-card${dimmed ? ' dimmed' : ''}${visible ? ' in-view' : ''}`}
      style={{ ...borderStyle, ...spanStyle, cursor: showPlaceholder ? 'default' : 'pointer' }}
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
            className={imgLoaded ? 'loaded' : ''}
            onLoad={() => setImgLoaded(true)}
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
        {objects.map((obj, i) => {
          const hit = objMatchesActiveTags(obj, activeTags);
          const span = SPAN_PATTERN[i % SPAN_PATTERN.length];
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
              span={span}
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
