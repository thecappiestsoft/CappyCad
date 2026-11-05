// Buduje WSZYSTKIE wersje z jednego komputera z Linuksem (np. serwer CI):
// Windows (instalator + ZIP), macOS (Intel + Apple Silicon), Linux (.deb, Arch, AppImage, tar.gz)
// oraz jeden plik HTML. Wyniki: release/CappyCad-<wersja>/ z sumami SHA-256.
//
// Wymagania (Linux): wine + wine32 (instalator Windows), bsdtar (pakiet Arch), xvfb-run (test),
//                    rcodesign w PATH lub tools/bin/ (podpis ad-hoc macOS).
//   npm run dist:all            (z testem)
//   npm run dist:all -- --no-test
import { execSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const run = cmd => {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', env: { ...process.env, WINEDEBUG: '-all' } });
};
const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;

fs.rmSync('release', { recursive: true, force: true });
run('node scripts/build.mjs');
if (!process.argv.includes('--no-test')) run('node test/run.mjs');
run('node scripts/build-html.mjs');
run('npx electron-builder --linux');
if (!fs.existsSync(path.join(process.env.HOME || '/root', '.wine', 'system.reg'))) run('wineboot -i');
run('npx electron-builder --win');
run('npx electron-builder --mac');

// Zebranie gotowych plików w jednym folderze
const out = path.join('release', `CappyCad-${version}`);
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync('release')) {
  if (/\.(exe|zip|deb|AppImage|pkg\.tar\.xz|tar\.gz)$/.test(f))
    fs.renameSync(path.join('release', f), path.join(out, f));
}
fs.copyFileSync('dist/CappyCad.html', path.join(out, `CappyCad-${version}.html`));
for (const f of fs.readdirSync('docs/user')) fs.copyFileSync(path.join('docs/user', f), path.join(out, f));

const sums = fs
  .readdirSync(out)
  .filter(f => !f.endsWith('.txt'))
  .sort()
  .map(
    f =>
      crypto
        .createHash('sha256')
        .update(fs.readFileSync(path.join(out, f)))
        .digest('hex') +
      '  ' +
      f,
  );
fs.writeFileSync(path.join(out, 'SHA256SUMS.txt'), sums.join('\n') + '\n');

console.log(`\nGotowe pliki w ${out}:`);
for (const f of fs.readdirSync(out))
  console.log('  ' + f.padEnd(52) + (fs.statSync(path.join(out, f)).size / 1048576).toFixed(1) + ' MB');
