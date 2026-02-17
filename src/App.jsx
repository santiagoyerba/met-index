import { useState, useEffect, useMemo } from 'react';
import Header from './components/Header';
import FilterBar from './components/FilterBar';
import CatalogView from './components/CatalogView';
import TimelineView from './components/TimelineView';
import Modal from './components/Modal';
import { useMETObjects } from './hooks/useMETObjects';
import { buildTagCounts, PALETTE } from './utils/met';

export default function App() {
  const [activeView, setActiveView] = useState('catalog');
  const [displayMode, setDisplayMode] = useState('list');
  const [activeTags, setActiveTags] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [modalObj, setModalObj] = useState(null);
  const { objects, status, init } = useMETObjects();

  useEffect(() => { init(); }, [init]);

  const tagColors = useMemo(() => {
    const map = new Map();
    buildTagCounts(objects).forEach(([tag], i) => {
      map.set(tag, PALETTE[i % PALETTE.length]);
    });
    return map;
  }, [objects]);

  const filteredObjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return objects;
    return objects.filter(obj =>
      (obj.title || '').toLowerCase().includes(q) ||
      (obj.artistDisplayName || '').toLowerCase().includes(q) ||
      (obj.objectName || '').toLowerCase().includes(q)
    );
  }, [objects, searchQuery]);

  function toggleTag(tag) {
    setActiveTags(prev => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  }

  function handleDisplayMode(mode) {
    setDisplayMode(mode);
    setActiveView('catalog');
  }

  function toggleSearch() {
    setShowSearch(prev => {
      if (prev) setSearchQuery('');
      return !prev;
    });
  }

  return (
    <div id="app">
      <Header
        activeView={activeView}
        onViewChange={setActiveView}
        displayMode={displayMode}
        onDisplayModeChange={handleDisplayMode}
        showSearch={showSearch}
        onSearchToggle={toggleSearch}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        showFilters={showFilters}
        onFiltersToggle={() => setShowFilters(p => !p)}
        activeTagCount={activeTags.size}
      />
      {showFilters && (
        <FilterBar
          objects={objects}
          activeTags={activeTags}
          tagColors={tagColors}
          onToggleTag={toggleTag}
        />
      )}
      <main>
        {activeView === 'catalog' && (
          <CatalogView
            objects={filteredObjects}
            activeTags={activeTags}
            tagColors={tagColors}
            onRowClick={setModalObj}
            displayMode={displayMode}
          />
        )}
        {activeView === 'timeline' && (
          <TimelineView
            objects={filteredObjects}
            activeTags={activeTags}
            tagColors={tagColors}
            onNodeClick={setModalObj}
          />
        )}
        {activeView !== 'timeline' && <div id="status">{status}</div>}
      </main>
      {modalObj && <Modal obj={modalObj} onClose={() => setModalObj(null)} />}
    </div>
  );
}
