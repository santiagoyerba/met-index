export const TAG_FIELDS = ['department', 'objectName'];

export const PALETTE = [
  '#e8b86d', // amber
  '#6de8d4', // cyan
  '#e87d6d', // coral
  '#9d8de8', // lavender
  '#8de87d', // green
  '#6db4e8', // blue
  '#e88de8', // pink
  '#e8e06d', // yellow
];

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

export function normalizeTag(value, field) {
  if (!value) return value;
  if (field === 'objectName') {
    const lower = value.toLowerCase().trim();
    if (NAME_OVERRIDES[lower]) return NAME_OVERRIDES[lower];
    return value.split(',')[0].trim();
  }
  return value;
}

export function buildTagCounts(objects) {
  const deptCounts = new Map();
  const typeCounts = new Map();

  objects.forEach(obj => {
    const dept = normalizeTag(obj.department || '', 'department');
    if (dept?.trim()) deptCounts.set(dept, (deptCounts.get(dept) || 0) + 1);

    const type = normalizeTag(obj.objectName || '', 'objectName');
    if (type?.trim()) typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
  });

  const deptTags = [...deptCounts.entries()].sort((a, b) => b[1] - a[1]);
  const typeTags = [...typeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  return [...deptTags, ...typeTags];
}

export function val(v) {
  return (v && String(v).trim()) ? String(v).trim() : '–';
}

export function getLocation(obj) {
  const parts = [obj.city, obj.country].filter(v => v && v.trim());
  if (parts.length) return parts.join(', ');
  return val(obj.culture);
}

export function parseCm(str) {
  if (!str) return '–';
  const match = str.match(/\(([^)]+cm)\)/i);
  if (match) return match[1].trim();
  return '–';
}

export function objMatchesActiveTags(obj, activeTags) {
  if (activeTags.size === 0) return true;
  return [...activeTags].some(tag =>
    TAG_FIELDS.some(f => normalizeTag(obj[f] || '', f) === tag)
  );
}

export function getMatchingColors(obj, activeTags, tagColors) {
  if (activeTags.size === 0) return [];
  return [...activeTags]
    .filter(tag => TAG_FIELDS.some(f => normalizeTag(obj[f] || '', f) === tag))
    .map(tag => tagColors.get(tag))
    .filter(Boolean);
}

export function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
