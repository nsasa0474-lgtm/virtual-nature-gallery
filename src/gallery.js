import * as THREE from 'three';

const WALL_HEIGHT = 4.2;
const WALL_THICKNESS = 0.22;
const EYE_LEVEL = 1.65;
const FRAME_CENTER_Y = 1.75;

/**
 * Room definitions: axis-aligned halls + corridors.
 * Units in meters.
 */
const ROOMS = [
  // Main hall
  { x: 0, z: 0, w: 18, d: 12, name: 'main' },
  // Corridor east (wider for comfortable passage)
  { x: 12, z: 0, w: 6, d: 4.0, name: 'corridor-e' },
  // East hall
  { x: 22, z: 0, w: 14, d: 11, name: 'east' },
  // Corridor north from main
  { x: 0, z: -9, w: 4.0, d: 6, name: 'corridor-n' },
  // North hall
  { x: 0, z: -18, w: 16, d: 12, name: 'north' },
  // Corridor west from main
  { x: -12, z: 0, w: 6, d: 4.0, name: 'corridor-w' },
  // West hall
  { x: -22, z: 0, w: 14, d: 11, name: 'west' },
];

function roomBounds(room) {
  const hw = room.w / 2;
  const hd = room.d / 2;
  return {
    minX: room.x - hw,
    maxX: room.x + hw,
    minZ: room.z - hd,
    maxZ: room.z + hd,
  };
}

/** Walkable AABBs: room interiors + wide door bridges so halls connect. */
export function getWalkableRects() {
  // Keep camera ~0.35m+ from inner wall face so near-plane doesn't clip through walls
  const inset = WALL_THICKNESS * 0.5 + 0.38;
  const rects = ROOMS.map((r) => {
    const b = roomBounds(r);
    return {
      minX: b.minX + inset,
      maxX: b.maxX - inset,
      minZ: b.minZ + inset,
      maxZ: b.maxZ - inset,
    };
  });

  // Wide bridges — must heavily overlap room walkable areas (no dead zones)
  const bridges = [
    { minX: 7.3, maxX: 10.7, minZ: -1.5, maxZ: 1.5 }, // main ↔ corridor-e
    { minX: 13.3, maxX: 16.7, minZ: -1.5, maxZ: 1.5 }, // corridor-e ↔ east
    { minX: -10.7, maxX: -7.3, minZ: -1.5, maxZ: 1.5 }, // main ↔ corridor-w
    { minX: -16.7, maxX: -13.3, minZ: -1.5, maxZ: 1.5 }, // corridor-w ↔ west
    { minX: -1.5, maxX: 1.5, minZ: -7.7, maxZ: -4.3 }, // main ↔ corridor-n
    { minX: -1.5, maxX: 1.5, minZ: -13.7, maxZ: -10.3 }, // corridor-n ↔ north
  ];

  return rects.concat(bridges);
}

/** Center-point check (avoids single-rect disk traps in doorways). */
export function isInsideWalkable(x, z) {
  const rects = getWalkableRects();
  for (const r of rects) {
    if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
      return true;
    }
  }
  return false;
}

function createWallMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xe8e0d4,
    roughness: 0.88,
    metalness: 0.02,
  });
}

function createFloorMaterial() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#5c4030';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 40; i++) {
    const y = (i / 40) * 512;
    ctx.strokeStyle = i % 2 === 0 ? '#4a3428' : '#6b4a38';
    ctx.lineWidth = 12 + (i % 3) * 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y + 8);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.anisotropy = 8;
  return new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.35,
    metalness: 0.08,
    color: 0xffffff,
  });
}

function createCeilingMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xf4f0e8,
    roughness: 0.95,
    metalness: 0,
  });
}

