const VISION_URL = '/mediapipe/vision_bundle.mjs';
const WASM_DIR = '/mediapipe/wasm';

export async function createTrackers(category) {
  const { FilesetResolver, FaceLandmarker, HandLandmarker } = await import(VISION_URL);
  const vision = await FilesetResolver.forVisionTasks(WASM_DIR);
  const trackers = {};

  try {
    if (category === 'earrings' || category === 'necklaces') {
      trackers.face = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: '/mediapipe/face_landmarker.task', delegate: 'GPU' },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFacialTransformationMatrixes: true,
      });
    } else {
      trackers.hand = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: '/mediapipe/hand_landmarker.task', delegate: 'GPU' },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.5,
      });
    }
    return trackers;
  } catch (error) {
    closeTrackers(trackers);
    throw error;
  }
}

export function detectTrackers(trackers, video, timestamp) {
  const result = {};
  if (trackers.face) result.face = trackers.face.detectForVideo(video, timestamp);
  if (trackers.hand) result.hand = trackers.hand.detectForVideo(video, timestamp);
  return result;
}

export function closeTrackers(trackers) {
  Object.values(trackers).forEach((tracker) => tracker.close());
}
