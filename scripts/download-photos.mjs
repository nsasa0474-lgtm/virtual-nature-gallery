/**
 * Download ~100 nature photos into public/photos/ + photos.json
 * Source: Unsplash CDN (nature / landscape photo IDs).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'photos');
const MANIFEST = path.join(OUT_DIR, 'photos.json');
const TARGET = 100;
const USER_AGENT =
  'VirtualNatureGallery/1.0 (local educational offline gallery)';

/** Curated Unsplash photo IDs — landscapes, forests, water, mountains. */
const PHOTO_IDS = [
  '1506905925346-21bda4d32df4',
  '1469474968028-56623f02e42e',
  '1441974231531-c6227db76b6e',
  '1470071459604-3b5ec3a7fe05',
  '1472214103451-9374bd1c798e',
  '1464822759023-fed622ff2c3b',
  '1501785888041-af3ef285b470',
  '1447752875215-b2761acb3c5d',
  '1470252649378-9d94cc349e8e',
  '1518173946687-a4c8892bbd9f',
  '1500534314209-a25ddb2bd429',
  '1475924156734-496f6cac6ec1',
  '1433086966358-5484364d4af7',
  '1510784722465-f2aedbdc6d65',
  '1511497584788-876760111969',
  '1502082553048-f009c37129b9',
  '1418065460887-82f2f4c6e3e3',
  '1476041800959-2ba4aec2e7b4',
  '1426604966848-d7adac402bff',
  '1470071459604-3b5ec3a7fe05',
  '1493246507139-91e8fad9978e',
  '1469474968028-56623f02e42e',
  '1506744038136-46273834b3fb',
  '1439853948847-ec7a4d1c0e6b',
  '1440342359743-84fcb8c21f68',
  '1513836279014-a89f7a76ae86',
  '1518495973542-4542c06a5843',
  '1475113540836-f544f61c2cb6',
  '1519681393784-d120267933ba',
  '1501854140801-50d01698950b',
  '1446329813270-4d0b7f4b6a8a',
  '1470770841072-f978cf4d019e',
  '1507003211169-0a1dd7228f2d',
  '1465146633011-14f8e0781093',
  '1516483638262-f3e4c6b8e5c7',
  '1501594907352-04cda38ebc29',
  '1511884642898-4c92249e20b6',
  '1470246973918-29a93279e6b7',
  '1439066615861-d1af74d74000',
  '1507525428034-b723cf961d3e',
  '1505142468610-359e7d316be0',
  '1418065460887-82f2f4c6e3e3',
  '1518709268805-4e9042af9f23',
  '1497436072909-60f360e1d4b1',
  '1464822759023-fed622ff2c3b',
  '1519681393784-d120267933ba',
  '1501785888041-af3ef285b470',
  '1475924156734-496f6cac6ec1',
  '1441974231531-c6227db76b6e',
  '1500534314209-a25ddb2bd429',
  '1472214103451-9374bd1c798e',
  '1518173946687-a4c8892bbd9f',
  '1433086966358-5484364d4af7',
  '1510784722465-f2aedbdc6d65',
  '1511497584788-876760111969',
  '1502082553048-f009c37129b9',
  '1476041800959-2ba4aec2e7b4',
  '1426604966848-d7adac402bff',
  '1493246507139-91e8fad9978e',
  '1506744038136-46273834b3fb',
  '1513836279014-a89f7a76ae86',
  '1518495973542-4542c06a5843',
  '1475113540836-f544f61c2cb6',
  '1501854140801-50d01698950b',
  '1470770841072-f978cf4d019e',
  '1465146633011-14f8e0781093',
  '1501594907352-04cda38ebc29',
  '1511884642898-4c92249e20b6',
  '1439066615861-d1af74d74000',
  '1507525428034-b723cf961d3e',
  '1505142468610-359e7d316be0',
  '1518709268805-4e9042af9f23',
  '1497436072909-60f360e1d4b1',
  '1559827260-dc66d52bef19',
  '1540206395-68808572332f',
  '1470071459604-3b5ec3a7fe05',
  '1547036967-23d11aacaee8',
  '1519904981063-b0cf448d479e',
  '1506905925346-21bda4d32df4',
  '1469474968028-56623f02e42e',
  '1470252649378-9d94cc349e8e',
  '1447752875215-b2761acb3c5d',
  '1542273917363-dcaae243fff5',
  '1518495973542-4542c06a5843',
  '1527489375415-8c3f4e0c6e8a',
  '1475924156734-496f6cac6ec1',
  '1502082553048-f009c37129b9',
  '1439853948847-ec7a4d1c0e6b',
  '1440342359743-84fcb8c21f68',
  '1470246973918-29a93279e6b7',
  '1551632811-561732d1e306',
  '1464822759023-fed622ff2c3b',
  '1501785888041-af3ef285b470',
  '1519681393784-d120267933ba',
  '1441974231531-c6227db76b6e',
  '1472214103451-9374bd1c798e',
  '1500534314209-a25ddb2bd429',
  '1518173946687-a4c8892bbd9f',
  '1433086966358-5484364d4af7',
  '1506744038136-46273834b3fb',
  '1493246507139-91e8fad9978e',
  '1513836279014-a89f7a76ae86',
  '1475113540836-f544f61c2cb6',
  '1501854140801-50d01698950b',
  '1470770841072-f978cf4d019e',
  '1501594907352-04cda38ebc29',
  '1439066615861-d1af74d74000',
  '1507525428034-b723cf961d3e',
  '1518709268805-4e9042af9f23',
  '1540206395-68808572332f',
  '1559827260-dc66d52bef19',
  '1547036967-23d11aacaee8',
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function downloadFile(url, dest, retries = 4) {
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: { 'User-Agent': USER_AGENT, Accept: 'image/*' },
      });
      if (res.status === 429 || res.status === 503) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 3000) throw new Error('File too small');
      fs.writeFileSync(dest, buf);
      return buf.length;
    } catch (err) {
      lastErr = err;
      await sleep(500 * (attempt + 1));
    }
  }
  throw lastErr || new Error('Download failed');
}

