import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { FACE_ANCHORS, HDRI_URL, PRODUCT_DEFAULTS, USE_CANONICAL_FACE_MESH, loadProductMetadata } from './anchors.js';
import { createJewelryMaterial } from './materials.js';
import { createFingerOccluder, createHeadOccluder, updateCylinder } from './occluders.js';

function coverPoint(point, video, width, height) {
  const videoAspect = video.videoWidth / video.videoHeight;
  const viewAspect = width / height;
  if (videoAspect > viewAspect) {
    const visibleWidth = viewAspect / videoAspect;
    return { x: (point.x - (1 - visibleWidth) / 2) / visibleWidth, y: point.y };
  }
  const visibleHeight = videoAspect / viewAspect;
  return { x: point.x, y: (point.y - (1 - visibleHeight) / 2) / visibleHeight };
}

function colorFromVideo(video, canvas, context, renderer, scene, light) {
  if (!video.videoWidth || !video.videoHeight) return;
  canvas.width = 16;
  canvas.height = 16;
  context.drawImage(video, 0, 0, 16, 16);
  const pixels = context.getImageData(0, 0, 16, 16).data;
  let luminance = 0, red = 0, green = 0, blue = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    red += pixels[i];
    green += pixels[i + 1];
    blue += pixels[i + 2];
    luminance += 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
  }
  const count = pixels.length / 4;
  const mean = luminance / (count * 255);
  const intensity = THREE.MathUtils.clamp(0.6 + mean * 0.8, 0.6, 1.4);
  scene.environmentIntensity = intensity;
  light.color.setRGB(red / count / 255, green / count / 255, blue / count / 255);
  light.color.lerp(new THREE.Color(0xffffff), 0.75);
  renderer.toneMappingExposure = intensity;
}

function makeProcedural(category) {
  if (category === 'earrings') return new THREE.TorusGeometry(0.014, 0.002, 10, 32);
  if (category === 'rings') return new THREE.TorusGeometry(0.012, 0.002, 10, 32);
  if (category === 'bracelets') return new THREE.TorusGeometry(0.04, 0.003, 10, 40);
  const geometry = new THREE.TorusGeometry(0.032, 0.0015, 8, 40, Math.PI * 1.6);
  return geometry;
}

function placeInFrontOfCamera(camera, normalizedPoint, depth) {
  const point = new THREE.Vector3(normalizedPoint.x * 2 - 1, 1 - normalizedPoint.y * 2, 0.5);
  point.unproject(camera);
  const direction = point.sub(camera.position).normalize();
  return camera.position.clone().addScaledVector(direction, depth);
}

