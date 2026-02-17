import { objMatchesActiveTags } from '../utils/met';

export default function GridView({ objects, activeTags, onLoadMore, hasMore, loading }) {
  const anyActive = activeTags.size > 0;

  return (
    <div id="view-grid">
      <div id="grid-body">
        {objects.map(obj => {
          const hit = objMatchesActiveTags(obj, activeTags);
          return (
            <div key={obj.objectID} className={`grid-card${anyActive && !hit ? ' dimmed' : ''}`}>
              <img src={obj.primaryImageSmall} alt={obj.title} loading="lazy" />
            </div>
          );
        })}
      </div>
      {hasMore && (
        <div id="load-more">
          <button onClick={onLoadMore} disabled={loading}>
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
