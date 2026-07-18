import * as THREE from 'three';

const FRAME_DEPTH = 0.052;
const FRAME_BORDER = 0.058;
const MATTE = 0.04;
const MAX_DISPLAY_W = 1.85;
const MAX_DISPLAY_H = 1.55;
const MIN_DISPLAY = 0.55;
/** How far the back of the frame sits off the wall surface */
const WALL_STANDOFF = 0.024;
/** Keep frames away from wall corners so they don't poke into adjacent walls */
const CORNER_CLEAR = 0.55;

/** One shared wood material — avoids mismatched grain seams between rim pieces */
let sharedWoodMaterial = null;
function getWoodMaterial() {
  if (sharedWoodMaterial) return sharedWoodMaterial;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 128, 128);
  g.addColorStop(0, '#4a301c');
  g.addColorStop(0.45, '#6b472c');
  g.addColorStop(1, '#3d2918');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 24; i++) {
    ctx.strokeStyle = `rgba(20,10,5,${0.05 + (i % 5) * 0.015})`;
    ctx.beginPath();
    const y = 4 + i * 5;
    ctx.moveTo(0, y);
    ctx.lineTo(128, y + 1);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.5, 1.5);
  sharedWoodMaterial = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.7,
    metalness: 0.03,
    color: 0xffffff,
  });
  return sharedWoodMaterial;
}

function createMatteMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xf3eee4,
    roughness: 0.95,
    metalness: 0,
    depthWrite: true,
  });
}

/** Single solid frame rim (no seams between top/left/right/bottom). */
function createFrameRimMesh(outerW, outerH, border, depth, material) {
  const hw = outerW / 2;
  const hh = outerH / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, -hh);
  shape.lineTo(hw, -hh);
  shape.lineTo(hw, hh);
  shape.lineTo(-hw, hh);
  shape.closePath();

  const hole = new THREE.Path();
  const iw = hw - border;
  const ih = hh - border;
  hole.moveTo(-iw, -ih);
  hole.lineTo(-iw, ih);
  hole.lineTo(iw, ih);
  hole.lineTo(iw, -ih);
  hole.closePath();
  shape.holes.push(hole);

  // No bevel — bevelled inner lips z-fight with matte/photo and flash wall color
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 1,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Fit image into max box preserving aspect ratio.
 * @param {number} [maxW]
 * @param {number} [maxH]
 */
export function fitSize(imgW, imgH, maxW = MAX_DISPLAY_W, maxH = MAX_DISPLAY_H) {
  const aspect = imgW / imgH;
  let w = Math.min(MAX_DISPLAY_W, maxW);
  let h = w / aspect;
  if (h > Math.min(MAX_DISPLAY_H, maxH)) {
    h = Math.min(MAX_DISPLAY_H, maxH);
    w = h * aspect;
  }
  const minW = Math.min(MIN_DISPLAY, maxW);
  const minH = Math.min(MIN_DISPLAY, maxH);
  if (w < minW && aspect >= 1) {
    w = minW;
    h = w / aspect;
  }
  if (h < minH && aspect < 1) {
    h = minH;
    w = h * aspect;
  }
  // Hard clamp to available slot
  if (w > maxW) {
    w = maxW;
    h = w / aspect;
  }
  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }
  return { w, h };
}

/**
 * Create a framed picture mesh group.
 * @param {THREE.Texture} texture
 * @param {number} imgW
 * @param {number} imgH
 * @param {{ maxW?: number, maxH?: number }} [limits]
 */
export function createFramedPhoto(texture, imgW, imgH, limits = {}) {
  const group = new THREE.Group();
  const { w, h } = fitSize(
    imgW || 1600,
    imgH || 1200,
    limits.maxW ?? MAX_DISPLAY_W,
    limits.maxH ?? MAX_DISPLAY_H
  );

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.repeat.set(1, 1);
  texture.offset.set(0, 0);
  texture.center.set(0.5, 0.5);
  texture.rotation = 0;

  const wood = getWoodMaterial();
  const matte = createMatteMaterial();

  const outerW = w + 2 * (MATTE + FRAME_BORDER);
  const outerH = h + 2 * (MATTE + FRAME_BORDER);
  const depth = FRAME_DEPTH;
  const bw = FRAME_BORDER;
  const holeW = outerW - 2 * bw;
  const holeH = outerH - 2 * bw;
  // Tuck matte under the wood rim so no wall/back flashes in the joint
  const underlap = 0.02;

  // Full back seals the wall completely behind the whole frame
  const back = new THREE.Mesh(new THREE.BoxGeometry(outerW, outerH, 0.02), wood);
  back.position.z = 0.01;
  back.renderOrder = 0;
  group.add(back);

  // Thick matte fills the opening and slides under the rim
  const matteBoard = new THREE.Mesh(
    new THREE.BoxGeometry(holeW + 2 * underlap, holeH + 2 * underlap, 0.014),
    matte
  );
  matteBoard.position.z = 0.03;
  matteBoard.renderOrder = 1;
  group.add(matteBoard);

  // Photo sits on matte, clearly inside the opening
  const photoMat = new THREE.MeshBasicMaterial({
    map: texture,
    toneMapped: false,
    depthWrite: true,
  });
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(w, h), photoMat);
  photo.position.z = 0.039;
  photo.renderOrder = 2;
  group.add(photo);

  // Wood rim over the matte edges (photo recessed in the well)
  const rim = createFrameRimMesh(outerW, outerH, bw, depth, wood);
  rim.position.z = 0.024;
  rim.renderOrder = 3;
  group.add(rim);

  group.userData.outerWidth = outerW;
  group.userData.outerHeight = outerH;
  group.userData.photoMesh = photo;
  group.userData.frameDepth = depth + 0.024;

  return group;
}

