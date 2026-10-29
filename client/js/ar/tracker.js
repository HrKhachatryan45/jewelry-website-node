// Pure landmark → placement math for the AR overlay.
//
// Everything is projected into the current camera preview's pixel space first,
// using the same front/rear mirror setting as the visible video.
//
// Anchor rules by category (see task spec):
//  - Necklaces: the pendant hangs from the throat (below the chin / above the
//    collarbone), sized from the face; Pose supplies the collarbone tilt and
//    acts as a face-less fallback.
//  - Earrings:  the top of the earring sits on the earlobe, hanging down.
//  - Bracelets and watches: the band is centred on the wrist, across the forearm axis.
//  - Rings:     the band is centred on the base of the ring finger.

import { mx } from './view.js';

export const DEBUG_AR = false;

const DEFAULT_AR_TUNE = Object.freeze({
  shift: -0.02,
  diameter: 1.05,
  lengthFactor: 1,
  rollDeg: 180,
  occEnabled: true,
  occDepth: 0.75,
  hole: 'auto',
  dial: 'auto',
  watchRoll: 180,
});

export function getArTune() {
  if (typeof window === 'undefined') return DEFAULT_AR_TUNE;
  if (!window.AR_TUNE || typeof window.AR_TUNE !== 'object' || Array.isArray(window.AR_TUNE)) {
    window.AR_TUNE = { ...DEFAULT_AR_TUNE };
  } else {
    Object.entries(DEFAULT_AR_TUNE).forEach(([key, value]) => {
      if (typeof value === 'boolean') {
        if (typeof window.AR_TUNE[key] !== 'boolean') window.AR_TUNE[key] = value;
      } else if (typeof value === 'string') {
        if (typeof window.AR_TUNE[key] !== 'string') window.AR_TUNE[key] = value;
      } else if (!Number.isFinite(window.AR_TUNE[key])) {
        window.AR_TUNE[key] = value;
      }
    });
  }
  return window.AR_TUNE;
}

const TUNE = {
  necklaces: {
    chainSpreadOfFace: 0.85, // chain spread → fraction of the face width
    pendantOfFace: 0.4, // fallback: pendant width → fraction of the face width
    maxWidthOfFace: 1, // never wider than the face
    throatDrop: 0.26, // × face height below the chin
    neckRise: 0.12, // × shoulder width above the shoulder line (pose mode)
    modelWidthOfFace: 0.85,
    modelDrop: 0.38, // necklace center below the chin, in face-height units
  },
  earrings: { heightFactor: 0.17, anchorRise: 0.05 }, // × face height, per earlobe
  bracelets: {
    widthFactor: 0.7, // PNG width → fraction of hand width (knuckle line)
  },
  rings: {
    widthFactor: 0.3, // PNG ring width → fraction of hand width
    modelWidthFactor: 0.65, // GLB ring diameter → fraction of ring-finger segment
  },
};

const mir = (lm, w, h) => ({ x: mx(lm.x) * w, y: lm.y * h });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const ang = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const p3 = (lm, w, h) => ({
  x: mx(lm.x) * w - w / 2,
  y: h / 2 - lm.y * h,
  z: -(lm.z || 0) * w,
});
const sub3 = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const len3 = (a) => Math.hypot(a.x, a.y, a.z);
const cross3 = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const norm3 = (a) => {
  const length = len3(a) || 1;
  return { x: a.x / length, y: a.y / length, z: a.z / length };
};

// Folding a direction into (-90°, +90°] yields the *line orientation* of two
// points. Mirroring the feed can reverse landmark ordering (an upright eye or
// shoulder line then measures 180°), which would render the product upside
// down — folding fixes that. Also keeps an upside-down limb from flipping a
// near-symmetric ring/bangle.
function foldLine(rot) {
  let r = rot;
  while (r > Math.PI / 2) r -= Math.PI;
  while (r <= -Math.PI / 2) r += Math.PI;
  return r;
}

