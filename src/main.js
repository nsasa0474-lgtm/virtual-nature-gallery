import * as THREE from 'three';
import { createGallery } from './gallery.js';
import { loadPhotos, hangPhotos } from './frames.js';
import { createPlayer } from './player.js';
import { setupUI } from './ui.js';

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

const player = createPlayer(camera, canvas, gallery.spawn, []);
const ui = setupUI({
  onEnter: () => player.lock(),
  controls: player.controls,
});

async function init() {
  try {
    ui.setLoading('Загрузка фотографий природы…');
    const photos = await loadPhotos('./photos/photos.json');
    ui.setLoading(`Размещение ${photos.length} фотографий на стенах…`);
    const { placed, frameColliders } = hangPhotos(
      gallery.group,
      gallery.pictureWalls,
      photos
    );
    player.setFrameColliders(frameColliders);
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
