import { useEffect, useRef } from 'react';
import { objMatchesActiveTags } from '../utils/met';

export default function GridView({ objects, activeTags, onLoadMore, hasMore }) {
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
    <div id="view-grid">
      <div id="grid-body">
        {objects.map(obj => {
          const hit = objMatchesActiveTags(obj, activeTags);
          return (
            <div key={obj.objectID} className={`grid-card${anyActive && !hit ? ' dimmed' : ''}`}>
              <img
                src={obj.primaryImageSmall}
                alt={obj.title}
                loading="lazy"
              />
            </div>
          );
        })}
      </div>
      {hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}
    </div>
  );
}
