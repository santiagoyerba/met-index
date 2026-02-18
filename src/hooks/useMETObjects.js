import { useState, useCallback } from 'react';

export function useMETObjects() {
  const [objects, setObjects] = useState([]);
  const [status, setStatus] = useState('');

  const init = useCallback(async () => {
    setStatus('Loading…');
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}data.json`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setObjects(data);
      setStatus(`${data.length} objects`);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  }, []);

  return { objects, status, init };
}
