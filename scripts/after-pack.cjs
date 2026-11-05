// electron-builder: krok po spakowaniu aplikacji.
// Na macOS aplikacja musi mieć przynajmniej podpis „ad-hoc”, inaczej nie uruchomi się
// na komputerach z procesorem Apple (M1–M4). Podpis ad-hoc nie wymaga konta Apple Developer.
//  - budowanie na Macu:     używamy systemowego `codesign`,
//  - budowanie na Linuksie: używamy `rcodesign` (https://github.com/indygreg/apple-platform-rs),
//    jeśli jest w PATH lub w tools/bin/ — w przeciwnym razie tylko ostrzegamy.
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);

  if (process.platform === 'darwin') {
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
    return;
  }

  const local = path.join(__dirname, '..', 'tools', 'bin', 'rcodesign');
  const rcodesign = fs.existsSync(local) ? local : spawnSync('which', ['rcodesign']).status === 0 ? 'rcodesign' : null;
  if (rcodesign) {
    execFileSync(rcodesign, ['sign', appPath], { stdio: 'inherit' });
  } else {
    console.warn(
      'UWAGA: brak rcodesign — aplikacja macOS nie została podpisana ad-hoc (nie uruchomi się na Apple Silicon).',
    );
  }
};