/** Unique IDs preserving order */
function uniqueIds(ids) {
  const seen = new Set();
  const out = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function writeGradientPng(filePath, width, height, seed) {
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c;
  }
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const typeBuf = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;

  const raw = Buffer.alloc((width * 3 + 1) * height);
  const palettes = [
    [34, 90, 60, 120, 160, 200],
    [40, 70, 110, 180, 140, 80],
    [20, 50, 40, 90, 130, 70],
    [60, 40, 30, 200, 160, 100],
    [30, 60, 90, 100, 160, 180],
  ];
  const p = palettes[seed % palettes.length];
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0;
    for (let x = 0; x < width; x++) {
      const t = x / width;
      const u = y / height;
      raw[o++] = (p[0] * (1 - u) + p[3] * u + t * 20) | 0;
      raw[o++] = (p[1] * (1 - u) + p[4] * u + (1 - t) * 15) | 0;
      raw[o++] = (p[2] * (1 - t) + p[5] * t + u * 10) | 0;
    }
  }

  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(filePath, png);
}

async function main() {
  ensureDir(OUT_DIR);
  for (const f of fs.readdirSync(OUT_DIR)) {
    fs.unlinkSync(path.join(OUT_DIR, f));
  }

  const ids = uniqueIds(PHOTO_IDS);
  const manifest = [];

  console.log(`Downloading nature photos from Unsplash (${ids.length} unique IDs)…`);

  // First pass: unique unsplash IDs
  for (let i = 0; i < ids.length && manifest.length < TARGET; i++) {
    const id = ids[i];
    const n = manifest.length + 1;
    const file = `nature_${String(n).padStart(3, '0')}.jpg`;
    const dest = path.join(OUT_DIR, file);
    const landscape = n % 5 !== 0;
    const w = landscape ? 1280 : 960;
    const h = landscape ? 853 : 1280;
    const url = `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&q=75`;
    try {
      await downloadFile(url, dest);
      manifest.push({ file, width: w, height: h, source: `unsplash/${id}` });
      console.log(`  [${manifest.length}/${TARGET}] ${file}`);
      await sleep(120);
    } catch (err) {
      console.warn(`  skip ${id}: ${err.message}`);
    }
  }

  // Second pass: vary crop params on working IDs to reach 100 distinct files
  let extra = 0;
  while (manifest.length < TARGET && extra < TARGET * 2) {
    extra += 1;
    const id = ids[extra % ids.length];
    const n = manifest.length + 1;
    const file = `nature_${String(n).padStart(3, '0')}.jpg`;
    const dest = path.join(OUT_DIR, file);
    const w = 1100 + (extra % 5) * 40;
    const h = 700 + (extra % 7) * 50;
    const url = `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&q=70&crop=entropy&fm=jpg`;
    try {
      await downloadFile(url, dest);
      manifest.push({ file, width: w, height: h, source: `unsplash/${id}/v${extra}` });
      console.log(`  [${manifest.length}/${TARGET}] ${file} (variant)`);
      await sleep(100);
    } catch (err) {
      console.warn(`  variant fail: ${err.message}`);
      await sleep(300);
    }
  }

  // Absolute fallback so gallery always has 100 frames
  while (manifest.length < TARGET) {
    const n = manifest.length + 1;
    const file = `nature_${String(n).padStart(3, '0')}.png`;
    const dest = path.join(OUT_DIR, file);
    writeGradientPng(dest, 800, 600, n);
    manifest.push({ file, width: 800, height: 600, source: `generated/${n}` });
    console.log(`  [generated ${manifest.length}/${TARGET}] ${file}`);
  }

  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`\nDone. Saved ${manifest.length} photos → ${MANIFEST}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
