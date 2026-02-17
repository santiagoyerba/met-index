export default function Header({ activeView, onViewChange }) {
  return (
    <header>
      <span className="site-title">Art Index</span>
      <div className="view-toggle">
        <button
          className={activeView === 'list' ? 'active' : ''}
          onClick={() => onViewChange('list')}
        >
          List
        </button>
        <button
          className={activeView === 'grid' ? 'active' : ''}
          onClick={() => onViewChange('grid')}
        >
          Grid
        </button>
        <button
          className={activeView === 'timeline' ? 'active' : ''}
          onClick={() => onViewChange('timeline')}
        >
          Timeline
        </button>
      </div>
    </header>
  );
}