function addBox(group, material, w, h, d, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

/**
 * Build outer walls for a room, with door openings toward neighbors.
 */
function buildRoomShell(group, room, wallMat, openings) {
  const b = roomBounds(room);
  const y = WALL_HEIGHT / 2;
  const t = WALL_THICKNESS;

  const sides = [
    { side: 'n', ax: 'z', fixed: b.minZ, len: room.w, along: 'x', center: room.x },
    { side: 's', ax: 'z', fixed: b.maxZ, len: room.w, along: 'x', center: room.x },
    { side: 'w', ax: 'x', fixed: b.minX, len: room.d, along: 'z', center: room.z },
    { side: 'e', ax: 'x', fixed: b.maxX, len: room.d, along: 'z', center: room.z },
  ];

  for (const s of sides) {
    const door = openings.find((o) => o.room === room.name && o.side === s.side);
    if (!door) {
      if (s.along === 'x') {
        addBox(group, wallMat, s.len + t, WALL_HEIGHT, t, s.center, y, s.fixed);
      } else {
        addBox(group, wallMat, t, WALL_HEIGHT, s.len + t, s.fixed, y, s.center);
      }
      continue;
    }

    // Wall with door gap (doorWidth centered at door.offset along the wall)
    const doorW = door.width;
    const half = s.len / 2;
    const doorCenter = door.offset; // relative to room center along wall axis
    const leftEnd = -half;
    const rightEnd = half;
    const gapL = doorCenter - doorW / 2;
    const gapR = doorCenter + doorW / 2;

    const segments = [];
    if (gapL > leftEnd + 0.05) {
      segments.push({ from: leftEnd, to: gapL });
    }
    if (gapR < rightEnd - 0.05) {
      segments.push({ from: gapR, to: rightEnd });
    }

    for (const seg of segments) {
      const segLen = seg.to - seg.from;
      const mid = (seg.from + seg.to) / 2;
      if (s.along === 'x') {
        addBox(group, wallMat, segLen, WALL_HEIGHT, t, room.x + mid, y, s.fixed);
      } else {
        addBox(group, wallMat, t, WALL_HEIGHT, segLen, s.fixed, y, room.z + mid);
      }
    }

    // Lintel above door
    const lintelH = WALL_HEIGHT - door.height;
    if (lintelH > 0.05) {
      const ly = door.height + lintelH / 2;
      if (s.along === 'x') {
        addBox(group, wallMat, doorW, lintelH, t, room.x + doorCenter, ly, s.fixed);
      } else {
        addBox(group, wallMat, t, lintelH, doorW, s.fixed, ly, room.z + doorCenter);
      }
    }
  }
}

const OPENINGS = [
  { room: 'main', side: 'e', offset: 0, width: 3.6, height: 2.6 },
  { room: 'main', side: 'w', offset: 0, width: 3.6, height: 2.6 },
  { room: 'main', side: 'n', offset: 0, width: 3.6, height: 2.6 },
  { room: 'corridor-e', side: 'w', offset: 0, width: 3.6, height: 2.6 },
  { room: 'corridor-e', side: 'e', offset: 0, width: 3.6, height: 2.6 },
  { room: 'east', side: 'w', offset: 0, width: 3.6, height: 2.6 },
  { room: 'corridor-w', side: 'e', offset: 0, width: 3.6, height: 2.6 },
  { room: 'corridor-w', side: 'w', offset: 0, width: 3.6, height: 2.6 },
  { room: 'west', side: 'e', offset: 0, width: 3.6, height: 2.6 },
  { room: 'corridor-n', side: 's', offset: 0, width: 3.6, height: 2.6 },
  { room: 'corridor-n', side: 'n', offset: 0, width: 3.6, height: 2.6 },
  { room: 'north', side: 's', offset: 0, width: 3.6, height: 2.6 },
];

/**
 * Collect wall segments suitable for hanging frames (no door gaps).
 * Returns list of { origin, direction, normal, length, room }
 */
export function getPictureWalls() {
  const walls = [];
  for (const room of ROOMS) {
    if (room.name.startsWith('corridor')) continue;
    const b = roomBounds(room);
    const candidates = [
      {
        side: 'n',
        origin: new THREE.Vector3(b.minX, FRAME_CENTER_Y, b.minZ + WALL_THICKNESS / 2),
        dir: new THREE.Vector3(1, 0, 0),
        normal: new THREE.Vector3(0, 0, 1),
        length: room.w,
      },
      {
        side: 's',
        origin: new THREE.Vector3(b.minX, FRAME_CENTER_Y, b.maxZ - WALL_THICKNESS / 2),
        dir: new THREE.Vector3(1, 0, 0),
        normal: new THREE.Vector3(0, 0, -1),
        length: room.w,
      },
      {
        side: 'w',
        origin: new THREE.Vector3(b.minX + WALL_THICKNESS / 2, FRAME_CENTER_Y, b.minZ),
        dir: new THREE.Vector3(0, 0, 1),
        normal: new THREE.Vector3(1, 0, 0),
        length: room.d,
      },
      {
        side: 'e',
        origin: new THREE.Vector3(b.maxX - WALL_THICKNESS / 2, FRAME_CENTER_Y, b.minZ),
        dir: new THREE.Vector3(0, 0, 1),
        normal: new THREE.Vector3(-1, 0, 0),
        length: room.d,
      },
    ];

    for (const c of candidates) {
      const key = `${room.name}:${c.side}`;
      const opening = OPENINGS.find((o) => o.room === room.name && o.side === c.side);
      if (opening) {
        // Split wall into two segments around the door
        const half = c.length / 2;
        const gapL = half + opening.offset - opening.width / 2;
        const gapR = half + opening.offset + opening.width / 2;
        const margin = 0.8;
        if (gapL > margin * 2) {
          walls.push({
            origin: c.origin.clone(),
            dir: c.dir.clone(),
            normal: c.normal.clone(),
            length: gapL - margin,
            room: room.name,
          });
        }
        if (c.length - gapR > margin * 2) {
          const start = gapR + margin;
          walls.push({
            origin: c.origin.clone().add(c.dir.clone().multiplyScalar(start)),
            dir: c.dir.clone(),
            normal: c.normal.clone(),
            length: c.length - start - margin,
            room: room.name,
          });
        }
      } else {
        walls.push({
          origin: c.origin.clone().add(c.dir.clone().multiplyScalar(0.6)),
          dir: c.dir.clone(),
          normal: c.normal.clone(),
          length: c.length - 1.2,
          room: room.name,
        });
      }
    }
  }
  return walls;
}

export function createGallery() {
  const group = new THREE.Group();
  const wallMat = createWallMaterial();
  const floorMat = createFloorMaterial();
  const ceilMat = createCeilingMaterial();

  // Floors & ceilings per room
  for (const room of ROOMS) {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(room.w, room.d),
      floorMat
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(room.x, 0, room.z);
    floor.receiveShadow = true;
    group.add(floor);

    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(room.w, room.d),
      ceilMat
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(room.x, WALL_HEIGHT, room.z);
    ceil.receiveShadow = true;
    group.add(ceil);
  }

  for (const room of ROOMS) {
    buildRoomShell(group, room, wallMat, OPENINGS);
  }

  // Soft museum lighting
  const ambient = new THREE.AmbientLight(0xfff5e8, 0.45);
  group.add(ambient);

  const hemi = new THREE.HemisphereLight(0xfff8f0, 0x4a3c2e, 0.35);
  group.add(hemi);

  for (const room of ROOMS) {
    if (room.name.startsWith('corridor')) {
      const light = new THREE.PointLight(0xfff0dd, 18, 12, 2);
      light.position.set(room.x, WALL_HEIGHT - 0.4, room.z);
      group.add(light);
      continue;
    }

    const spots = [
      [room.x - room.w * 0.25, room.z - room.d * 0.2],
      [room.x + room.w * 0.25, room.z - room.d * 0.2],
      [room.x - room.w * 0.25, room.z + room.d * 0.2],
      [room.x + room.w * 0.25, room.z + room.d * 0.2],
      [room.x, room.z],
    ];

    for (const [lx, lz] of spots) {
      const light = new THREE.PointLight(0xfff2e0, 28, 14, 2);
      light.position.set(lx, WALL_HEIGHT - 0.35, lz);
      light.castShadow = false;
      group.add(light);
    }

    // Subtle directional fill
    const dir = new THREE.DirectionalLight(0xfff8ee, 0.25);
    dir.position.set(room.x + 4, 8, room.z + 3);
    group.add(dir);
  }

  return {
    group,
    eyeLevel: EYE_LEVEL,
    spawn: new THREE.Vector3(0, EYE_LEVEL, 3),
    pictureWalls: getPictureWalls(),
  };
}

export { WALL_HEIGHT, FRAME_CENTER_Y, EYE_LEVEL };
