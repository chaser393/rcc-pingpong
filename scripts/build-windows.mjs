import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const result = spawnSync(
  process.execPath,
  ['node_modules/vinext/dist/cli.js', 'build'],
  { stdio: 'inherit', env: { ...process.env, PONG_TARGET: 'windows' } },
);
if (result.status !== 0) process.exit(result.status ?? 1);
// A fresh version directory avoids overwriting an existing Windows data folder.
const destination = resolve(
  'outputs',
  'windows-' + new Date().toISOString().replace(/[:.]/g, '-'),
);
if (!existsSync('dist/standalone/server.js'))
  throw Error('Standalone server was not emitted.');
mkdirSync(destination, { recursive: true });
cpSync('dist/standalone', destination, { recursive: true });
cpSync('drizzle', resolve(destination, 'drizzle'), { recursive: true });
cpSync('windows/Start-Pong.ps1', resolve(destination, 'Start-Pong.ps1'));
cpSync('windows/import-state.mjs', resolve(destination, 'import-state.mjs'));
cpSync('windows/runtime.mjs', resolve(destination, 'runtime.mjs'));
cpSync('windows/HOSTING.md', resolve(destination, 'HOSTING.md'));
writeFileSync(resolve('outputs', 'windows-build-path.txt'), destination);
console.log('Windows package: ' + destination);
