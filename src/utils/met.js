export const BASE = 'https://collectionapi.metmuseum.org/public/collection/v1';

export const TAG_FIELDS = ['department', 'objectName', 'country'];

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
