import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class EarringModelRenderer {
  static async create(modelUrl, width, height, metadataUrl) {
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 1.8));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(-1, 1, 3);
    scene.add(keyLight);

    const camera = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 0.1, 2000);
    camera.position.set(0, 0, 1000);
    camera.lookAt(0, 0, 0);

    try {
      let config = {
        scale: 1,
        anchorOffset: { x: 0, y: 0, z: 0 },
        rotationOffset: { x: 0, y: 0, z: 0 },
      };
      if (metadataUrl) {
        const response = await fetch(metadataUrl);
        if (response.status === 404) {
          console.warn(`Optional earring calibration not found; using defaults: ${metadataUrl}`);
        } else {
          if (!response.ok) throw new Error(`Failed to load earring calibration: ${response.status} ${metadataUrl}`);
          const metadata = await response.json();
          const readVector = (value, name) => {
            if (value === undefined) return { x: 0, y: 0, z: 0 };
            if (!value || typeof value !== 'object') {
              throw new Error(`Invalid earring calibration: ${name} must be an object`);
            }
            const vector = {};
            for (const axis of ['x', 'y', 'z']) {
              vector[axis] = value[axis] === undefined ? 0 : value[axis];
              if (!Number.isFinite(vector[axis])) {
                throw new Error(`Invalid earring calibration: ${name}.${axis} must be a number`);
              }
            }
            return vector;
          };
          config = {
            scale: metadata.normalizedScale === undefined ? 1 : metadata.normalizedScale,
            anchorOffset: readVector(metadata.anchorOffset, 'anchorOffset'),
            rotationOffset: readVector(metadata.rotationOffset, 'rotationOffset'),
          };
          if (!Number.isFinite(config.scale) || config.scale <= 0) {
            throw new Error('Invalid earring calibration: normalizedScale must be a positive number');
          }
        }
      }

      const gltf = await new GLTFLoader().loadAsync(modelUrl);
      const source = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(source);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const longestSide = Math.max(size.x, size.y, size.z);
      if (!Number.isFinite(longestSide) || longestSide <= 0 || size.y <= 0) {
        throw new Error('The earring GLB has no visible geometry');
      }

      const normalizedModel = new THREE.Group();
      normalizedModel.scale.setScalar(1 / longestSide);
      normalizedModel.position.set(
        -config.anchorOffset.x,
        -config.anchorOffset.y,
        -config.anchorOffset.z,
      );
      normalizedModel.rotation.order = 'ZYX';
      normalizedModel.rotation.set(
        config.rotationOffset.x,
        config.rotationOffset.y,
        config.rotationOffset.z,
      );
      source.position.set(-center.x, -bounds.max.y, -center.z);
      normalizedModel.add(source);

      const models = [normalizedModel, normalizedModel.clone(true)].map((model) => {
        const instance = new THREE.Group();
        instance.add(model);
        instance.visible = false;
        scene.add(instance);
        return instance;
      });

      return new EarringModelRenderer(
        THREE,
        renderer,
        scene,
        camera,
        canvas,
        models,
        size.y / longestSide,
        config.scale,
        width,
        height,
      );
    } catch (error) {
      console.error('Failed to initialize the 3D earring renderer', error);
      renderer.dispose();
      throw error;
    }
  }

  constructor(THREE, renderer, scene, camera, canvas, models, normalizedHeight, scaleMultiplier, width, height) {
    Object.assign(this, { THREE, renderer, scene, camera, canvas, models, normalizedHeight, scaleMultiplier, width, height });
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
    this.camera.updateProjectionMatrix();
  }

  render(placements) {
    this.models.forEach((model, index) => {
      const placement = placements[index];
      model.visible = Boolean(placement);
      if (!placement) return;

      const scale = (placement.h / this.normalizedHeight) * this.scaleMultiplier;
      model.position.set(
        placement.x - this.width / 2,
        this.height / 2 - placement.y,
        -placement.z,
      );
      model.rotation.order = 'ZYX';
      model.rotation.set(0, placement.yaw || 0, placement.rot);
      model.scale.setScalar(scale);
    });
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    const geometries = new Set();
    const materials = new Set();
    this.scene.traverse((node) => {
      if (node.geometry) geometries.add(node.geometry);
      if (node.material) {
        const values = Array.isArray(node.material) ? node.material : [node.material];
        values.forEach((material) => materials.add(material));
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => {
      for (const value of Object.values(material)) {
        if (value && value.isTexture) value.dispose();
      }
      material.dispose();
    });
    this.renderer.dispose();
  }
}
