import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE = 'https://collectionapi.metmuseum.org/public/collection/v1';
const SEARCH_TERMS = ['religious', 'devotional'];
const CONCURRENCY = 1;
const RETRIES = 5;
const BASE_DELAY = 400;   // ms between each request
const RETRY_DELAY = 3000; // ms base delay for retries (multiplied by attempt)
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, attempts = RETRIES) {
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url, { headers: HEADERS });
      if (r.ok) return r.json();
      if (r.status === 404) return null;
      const delay = r.status === 429 ? 5000 : RETRY_DELAY * (i + 1);
      if (i < attempts - 1) await sleep(delay);
    } catch {
      if (i < attempts - 1) await sleep(RETRY_DELAY * (i + 1));
    }
  }
  return null;
}

async function getAllObjectIDs() {
  const allIDs = new Set();
  for (const term of SEARCH_TERMS) {
    const url = `${BASE}/search?q=${encodeURIComponent(term)}&hasImages=true`;
    const resp = await fetch(url, { headers: HEADERS });
    if (!resp.ok) { console.warn(`Search failed for "${term}": ${resp.status}`); continue; }
    const { objectIDs } = await resp.json();
    if (objectIDs) objectIDs.forEach(id => allIDs.add(id));
    console.log(`"${term}": ${objectIDs?.length ?? 0} IDs (total unique so far: ${allIDs.size})`);
    await sleep(500);
  }
  return [...allIDs];
}

async function main() {
  console.log('Fetching object IDs...');
  const objectIDs = await getAllObjectIDs();
  console.log(`Total unique IDs: ${objectIDs.length}`);

  const results = [];
  let done = 0;
  const queue = [...objectIDs];

  async function worker() {
    while (queue.length > 0) {
      const id = queue.shift();
      if (id === undefined) break;
      const obj = await fetchWithRetry(`${BASE}/objects/${id}`);
      if (obj?.objectID) results.push(obj);
      done++;
      if (done % 25 === 0 || done === objectIDs.length) {
        process.stdout.write(`\rFetched ${done}/${objectIDs.length} (${results.length} ok)   `);
      }
      await sleep(BASE_DELAY);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`\nDone. ${results.length} objects saved.`);

  const outDir = join(__dirname, '..', 'public');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'data.json'), JSON.stringify(results));
}

main().catch(err => { console.error(err); process.exit(1); });
