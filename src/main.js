import * as THREE from 'three';
import {
  createGallery,
  isNearSecretDoor,
  isInsideWalkable,
} from './gallery.js';
import {
  loadPhotos,
  hangPhotos,
  loadTexturesFromUrls,
  removeFrames,
} from './frames.js';
import { createPlayer } from './player.js';
import { setupUI } from './ui.js';
import { unlockSecret, lockSecret, isSecretUnlocked } from './secretCrypto.js';

const canvas = document.getElementById('gallery-canvas');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1c1814);
scene.fog = new THREE.Fog(0x1c1814, 28, 55);

const camera = new THREE.PerspectiveCamera(
  72,
  window.innerWidth / window.innerHeight,
  0.12,
  120
);

const gallery = createGallery();
scene.add(gallery.group);

const player = createPlayer(
  camera,
  canvas,
  gallery.spawn,
  [],
  () => gallery.getDoorCollider()
);

const ui = setupUI({
  onEnter: () => {
    if (ui.isPasswordDialogOpen()) return;
    player.lock();
  },
  controls: player.controls,
});

let publicColliders = [];
let secretFrames = [];
let secretColliders = [];
let unlockBusy = false;

function refreshColliders() {
  player.setFrameColliders([...publicColliders, ...secretColliders]);
}

function wipeSecretRoom() {
  removeFrames(gallery.group, secretFrames);
  secretFrames = [];
  secretColliders = [];
  lockSecret();
  gallery.setSecretUnlocked(false);
  refreshColliders();
  ui.setLockHintVisible(false);

  if (!isInsideWalkable(camera.position.x, camera.position.z)) {
    camera.position.copy(gallery.spawn);
  }
}

async function openSecretWithPassword(password) {
  const items = await unlockSecret(password);
  const textures = await loadTexturesFromUrls(items);
  const secretWalls = gallery.pictureWalls.filter((w) => w.room === 'secret');
  const hung = hangPhotos(gallery.group, secretWalls, textures);
  secretFrames = hung.placed;
  secretColliders = hung.frameColliders;
  gallery.setSecretUnlocked(true);
  refreshColliders();
  ui.closePasswordDialog();
  ui.setLockHintVisible(true);
  player.lock();
}

function onKeyDown(e) {
  if (ui.isPasswordDialogOpen()) return;

  if (e.code === 'KeyE' && !gallery.isSecretUnlocked()) {
    if (!isNearSecretDoor(camera.position.x, camera.position.z)) return;
    e.preventDefault();
    player.unlockPointer();
    ui.openPasswordDialog(async (password) => {
      if (unlockBusy) return;
      unlockBusy = true;
      try {
        await openSecretWithPassword(password);
      } finally {
        unlockBusy = false;
      }
    });
    return;
  }

  if (e.code === 'KeyL' && isSecretUnlocked()) {
    e.preventDefault();
    wipeSecretRoom();
  }
}

document.addEventListener('keydown', onKeyDown);

async function init() {
  try {
    ui.setLoading('Загрузка фотографий природы…');
    const photos = await loadPhotos('./photos/photos.json');
    const publicWalls = gallery.pictureWalls.filter((w) => w.room !== 'secret');
    ui.setLoading(`Размещение ${photos.length} фотографий на стенах…`);
    const { placed, frameColliders } = hangPhotos(
      gallery.group,
      publicWalls,
      photos
    );
    publicColliders = frameColliders;
    refreshColliders();
    ui.setReady(placed.length);
  } catch (err) {
    console.error(err);
    ui.setLoading(
      'Ошибка загрузки фото. Сначала выполните: npm run download-photos && npm run build'
    );
  }
}

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  player.update(delta);

  const nearDoor =
    !gallery.isSecretUnlocked() &&
    isNearSecretDoor(camera.position.x, camera.position.z) &&
    player.controls.isLocked &&
    !ui.isPasswordDialogOpen();
  ui.setDoorPromptVisible(nearDoor);

  if (gallery.isSecretUnlocked() && player.controls.isLocked) {
    ui.setLockHintVisible(true);
  } else if (!gallery.isSecretUnlocked()) {
    ui.setLockHintVisible(false);
  }

  renderer.render(scene, camera);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', onResize);

init();
animate();