function faceMetrics(face, w, h) {
  const chin = mir(face[152], w, h);
  const top = mir(face[10], w, h);
  const faceHeight = dist(chin, top);
  const jawL = face[172] ? mir(face[172], w, h) : chin;
  const jawR = face[397] ? mir(face[397], w, h) : chin;
  let faceWidth = dist(jawL, jawR);
  if (!faceWidth && face[234] && face[454]) faceWidth = dist(mir(face[234], w, h), mir(face[454], w, h));
  if (!faceWidth) faceWidth = faceHeight * 0.72;
  return { chin, top, faceHeight, faceWidth, jawL, jawR };
}

// Collarbone tilt: the shoulder line when the body is visible, otherwise the
// eye line — a tilted head should tilt the necklace with it.
function collarTilt(pose, face, w, h) {
  if (pose && pose[11] && pose[12]) {
    return foldLine(ang(mir(pose[11], w, h), mir(pose[12], w, h)));
  }
  if (face && face[33] && face[263]) {
    return foldLine(ang(mir(face[33], w, h), mir(face[263], w, h)));
  }
  return 0;
}

function placeNecklace(lm, w, h, asset) {
  const piece = asset.pieces[0];
  if (!piece) return [];
  const { face, pose } = lm;

  let anchor; // where the top of the pendant has to sit
  let faceWidth; // width reference (the neck is as wide as the face)
  let rot = collarTilt(pose, face, w, h);

  if (face && face[152] && face[10]) {
    const { chin, faceHeight, faceWidth: fw, jawL, jawR } = faceMetrics(face, w, h);
    anchor = {
      x: (jawL.x + jawR.x) / 2,
      y: chin.y + faceHeight * TUNE.necklaces.throatDrop,
    };
    faceWidth = fw;
  } else if (pose && pose[11] && pose[12]) {
    const sL = mir(pose[11], w, h);
    const sR = mir(pose[12], w, h);
    const shoulderWidth = dist(sL, sR);
    if (!shoulderWidth) return [];
    anchor = {
      x: (sL.x + sR.x) / 2,
      y: (sL.y + sR.y) / 2 - shoulderWidth * TUNE.necklaces.neckRise,
    };
    // Shoulder width → face height-ish reference → face width.
    faceWidth = shoulderWidth * 0.48 * 0.72;
  } else {
    return [];
  }

  // Size the necklace against the wearer's body: the chain spread is roughly
  // the width of the neck, so the pendant keeps its real proportions.
  let scale = 0;
  if (piece.spreadW > 0) {
    scale = (faceWidth * TUNE.necklaces.chainSpreadOfFace) / piece.spreadW;
  } else if (piece.pendantW > 0) {
    scale = (faceWidth * TUNE.necklaces.pendantOfFace) / piece.pendantW;
  }
  if (!scale) return [];

  let pw = piece.sw * scale;
  let ph = piece.sh * scale;
  const maxWidth = faceWidth * TUNE.necklaces.maxWidthOfFace;
  if (maxWidth && pw > maxWidth) {
    pw = maxWidth;
    ph = pw * (piece.sh / piece.sw);
  }

  return [{
    key: 'neck',
    sx: piece.sx,
    sy: piece.sy,
    sw: piece.sw,
    sh: piece.sh,
    ax: piece.ax,
    ay: piece.ay,
    x: anchor.x,
    y: anchor.y,
    w: pw,
    h: ph,
    rot,
  }];
}

function placeEarrings(lm, w, h, asset) {
  const { face } = lm;
  if (!face || !face[132] || !face[361] || !face[10] || !face[152]) return [];

  const { faceHeight } = faceMetrics(face, w, h);
  const rot =
    face[33] && face[263] ? foldLine(ang(mir(face[33], w, h), mir(face[263], w, h))) : 0; // head tilt

  const earA = mir(face[132], w, h);
  const earB = mir(face[361], w, h);
  earA.y -= faceHeight * TUNE.earrings.anchorRise;
  earB.y -= faceHeight * TUNE.earrings.anchorRise;
  const th = faceHeight * TUNE.earrings.heightFactor;

  const pieceA = asset.pieces[0];
  const pieceB = asset.pieces[1] || asset.pieces[0];
  if (!pieceA) return [];

  const make = (key, piece, at) => ({
    key,
    sx: piece.sx,
    sy: piece.sy,
    sw: piece.sw,
    sh: piece.sh,
    ax: piece.ax,
    ay: piece.ay,
    x: at.x,
    y: at.y,
    w: th * (piece.sw / piece.sh),
    h: th,
    rot,
  });

  return [make('ear:0', pieceA, earA), make('ear:1', pieceB, earB)];
}

