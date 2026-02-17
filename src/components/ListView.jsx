import { val, getLocation, parseCm, objMatchesActiveTags, getMatchingColors } from '../utils/met';

const COLUMNS = [
  { label: 'Type',       key: 'type'   },
  { label: 'Title',      key: 'title'  },
  { label: 'Artist',     key: 'artist' },
  { label: 'Date',       key: 'date'   },
  { label: 'Period',     key: null     },
  { label: 'Location',   key: null     },
  { label: 'Dimensions', key: null     },
];

function Row({ obj, activeTags, tagColors, anyActive, onClick }) {
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
    >
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

  return (
    <div id="view-list">
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
          />
        ))}
      </div>
    </div>
  );
}
