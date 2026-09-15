import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const cwd = process.env.PONG_TEST_PACKAGE_DIR ?? readFileSync('outputs/windows-build-path.txt', 'utf8').trim();
const data = mkdtempSync(join(tmpdir(), 'pong-windows-test-'));
const url = 'http://127.0.0.1:3002',
  setupKey = crypto.randomUUID();
let child,
  logs = '';
async function start(publicOrigin = '') {
  child = spawn(process.execPath, ['server.js'], {
    cwd,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: '3002',
      PONG_DATA_DIR: data,
      SETUP_KEY: setupKey,
      PUBLIC_ORIGIN: publicOrigin,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (b) => (logs += b));
  child.stderr.on('data', (b) => (logs += b));
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw Error(logs);
    try {
      const r = await fetch(url + '/api/state');
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error(logs);
}
async function stop() {
  if (child && child.exitCode === null) {
    const exited = new Promise((r) => child.once('exit', r));
    child.kill();
    await exited;
  }
}
async function post(path, body, cookie = '', origin = url) {
  return fetch(url + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin, cookie },
    body: JSON.stringify(body),
  });
}
try {
  await start();
  assert.equal(
    (await (await fetch(url + '/api/state')).json()).needsSetup,
    true,
  );
  assert.equal(
    (
      await post('/api/state', {
        action: 'player',
        value: { name: 'No access' },
        version: 0,
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await post('/api/auth', {
        action: 'create',
        username: 'admin',
        password: ' ',
        setupKey,
      })
    ).status,
    400,
  );
  let r = await post('/api/auth', {
    action: 'create',
    username: 'admin',
    password: 'x',
    setupKey,
  });
  assert.equal(r.status, 200, await r.text());
  let cookie = r.headers.get('set-cookie').split(';')[0];
  r = await post(
    '/api/state',
    {
      action: 'player',
      value: { name: 'Saved Player', notes: 'Private fixture note' },
      version: 0,
    },
    cookie,
  );
  assert.equal(r.status, 200, await r.text());
  assert.equal(
    (
      await post(
        '/api/state',
        { action: 'player', value: { name: 'Stale' }, version: 0 },
        cookie,
      )
    ).status,
    409,
  );
  const publicState = await (await fetch(url + '/api/state')).json();
  assert.equal(publicState.state.players[0].notes, '');
  const privateState = await (
    await fetch(url + '/api/state', { headers: { cookie } })
  ).json();
  assert.equal(privateState.state.players[0].notes, 'Private fixture note');
  assert.match(await (await fetch(url)).text(), /RCC PINGPONG NIGHT/);
  await stop();
  await start('https://pong.kor.red');
  assert.equal(
    (await (await fetch(url + '/api/state')).json()).state.players[0].name,
    'Saved Player',
  );
  assert.equal(
    (
      await post('/api/auth', {
        action: 'login',
        username: 'admin',
        password: 'x',
      })
    ).status,
    400,
  );
  r = await post(
    '/api/auth',
    { action: 'login', username: 'admin', password: 'x' },
    '',
    'https://pong.kor.red',
  );
  assert.equal(r.status, 200, await r.text());
  assert.match(r.headers.get('set-cookie'), /; Secure/);
  console.log(
    'PASS: standalone Windows server, SQLite migrations/persistence/restart, manager setup, nonblank-only passwords, anonymous read restrictions, stale write protection and tunnel HTTPS cookies/origin.',
  );
} finally {
  await stop();
}