export function computeNecklaceModelPlacements(lm, w, h) {
  const { face, pose } = lm;
  const point3d = (landmark) => p3(landmark, w, h);

  if (face?.[152] && face[10] && face[172] && face[397]) {
    const chin = point3d(face[152]);
    const jawLeft = point3d(face[172]);
    const jawRight = point3d(face[397]);
    const faceLeft = face[234] ? point3d(face[234]) : jawLeft;
    const faceRight = face[454] ? point3d(face[454]) : jawRight;
    const faceTop = point3d(face[10]);
    const faceHeight = Math.hypot(chin.x - faceTop.x, chin.y - faceTop.y);
    const faceWidth = Math.hypot(
      faceRight.x - faceLeft.x,
      faceRight.y - faceLeft.y,
      faceRight.z - faceLeft.z,
    );
    if (!faceHeight || !faceWidth) return [];

    const faceCenter = {
      x: (faceLeft.x + faceRight.x) / 2,
      y: chin.y - faceHeight * TUNE.necklaces.modelDrop,
      z: (chin.z + faceLeft.z + faceRight.z) / 3 + 8,
    };
    const screenLeft = mir(face[234] || face[172], w, h);
    const screenRight = mir(face[454] || face[397], w, h);

    return [{
      key: 'neck-model',
      pos: faceCenter,
      d: faceWidth * TUNE.necklaces.modelWidthOfFace,
      rot: foldLine(ang(screenLeft, screenRight)),
      yaw: Math.atan2(faceRight.z - faceLeft.z, faceRight.x - faceLeft.x),
    }];
  }

  if (pose?.[11] && pose[12]) {
    const leftShoulder = point3d(pose[11]);
    const rightShoulder = point3d(pose[12]);
    const shoulderWidth = Math.hypot(
      rightShoulder.x - leftShoulder.x,
      rightShoulder.y - leftShoulder.y,
      rightShoulder.z - leftShoulder.z,
    );
    if (!shoulderWidth) return [];

    return [{
      key: 'neck-model',
      pos: {
        x: (leftShoulder.x + rightShoulder.x) / 2,
        y: (leftShoulder.y + rightShoulder.y) / 2 + shoulderWidth * 0.14,
        z: (leftShoulder.z + rightShoulder.z) / 2 + 8,
      },
      d: shoulderWidth * 0.42,
      rot: foldLine(ang(mir(pose[11], w, h), mir(pose[12], w, h))),
      yaw: 0,
    }];
  }

  return [];
}

export function computeEarringModelPlacements(lm, w, h) {
  const { face } = lm;
  if (!face || !face[234] || !face[454] || !face[132] || !face[361] || !face[10] || !face[152]) return [];

  const { faceHeight } = faceMetrics(face, w, h);
  const rot =
    face[33] && face[263] ? foldLine(ang(mir(face[33], w, h), mir(face[263], w, h))) : 0;
  const leftLandmark = face[234];
  const rightLandmark = face[454];
  const point3d = (landmark) => ({
    ...mir(landmark, w, h),
    z: Number.isFinite(landmark.z) ? landmark.z * w : 0,
  });
  const leftEdge = point3d(leftLandmark);
  const rightEdge = point3d(rightLandmark);
  const [A, B] = leftLandmark.x < rightLandmark.x
    ? [leftLandmark, rightLandmark]
    : [rightLandmark, leftLandmark];
  const deltaX = B.x - A.x;
  const deltaZ = ((B.z || 0) - (A.z || 0));
  const faceWidth = Math.hypot(deltaX, deltaZ) || 1;
  const yaw = Math.atan2(deltaZ, deltaX);
  const dz = deltaZ / faceWidth;
  const hidden = leftLandmark.x < rightLandmark.x
    ? [dz < -0.22, dz > 0.22]
    : [dz > 0.22, dz < -0.22];
  const screenFaceWidth = Math.max(1, Math.abs(rightEdge.x - leftEdge.x));
  const faceCenterX = (leftEdge.x + rightEdge.x) / 2;
  const sideLobe = (edgeIndex, jawIndex) => {
    const edge = point3d(face[edgeIndex]);
    const jaw = point3d(face[jawIndex]);
    const point = {
      x: edge.x + (jaw.x - edge.x) * 0.3,
      y: edge.y + (jaw.y - edge.y) * 0.3,
      z: edge.z + (jaw.z - edge.z) * 0.3,
    };
    point.x += Math.sign(edge.x - faceCenterX) * screenFaceWidth * 0.03;
    return point;
  };
  const anchors = [
    { landmarkIndex: 234, point: sideLobe(234, 132) },
    { landmarkIndex: 454, point: sideLobe(454, 361) },
  ].sort((a, b) => a.point.x - b.point.x);
  const height = faceHeight * TUNE.earrings.heightFactor;

  return anchors.map(({ landmarkIndex, point }, index) => {
    const anatomicalIndex = landmarkIndex === 234 ? 0 : 1;
    return hidden[anatomicalIndex] ? null : ({
      key: `ear-model:${index}`,
      x: point.x,
      y: point.y,
      z: point.z,
      w: height,
      h: height,
      rot,
      yaw,
    });
  });
}

