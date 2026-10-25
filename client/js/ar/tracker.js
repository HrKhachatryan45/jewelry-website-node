// Pure landmark → placement math for the AR overlay.
//
// Everything is projected into *mirrored* canvas pixels first (the feed is drawn
// with scaleX(-1) so user movement feels natural), then angles and distances are
// computed from the mirrored points, so all drawing maths stays standard.
//
// Anchor rules by category (see task spec):
//  - Necklaces: the pendant hangs from the throat (below the chin / above the
//    collarbone), sized from the face; Pose supplies the collarbone tilt and
//    acts as a face-less fallback.
//  - Earrings:  the top of the earring sits on the earlobe, hanging down.
//  - Bracelets: the band is centred on the wrist, across the forearm axis.
//  - Rings:     the band is centred on the base of the ring finger.

const TUNE = {
  necklaces: {
    chainSpreadOfFace: 0.85, // chain spread → fraction of the face width
    pendantOfFace: 0.4, // fallback: pendant width → fraction of the face width
    maxWidthOfFace: 1, // never wider than the face
    throatDrop: 0.26, // × face height below the chin
    neckRise: 0.12, // × shoulder width above the shoulder line (pose mode)
  },
  earrings: { heightFactor: 0.17 }, // × face height, per earlobe
  bracelets: { widthFactor: 0.7 }, // × hand width (knuckle line)
  rings: {
    widthFactor: 0.3, // PNG ring width → fraction of hand width
    modelWidthFactor: 0.65, // GLB ring diameter → fraction of ring-finger segment
  },
};

const mir = (lm, w, h) => ({ x: (1 - lm.x) * w, y: lm.y * h });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const ang = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

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
  if (!face || !face[177] || !face[397] || !face[10] || !face[152]) return [];

  const { faceHeight } = faceMetrics(face, w, h);
  const rot =
    face[33] && face[263] ? foldLine(ang(mir(face[33], w, h), mir(face[263], w, h))) : 0; // head tilt

  const earA = mir(face[177], w, h);
  const earB = mir(face[397], w, h);
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

function handWidth(hand, w, h) {
  if (!hand[5] || !hand[17]) return 0;
  return dist(mir(hand[5], w, h), mir(hand[17], w, h));
}

export function computeRingModelPlacements(lm, w, h) {
  const out = [];
  (lm.hands || []).forEach((hand, i) => {
    if (!hand[13] || !hand[14]) return;
    const fingerStart = mir(hand[13], w, h);
    const fingerEnd = mir(hand[14], w, h);
    const fingerLength = dist(fingerStart, fingerEnd);
    if (!fingerLength) return;
    const fingerBase = lerp(fingerStart, fingerEnd, 0.25);
    out.push({
      key: `ring:${i}`,
      x: fingerBase.x,
      y: fingerBase.y,
      w: fingerLength * TUNE.rings.modelWidthFactor,
      h: fingerLength * TUNE.rings.modelWidthFactor,
      rot: foldLine(ang(fingerStart, fingerEnd) + Math.PI / 2),
    });
  });
  return out;
}

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

function placeBracelets(lm, w, h, asset) {
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
      key: `brace:${i}`,
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
    default:
      return [];
  }
}
