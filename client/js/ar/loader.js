// Dynamically loads the MediaPipe CDN solutions required by a product category.
// Only the solutions a category actually needs are fetched (face tracking for
// earrings/necklaces, hand tracking for rings/bracelets) so a product page never
// pays for models it does not use. Solutions can also be loaded one by one,
// which lets the engine start with the cheap tracker and add a heavier
// fallback only when the target is not found.
//
// Every package is pinned to a version that is known to exist on the CDN and
// falls back to the "latest" tag, so a version that disappears upstream cannot
// silently kill the try-on.

const CDN = 'https://cdn.jsdelivr.net/npm';

const PACKAGES = {
  camera: {
    global: 'Camera',
    src: `${CDN}/@mediapipe/camera_utils@0.3.1675466862/camera_utils.js`,
    alt: `${CDN}/@mediapipe/camera_utils/camera_utils.js`,
  },
  faceMesh: {
    global: 'FaceMesh',
    src: `${CDN}/@mediapipe/face_mesh@0.4.1633559619/face_mesh.js`,
    alt: `${CDN}/@mediapipe/face_mesh/face_mesh.js`,
  },
  pose: {
    global: 'Pose',
    src: `${CDN}/@mediapipe/pose@0.5.1675469404/pose.js`,
    alt: `${CDN}/@mediapipe/pose/pose.js`,
  },
  hands: {
    global: 'Hands',
    src: `${CDN}/@mediapipe/hands@0.4.1675469240/hands.js`,
    alt: `${CDN}/@mediapipe/hands/hands.js`,
  },
};

const scriptCache = new Map();

function loadScript(src) {
  if (scriptCache.has(src)) return scriptCache.get(src);
  const promise = new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.crossOrigin = 'anonymous';
    el.async = true;
    el.onload = () => resolve(src);
    el.onerror = () => {
      scriptCache.delete(src);
      reject(new Error(`Failed to load ${src}`));
    };
    document.head.appendChild(el);
  });
  scriptCache.set(src, promise);
  return promise;
}

// Tries the pinned version first, then the "latest" tag. Returns the URL that
// worked, so the wasm assets can be located next to it.
async function loadPackageScript(pkg) {
  const candidates = [pkg.src, pkg.alt].filter(Boolean);
  let lastError = null;
  for (const src of candidates) {
    try {
      return await loadScript(src);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('MediaPipe script could not be loaded');
}

// Resolves to { key, Ctor, locateFile } for one MediaPipe solution.
// Throws when the package or its CDN assets cannot be loaded.
export async function loadArSolver(key) {
  const pkg = PACKAGES[key];
  if (!pkg) throw new Error(`Unknown AR solution: ${key}`);

  const src = await loadPackageScript(pkg);
  if (typeof window[pkg.global] !== 'function') {
    throw new Error(`MediaPipe global "${pkg.global}" unavailable`);
  }

  // The wasm/data assets live next to the script that was loaded.
  const base = src.replace(/\/[^/]+$/, '');

  return {
    key,
    Ctor: window[pkg.global],
    locateFile: (file) => `${base}/${file}`,
  };
}

// Camera helper used to pump frames into the solutions.
export function loadArCamera() {
  return loadArSolver('camera');
}
