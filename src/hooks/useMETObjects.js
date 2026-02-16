import { useState, useRef, useCallback } from 'react';
import { BASE } from '../utils/met';

const CACHE_KEY = 'met-art-index-v1';
const CACHE_TTL = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 50;
const CONCURRENCY = 8;

function getCached() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, objects } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return objects;
  } catch { return null; }
}

function setCache(objects) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), objects }));
  } catch {}
}

async function fetchBatch(ids, onProgress) {
  const results = [];
  const queue = [...ids];

  async function worker() {
    while (queue.length > 0) {
      const id = queue.shift();
      if (id === undefined) break;
      try {
        const r = await fetch(`${BASE}/objects/${id}`);
        if (r.ok) {
          const obj = await r.json();
          if (obj?.objectID) results.push(obj);
        }
      } catch {}
      onProgress();
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return results;
}

export function useMETObjects() {
  const [objects, setObjects] = useState([]);
  const [status, setStatus] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const allIDsRef = useRef([]);
  const loadedCountRef = useRef(0);
  const isLoadingRef = useRef(false);

  const loadBatch = useCallback(async (ids) => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    let fetched = 0;
    const batch = await fetchBatch(ids, () => {
      fetched++;
      setStatus(`Loading… ${loadedCountRef.current + fetched} / ${allIDsRef.current.length}`);
    });

    loadedCountRef.current += ids.length;
    setObjects(prev => {
      const next = [...prev, ...batch];
      return next;
    });
    setHasMore(loadedCountRef.current < allIDsRef.current.length);
    isLoadingRef.current = false;
  }, []);

  const loadMore = useCallback(() => {
    const start = loadedCountRef.current;
    const end = Math.min(start + BATCH_SIZE, allIDsRef.current.length);
    if (start >= allIDsRef.current.length) return;
    const nextBatch = allIDsRef.current.slice(start, end);
    loadBatch(nextBatch);
  }, [loadBatch]);

  const init = useCallback(async () => {
    const cached = getCached();
    if (cached) {
      setObjects(cached);
      setStatus(`${cached.length} objects`);
      setHasMore(false);
      return;
    }

    setStatus('Loading…');

    try {
      const resp = await fetch(`${BASE}/search?q=religious&hasImages=true`);
      if (!resp.ok) throw new Error(`Search failed (${resp.status})`);

      const data = await resp.json();
      if (!data.objectIDs?.length) {
        setStatus('No results found.');
        return;
      }

      allIDsRef.current = data.objectIDs;
      loadedCountRef.current = 0;

      const firstBatch = data.objectIDs.slice(0, BATCH_SIZE);
      let fetched = 0;
      const results = await fetchBatch(firstBatch, () => {
        fetched++;
        setStatus(`Loading… ${fetched} / ${data.objectIDs.length}`);
      });

      loadedCountRef.current = BATCH_SIZE;
      setObjects(results);
      setHasMore(BATCH_SIZE < data.objectIDs.length);

      setCache(results);
      setStatus(`${results.length} objects loaded`);

    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  }, []);

  return { objects, status, hasMore, loadMore, init };
}
