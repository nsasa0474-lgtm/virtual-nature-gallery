import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, 'dist');
const PREFERRED_PORT = Number(process.env.PORT) || 8765;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
};

function safePath(urlPath) {
  let rel = decodeURIComponent((urlPath || '/').split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  rel = rel.replace(/^[/\\]+/, '').replace(/\//g, path.sep);
  const full = path.resolve(ROOT, rel);
  const rootWithSep = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
  if (full !== ROOT && !full.startsWith(rootWithSep)) return null;
  return full;
}

if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
  console.error('Сборка не найдена: dist/index.html');
  console.error('Выполните: npm install && npm run build');
  process.exit(1);
}

function openBrowser(url) {
  const cmd =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd);
}

function createServer() {
  return http.createServer((req, res) => {
    const filePath = safePath(req.url || '/');
    if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    fs.createReadStream(filePath).pipe(res);
  });
}

function tryListen(port, attemptsLeft) {
  const server = createServer();

  server.on('error', (err) => {
    try {
      server.close();
    } catch {}
    if ((err.code === 'EADDRINUSE' || err.code === 'EACCES') && attemptsLeft > 0) {
      console.warn(`Порт ${port} недоступен (${err.code}), пробую ${port + 1}…`);
      tryListen(port + 1, attemptsLeft - 1);
      return;
    }
    console.error('Ошибка сервера:', err.message);
    process.exit(1);
  });

  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}/`;
    console.log('');
    console.log('  Виртуальная галерея природы');
    console.log('  ============================');
    console.log(`  ${url}`);
    console.log('  Закройте это окно, чтобы остановить галерею.');
    console.log('');
    openBrowser(url);
  });
}

tryListen(PREFERRED_PORT, 20);
