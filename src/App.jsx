import { useState, useEffect, useMemo } from 'react';
import Header from './components/Header';
import FilterBar from './components/FilterBar';
import ListView from './components/ListView';
import GridView from './components/GridView';
import TimelineView from './components/TimelineView';
import Modal from './components/Modal';
import { useMETObjects } from './hooks/useMETObjects';
import { buildTagCounts, PALETTE } from './utils/met';

export default function App() {
  const [activeView, setActiveView] = useState('list');
  const [activeTags, setActiveTags] = useState(new Set());
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

  function toggleTag(tag) {
    setActiveTags(prev => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  }

  return (
    <>
      <Header activeView={activeView} onViewChange={setActiveView} />
      <FilterBar
        objects={objects}
        activeTags={activeTags}
        tagColors={tagColors}
        onToggleTag={toggleTag}
      />
      <main>
        {activeView === 'list' && (
          <ListView
            objects={objects}
            activeTags={activeTags}
            tagColors={tagColors}
            onRowClick={setModalObj}
          />
        )}
        {activeView === 'grid' && (
          <GridView
            objects={objects}
            activeTags={activeTags}
            tagColors={tagColors}
          />
        )}
        {activeView === 'timeline' && (
          <TimelineView
            objects={objects}
            activeTags={activeTags}
            tagColors={tagColors}
          />
        )}
        {activeView !== 'timeline' && <div id="status">{status}</div>}
      </main>
      {modalObj && <Modal obj={modalObj} onClose={() => setModalObj(null)} />}
    </>
  );
}