/**
 * Place all photos along picture walls, proportional to wall length.
 */
export function hangPhotos(sceneGroup, pictureWalls, textures) {
  const placed = [];
  const frameColliders = [];
  if (!textures.length || !pictureWalls.length) {
    return { placed, frameColliders };
  }

  const GAP = 0.28;
  const FRAME_CHROME = 2 * (MATTE + FRAME_BORDER);

  const totalLen = pictureWalls.reduce((sum, w) => sum + Math.max(w.length, 0.1), 0);
  const counts = pictureWalls.map((w) =>
    Math.max(1, Math.round((textures.length * w.length) / totalLen))
  );

  // Adjust rounding so sum === textures.length
  let diff = textures.length - counts.reduce((a, b) => a + b, 0);
  let guard = 0;
  while (diff !== 0 && guard++ < 500) {
    if (diff > 0) {
      let best = 0;
      for (let i = 1; i < pictureWalls.length; i++) {
        if (pictureWalls[i].length / counts[i] > pictureWalls[best].length / counts[best]) {
          best = i;
        }
      }
      counts[best] += 1;
      diff -= 1;
    } else {
      let best = 0;
      for (let i = 1; i < counts.length; i++) {
        if (counts[i] > 1 && counts[i] > counts[best]) best = i;
      }
      if (counts[best] <= 1) break;
      counts[best] -= 1;
      diff += 1;
    }
  }

  let texIndex = 0;
  for (let wi = 0; wi < pictureWalls.length; wi++) {
    const wall = pictureWalls[wi];
    const count = counts[wi];
    // Usable span inset from both corners so frames don't poke into adjacent walls
    const clear = Math.min(CORNER_CLEAR, wall.length * 0.22);
    const usable = Math.max(0.4, wall.length - 2 * clear);
    const pitch = usable / count;
    const maxOuter = Math.max(0.35, pitch - GAP);
    const maxPhotoW = Math.max(0.25, maxOuter - FRAME_CHROME);
    const maxPhotoH = MAX_DISPLAY_H;

    for (let i = 0; i < count && texIndex < textures.length; i++) {
      const entry = textures[texIndex++];
      const { texture } = entry;
      const img = texture.image;
      const width = img?.width || entry.width || 1600;
      const height = img?.height || entry.height || 1200;
      const frame = createFramedPhoto(texture, width, height, {
        maxW: maxPhotoW,
        maxH: maxPhotoH,
      });
      const outerW = frame.userData.outerWidth;
      const t = (i + 0.5) / count;
      const along = clear + usable * t;
      const half = outerW / 2 + 0.03;
      const minAlong = clear + half;
      const maxAlong = wall.length - clear - half;
      const clamped =
        maxAlong <= minAlong + 1e-4
          ? wall.length / 2
          : THREE.MathUtils.clamp(along, minAlong, maxAlong);

      const pos = wall.origin.clone().add(wall.dir.clone().multiplyScalar(clamped));
      pos.add(wall.normal.clone().multiplyScalar(WALL_STANDOFF));

      frame.position.copy(pos);
      frame.lookAt(pos.clone().add(wall.normal));
      sceneGroup.add(frame);
      placed.push(frame);

      frame.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(frame);
      const pad = 0.06;
      frameColliders.push({
        minX: box.min.x - pad,
        maxX: box.max.x + pad,
        minZ: box.min.z - pad,
        maxZ: box.max.z + pad,
      });
    }
  }

  return { placed, frameColliders };
}

/**
 * Load photos from manifest.
 */
export async function loadPhotos(manifestUrl = './photos/photos.json') {
  const res = await fetch(manifestUrl);
  if (!res.ok) {
    throw new Error(`Не удалось загрузить манифест фото: ${res.status}`);
  }
  const manifest = await res.json();
  const loader = new THREE.TextureLoader();
  const results = [];

  const loadOne = (entry) =>
    new Promise((resolve) => {
      const url = `./photos/${entry.file}`;
      loader.load(
        url,
        (texture) => {
          results.push({
            texture,
            width: entry.width || 1600,
            height: entry.height || 1200,
            file: entry.file,
          });
          resolve();
        },
        undefined,
        () => {
          console.warn('Skip missing photo', entry.file);
          resolve();
        }
      );
    });

  const batch = 12;
  for (let i = 0; i < manifest.length; i += batch) {
    await Promise.all(manifest.slice(i, i + batch).map(loadOne));
  }

  return results;
}
