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
    <div className="modal" onClick={onClose}>
      <div className="modal-frame" onClick={e => e.stopPropagation()}>
        <img
          className="modal-img"
          src={obj.primaryImage || obj.primaryImageSmall || ''}
          alt={obj.title || ''}
        />
        <div className="modal-caption">
          <p className="modal-caption-title">{val(obj.title)}</p>
          {obj.artistDisplayName && <p className="modal-caption-sub">{val(obj.artistDisplayName)}</p>}
          {obj.medium && <p className="modal-caption-sub">{val(obj.medium)}</p>}
          {obj.creditLine && <p className="modal-caption-sub">{val(obj.creditLine)}</p>}
        </div>
      </div>
    </div>
  );
}
