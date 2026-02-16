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
      </div>
    </header>
  );
}
