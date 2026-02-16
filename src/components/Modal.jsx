import { useEffect } from 'react';
import { val } from '../utils/met';

export default function Modal({ obj, onClose }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div id="modal" className="modal" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-header">
        <button id="modal-close" onClick={onClose}>Close</button>
      </div>
      <div className="modal-inner">
        <img
          id="modal-img"
          src={obj.primaryImage || obj.primaryImageSmall || ''}
          alt={obj.title || ''}
        />
        <div className="modal-info">
          <p id="modal-title">{val(obj.title)}</p>
          <p id="modal-artist">{val(obj.artistDisplayName)}</p>
          <p id="modal-medium">{val(obj.medium)}</p>
          <p id="modal-credit">{val(obj.creditLine)}</p>
        </div>
      </div>
    </div>
  );
}
