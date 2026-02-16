const BASE = 'https://collectionapi.metmuseum.org/public/collection/v1';

// Fields used to generate filter tags
const TAG_FIELDS = ['department', 'objectName', 'country'];

// Explicit overrides for known synonyms (lowercase key → canonical label)
const NAME_OVERRIDES = {
  'painted panel':        'Painting',
  'painted panels':       'Painting',
  'panel painting':       'Painting',
  'panel':                'Painting',
  'paintings-icons':      'Painting',
  'diptych leaf':         'Diptych',
  'diptych':              'Diptych',
  'drawing ornament & architecture': 'Drawing',
};

function normalizeTag(value, field) {
  if (!value) return value;
  if (field === 'objectName') {
    const lower = value.toLowerCase().trim();
    if (NAME_OVERRIDES[lower]) return NAME_OVERRIDES[lower];
    // "Painting, triptych" → "Painting"
    return value.split(',')[0].trim();
  }
  return value;
}

// State
let allObjects = [];
let activeTags = new Set();

// ── Helpers ───────────────────────────────────────────────────────────────────

function val(v) {
  return (v && String(v).trim()) ? String(v).trim() : '–';
}

function getLocation(obj) {
  const parts = [obj.city, obj.country].filter(v => v && v.trim());
  if (parts.length) return parts.join(', ');
  return val(obj.culture);
}

function parseCm(str) {
  if (!str) return '–';
  const match = str.match(/\(([^)]+cm)\)/i);
  if (match) return match[1].trim();
  return '–';
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// ── Filter logic (OR) ─────────────────────────────────────────────────────────

function objMatchesActiveTags(obj) {
  if (activeTags.size === 0) return true;
  return [...activeTags].some(tag =>
    TAG_FIELDS.some(f => normalizeTag(obj[f] || '', f) === tag)
  );
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderRow(obj) {
  const row = document.createElement('div');
  row.className = 'table-row';
  row.innerHTML = `
    <span title="${esc(obj.objectName)}">${val(obj.objectName)}</span>
    <span title="${esc(obj.title)}">${val(obj.title)}</span>
    <span title="${esc(obj.artistDisplayName)}">${val(obj.artistDisplayName)}</span>
    <span>${val(obj.objectDate)}</span>
    <span>${val(obj.period)}</span>
    <span>${getLocation(obj)}</span>
    <span title="${esc(obj.dimensions)}">${parseCm(obj.dimensions)}</span>
  `;
  return row;
}

function renderCard(obj) {
  const card = document.createElement('div');
  card.className = 'grid-card';
  card.innerHTML = `<img src="${obj.primaryImageSmall}" alt="${esc(obj.title)}" loading="lazy">`;
  return card;
}

function renderAll() {
  const anyActive = activeTags.size > 0;
  const listBody  = document.getElementById('list-body');
  const gridBody  = document.getElementById('grid-body');
  const frag      = document.createDocumentFragment();
  const gfrag     = document.createDocumentFragment();

  listBody.innerHTML = '';
  gridBody.innerHTML = '';

  allObjects.forEach(obj => {
    const hit  = objMatchesActiveTags(obj);
    const row  = renderRow(obj);
    const card = renderCard(obj);
    if (anyActive && !hit) {
      row.classList.add('dimmed');
      card.classList.add('dimmed');
    }
    frag.appendChild(row);
    gfrag.appendChild(card);
  });

  listBody.appendChild(frag);
  gridBody.appendChild(gfrag);
}

// ── Filter chips ──────────────────────────────────────────────────────────────

function buildCounts() {
  const counts = new Map();
  allObjects.forEach(obj => {
    TAG_FIELDS.forEach(field => {
      const raw = obj[field];
      if (!raw || !raw.trim()) return;
      const v = normalizeTag(raw, field);
      counts.set(v, (counts.get(v) || 0) + 1);
    });
  });
  return counts;
}

function updateFilters() {
  const bar    = document.getElementById('filter-bar');
  const counts = buildCounts();

  // Sort by count desc then alpha; show all tags (count >= 1)
  const sorted = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  // Rebuild chips completely so order stays correct
  bar.innerHTML = '';
  sorted.forEach(([tag, count]) => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.dataset.tag = tag;
    if (activeTags.has(tag)) chip.classList.add('active');
    chip.innerHTML = `<span class="chip-label">${esc(tag)}</span><span class="chip-count">(${count})</span>`;
    chip.addEventListener('click', () => {
      if (activeTags.has(tag)) {
        activeTags.delete(tag);
        chip.classList.remove('active');
      } else {
        activeTags.add(tag);
        chip.classList.add('active');
      }
      renderAll();
    });
    bar.appendChild(chip);
  });
}

