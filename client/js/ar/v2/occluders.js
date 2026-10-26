import * as THREE from 'three';

const depthMaterial = () => new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, side: THREE.DoubleSide });

export function createHeadOccluder() {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), depthMaterial());
  mesh.scale.set(0.095, 0.13, 0.11);
  mesh.renderOrder = 0;
  return mesh;
}

export function updateCylinder(mesh, start, end, radius) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  if (length < 0.0001) {
    mesh.visible = false;
    return;
  }
  mesh.visible = true;
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.scale.set(radius, length, radius);
}

export function createFingerOccluder() {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 16), depthMaterial());
  mesh.renderOrder = 0;
  return mesh;
}
