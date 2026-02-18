import { useEffect, useState } from 'react';
import { val } from '../utils/met';

export default function Modal({ obj, onClose }) {
  const [fullLoaded, setFullLoaded] = useState(false);

  const smallSrc = obj.primaryImageSmall || '';
  const fullSrc  = obj.primaryImage || obj.primaryImageSmall || '';
  const sameUrl  = !fullSrc || smallSrc === fullSrc;

  // Reset when object changes
  useEffect(() => { setFullLoaded(false); }, [obj]);

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
        {/* Thumbnail — visible immediately, sized to determine frame dimensions */}
        <img
          className="modal-img"
          src={smallSrc || fullSrc}
          alt={obj.title || ''}
        />
        {/* Full-res — absolutely overlaid, fades in when ready */}
        {!sameUrl && (
          <img
            className="modal-img modal-img-full"
            src={fullSrc}
            alt=""
            style={{ opacity: fullLoaded ? 1 : 0 }}
            onLoad={() => setFullLoaded(true)}
          />
        )}
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
