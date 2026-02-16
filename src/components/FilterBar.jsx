import { useState, useMemo } from 'react';
import { TAG_FIELDS, normalizeTag } from '../utils/met';

function buildCounts(objects) {
  const counts = new Map();
  objects.forEach(obj => {
    TAG_FIELDS.forEach(field => {
      const raw = obj[field];
      if (!raw || !raw.trim()) return;
      const v = normalizeTag(raw, field);
      counts.set(v, (counts.get(v) || 0) + 1);
    });
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

const COLLAPSE_LIMIT = 10;

export default function FilterBar({ objects, activeTags, onToggleTag }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = useMemo(() => buildCounts(objects), [objects]);
  const overflow = sorted.length - COLLAPSE_LIMIT;

  return (
    <>
      <nav id="filter-bar">
        {sorted.map(([tag, count], i) => {
          const isOverflow = i >= COLLAPSE_LIMIT;
          if (isOverflow && !expanded) return null;
          return (
            <button
              key={tag}
              className={`chip${activeTags.has(tag) ? ' active' : ''}`}
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
