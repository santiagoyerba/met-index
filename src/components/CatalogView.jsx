import { useState, useMemo } from 'react';
import ListView from './ListView';
import GridView from './GridView';

export default function CatalogView({ objects, activeTags, tagColors, onRowClick, displayMode }) {
  const [sortConfig, setSortConfig] = useState({ key: null, dir: 'asc' });

  function handleSort(key) {
    setSortConfig(prev =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    );
  }

  const sortedObjects = useMemo(() => {
    if (!sortConfig.key) return objects;
    return [...objects].sort((a, b) => {
      if (sortConfig.key === 'date') {
        const aV = a.objectBeginDate ?? null;
        const bV = b.objectBeginDate ?? null;
        if (aV === null && bV === null) {
          return sortConfig.dir === 'asc'
            ? (a.objectDate || '').localeCompare(b.objectDate || '')
            : (b.objectDate || '').localeCompare(a.objectDate || '');
        }
        if (aV === null) return 1;
        if (bV === null) return -1;
        return sortConfig.dir === 'asc' ? aV - bV : bV - aV;
      }
      const field = { type: 'objectName', title: 'title', artist: 'artistDisplayName' }[sortConfig.key];
      const aV = (a[field] || '').toLowerCase();
      const bV = (b[field] || '').toLowerCase();
      return sortConfig.dir === 'asc' ? aV.localeCompare(bV) : bV.localeCompare(aV);
    });
  }, [objects, sortConfig]);

  return (
    <div id="view-catalog">
      {displayMode === 'list' && (
        <ListView
          objects={sortedObjects}
          activeTags={activeTags}
          tagColors={tagColors}
          onRowClick={onRowClick}
          sortConfig={sortConfig}
          onSort={handleSort}
        />
      )}
      {displayMode === 'grid' && (
        <GridView
          objects={objects}
          activeTags={activeTags}
          tagColors={tagColors}
        />
      )}
    </div>
  );
}
