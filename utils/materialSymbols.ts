import { ICON_NAME_MAP } from '../components/ui/Icon';
import { ALL_PHOSPHOR_ICON_NAMES, PHOSPHOR_ICONS } from './phosphorIcons';

const EXTRA_TAGS: Record<string, string[]> = {
  weekend: ['couch', 'sofa', 'relax', 'sleep'],
  chair: ['seat', 'couch', 'sofa', 'sit'],
  living: ['couch', 'sofa', 'living_room', 'home'],
  event_seat: ['couch', 'sofa', 'seat', 'theater'],
  bed: ['sleep', 'nap', 'bedroom'],
  night_shelter: ['shelter', 'home', 'housing', 'bed', 'couch'],
  crib: ['baby', 'bed', 'infant'],
  baby_changing_station: ['baby', 'infant'],
  family_restroom: ['restroom', 'family', 'bathroom'],
  child_care: ['baby', 'kids', 'childcare'],
  pets: ['dog', 'cat', 'animal'],
  bathtub: ['bathroom', 'tub', 'shower'],
};

// Combine all Phosphor icons with existing legacy keys for backward compatibility
export const ICON_LIBRARY: string[] = Array.from(
  new Set([...ALL_PHOSPHOR_ICON_NAMES, ...Object.keys(ICON_NAME_MAP)])
);

const fuzzyMatch = (needle: string, haystack: string): boolean => {
  if (!needle) return true;
  if (!haystack) return false;

  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();

  let index = 0;
  for (let i = 0; i < h.length; i++) {
    if (h[i] === n[index]) {
      index++;
    }
    if (index === n.length) return true;
  }
  return false;
};

const buildTags = (name: string): string[] => {
  const base = name.split(/[_\-\s]+/).filter(Boolean);
  const extras = EXTRA_TAGS[name] || [];
  return Array.from(new Set([...base, ...extras]));
};

const MATERIAL_SYMBOL_METADATA = [
  ...PHOSPHOR_ICONS.map(item => ({
    name: item.name,
    tags: item.tags,
  })),
  ...Object.keys(ICON_NAME_MAP).map(name => ({
    name,
    tags: buildTags(name),
  })),
];

export const searchMaterialSymbols = (term: string): string[] => {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return [];

  const matches = MATERIAL_SYMBOL_METADATA.filter(({ name, tags }) =>
    fuzzyMatch(normalized, name) || tags.some(tag => fuzzyMatch(normalized, tag))
  );

  return Array.from(new Set(matches.map(item => item.name)));
};

export default MATERIAL_SYMBOL_METADATA;
