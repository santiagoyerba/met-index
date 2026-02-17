import { useState, useEffect } from 'react';
import { buildTagCounts, hexToRgba } from '../utils/met';

const DESKTOP_LIMIT = 30;
const MOBILE_LIMIT = 10;

export default function FilterBar({ objects, activeTags, tagColors, onToggleTag }) {
  const [expanded, setExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 700px)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 700px)');
    const handler = e => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const limit = isMobile ? MOBILE_LIMIT : DESKTOP_LIMIT;
  const sorted = buildTagCounts(objects);
  const overflow = sorted.length - limit;

  return (
    <>
      <nav id="filter-bar">
        {sorted.map(([tag, count], i) => {
          if (i >= limit && !expanded) return null;
          const color = tagColors.get(tag);
          const isActive = activeTags.has(tag);
          const chipColor = color
            ? (isActive ? color : hexToRgba(color, 0.38))
            : undefined;
          return (
            <button
              key={tag}
              className={`chip${isActive ? ' active' : ''}`}
              style={chipColor ? { color: chipColor } : undefined}
              onClick={() => onToggleTag(tag)}
            >
              <span className="chip-label">{tag}</span>
              <span className="chip-count">({count})</span>
            </button>
          );
        })}
      </nav>
      {overflow > 0 && (
        <button id="filter-toggle" onClick={() => setExpanded(e => !e)}>
          {expanded ? 'View less' : `View more (${overflow})`}
        </button>
      )}
    </>
  );
}
