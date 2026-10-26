import * as THREE from 'three';

export const METAL_PRESETS = Object.freeze({
  yellowGold: Object.freeze({ color: 0xd4af37, metalness: 1, roughness: 0.2 }),
  roseGold: Object.freeze({ color: 0xb76e79, metalness: 1, roughness: 0.24 }),
  whiteGold: Object.freeze({ color: 0xe6e6e6, metalness: 1, roughness: 0.2 }),
  silver: Object.freeze({ color: 0xc0c0c0, metalness: 1, roughness: 0.28 }),
});

export function createJewelryMaterial({ gemstone = false, lowQuality = false, preset = 'yellowGold' } = {}) {
  if (gemstone && !lowQuality) {
    return new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: 0.08,
      transmission: 0.8,
      thickness: 0.15,
      ior: 2.4,
      transparent: true,
      opacity: 0.95,
    });
  }
  return new THREE.MeshStandardMaterial({ ...(METAL_PRESETS[preset] || METAL_PRESETS.yellowGold) });
}
