/**
 * Replace public/photos with images from new_foto/ when the set differs.
 * Rebuilds photos.json and optionally dist/.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INBOX = path.join(ROOT, 'new_foto');
const OUT_DIR = path.join(ROOT, 'public', 'photos');
const MANIFEST = path.join(OUT_DIR, 'photos.json');
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

function listImages(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => {
      const ext = path.extname(name).toLowerCase();
      if (!IMAGE_EXT.has(ext)) return false;
      const full = path.join(dir, name);
      return fs.statSync(full).isFile();
    })
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    .map((name) => path.join(dir, name));
}

function fileFingerprint(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function setFingerprint(files) {
  const hashes = files.map(fileFingerprint).sort();
  return crypto.createHash('sha256').update(hashes.join('\n')).digest('hex');
}

function readJpegSize(buf) {
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      i += 2;
      continue;
    }
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
    }
    i += 2 + len;
  }
  return null;
}

function readPngSize(buf) {
  if (buf.length < 24) return null;
  if (buf.toString('ascii', 1, 4) !== 'PNG') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function readGifSize(buf) {
  if (buf.length < 10) return null;
  if (buf.toString('ascii', 0, 3) !== 'GIF') return null;
  return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
}

function readWebpSize(buf) {
  if (buf.length < 30) return null;
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') {
    return null;
  }
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8X' && buf.length >= 30) {
    const w = 1 + buf[24] + (buf[25] << 8) + (buf[26] << 16);
    const h = 1 + buf[27] + (buf[28] << 8) + (buf[29] << 16);
    return { width: w, height: h };
  }
  if (chunk === 'VP8 ' && buf.length >= 30) {
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === 'VP8L' && buf.length >= 25) {
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

function readImageSize(filePath) {
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  let size = null;
  if (ext === '.jpg' || ext === '.jpeg') size = readJpegSize(buf);
  else if (ext === '.png') size = readPngSize(buf);
  else if (ext === '.gif') size = readGifSize(buf);
  else if (ext === '.webp') size = readWebpSize(buf);
  return size || { width: 1280, height: 853 };
}

function clearPhotosDir() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const name of fs.readdirSync(OUT_DIR)) {
    fs.unlinkSync(path.join(OUT_DIR, name));
  }
}

function rebuildDist() {
  if (!fs.existsSync(path.join(ROOT, 'node_modules', 'vite'))) {
    console.log('  node_modules нет — пропускаю vite build (запустите npm start позже).');
    return;
  }
  console.log('  Пересобираю dist…');
  const command =
    process.platform === 'win32' ? 'npm.cmd run build' : 'npm run build';
  const result = spawnSync(command, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  if (result.status !== 0) {
    console.warn('  Предупреждение: сборка dist не удалась. Фото уже заменены в public/photos.');
  }
}

function main() {
  fs.mkdirSync(INBOX, { recursive: true });
  const incoming = listImages(INBOX);

  if (incoming.length === 0) {
    console.log('');
    console.log('  В папке new_foto нет фото.');
    console.log('  Положите туда .jpg / .png / .webp / .gif и запустите снова.');
    console.log('');
    process.exit(0);
  }

  const current = listImages(OUT_DIR);
  const incomingFp = setFingerprint(incoming);
  const currentFp = current.length ? setFingerprint(current) : '';

  if (incomingFp === currentFp) {
    console.log('');
    console.log(`  Фото уже совпадают (${incoming.length} шт.) — менять нечего.`);
    console.log('');
    process.exit(0);
  }

  console.log('');
  console.log(`  Найдено новых фото: ${incoming.length}`);
  console.log(`  Было в галерее:     ${current.length}`);
  console.log('  Заменяю…');

  clearPhotosDir();
  const manifest = [];

  for (let i = 0; i < incoming.length; i++) {
    const src = incoming[i];
    const ext = path.extname(src).toLowerCase().replace('.jpeg', '.jpg');
    const file = `nature_${String(i + 1).padStart(3, '0')}${ext === '.jpeg' ? '.jpg' : ext}`;
    const dest = path.join(OUT_DIR, file);
    fs.copyFileSync(src, dest);
    const { width, height } = readImageSize(dest);
    manifest.push({
      file,
      width,
      height,
      source: `new_foto/${path.basename(src)}`,
    });
    console.log(`  → ${file}  (${width}×${height})`);
  }

  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`  Манифест: ${manifest.length} записей → public/photos/photos.json`);
  rebuildDist();
  console.log('');
  console.log('  Готово. Запустите галерею (Запустить_галерею.bat / npm start).');
  console.log('');
}

main();
