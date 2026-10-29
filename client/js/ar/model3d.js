import { DEBUG_AR, getArTune } from './tracker.js';

const THREE_URL = 'https://esm.sh/three@0.164.1';
const GLTF_LOADER_URL = 'https://esm.sh/three@0.164.1/examples/jsm/loaders/GLTFLoader.js';
const ROOM_ENVIRONMENT_URL = 'https://esm.sh/three@0.164.1/examples/jsm/environments/RoomEnvironment.js';

function finiteVector(value, fallback) {
  return {
    x: Number.isFinite(value?.x) ? value.x : fallback.x,
    y: Number.isFinite(value?.y) ? value.y : fallback.y,
    z: Number.isFinite(value?.z) ? value.z : fallback.z,
  };
}

function axisVector(THREE, axis) {
  const match = /^([+-])([xyz])$/.exec(axis || '');
  if (!match) return null;
  const vector = new THREE.Vector3();
  vector.setComponent('xyz'.indexOf(match[2]), match[1] === '-' ? -1 : 1);
  return vector;
}

function positiveAxis(THREE, axis, extents, rotation) {
  const index = typeof axis === 'string' ? ['x', 'y', 'z'].indexOf(axis) : -1;
  const selectedIndex = index >= 0 ? index : extents.indexOf(Math.min(...extents));
  return {
    index: selectedIndex,
    vector: new THREE.Vector3().setComponent(selectedIndex, 1).applyEuler(rotation).normalize(),
  };
}

function resolveWatchDialAxis(THREE, configured, holeIndex, extents, rotation) {
  let dial = axisVector(THREE, configured);
  if (dial) dial.applyEuler(rotation).normalize();
  if (!dial || Math.abs(dial.dot(positiveAxis(THREE, 'xyz'[holeIndex], extents, rotation).vector)) > 1e-4) {
    const remaining = [0, 1, 2]
      .filter((axis) => axis !== holeIndex)
      .sort((a, b) => extents[a] - extents[b]);
    dial = new THREE.Vector3()
      .setComponent(remaining[0], 1)
      .applyEuler(rotation)
      .normalize();
  }
  return dial;
}

function makeBasis(THREE, axis, perpendicular) {
  const x = axis.clone().normalize();
  const y = perpendicular.clone().addScaledVector(x, -perpendicular.dot(x)).normalize();
  const z = new THREE.Vector3().crossVectors(x, y).normalize();
  y.crossVectors(z, x).normalize();
  return new THREE.Matrix4().makeBasis(x, y, z);
}

async function loadModelConfig(metadataUrl) {
  if (!metadataUrl) return {};
  try {
    const response = await fetch(metadataUrl);
    if (!response.ok) throw new Error(`Could not load 3D model config (${response.status}).`);
    const config = await response.json();
    return config && typeof config === 'object' && !Array.isArray(config) ? config : {};
  } catch (error) {
    console.warn('Could not load 3D model config; using defaults.', error);
    return {};
  }
}

function detectBraceletAxes(THREE, source, bounds, size) {
  const extents = [size.x, size.y, size.z];
  const holeIndex = extents.indexOf(Math.min(...extents));
  const candidates = [0, 1, 2].filter((index) => index !== holeIndex);
  const min = [bounds.min.x, bounds.min.y, bounds.min.z];
  const max = [bounds.max.x, bounds.max.y, bounds.max.z];
  const edgeCounts = candidates.map((axis) => ({ axis, min: 0, max: 0 }));
  const totalVertices = { value: 0 };
  const point = new THREE.Vector3();

  source.updateMatrixWorld(true);
  source.traverse((node) => {
    const positions = node.geometry?.getAttribute('position');
    if (!node.isMesh || !positions) return;
    for (let index = 0; index < positions.count; index += 1) {
      point.fromBufferAttribute(positions, index).applyMatrix4(node.matrixWorld);
      const coordinates = [point.x, point.y, point.z];
      totalVertices.value += 1;
      for (const edge of edgeCounts) {
        const threshold = extents[edge.axis] * 0.04;
        if (coordinates[edge.axis] - min[edge.axis] <= threshold) edge.min += 1;
        if (max[edge.axis] - coordinates[edge.axis] <= threshold) edge.max += 1;
      }
    }
  });

  edgeCounts.sort((a, b) => {
    const aMass = Math.min(a.min, a.max) / Math.max(1, totalVertices.value);
    const bMass = Math.min(b.min, b.max) / Math.max(1, totalVertices.value);
    return aMass - bMass || extents[b.axis] - extents[a.axis] || a.axis - b.axis;
  });
  const opening = edgeCounts[0];
  const openingSign = opening && opening.min !== opening.max
    ? opening.min < opening.max ? -1 : 1
    : 1;
  const axis = (index, sign = 1) => {
    const vector = new THREE.Vector3();
    vector.setComponent(index, sign);
    return vector;
  };

  return {
    holeAxis: axis(holeIndex),
    holeAxisIndex: holeIndex,
    openingDir: opening ? axis(opening.axis, openingSign) : axis(candidates[0]),
  };
}

