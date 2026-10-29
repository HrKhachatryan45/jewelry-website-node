import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectDir = path.resolve(serverDir, '..');
const packageDir = path.join(serverDir, 'node_modules/@mediapipe/tasks-vision');
const destination = path.join(projectDir, 'client/mediapipe');

async function copyTaskFiles(directory) {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  const copied = [];
  for (const entry of entries) {
    const source = path.join(directory, entry.name);
    if (entry.isDirectory()) copied.push(...await copyTaskFiles(source));
    else if (entry.name.endsWith('.task')) {
      const target = path.join(destination, entry.name);
      await fs.copyFile(source, target);
      copied.push(entry.name);
    }
  }
  return copied;
}

await fs.mkdir(path.join(destination, 'wasm'), { recursive: true });
await fs.copyFile(path.join(packageDir, 'vision_bundle.mjs'), path.join(destination, 'vision_bundle.mjs'));
await fs.copyFile(
  path.join(packageDir, 'vision_bundle.mjs.map'),
  path.join(destination, 'vision_bundle_mjs.js.map'),
);
await fs.cp(path.join(packageDir, 'wasm'), path.join(destination, 'wasm'), { recursive: true });
const modelDirs = [
  path.join(serverDir, 'assets/mediapipe'),
  path.join(packageDir, 'models'),
];
const copiedModels = [];
for (const directory of modelDirs) copiedModels.push(...await copyTaskFiles(directory));
const faceLandmarkerPresent = copiedModels.includes('face_landmarker.task');
const handLandmarkerPresent = copiedModels.includes('hand_landmarker.task');

console.log('Copied MediaPipe Tasks Vision bundle and WASM files to client/mediapipe/.');
if (!faceLandmarkerPresent) console.warn('Missing face_landmarker.task. Download it into server/assets/mediapipe/; see README.md.');
if (!handLandmarkerPresent) console.warn('Missing hand_landmarker.task. Download it into server/assets/mediapipe/; see README.md.');
