import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { isInsideWalkable, EYE_LEVEL } from './gallery.js';

/**
 * @param {THREE.Camera} camera
 * @param {HTMLElement} domElement
 * @param {THREE.Vector3} spawn
 * @param {{ minX:number,maxX:number,minZ:number,maxZ:number }[]} [frameColliders]
 */
export function createPlayer(camera, domElement, spawn, frameColliders = []) {
  const controls = new PointerLockControls(camera, domElement);
  camera.position.copy(spawn);

  const velocity = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const keys = {
    forward: false,
    back: false,
    left: false,
    right: false,
  };

  const speed = 4.2;
  const damping = 8.0;
  let colliders = frameColliders;

  function onKey(e, pressed) {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        keys.forward = pressed;
        break;
      case 'KeyS':
      case 'ArrowDown':
        keys.back = pressed;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        keys.left = pressed;
        break;
      case 'KeyD':
      case 'ArrowRight':
        keys.right = pressed;
        break;
    }
  }

  const down = (e) => onKey(e, true);
  const up = (e) => onKey(e, false);
  document.addEventListener('keydown', down);
  document.addEventListener('keyup', up);

  function hitsFrame(x, z) {
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) return true;
    }
    return false;
  }

  function canStand(x, z) {
    return isInsideWalkable(x, z) && !hitsFrame(x, z);
  }

  function tryMove(from, to) {
    const nx = new THREE.Vector3(to.x, from.y, from.z);
    const nz = new THREE.Vector3(from.x, from.y, to.z);
    const full = to.clone();

    let result = from.clone();
    if (canStand(full.x, full.z)) {
      result = full;
    } else if (canStand(nx.x, nx.z)) {
      result.set(nx.x, from.y, from.z);
    } else if (canStand(nz.x, nz.z)) {
      result.set(from.x, from.y, nz.z);
    }
    result.y = EYE_LEVEL;
    return result;
  }

  function update(delta) {
    if (!controls.isLocked) {
      velocity.set(0, 0, 0);
      return;
    }

    const dt = Math.min(delta, 0.05);
    velocity.x -= velocity.x * damping * dt;
    velocity.z -= velocity.z * damping * dt;

    direction.z = Number(keys.forward) - Number(keys.back);
    direction.x = Number(keys.right) - Number(keys.left);
    direction.normalize();

    if (keys.forward || keys.back) velocity.z -= direction.z * speed * dt * 12;
    if (keys.left || keys.right) velocity.x -= direction.x * speed * dt * 12;

    const before = camera.position.clone();
    controls.moveRight(-velocity.x * dt);
    controls.moveForward(-velocity.z * dt);

    const after = camera.position.clone();
    after.y = EYE_LEVEL;
    camera.position.copy(tryMove(before, after));
  }

  function setFrameColliders(next) {
    colliders = next || [];
  }

  function lock() {
    controls.lock();
  }

  function dispose() {
    document.removeEventListener('keydown', down);
    document.removeEventListener('keyup', up);
    controls.dispose();
  }

  return { controls, update, lock, dispose, setFrameColliders };
}