// ── Filter toggle (mobile) ────────────────────────────────────────────────────

function setupFilterToggle() {
  const LIMIT    = 10;
  const bar      = document.getElementById('filter-bar');
  const btn      = document.getElementById('filter-toggle');
  const chips    = [...bar.querySelectorAll('.chip')];
  const overflow = chips.slice(LIMIT);

  if (overflow.length === 0) return;

  // Mark overflow chips so CSS can hide them when bar is collapsed
  overflow.forEach(c => c.classList.add('overflow-chip'));
  bar.classList.add('collapsed');
  btn.textContent = `View more (${overflow.length})`;

  btn.addEventListener('click', () => {
    const isCollapsed = bar.classList.contains('collapsed');
    bar.classList.toggle('collapsed', !isCollapsed);
    btn.textContent = isCollapsed ? 'View less' : `View more (${overflow.length})`;
  });
}

// ── View toggle ───────────────────────────────────────────────────────────────

function setupToggle() {
  const viewList = document.getElementById('view-list');
  const viewGrid = document.getElementById('view-grid');
  const btnList  = document.getElementById('btn-list');
  const btnGrid  = document.getElementById('btn-grid');

  btnList.addEventListener('click', () => {
    viewList.classList.remove('hidden');
    viewGrid.classList.add('hidden');
    btnList.classList.add('active');
    btnGrid.classList.remove('active');
  });

  btnGrid.addEventListener('click', () => {
    viewGrid.classList.remove('hidden');
    viewList.classList.add('hidden');
    btnGrid.classList.add('active');
    btnList.classList.remove('active');
  });
}

// ── Cache ─────────────────────────────────────────────────────────────────────

const CACHE_KEY = 'met-art-index-v1';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

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
  } catch {} // ignore quota errors
}

// ── Fetch with controlled concurrency ────────────────────────────────────────

async function fetchAll(ids, concurrency, onProgress) {
  const results = [];
  const queue   = [...ids];

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

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  setupToggle();

  const status = document.getElementById('status');

  // Serve from cache when available — instant load
  const cached = getCached();
  if (cached) {
    allObjects = cached;
    renderAll();
    updateFilters();
    setupFilterToggle();
    status.textContent = `${allObjects.length} objects`;
    return;
  }

  status.textContent = 'Loading…';

  try {
    const resp = await fetch(`${BASE}/search?q=religious&hasImages=true`);
    if (!resp.ok) throw new Error(`Search failed (${resp.status})`);

    const data = await resp.json();
    if (!data.objectIDs || !data.objectIDs.length) {
      status.textContent = 'No results found.';
      return;
    }

    const ids  = data.objectIDs.slice(0, 100);
    let loaded = 0;

    // 8 concurrent workers — respects the API's rate limit
    allObjects = await fetchAll(ids, 8, () => {
      loaded++;
      status.textContent = `Loading… ${loaded} / ${ids.length}`;
    });

    setCache(allObjects);
    renderAll();
    updateFilters();
    setupFilterToggle();
    status.textContent = `${allObjects.length} objects`;

  } catch (err) {
    status.textContent = `Error: ${err.message}`;
  }
}

init();
