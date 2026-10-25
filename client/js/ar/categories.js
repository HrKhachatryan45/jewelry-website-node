// Single source of truth for the virtual try-on.
//
// Every layer (UI copy, solver selection, placement maths) reads the category
// definition from here, so a necklace can never end up tracking a hand and a
// ring can never end up tracking a face.

export const AR_CATEGORIES = {
  necklaces: {
    id: 'necklaces',
    // Which body part the user has to show the camera.
    target: 'face',
    // Solvers are tried in order: the first one that finds its target wins.
    // 'pose' is only a fallback (used when no face is in frame).
    solvers: ['faceMesh', 'pose'],
    labelKey: 'ar.category.necklaces',
    hintKey: 'ar.hint.necklaces',
  },
  earrings: {
    id: 'earrings',
    target: 'face',
    solvers: ['faceMesh'],
    labelKey: 'ar.category.earrings',
    hintKey: 'ar.hint.earrings',
  },
  rings: {
    id: 'rings',
    target: 'hand',
    solvers: ['hands'],
    labelKey: 'ar.category.rings',
    hintKey: 'ar.hint.rings',
  },
  bracelets: {
    id: 'bracelets',
    target: 'hand',
    solvers: ['hands'],
    labelKey: 'ar.category.bracelets',
    hintKey: 'ar.hint.bracelets',
  },
};

// Categories the try-on supports (order = display order).
export const AR_CATEGORY_IDS = Object.keys(AR_CATEGORIES);

// Free-form spellings seen in the catalogue, in the admin panel and in old
// links. Everything is folded onto the canonical ids above.
const ALIASES = {
  necklace: 'necklaces',
  necklaces: 'necklaces',
  necklase: 'necklaces',
  neclace: 'necklaces',
  pendant: 'necklaces',
  pendants: 'necklaces',
  chain: 'necklaces',
  chains: 'necklaces',
  choker: 'necklaces',
  chokers: 'necklaces',
  collar: 'necklaces',
  earrings: 'earrings',
  earring: 'earrings',
  studs: 'earrings',
  drops: 'earrings',
  hoops: 'earrings',
  rings: 'rings',
  ring: 'rings',
  band: 'rings',
  bands: 'rings',
  solitaire: 'rings',
  bracelets: 'bracelets',
  bracelet: 'bracelets',
  bangle: 'bracelets',
  bangles: 'bracelets',
  cuff: 'bracelets',
  cuffs: 'bracelets',
  anklet: 'bracelets',
  anklets: 'bracelets',
  // Armenian labels used by the category picker.
  'վզնոցներ': 'necklaces',
  'վզնոց': 'necklaces',
  'ականջօղեր': 'earrings',
  'ականջօղ': 'earrings',
  'մատանիներ': 'rings',
  'մատանիներ': 'rings',
  'ապարանջաններ': 'bracelets',
  'ապարանջան': 'bracelets',
};

// Turns any catalogue value into a canonical try-on category id, or null when
// the product cannot be tried on (chains without a pendant, custom pieces...).
export function normalizeCategory(raw) {
  if (raw == null) return null;
  let key = String(raw).trim().toLowerCase();
  if (!key) return null;
  key = key.replace(/[\s-]+/g, '_');
  key = key.replace(/^(category|cat|product_?category|type)_/, '');
  if (ALIASES[key]) return ALIASES[key];
  // "necklaces" vs "necklace" — try the singular form as a fallback.
  if (key.endsWith('s') && ALIASES[key.slice(0, -1)]) return ALIASES[key.slice(0, -1)];
  return null;
}

// Canonical definition for a raw category value (null when unsupported).
export function getArCategory(raw) {
  const id = normalizeCategory(raw);
  return id ? AR_CATEGORIES[id] : null;
}

// True when the product can be tried on.
export function isTryOnCategory(raw) {
  return normalizeCategory(raw) !== null;
}
