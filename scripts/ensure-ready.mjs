/**
 * Ensure node_modules + dist exist after a fresh clone / ZIP download.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function runNpm(args) {
  const command =
    process.platform === 'win32' ? `npm.cmd ${args.join(' ')}` : `npm ${args.join(' ')}`;
  console.log(`> ${command}`);
  const result = spawnSync(command, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const hasModules = fs.existsSync(path.join(ROOT, 'node_modules', 'vite'));
const hasDist = fs.existsSync(path.join(ROOT, 'dist', 'index.html'));

if (!hasModules) {
  console.log('');
  console.log('  Первый запуск: устанавливаю зависимости…');
  console.log('');
  runNpm(['install']);
}

if (!hasDist) {
  console.log('');
  console.log('  Собираю галерею (один раз после скачивания)…');
  console.log('');
  runNpm(['run', 'build']);
}

if (!fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) {
  console.error('Сборка не появилась: dist/index.html');
  process.exit(1);
}
