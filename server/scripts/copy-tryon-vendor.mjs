import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectDir = path.resolve(serverDir, '..');
const threeDir = path.join(serverDir, 'node_modules/three');
const destination = path.join(projectDir, 'client/vendor/three');
const addonFiles = [
  ['examples/jsm/loaders/GLTFLoader.js', 'examples/jsm/loaders/GLTFLoader.js'],
  ['examples/jsm/environments/RoomEnvironment.js', 'examples/jsm/environments/RoomEnvironment.js'],
  ['examples/jsm/utils/BufferGeometryUtils.js', 'examples/jsm/utils/BufferGeometryUtils.js'],
  ['examples/jsm/loaders/RGBELoader.js', 'examples/jsm/loaders/RGBELoader.js'],
  ['examples/jsm/loaders/HDRLoader.js', 'examples/jsm/loaders/HDRLoader.js'],
];

await fs.mkdir(destination, { recursive: true });
await fs.copyFile(path.join(threeDir, 'build/three.core.js'), path.join(destination, 'three.core.js'));
await fs.copyFile(path.join(threeDir, 'build/three.module.js'), path.join(destination, 'three.module.js'));
await fs.rm(path.join(destination, 'examples/jsm'), { recursive: true, force: true });
for (const [source, target] of addonFiles) {
  const targetPath = path.join(destination, target);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.copyFile(path.join(threeDir, source), targetPath);
}
console.log('Copied local Three.js modules to client/vendor/three/.');
