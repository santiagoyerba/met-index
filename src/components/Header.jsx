export default function Header({
  activeView,
  onViewChange,
  displayMode,
  onDisplayModeChange,
  showSearch,
  onSearchToggle,
  searchQuery,
  onSearchChange,
  showFilters,
  onFiltersToggle,
  activeTagCount,
}) {
  return (
    <header>
      <span className="site-title">Art Index</span>
      <div className="view-toggle">
        <div className="search-control">
          <input
            className={`search-input${showSearch ? ' open' : ''}`}
            type="text"
            placeholder="Search by title, artist or type…"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            tabIndex={showSearch ? 0 : -1}
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        <button
          className={showSearch ? 'active' : ''}
          onClick={onSearchToggle}
        >Search</button>
        <button
          className={showFilters || activeTagCount > 0 ? 'active' : ''}
          onClick={onFiltersToggle}
        >Filters{activeTagCount > 0 ? ` (${activeTagCount})` : ''}</button>
        <button
          className={activeView === 'catalog' && displayMode === 'list' ? 'active' : ''}
          onClick={() => onDisplayModeChange('list')}
        >List</button>
        <button
          className={activeView === 'catalog' && displayMode === 'grid' ? 'active' : ''}
          onClick={() => onDisplayModeChange('grid')}
        >Grid</button>
        <button
          className={activeView === 'map' ? 'active' : ''}
          onClick={() => onViewChange('map')}
        >Map</button>
        <button
          className={activeView === 'timeline' ? 'active' : ''}
          onClick={() => onViewChange('timeline')}
        >Timeline</button>
        <button
          className={activeView === 'stats' ? 'active' : ''}
          onClick={() => onViewChange('stats')}
        >Stats</button>
      </div>
    </header>
  );
}
