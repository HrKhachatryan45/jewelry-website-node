export const USE_CANONICAL_FACE_MESH = false;
export const HDRI_URL = null;

export const FACE_ANCHORS = Object.freeze({
  leftEarlobe: Object.freeze({ x: -0.075, y: -0.045, z: 0.012 }),
  rightEarlobe: Object.freeze({ x: 0.075, y: -0.045, z: 0.012 }),
  neck: Object.freeze({ x: 0, y: -0.115, z: 0.035 }),
});

export const PRODUCT_DEFAULTS = Object.freeze({
  earrings: Object.freeze({ scale: 0.055, anchorOffset: Object.freeze({ x: 0, y: -0.012, z: 0.01 }), rotationOffset: Object.freeze({ x: 0, y: 0, z: 0 }) }),
  necklaces: Object.freeze({ scale: 0.18, anchorOffset: Object.freeze({ x: 0, y: 0, z: 0 }), rotationOffset: Object.freeze({ x: 0, y: 0, z: 0 }) }),
  rings: Object.freeze({ scale: 0.018, anchorOffset: Object.freeze({ x: 0, y: 0, z: 0 }), rotationOffset: Object.freeze({ x: 0, y: 0, z: 0 }), hideWhenPalmFacesAway: false }),
  bracelets: Object.freeze({ scale: 0.055, anchorOffset: Object.freeze({ x: 0, y: 0, z: 0 }), rotationOffset: Object.freeze({ x: 0, y: 0, z: 0 }), hideWhenPalmFacesAway: false }),
});

export function loadProductMetadata(metadataUrl) {
  if (!metadataUrl) return Promise.resolve({});
  return fetch(metadataUrl).then((response) => {
    if (!response.ok) return {};
    return response.json();
  }).catch(() => ({}));
}
