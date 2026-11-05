// Test dymny: uruchamia program w Electronie i sprawdza kluczowe funkcje (ok. 10–20 s).
// Wymaga zbudowanego interfejsu: npm test (buduje automatycznie).
// Na Linuksie bez ekranu (serwer, CI) używa xvfb-run, jeśli jest zainstalowany.
import { spawnSync } from 'child_process';
import electronPath from 'electron';

const runner = 'test/electron-runner.cjs';
const headlessLinux = process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY;
const hasXvfb = spawnSync('which', ['xvfb-run']).status === 0;
const linuxFlags = process.platform === 'linux' ? ['--no-sandbox'] : [];

const [cmd, args] =
  headlessLinux && hasXvfb
    ? ['xvfb-run', ['-a', '-s', '-screen 0 1440x900x24', electronPath, ...linuxFlags, runner]]
    : [electronPath, [...linuxFlags, runner]];

const result = spawnSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', timeout: 300000 });
const output = result.stdout || '';
const report = output.split('\n').filter(l => /^(Test dymny|TEST NIEUDANY|  - )/.test(l));
console.log(report.join('\n') || output || result.stderr);
process.exit(result.status === 0 && /Test dymny: OK/.test(output) ? 0 : 1);
