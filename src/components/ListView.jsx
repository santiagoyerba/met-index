import { val, getLocation, parseCm, objMatchesActiveTags, getMatchingColors } from '../utils/met';

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

export default function ListView({ objects, activeTags, tagColors, onRowClick }) {
  const anyActive = activeTags.size > 0;

  return (
    <div id="view-list">
      <div className="table-header">
        <span>Type</span>
        <span>Title</span>
        <span>Artist</span>
        <span>Date</span>
        <span>Period</span>
        <span>Location</span>
        <span>Dimensions</span>
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
