const THREE_URL = 'https://esm.sh/three@0.164.1';
const GLTF_LOADER_URL = 'https://esm.sh/three@0.164.1/examples/jsm/loaders/GLTFLoader.js';
const ROOM_ENVIRONMENT_URL = 'https://esm.sh/three@0.164.1/examples/jsm/environments/RoomEnvironment.js';

export class HandModelRenderer {
  static async create(canvas, modelUrl, width, height) {
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

    const gltf = await new GLTFLoader().loadAsync(modelUrl);
    const model = gltf.scene;
    const gemstoneCandidates = [];
    model.traverse((node) => {
      if (!node.isMesh) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      if (materials.some((material) => material?.name.toLowerCase().includes('diamond'))) {
        const size = new THREE.Box3().setFromObject(node).getSize(new THREE.Vector3());
        gemstoneCandidates.push({ node, volume: size.x * size.y * size.z });
      }
    });
    if (!gemstoneCandidates.length) {
      environmentTarget.dispose();
      renderer.dispose();
      throw new Error('The GLB model has no gemstone material');
    }
    const centerGemstone = gemstoneCandidates.reduce((largest, candidate) =>
      candidate.volume > largest.volume ? candidate : largest
    ).node;
    model.traverse((node) => {
      if (node.isMesh && node !== centerGemstone) node.visible = false;
    });

    // ADRG001's ring face is tilted 45° out of the camera plane in the GLB.
    // Undo that export tilt before measuring and rendering its visible size.
    const modelFacing = new THREE.Group();
    modelFacing.rotation.y = Math.PI;
    modelFacing.add(model);
    const modelOrientation = new THREE.Group();
    modelOrientation.rotation.x = -Math.PI / 4;
    modelOrientation.add(modelFacing);
    modelOrientation.updateMatrixWorld(true);

    const orientedBounds = new THREE.Box3();
    orientedBounds.setFromObject(centerGemstone);
    const orientedSize = orientedBounds.getSize(new THREE.Vector3());
    const visibleDimension = Math.max(orientedSize.x, orientedSize.y);
    if (!Number.isFinite(visibleDimension) || visibleDimension <= 0) {
      environmentTarget.dispose();
      renderer.dispose();
      throw new Error('The GLB gemstone has no visible geometry');
    }
    modelOrientation.position.copy(orientedBounds.getCenter(new THREE.Vector3())).negate();

    const modelScale = new THREE.Group();
    modelScale.scale.setScalar(1 / visibleDimension);
    modelScale.add(modelOrientation);
    const modelRoot = new THREE.Group();
    modelRoot.add(modelScale);
    scene.add(modelRoot);

    return new HandModelRenderer(THREE, renderer, scene, camera, modelRoot, canvas, width, height, environmentTarget);
  }

  constructor(THREE, renderer, scene, camera, model, canvas, width, height, environmentTarget) {
    Object.assign(this, { THREE, renderer, scene, camera, model, canvas, width, height, environmentTarget });
    this.resize(width, height);
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    this.camera.left = -width / 2;
    this.camera.right = width / 2;
    this.camera.top = -height / 2;
    this.camera.bottom = height / 2;
    this.camera.position.set(width / 2, height / 2, 1000);
    this.camera.lookAt(width / 2, height / 2, 0);
    this.camera.updateProjectionMatrix();
  }

  render(placements) {
    this.model.visible = placements.length > 0;
    if (placements.length) {
      const placement = placements[0];
      this.model.position.set(placement.x, placement.y, 0);
      this.model.rotation.set(0, 0, placement.rot);
      this.model.scale.setScalar(placement.w);
    }
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
