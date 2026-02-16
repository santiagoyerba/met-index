import { useEffect, useRef } from 'react';
import { val, getLocation, parseCm, objMatchesActiveTags } from '../utils/met';

function Row({ obj, activeTags, anyActive, onClick }) {
  const hit = objMatchesActiveTags(obj, activeTags);
  const hasImage = obj.primaryImage || obj.primaryImageSmall;
  return (
    <div
      className={`table-row${anyActive && !hit ? ' dimmed' : ''}`}
      style={hasImage ? { cursor: 'pointer' } : undefined}
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

export default function ListView({ objects, activeTags, onRowClick, onLoadMore, hasMore }) {
  const sentinelRef = useRef(null);
  const anyActive = activeTags.size > 0;

  useEffect(() => {
    if (!hasMore || !sentinelRef.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) onLoadMore();
    }, { rootMargin: '200px' });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

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
            anyActive={anyActive}
            onClick={onRowClick}
          />
        ))}
      </div>
      {hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}
    </div>
  );
}