function handWidth(hand, w, h) {
  if (!hand[5] || !hand[17]) return 0;
  return dist(mir(hand[5], w, h), mir(hand[17], w, h));
}

export function computeRingModelPlacements(lm, w, h) {
  const out = [];
  (lm.hands || []).forEach((hand, i) => {
    if (![0, 5, 9, 13, 14, 17].every((index) => hand[index])) return;
    const wrist = p3(hand[0], w, h);
    const indexBase = p3(hand[5], w, h);
    const fingerStart = p3(hand[13], w, h);
    const fingerEnd = p3(hand[14], w, h);
    const pinkyBase = p3(hand[17], w, h);
    const direction = sub3(fingerEnd, fingerStart);
    const fingerLength = len3(direction);
    if (!fingerLength) return;

    const up = cross3(sub3(indexBase, wrist), sub3(pinkyBase, wrist));
    const ringPosition = 0.55;
    const fingerBase = {
      x: fingerStart.x + (fingerEnd.x - fingerStart.x) * ringPosition,
      y: fingerStart.y + (fingerEnd.y - fingerStart.y) * ringPosition,
      z: fingerStart.z + (fingerEnd.z - fingerStart.z) * ringPosition,
    };
    out.push({
      key: `ring:${i}`,
      pos: fingerBase,
      dir: direction,
      up,
      d: fingerLength * TUNE.rings.modelWidthFactor,
      fingerLen: fingerLength,
    });
  });
  return out;
}

function computeWristModelPlacements(lm, w, h, preserveHandFacing) {
  const arTune = getArTune();
  const out = [];
  (lm.hands || []).forEach((hand, i) => {
    if (![0, 5, 9, 17].every((index) => hand[index])) return;
    const wrist = p3(hand[0], w, h);
    const indexBase = p3(hand[5], w, h);
    const middleBase = p3(hand[9], w, h);
    const pinkyBase = p3(hand[17], w, h);
    const direction = sub3(wrist, middleBase);
    const directionLength = len3(direction);
    const handWidth = Math.hypot(
      indexBase.x - pinkyBase.x,
      indexBase.y - pinkyBase.y,
      indexBase.z - pinkyBase.z,
    );
    if (!directionLength || !handWidth) return;

    const normal = cross3(sub3(indexBase, wrist), sub3(pinkyBase, wrist));
    if (!preserveHandFacing && normal.z < 0) {
      normal.x = -normal.x;
      normal.y = -normal.y;
      normal.z = -normal.z;
    }

    const diameter = handWidth * arTune.diameter;
    const forearmAxis = {
      x: direction.x / directionLength,
      y: direction.y / directionLength,
      z: direction.z / directionLength,
    };
    out.push({
      key: `brace:${i}`,
      pos: {
        x: wrist.x + direction.x * arTune.shift,
        y: wrist.y + direction.y * arTune.shift,
        z: wrist.z + direction.z * arTune.shift,
      },
      dir: forearmAxis,
      up: normal,
      d: diameter,
    });
  });
  return out;
}

