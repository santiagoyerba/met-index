import { useState, useRef, useCallback } from 'react';
import { val, getLocation, parseCm, objMatchesActiveTags, getMatchingColors } from '../utils/met';

const COLUMNS = [
  { label: '#',          key: null     },
  { label: 'Type',       key: 'type'   },
  { label: 'Title',      key: 'title'  },
  { label: 'Artist',     key: 'artist' },
  { label: 'Date',       key: 'date'   },
  { label: 'Period',     key: null     },
  { label: 'Location',   key: null     },
  { label: 'Dimensions', key: null     },
];

function Row({ obj, activeTags, tagColors, anyActive, onClick, onHover, onHoverEnd }) {
  const hit = objMatchesActiveTags(obj, activeTags);
  const hasImage = obj.primaryImage || obj.primaryImageSmall;

  let rowStyle = hasImage ? { cursor: 'pointer' } : {};
  if (anyActive && hit) {
    const colors = getMatchingColors(obj, activeTags, tagColors);
    if (colors.length > 0) rowStyle.color = colors[0];
  }

  return (
    <div
      className={`table-row${anyActive && !hit ? ' dimmed' : ''}`}
      style={rowStyle}
      onClick={hasImage ? () => onClick(obj) : undefined}
      onMouseEnter={hasImage ? () => onHover(obj) : undefined}
      onMouseLeave={hasImage ? onHoverEnd : undefined}
    >
      <span className="obj-num">{obj.objectID}</span>
      <span title={obj.objectName}>{val(obj.objectName)}</span>
      <span title={obj.title}>{val(obj.title)}</span>
      <span title={obj.artistDisplayName}>{val(obj.artistDisplayName)}</span>
      <span>{val(obj.objectDate)}</span>
      <span>{val(obj.period)}</span>
      <span>{getLocation(obj)}</span>
      <span title={obj.dimensions}>{parseCm(obj.dimensions)}</span>
    </div>
  );
}

export default function ListView({
  objects,
  activeTags,
  tagColors,
  onRowClick,
  sortConfig = { key: null, dir: 'asc' },
  onSort = () => {},
}) {
  const anyActive = activeTags.size > 0;
  const [hoveredObj, setHoveredObj] = useState(null);
  const previewRef = useRef(null);

  const handleMouseMove = useCallback((e) => {
    if (previewRef.current) {
      previewRef.current.style.left = (e.clientX + 24) + 'px';
      previewRef.current.style.top  = (e.clientY - 80) + 'px';
    }
  }, []);

  const handleHover    = useCallback((obj) => setHoveredObj(obj), []);
  const handleHoverEnd = useCallback(() => setHoveredObj(null), []);

  return (
    <div id="view-list" onMouseMove={handleMouseMove}>
      <div className="table-header">
        {COLUMNS.map(({ label, key }) => (
          <span
            key={label}
            className={key ? 'sortable' : ''}
            onClick={key ? () => onSort(key) : undefined}
          >
            {label}
            {key && sortConfig.key === key && (
              <span className="sort-arrow">{sortConfig.dir === 'asc' ? '↑' : '↓'}</span>
            )}
          </span>
        ))}
      </div>
      <div id="list-body">
        {objects.map(obj => (
          <Row
            key={obj.objectID}
            obj={obj}
            activeTags={activeTags}
            tagColors={tagColors}
            anyActive={anyActive}
            onClick={onRowClick}
            onHover={handleHover}
            onHoverEnd={handleHoverEnd}
          />
        ))}
      </div>
      {hoveredObj?.primaryImageSmall && (
        <div ref={previewRef} className="list-hover-preview">
          <img src={hoveredObj.primaryImageSmall} alt="" />
        </div>
      )}
    </div>
  );
}