export class HandModelRenderer {
  static async create(canvas, modelUrl, width, height, category = 'rings', metadataUrl = null) {
    const [THREE, { GLTFLoader }, { RoomEnvironment }] = await Promise.all([
      import(THREE_URL),
      import(GLTF_LOADER_URL),
      import(ROOM_ENVIRONMENT_URL),
    ]);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const environmentTarget = pmremGenerator.fromScene(new RoomEnvironment());
    pmremGenerator.dispose();
    scene.environment = environmentTarget.texture;
    scene.add(new THREE.AmbientLight(0xffffff, 1.8));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(-1, -1, 3);
    scene.add(keyLight);

    const camera = new THREE.OrthographicCamera(-width / 2, width / 2, -height / 2, height / 2, 0.1, 2000);
    camera.position.set(width / 2, height / 2, 1000);
    camera.lookAt(width / 2, height / 2, 0);

    const config = await loadModelConfig(metadataUrl);
    const configScale = Number.isFinite(config.scale) && config.scale > 0 ? config.scale : 0.95;
    const anchorOffset = finiteVector(config.anchorOffset, { x: 0, y: 0, z: 0 });
    const rotationOffset = finiteVector(config.rotationOffset, { x: 0, y: 0, z: 0 });
    const gltf = await new GLTFLoader().loadAsync(modelUrl);
    const source = gltf.scene;
    const isBracelet = category === 'bracelets';
    const isNecklace = category === 'necklaces';
    const isWatch = category === 'watches';
    const sourceBounds = new THREE.Box3().setFromObject(source);
    const sourceSize = sourceBounds.getSize(new THREE.Vector3());
    const sourceCenter = sourceBounds.getCenter(new THREE.Vector3());
    const sourceLongestSide = Math.max(sourceSize.x, sourceSize.y, sourceSize.z);
    if (!Number.isFinite(sourceLongestSide) || sourceLongestSide <= 0) {
      environmentTarget.dispose();
      renderer.dispose();
      throw new Error('The GLB model has no visible geometry');
    }

    let holeAxis;
    let openingDir;
    let holeAxisIndex;
    let modelDimension;
    let modelOrientation;
    let watchDialAxis;
    let watchRotationOffset;
    let watchOccluderLength;
    let watchOccluderRadius;
    let braceletBandLength;
    let braceletOccluderRadius;
    if (isBracelet) {
      const detectedAxes = detectBraceletAxes(THREE, source, sourceBounds, sourceSize);
      holeAxisIndex = detectedAxes.holeAxisIndex;
      braceletBandLength = sourceSize.getComponent(holeAxisIndex) / sourceLongestSide;
      const radialAxes = [0, 1, 2].filter((axis) => axis !== holeAxisIndex);
      braceletOccluderRadius = Math.min(
        ...radialAxes.map((axis) => sourceSize.getComponent(axis))
      ) / sourceLongestSide / 2 * 0.92;
      source.position.sub(sourceCenter);
      modelOrientation = new THREE.Group();
      const normalizedModel = new THREE.Group();
      normalizedModel.scale.setScalar(1 / sourceLongestSide);
      normalizedModel.add(source);
      const lengthScale = new THREE.Group();
      lengthScale.name = 'braceletLengthScale';
      lengthScale.add(normalizedModel);
      modelOrientation.add(lengthScale);
      modelOrientation.position.set(anchorOffset.x, anchorOffset.y, anchorOffset.z);
      modelOrientation.rotation.set(rotationOffset.x, rotationOffset.y, rotationOffset.z);
      holeAxis = detectedAxes.holeAxis.clone().applyEuler(modelOrientation.rotation).normalize();
      openingDir = detectedAxes.openingDir.clone().applyEuler(modelOrientation.rotation).normalize();
      modelDimension = 1;
    } else if (isNecklace) {
      source.position.sub(sourceCenter);
      modelOrientation = new THREE.Group();
      const normalizedModel = new THREE.Group();
      normalizedModel.scale.setScalar(1 / sourceLongestSide);
      normalizedModel.add(source);
      modelOrientation.add(normalizedModel);
      modelOrientation.position.set(anchorOffset.x, anchorOffset.y, anchorOffset.z);
      modelOrientation.rotation.set(rotationOffset.x, rotationOffset.y, rotationOffset.z);
      modelDimension = 1;
      holeAxis = new THREE.Vector3(0, 0, 1);
      openingDir = new THREE.Vector3(0, 1, 0);
    } else if (isWatch) {
      const extents = [sourceSize.x, sourceSize.y, sourceSize.z];
      const rotation = new THREE.Euler(rotationOffset.x, rotationOffset.y, rotationOffset.z);
      const configuredHole = ['x', 'y', 'z'].includes(getArTune().hole)
        ? getArTune().hole
        : 'auto';
      const { index: holeIndex, vector: holeVector } = positiveAxis(THREE, configuredHole, extents, rotation);
      holeAxisIndex = holeIndex;
      holeAxis = holeVector;
      const dialVector = resolveWatchDialAxis(THREE, getArTune().dial, holeIndex, extents, rotation);
      watchDialAxis = dialVector;
      watchRotationOffset = rotation;
      watchOccluderLength = sourceSize.getComponent(holeIndex) / sourceLongestSide;
      const radialAxes = [0, 1, 2].filter((axis) => axis !== holeIndex);
      watchOccluderRadius = Math.min(
        ...radialAxes.map((axis) => sourceSize.getComponent(axis))
      ) / sourceLongestSide / 2 * 0.85;
      source.position.sub(sourceCenter);
      modelOrientation = new THREE.Group();
      const normalizedModel = new THREE.Group();
      normalizedModel.scale.setScalar(1 / sourceLongestSide);
      normalizedModel.add(source);
      modelOrientation.add(normalizedModel);
      modelOrientation.position.set(anchorOffset.x, anchorOffset.y, anchorOffset.z);
      modelOrientation.rotation.set(rotationOffset.x, rotationOffset.y, rotationOffset.z);
      modelDimension = 1;
      openingDir = watchDialAxis;
    } else {
      modelOrientation = new THREE.Group();
      modelOrientation.rotation.x = -Math.PI / 3;
      modelOrientation.rotation.z = Math.PI;
      modelOrientation.add(source);
      modelOrientation.updateMatrixWorld(true);
      const orientedBounds = new THREE.Box3().setFromObject(modelOrientation);
      const orientedSize = orientedBounds.getSize(new THREE.Vector3());
      const center = orientedBounds.getCenter(new THREE.Vector3());
      modelDimension = Math.max(orientedSize.x, orientedSize.y, orientedSize.z);
      modelOrientation.position.sub(center);
      if (!Number.isFinite(modelDimension) || modelDimension <= 0) {
        environmentTarget.dispose();
        renderer.dispose();
        throw new Error('The GLB model has no visible geometry');
      }
      holeAxis = new THREE.Vector3(0, 0, 1).applyEuler(modelOrientation.rotation).normalize();
      openingDir = new THREE.Vector3(0, 1, 0).applyEuler(modelOrientation.rotation).normalize();
    }

    const instances = Array.from({ length: 2 }, () => {
      const modelScale = modelOrientation.clone(true);
      if (!isBracelet && !isNecklace && !isWatch) modelScale.scale.setScalar(1 / modelDimension);
      const modelRoot = new THREE.Group();
      modelRoot.add(modelScale);
      if (isWatch) modelRoot.userData.watchHoleIndex = holeAxisIndex;
      const lengthScale = isBracelet ? modelScale.getObjectByName('braceletLengthScale') : null;
      if (DEBUG_AR) modelScale.add(new THREE.AxesHelper(0.5));

      const occluder = new THREE.Mesh(
        isBracelet
          ? new THREE.CylinderGeometry(
            braceletOccluderRadius,
            braceletOccluderRadius,
            braceletBandLength * 1.02,
            32
          )
          : isWatch
            ? new THREE.CylinderGeometry(
              watchOccluderRadius,
              watchOccluderRadius,
              watchOccluderLength * 1.02,
              32
            )
          : new THREE.CylinderGeometry(1, 1, 1, 24),
        new THREE.MeshBasicMaterial({
          colorWrite: false,
          depthWrite: true,
          side: THREE.DoubleSide,
          wireframe: false,
        })
      );
      occluder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), holeAxis);
      if (isNecklace || isWatch) occluder.visible = false;
      occluder.renderOrder = -1;
      modelRoot.add(occluder);
      scene.add(modelRoot);
      return { root: modelRoot, modelScale, lengthScale, occluder, orientationReady: false };
    });

    return new HandModelRenderer(
      THREE, renderer, scene, camera, instances, canvas, width, height, environmentTarget,
      holeAxis, openingDir, holeAxisIndex, modelDimension, sourceSize, configScale, category,
      watchDialAxis, watchRotationOffset,
    );
  }

  constructor(THREE, renderer, scene, camera, instances, canvas, width, height, environmentTarget, holeAxis, openingDir, holeAxisIndex, modelDimension, bboxSize, configScale, category, watchDialAxis, watchRotationOffset) {
    Object.assign(this, {
      THREE,
      renderer,
      scene,
      camera,
      instances,
      canvas: canvas || renderer.domElement,
      width,
      height,
      environmentTarget,
      HOLE_AXIS: holeAxis,
      OPENING_DIR: openingDir,
      holeAxisIndex,
      modelDimension,
      bboxSize,
      configScale,
      category,
      watchDialAxis,
      watchRotationOffset,
      watchHoleIndex: holeAxisIndex,
      watchExtents: category === 'watches'
        ? [bboxSize.x, bboxSize.y, bboxSize.z].map((extent) => extent / Math.max(bboxSize.x, bboxSize.y, bboxSize.z))
        : null,
      lastDebugAt: 0,
    });
    this.resize(width, height);
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    this.camera.left = -width / 2;
    this.camera.right = width / 2;
    this.camera.top = height / 2;
    this.camera.bottom = -height / 2;
    this.camera.position.set(0, 0, 1000);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }

  render(placements) {
    const { THREE } = this;
    const arTune = this.category === 'bracelets' || this.category === 'watches' ? getArTune() : null;
    this.instances.forEach(({ root, modelScale, lengthScale, occluder }, index) => {
      const placement = placements[index];
      root.visible = Boolean(placement);
      if (!placement) return;

      root.position.set(placement.pos.x, placement.pos.y, placement.pos.z);
      if (this.category === 'necklaces') {
        root.rotation.set(0, placement.yaw || 0, placement.rot || 0);
        modelScale.scale.setScalar(placement.d * this.configScale);
        occluder.visible = false;
        return;
      }

      if (this.category === 'watches') {
        const fore = new THREE.Vector3(placement.fore.x, placement.fore.y, placement.fore.z).normalize();
        const up = new THREE.Vector3(placement.up.x, placement.up.y, placement.up.z).normalize();
        const configuredHole = ['x', 'y', 'z'].includes(arTune.hole)
          ? arTune.hole
          : 'auto';
        const { index: holeIndex, vector: hole } = positiveAxis(
          THREE, configuredHole, this.watchExtents, this.watchRotationOffset
        );
        const dial = resolveWatchDialAxis(
          THREE, arTune.dial, holeIndex, this.watchExtents, this.watchRotationOffset
        );
        this.HOLE_AXIS.copy(hole);
        this.watchDialAxis.copy(dial);
        occluder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), hole);
        if (root.userData.watchHoleIndex !== holeIndex) {
          const radialAxes = [0, 1, 2].filter((axis) => axis !== holeIndex);
          const radius = Math.min(...radialAxes.map((axis) => this.watchExtents[axis])) / 2 * 0.85;
          const length = this.watchExtents[holeIndex] * 1.02;
          occluder.geometry.dispose();
          occluder.geometry = new THREE.CylinderGeometry(radius, radius, length, 32);
          root.userData.watchHoleIndex = holeIndex;
        }
        occluder.position.copy(dial).multiplyScalar(-0.12);
        const modelBasis = makeBasis(THREE, this.HOLE_AXIS, dial).invert();
        const targetBasis = makeBasis(THREE, fore, up);
        const rotation = new THREE.Quaternion().setFromRotationMatrix(
          new THREE.Matrix4().multiplyMatrices(targetBasis, modelBasis)
        );
        rotation.premultiply(new THREE.Quaternion().setFromAxisAngle(
          up,
          THREE.MathUtils.degToRad(arTune.watchRoll)
        ));
        if (root.userData.orientationReady) {
          root.quaternion.slerp(rotation, 0.35);
          root.position.lerp(new THREE.Vector3(placement.pos.x, placement.pos.y, placement.pos.z), 0.5);
        } else {
          root.quaternion.copy(rotation);
          root.position.set(placement.pos.x, placement.pos.y, placement.pos.z);
          root.userData.orientationReady = true;
        }
        root.scale.setScalar(placement.d * this.configScale);
        occluder.visible = arTune.occEnabled;
        occluder.scale.set(1, 1, Number.isFinite(arTune.occDepth) ? arTune.occDepth : 0.75);
        if (DEBUG_AR) {
          const now = performance.now();
          if (now - this.lastDebugAt >= 1000) {
            console.log('[DEBUG_AR watch]', {
              bboxExtents: this.watchExtents,
              hole: 'xyz'[holeIndex],
              dial: arTune.dial,
            });
            this.lastDebugAt = now;
          }
        }
        return;
      }

      const direction = new THREE.Vector3(placement.dir.x, placement.dir.y, placement.dir.z).normalize();
      const rotation = new THREE.Quaternion().setFromUnitVectors(this.HOLE_AXIS, direction);
      const currentOpening = this.OPENING_DIR.clone().applyQuaternion(rotation);
      const targetOpening = new THREE.Vector3(placement.up.x, placement.up.y, placement.up.z).normalize().negate();
      targetOpening.addScaledVector(direction, -targetOpening.dot(direction)).normalize();
      if (targetOpening.lengthSq() > 0) {
        const roll = Math.atan2(
          currentOpening.clone().cross(targetOpening).dot(direction),
          currentOpening.dot(targetOpening)
        );
        rotation.premultiply(new THREE.Quaternion().setFromAxisAngle(direction, roll));
      }
      if (arTune) {
        const rollOffset = THREE.MathUtils.degToRad(arTune.rollDeg);
        rotation.premultiply(new THREE.Quaternion().setFromAxisAngle(direction, rollOffset));
      }

      if (this.category === 'bracelets') {
        occluder.visible = arTune.occEnabled;
        if (root.userData.orientationReady) root.quaternion.slerp(rotation, 0.35);
        else {
          root.quaternion.copy(rotation);
          root.userData.orientationReady = true;
        }
        root.scale.setScalar(placement.d * this.configScale);
        lengthScale.scale.set(1, 1, 1);
        lengthScale.scale.setComponent(this.holeAxisIndex, arTune.lengthFactor);
        occluder.scale.set(1, 1, arTune.occDepth);
        if (DEBUG_AR) {
          const now = performance.now();
          if (now - this.lastDebugAt >= 1000) {
            console.log('[DEBUG_AR bracelet]', {
              bboxSize: this.bboxSize.toArray(),
              HOLE_AXIS: this.HOLE_AXIS.toArray(),
              dir: [placement.dir.x, placement.dir.y, placement.dir.z],
              pos: [placement.pos.x, placement.pos.y, placement.pos.z],
              diameter: placement.d,
            });
            this.lastDebugAt = now;
          }
        }
      } else {
        root.quaternion.copy(rotation);
        modelScale.scale.setScalar(placement.d / this.modelDimension);
        occluder.scale.set(placement.d * 0.38, placement.fingerLen, placement.d * 0.38);
      }
      occluder.position.set(0, 0, 0);
    });
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.scene.traverse((node) => {
      if (node.geometry) node.geometry.dispose();
      if (node.material) {
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach((material) => {
          for (const value of Object.values(material)) {
            if (value && value.isTexture) value.dispose();
          }
          material.dispose();
        });
      }
    });
    this.environmentTarget.dispose();
    this.renderer.dispose();
  }
}
