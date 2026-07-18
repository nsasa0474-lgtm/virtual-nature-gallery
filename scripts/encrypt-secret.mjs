/**
 * Encrypt images from nopublic/ into public/secret/*.bin
 * Usage: SECRET_PASSWORD=... node scripts/encrypt-secret.mjs
 * Password is never written to disk by this script.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'nopublic');
const OUT_DIR = path.join(ROOT, 'public', 'secret');

const ITERATIONS = 600_000;
const KEY_LEN = 32;
const SALT_LEN = 16;
const IV_LEN = 12;

const password = process.env.SECRET_PASSWORD;
if (!password || password.length < 8) {
  console.error('Set SECRET_PASSWORD env var (min 8 chars).');
  process.exit(1);
}

function listImages(dir) {
  if (!fs.existsSync(dir)) {
    console.error('Missing folder:', dir);
    process.exit(1);
  }
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .map((f) => path.join(dir, f))
    .sort();
}

function deriveKey(passwordStr, salt) {
  return crypto.pbkdf2Sync(passwordStr, salt, ITERATIONS, KEY_LEN, 'sha256');
}

function encryptBuffer(key, plain) {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  // file layout: ciphertext || tag (16 bytes)
  return { iv, data: Buffer.concat([enc, tag]) };
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const f of fs.readdirSync(OUT_DIR)) {
  fs.unlinkSync(path.join(OUT_DIR, f));
}

const images = listImages(SRC_DIR);
if (!images.length) {
  console.error('No images in nopublic/');
  process.exit(1);
}

const salt = crypto.randomBytes(SALT_LEN);
const key = deriveKey(password, salt);

const files = [];
images.forEach((imgPath, i) => {
  const plain = fs.readFileSync(imgPath);
  const { iv, data } = encryptBuffer(key, plain);
  const outName = `secret_${String(i + 1).padStart(3, '0')}.bin`;
  fs.writeFileSync(path.join(OUT_DIR, outName), data);
  files.push({
    id: i + 1,
    file: outName,
    iv: iv.toString('base64'),
    mime: imgPath.toLowerCase().endsWith('.png')
      ? 'image/png'
      : imgPath.toLowerCase().endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg',
  });
  console.log(`Encrypted → ${outName} (${plain.length} bytes)`);
});

const manifest = {
  kdf: 'PBKDF2',
  hash: 'SHA-256',
  iterations: ITERATIONS,
  salt: salt.toString('base64'),
  files,
};

fs.writeFileSync(
  path.join(OUT_DIR, 'manifest.json'),
  JSON.stringify(manifest, null, 2),
  'utf8'
);

console.log(`\nDone. ${files.length} files → ${OUT_DIR}`);
console.log('Plaintext nopublic/ is gitignored; do not commit SECRET_PASSWORD.');