export function computeBraceletModelPlacements(lm, w, h) {
  return computeWristModelPlacements(lm, w, h, false);
}

export function computeWatchPlacements(lm, w, h) {
  return computeWristModelPlacements(lm, w, h, true).flatMap(({ key, pos, dir, up, d }) => {
    const projection = up.x * dir.x + up.y * dir.y + up.z * dir.z;
    const watchUp = norm3({
      x: up.x - dir.x * projection,
      y: up.y - dir.y * projection,
      z: up.z - dir.z * projection,
    });
    if (!len3(watchUp)) return [];
    return {
      key: key.replace(/^brace:/, 'watch:'),
      pos,
      fore: dir,
      up: watchUp,
      d,
    };
  });
}

export const computeWatchModelPlacements = computeWatchPlacements;

function placeRings(lm, w, h, asset) {
  const piece = asset.pieces[0];
  if (!piece) return [];
  const out = [];
  (lm.hands || []).forEach((hand, i) => {
    if (!hand[13] || !hand[14]) return;
    const handW = handWidth(hand, w, h);
    if (!handW) return;
    // The band sits at the base of the ring finger, not on the middle joint.
    const base = lerp(mir(hand[13], w, h), mir(hand[14], w, h), 0.25);
    const tw = handW * TUNE.rings.widthFactor;
    out.push({
      key: `ring:${i}`,
      sx: piece.sx,
      sy: piece.sy,
      sw: piece.sw,
      sh: piece.sh,
      ax: piece.ax,
      ay: piece.ay,
      x: base.x,
      y: base.y,
      w: tw,
      h: tw * (piece.sh / piece.sw),
      rot: foldLine(ang(mir(hand[13], w, h), mir(hand[14], w, h)) + Math.PI / 2),
    });
  });
  return out;
}

function placeBracelets(lm, w, h, asset, keyPrefix = 'brace') {
  const piece = asset.pieces[0];
  if (!piece) return [];
  const out = [];
  (lm.hands || []).forEach((hand, i) => {
    if (!hand[0] || !hand[9]) return;
    const handW = handWidth(hand, w, h);
    if (!handW) return;
    const wrist = mir(hand[0], w, h);
    const palm = mir(hand[9], w, h);
    const t = 0.12; // sit just past the wrist joint onto the hand
    const tw = handW * TUNE.bracelets.widthFactor;
    out.push({
      key: `${keyPrefix}:${i}`,
      sx: piece.sx,
      sy: piece.sy,
      sw: piece.sw,
      sh: piece.sh,
      ax: piece.ax,
      ay: piece.ay,
      x: wrist.x + (palm.x - wrist.x) * t,
      y: wrist.y + (palm.y - wrist.y) * t,
      w: tw,
      h: tw * (piece.sh / piece.sw),
      rot: foldLine(ang(wrist, palm) + Math.PI / 2), // band axis ⟂ forearm
    });
  });
  return out;
}

// lm = { face, pose, hands } — latest MediaPipe landmarks (video-space, 0..1).
// Returns [] when the body part the category needs is not in frame.
export function computePlacements(category, lm, w, h, asset) {
  if (asset?.type === 'model3d') {
    switch (category) {
      case 'necklaces':
        return computeNecklaceModelPlacements(lm, w, h);
      case 'rings':
        return computeRingModelPlacements(lm, w, h);
      case 'bracelets':
        return computeBraceletModelPlacements(lm, w, h);
      case 'watches':
        return computeWatchPlacements(lm, w, h);
      default:
        return [];
    }
  }
  if (!asset || !asset.pieces || !asset.pieces.length) return [];
  switch (category) {
    case 'necklaces':
      return placeNecklace(lm, w, h, asset);
    case 'earrings':
      return placeEarrings(lm, w, h, asset);
    case 'rings':
      return placeRings(lm, w, h, asset);
    case 'bracelets':
      return placeBracelets(lm, w, h, asset);
    case 'watches':
      return placeBracelets(lm, w, h, asset, 'watch');
    default:
      return [];
  }
}
