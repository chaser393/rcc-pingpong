import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const cwd =
  process.env.PONG_TEST_PACKAGE_DIR ??
  readFileSync('outputs/windows-build-path.txt', 'utf8').trim();
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
  const auth = async (username, password, cookie = '', action = 'login') =>
    post('/api/auth', { action, username, password, setupKey }, cookie);
  let r = await auth('admin', 'x', '', 'create');
  assert.equal(r.status, 200, await r.text());
  const admin = r.headers.get('set-cookie').split(';')[0];
  r = await auth('scorer', 'x', admin, 'create');
  assert.equal(r.status, 200, await r.text());
  r = await auth('scorer', 'x');
  let scorer = r.headers.get('set-cookie').split(';')[0];
  const read = async (cookie = admin) =>
    (await fetch(url + '/api/state', { headers: { cookie } })).json();
  const change = async (action, value, cookie = admin) =>
    post(
      '/api/state',
      { version: (await read()).version, action, value },
      cookie,
    );
  assert.equal((await read()).superAdmin, true);
  assert.equal((await read(scorer)).superAdmin, false);
  assert.equal(
    (await fetch(url + '/api/managers', { headers: { cookie: scorer } }))
      .status,
    403,
  );
  assert.equal((await fetch(url + '/api/managers')).status, 403);
  assert.equal((await auth('intruder', 'x', scorer, 'create')).status, 403);
  for (let i = 0; i < 8; i++) {
    r = await change('player', { name: `Player ${i}` }, scorer);
    assert.equal(r.status, 200, await r.text());
  }
  const ids = (await read()).state.players.map((p) => p.id);
  r = await change(
    'night',
    {
      name: 'Permission test',
      members: ids.map((id, i) => ({ id, table: i < 4 ? 1 : 2 })),
    },
    scorer,
  );
  assert.equal(r.status, 200, await r.text());
  const n = (await read()).state.nights[0];
  const m = n.matches[0];
  r = await change(
    'score',
    { nightId: n.id, matchId: m.id, score: [21, 10] },
    scorer,
  );
  assert.equal(r.status, 200, await r.text());
  const before = (await read()).state;
  for (const [action, value] of [
    ['score', { nightId: n.id, matchId: m.id, score: [10, 21] }],
    ['score', { nightId: n.id, matchId: m.id, score: null }],
    ['resetPlayerStats', { id: ids[0] }],
    ['deleteNight', { nightId: n.id }],
    ['renameNight', { nightId: n.id, name: 'Changed' }],
    ['reshuffle', { nightId: n.id }],
    ['addMatch', { nightId: n.id, table: 1, ids: ids.slice(0, 4) }],
    ['attendance', { nightId: n.id, out: ids[0] }],
    ['move', { nightId: n.id, playerId: ids[0], table: 2 }],
    ['championship', { nightId: n.id, ids: ids.slice(0, 4), bestOf: 1 }],
    ['finish', { nightId: n.id }],
    ['unknown', {}],
  ]) {
    r = await change(action, value, scorer);
    assert.equal(r.status, 403, action + ': ' + (await r.text()));
  }
  assert.deepEqual((await read()).state, before);
  r = await change(
    'score',
    { nightId: n.id, matchId: m.id, score: [10, 21] },
    admin,
  );
  assert.equal(r.status, 200, await r.text());
  r = await change('finish', { nightId: n.id });
  assert.equal(r.status, 200, await r.text());
  r = await change(
    'score',
    { nightId: n.id, matchId: n.matches[1].id, score: [21, 10] },
    scorer,
  );
  assert.equal(r.status, 403);
  const history = (await read()).state;
  r = await post(
    '/api/managers',
    { action: 'password', username: 'scorer', password: 'y' },
    scorer,
  );
  assert.equal(r.status, 403);
  r = await post(
    '/api/managers',
    { action: 'password', username: 'scorer', password: ' ' },
    admin,
  );
  assert.equal(r.status, 400);
  r = await post(
    '/api/managers',
    { action: 'password', username: 'scorer', password: 'y' },
    admin,
  );
  assert.equal(r.status, 200, await r.text());
  assert.equal((await read(scorer)).manager, null);
  assert.equal((await auth('scorer', 'x')).status, 400);
  r = await auth('scorer', 'y');
  assert.equal(r.status, 200);
  scorer = r.headers.get('set-cookie').split(';')[0];
  r = await post(
    '/api/managers',
    { action: 'delete', username: 'admin' },
    admin,
  );
  assert.equal(r.status, 400);
  r = await post(
    '/api/managers',
    { action: 'delete', username: 'scorer' },
    admin,
  );
  assert.equal(r.status, 200);
  assert.equal((await read(scorer)).manager, null);
  assert.deepEqual((await read()).state, history);
  await stop();
  await start();
  assert.deepEqual((await read()).state, history);
  assert.equal((await read()).superAdmin, true);
  console.log(
    'PASS: manager first scores, admin-only corrections/game changes/resets, manager CRUD permissions, password/session revocation, nonblank-only passwords, admin protection, unchanged history after account changes and restart.',
  );
} finally {
  await stop();
}
