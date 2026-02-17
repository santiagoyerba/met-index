import { useState, useRef, useCallback } from 'react';
import { BASE } from '../utils/met';

const CACHE_KEY = 'met-art-index-v1';
const CACHE_TTL = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 50;
const CONCURRENCY = 4;

function getCached() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, objects, allIDs, loadedCount } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return { objects, allIDs: allIDs || [], loadedCount: loadedCount || BATCH_SIZE };
  } catch { return null; }
}

function setCache(objects, allIDs, loadedCount) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), objects, allIDs, loadedCount }));
  } catch {}
}

async function fetchBatch(ids) {
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
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return results;
}

export function useMETObjects() {
  const [objects, setObjects] = useState([]);
  const [status, setStatus] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const allIDsRef = useRef([]);
  const loadedCountRef = useRef(0);
  const isLoadingRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (isLoadingRef.current) return;
    const start = loadedCountRef.current;
    if (start >= allIDsRef.current.length) return;

    isLoadingRef.current = true;
    setLoading(true);
    setStatus('Loading…');

    const end = Math.min(start + BATCH_SIZE, allIDsRef.current.length);
    const batchIDs = allIDsRef.current.slice(start, end);
    const batch = await fetchBatch(batchIDs);
    loadedCountRef.current = end;

    setObjects(prev => {
      const next = [...prev, ...batch];
      setCache(next, allIDsRef.current, end);
      setStatus(`${next.length} of ${allIDsRef.current.length}`);
      return next;
    });
    setHasMore(end < allIDsRef.current.length);
    setLoading(false);
    isLoadingRef.current = false;
  }, []);

  const init = useCallback(async () => {
    const cached = getCached();
    if (cached) {
      allIDsRef.current = cached.allIDs;
      loadedCountRef.current = cached.loadedCount;
      setObjects(cached.objects);
      setHasMore(cached.loadedCount < cached.allIDs.length);
      setStatus(`${cached.objects.length} of ${cached.allIDs.length}`);
      return;
    }

    isLoadingRef.current = true;
    setLoading(true);
    setStatus('Loading…');

    try {
      const resp = await fetch(`${BASE}/search?q=religious&hasImages=true`);
      if (!resp.ok) throw new Error(`Search failed (${resp.status})`);
      const data = await resp.json();
      if (!data.objectIDs?.length) {
        setStatus('No results found.');
        setLoading(false);
        isLoadingRef.current = false;
        return;
      }

      allIDsRef.current = data.objectIDs;
      const firstBatch = data.objectIDs.slice(0, BATCH_SIZE);
      const results = await fetchBatch(firstBatch);
      loadedCountRef.current = BATCH_SIZE;

      setObjects(results);
      setCache(results, data.objectIDs, BATCH_SIZE);
      setHasMore(BATCH_SIZE < data.objectIDs.length);
      setStatus(`${results.length} of ${data.objectIDs.length}`);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }

    setLoading(false);
    isLoadingRef.current = false;
  }, []);

  return { objects, status, hasMore, loading, loadMore, init };
}
