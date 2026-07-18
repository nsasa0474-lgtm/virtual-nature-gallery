/**
 * Client-side secret vault: PBKDF2-SHA-256 + AES-256-GCM via Web Crypto.
 * Plaintext images exist only as in-memory blob URLs until lock().
 */

const MANIFEST_URL = './secret/manifest.json';

let cryptoKey = null;
let blobUrls = [];
let unlockedItems = []; // { url, mime, file }

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(password, salt, iterations) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
}

async function decryptFile(key, iv, cipherWithTag) {
  if (cipherWithTag.byteLength < 17) throw new Error('Ciphertext too short');
  const tagLen = 16;
  const data = cipherWithTag.slice(0, cipherWithTag.byteLength - tagLen);
  const tag = cipherWithTag.slice(cipherWithTag.byteLength - tagLen);
  // Web Crypto expects ciphertext||tag as one buffer for AES-GCM
  const combined = new Uint8Array(data.byteLength + tag.byteLength);
  combined.set(new Uint8Array(data), 0);
  combined.set(new Uint8Array(tag), data.byteLength);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, combined);
}

export function isSecretUnlocked() {
  return cryptoKey !== null && unlockedItems.length > 0;
}

export function getUnlockedItems() {
  return unlockedItems.slice();
}

/**
 * Fetch manifest + ciphertext, decrypt with password.
 * @returns {Promise<{ url: string, mime: string, file: string }[]>}
 */
export async function unlockSecret(password) {
  if (!password) throw new Error('empty');

  const res = await fetch(MANIFEST_URL);
  if (!res.ok) throw new Error('manifest');
  const manifest = await res.json();

  const salt = b64ToBytes(manifest.salt);
  const key = await deriveKey(password, salt, manifest.iterations);

  const items = [];
  try {
    for (const entry of manifest.files) {
      const binRes = await fetch(`./secret/${entry.file}`);
      if (!binRes.ok) throw new Error('missing');
      const buf = new Uint8Array(await binRes.arrayBuffer());
      const iv = b64ToBytes(entry.iv);
      let plain;
      try {
        plain = await decryptFile(key, iv, buf);
      } catch {
        throw new Error('bad-password');
      }
      const mime = entry.mime || 'image/jpeg';
      const blob = new Blob([plain], { type: mime });
      const url = URL.createObjectURL(blob);
      items.push({ url, mime, file: entry.file });
    }
  } catch (err) {
    for (const item of items) {
      try {
        URL.revokeObjectURL(item.url);
      } catch {
        /* ignore */
      }
    }
    throw err;
  }

  lockSecret();
  cryptoKey = key;
  blobUrls = items.map((i) => i.url);
  unlockedItems = items;
  return items;
}

/** Wipe key material references and revoke blob URLs. */
export function lockSecret() {
  for (const u of blobUrls) {
    try {
      URL.revokeObjectURL(u);
    } catch {
      /* ignore */
    }
  }
  blobUrls = [];
  unlockedItems = [];
  cryptoKey = null;
}
