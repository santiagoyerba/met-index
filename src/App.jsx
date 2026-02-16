import { useState, useEffect } from 'react';
import Header from './components/Header';
import FilterBar from './components/FilterBar';
import ListView from './components/ListView';
import GridView from './components/GridView';
import Modal from './components/Modal';
import { useMETObjects } from './hooks/useMETObjects';

export default function App() {
  const [activeView, setActiveView] = useState('list');
  const [activeTags, setActiveTags] = useState(new Set());
  const [modalObj, setModalObj] = useState(null);
  const { objects, status, hasMore, loadMore, init } = useMETObjects();

  useEffect(() => { init(); }, [init]);

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
      <FilterBar objects={objects} activeTags={activeTags} onToggleTag={toggleTag} />
      <main>
        {activeView === 'list' ? (
          <ListView
            objects={objects}
            activeTags={activeTags}
            onRowClick={setModalObj}
            onLoadMore={loadMore}
            hasMore={hasMore}
          />
        ) : (
          <GridView
            objects={objects}
            activeTags={activeTags}
            onLoadMore={loadMore}
            hasMore={hasMore}
          />
        )}
        <div id="status">{status}</div>
      </main>
      {modalObj && <Modal obj={modalObj} onClose={() => setModalObj(null)} />}
    </>
  );
}