export class TryOnRenderer {
  static async create(canvas, video, category, { imageUrl, modelUrl, metadataUrl, debug = false } = {}) {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.setClearAlpha(0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    const environment = new THREE.PMREMGenerator(renderer);
    let environmentMap;
    if (HDRI_URL) {
      try {
        const hdr = await new RGBELoader().loadAsync(HDRI_URL);
        environmentMap = environment.fromEquirectangular(hdr);
        hdr.dispose();
      } catch (error) {
        console.warn(`Could not load try-on environment map at ${HDRI_URL}; using procedural lighting.`, error);
      }
    }
    if (!environmentMap) {
      const room = new RoomEnvironment(renderer);
      environmentMap = environment.fromScene(room, 0.04);
      room.dispose();
    }
    environment.dispose();
    scene.environment = environmentMap.texture;
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.3);
    keyLight.position.set(-1, 1, 2);
    scene.add(keyLight, new THREE.AmbientLight(0xffffff, 0.75));

    const product = new THREE.Group();
    const categoryDefaults = PRODUCT_DEFAULTS[category];
    const metadata = await loadProductMetadata(metadataUrl);
    const productScale = Number.isFinite(metadata.scale) ? metadata.scale : categoryDefaults.scale;
    const anchorOffset = { ...categoryDefaults.anchorOffset, ...metadata.anchorOffset };
    const rotationOffset = { ...categoryDefaults.rotationOffset, ...metadata.rotationOffset };
    const hideWhenPalmFacesAway = metadata.hideWhenPalmFacesAway ?? categoryDefaults.hideWhenPalmFacesAway ?? false;
    let quality = '3d';

    if (modelUrl) {
      try {
        const model = await new GLTFLoader().loadAsync(modelUrl);
        product.add(model.scene);
        const bounds = new THREE.Box3().setFromObject(model.scene);
        const size = bounds.getSize(new THREE.Vector3());
        const longestSide = Math.max(size.x, size.y, size.z);
        if (longestSide > 0) model.scene.scale.setScalar(productScale / longestSide);
        model.scene.position.set(anchorOffset.x, anchorOffset.y, anchorOffset.z);
        model.scene.rotation.set(rotationOffset.x, rotationOffset.y, rotationOffset.z);
      } catch (error) {
        console.warn('Try-on GLB failed to load; using a basic preview.', error);
        quality = 'basic';
      }
    }

    if (product.children.length === 0 && imageUrl) {
      try {
        const texture = await new THREE.TextureLoader().loadAsync(imageUrl);
        texture.colorSpace = THREE.SRGBColorSpace;
        const imageMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide });
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), imageMaterial);
        const imageAspect = texture.image.width / texture.image.height;
        plane.scale.set(productScale * imageAspect, productScale, 1);
        plane.position.set(anchorOffset.x, anchorOffset.y, anchorOffset.z);
        plane.rotation.set(rotationOffset.x, rotationOffset.y, rotationOffset.z);
        product.add(plane);
        quality = 'basic';
      } catch (error) {
        console.warn('Try-on image failed to load; using a procedural preview.', error);
      }
    }

    if (product.children.length === 0) {
      const metal = createJewelryMaterial({ preset: metadata.metalPreset });
      const jewelry = new THREE.Mesh(makeProcedural(category), metal);
      jewelry.rotation.set(rotationOffset.x, rotationOffset.y, rotationOffset.z);
      product.add(jewelry);
      quality = 'procedural';
    }
    product.traverse((node) => { if (node.isMesh) node.renderOrder = 1; });

    const headGroup = new THREE.Group();
    headGroup.matrixAutoUpdate = false;
    scene.add(headGroup);
    let headOccluder = createHeadOccluder();
    if (USE_CANONICAL_FACE_MESH) {
      try {
        const faceMesh = await new GLTFLoader().loadAsync('/models/canonical_face_model.glb');
        let canonicalGeometry = null;
        faceMesh.scene.traverse((node) => {
          if (!canonicalGeometry && node.isMesh) canonicalGeometry = node.geometry;
        });
        headOccluder.geometry.dispose();
        headOccluder = new THREE.Mesh(canonicalGeometry || new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, side: THREE.DoubleSide }));
        headOccluder.scale.setScalar(0.1);
      } catch (error) {
        console.warn('Canonical face occluder unavailable; using ellipsoid.', error);
      }
    }
    headGroup.add(headOccluder);
    const axes = debug ? new THREE.AxesHelper(0.12) : null;
    if (axes) headGroup.add(axes);
    const anchorMarkers = debug
      ? (category === 'earrings' ? [FACE_ANCHORS.leftEarlobe, FACE_ANCHORS.rightEarlobe] : [FACE_ANCHORS.neck]).map((anchor) => {
        const marker = new THREE.Mesh(new THREE.SphereGeometry(0.004, 12, 8), new THREE.MeshBasicMaterial({ color: 0x00ff9d }));
        marker.position.set(anchor.x, anchor.y, anchor.z);
        headGroup.add(marker);
        return marker;
      })
      : [];
    const faceProducts = [];
    if (category === 'earrings') {
      for (const anchor of [FACE_ANCHORS.leftEarlobe, FACE_ANCHORS.rightEarlobe]) {
        const side = new THREE.Group();
        const sideProduct = product.clone(true);
        side.add(sideProduct);
        side.position.set(anchor.x, anchor.y, anchor.z);
        if (anchor.x > 0) side.scale.x = -1;
        headGroup.add(side);
        faceProducts.push(side);
      }
    } else if (category === 'necklaces') {
      const necklace = product.clone(true);
      necklace.position.set(FACE_ANCHORS.neck.x, FACE_ANCHORS.neck.y, FACE_ANCHORS.neck.z);
      headGroup.add(necklace);
      faceProducts.push(necklace);
    }

    const handGroup = new THREE.Group();
    scene.add(handGroup);
    const handProduct = product.clone(true);
    handGroup.add(handProduct);
    const handOccluder = createFingerOccluder();
    handGroup.add(handOccluder);
    const handAnchorMarker = debug
      ? new THREE.Mesh(new THREE.SphereGeometry(0.004, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff3d9a }))
      : null;
    if (handAnchorMarker) {
      handAnchorMarker.visible = false;
      scene.add(handAnchorMarker);
    }

    const ambientCanvas = document.createElement('canvas');
    const ambientContext = ambientCanvas.getContext('2d', { willReadFrequently: true });
    if (!ambientContext) throw new Error('Ambient sampling is unavailable.');
    let lastAmbientSample = 0;
    let currentWidth = 1, currentHeight = 1;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      if (currentWidth === rect.width && currentHeight === rect.height) return;
      currentWidth = rect.width;
      currentHeight = rect.height;
      renderer.setSize(currentWidth, currentHeight, false);
      camera.aspect = currentWidth / currentHeight;
      camera.updateProjectionMatrix();
    }

    function render(results, opacity = 1, now = performance.now()) {
      resize();
      headGroup.visible = false;
      handGroup.visible = false;
      if (category === 'earrings' || category === 'necklaces') {
        const data = results.face?.facialTransformationMatrixes?.[0]?.data;
        if (data && data.length === 16) {
          const matrix = new THREE.Matrix4().fromArray(data);
          headGroup.matrix.copy(matrix);
          headGroup.visible = true;
          headGroup.traverse((child) => setOpacity(child, opacity));
          const rotation = new THREE.Euler().setFromRotationMatrix(matrix);
          if (category === 'earrings') {
            faceProducts[0].visible = rotation.y < THREE.MathUtils.degToRad(55);
            faceProducts[1].visible = rotation.y > THREE.MathUtils.degToRad(-55);
          } else {
            const position = new THREE.Vector3();
            const quaternion = new THREE.Quaternion();
            const scale = new THREE.Vector3();
            matrix.decompose(position, quaternion, scale);
            const reducedEuler = new THREE.Euler().setFromQuaternion(quaternion, 'YXZ');
            reducedEuler.x *= 0.3;
            reducedEuler.y = 0;
            reducedEuler.z *= 0.3;
            const reducedRotation = new THREE.Quaternion().setFromEuler(reducedEuler);
            headGroup.matrix.compose(position, reducedRotation, scale);
          }
        }
      } else {
        const result = results.hand;
        const landmarks = result?.landmarks?.[0];
        const world = result?.worldLandmarks?.[0];
        const confidence = result?.handedness?.[0]?.[0]?.score ?? 0;
        if (landmarks && world && confidence >= 0.6) {
          const palmWidth = Math.hypot(landmarks[5].x - landmarks[17].x, landmarks[5].y - landmarks[17].y);
          const depth = result.depths?.[0] || THREE.MathUtils.clamp(0.085 / Math.max(0.01, palmWidth * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect), 0.2, 1.2);
          const point = (index) => coverPoint(landmarks[index], video, currentWidth, currentHeight);
          const startIdx = category === 'rings' ? 13 : 0;
          const endIdx = category === 'rings' ? 14 : 9;
          const screen = point(category === 'rings' ? 13 : 0);
          const midpoint = category === 'rings'
            ? { x: screen.x + (point(14).x - screen.x) * 0.45, y: screen.y + (point(14).y - screen.y) * 0.45 }
            : screen;
          const anchorWorld = placeInFrontOfCamera(camera, midpoint, depth);
          const direction = new THREE.Vector3(
            world[endIdx].x - world[startIdx].x,
            -(world[endIdx].y - world[startIdx].y),
            -(world[endIdx].z - world[startIdx].z)
          );
          const segmentLength = direction.length();
          if (segmentLength < 0.0001) {
            handGroup.visible = false;
            handOccluder.visible = false;
            if (handAnchorMarker) handAnchorMarker.visible = false;
            renderer.render(scene, camera);
            return;
          }
          direction.normalize();
          const palmWidthWorld = Math.hypot(world[5].x - world[17].x, world[5].y - world[17].y, world[5].z - world[17].z);
          if (category === 'bracelets') {
            const palmA = new THREE.Vector3(world[5].x - world[0].x, -(world[5].y - world[0].y), -(world[5].z - world[0].z));
            const palmB = new THREE.Vector3(world[17].x - world[0].x, -(world[17].y - world[0].y), -(world[17].z - world[0].z));
            direction.crossVectors(palmA, palmB).normalize();
            if (hideWhenPalmFacesAway && direction.z <= 0) {
              handGroup.visible = false;
              handOccluder.visible = false;
              if (handAnchorMarker) handAnchorMarker.visible = false;
              renderer.render(scene, camera);
              return;
            }
          }
          handGroup.position.copy(anchorWorld);
          handGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
          handGroup.visible = true;
          handProduct.visible = true;
          handProduct.scale.setScalar(category === 'rings'
            ? THREE.MathUtils.clamp(segmentLength / 0.02, 0.6, 1.4)
            : THREE.MathUtils.clamp(palmWidthWorld / 0.08, 0.75, 1.35));
          if (handAnchorMarker) {
            handAnchorMarker.visible = true;
            handAnchorMarker.position.copy(anchorWorld);
          }
          if (category === 'rings') {
            const fingerWidth = Math.hypot(world[13].x - world[17].x, world[13].y - world[17].y, world[13].z - world[17].z) * 0.5;
            const fingerStart = placeInFrontOfCamera(camera, point(startIdx), depth);
            const fingerEnd = placeInFrontOfCamera(camera, point(endIdx), depth);
            handGroup.updateMatrixWorld(true);
            const localStart = handGroup.worldToLocal(fingerStart.clone());
            const localEnd = handGroup.worldToLocal(fingerEnd.clone());
            updateCylinder(handOccluder, localStart, localEnd, Math.max(0.002, fingerWidth * 0.45));
          } else {
            const wristRadius = Math.max(0.008, palmWidthWorld * 0.3);
            updateCylinder(
              handOccluder,
              new THREE.Vector3(0, -wristRadius, 0),
              new THREE.Vector3(0, wristRadius, 0),
              wristRadius
            );
          }
          handGroup.traverse((child) => setOpacity(child, opacity));
        } else {
          handOccluder.visible = false;
          if (handAnchorMarker) handAnchorMarker.visible = false;
        }
      }
      if (now - lastAmbientSample > 500) {
        try {
          colorFromVideo(video, ambientCanvas, ambientContext, renderer, scene, keyLight);
        } catch (error) {
          console.warn('Ambient light sampling failed', error);
        }
        lastAmbientSample = now;
      }
      renderer.render(scene, camera);
    }

    function setLowQuality(enabled) {
      renderer.setPixelRatio(enabled ? 1 : Math.min(window.devicePixelRatio || 1, 2));
      product.traverse((node) => {
        if (node.isMesh && node.material?.isMeshPhysicalMaterial && enabled) {
          node.material.transmission = 0;
          node.material.needsUpdate = true;
        }
      });
    }

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);

    return {
      camera,
      quality,
      render,
      setLowQuality,
      dispose() {
        window.removeEventListener('resize', resize);
        window.removeEventListener('orientationchange', resize);
        scene.traverse((node) => {
          if (node.geometry) node.geometry.dispose();
          if (node.material) {
            const materials = Array.isArray(node.material) ? node.material : [node.material];
            materials.forEach((material) => {
              Object.values(material).forEach((value) => { if (value?.isTexture) value.dispose(); });
              material.dispose();
            });
          }
        });
        environmentMap.dispose();
        renderer.dispose();
      },
    };
  }
}

function setOpacity(node, opacity) {
  if (!node.isMesh || !node.material) return;
  const materials = Array.isArray(node.material) ? node.material : [node.material];
  materials.forEach((material) => {
    if (!('opacity' in material) || material.colorWrite === false) return;
    material.transparent = opacity < 1 || material.transparent;
    material.opacity = opacity;
    material.depthWrite = opacity >= 1;
  });
}
