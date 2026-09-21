import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
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
    ['settings', { defaultTables: 1 }],
    ['resetPlayerStats', { id: ids[0] }],
    ['deleteNight', { nightId: n.id }],
    ['unknown', {}],
  ]) {
    r = await change(action, value, scorer);
    assert.equal(r.status, 403, action + ': ' + (await r.text()));
  }
  assert.deepEqual((await read()).state, before);
  for (const [action, value] of [
    ['score', { nightId: n.id, matchId: m.id, score: [10, 21] }],
    ['score', { nightId: n.id, matchId: m.id, score: null }],
    ['score', { nightId: n.id, matchId: m.id, score: [21, 10] }],
    ['renameNight', { nightId: n.id, name: 'Changed' }],
    ['addMatch', { nightId: n.id, table: 1, ids: ids.slice(0, 4) }],
    ['reshuffle', { nightId: n.id }],
    ['attendance', { nightId: n.id, out: ids[0] }],
    ['attendance', { nightId: n.id, in: ids[0], table: 1 }],
    ['move', { nightId: n.id, playerId: ids[0], table: 2 }],
    ['move', { nightId: n.id, playerId: ids[0], table: 1 }],
    ['championship', { nightId: n.id, ids: ids.slice(0, 4), bestOf: 1 }],
  ]) {
    r = await change(action, value, scorer);
    assert.equal(r.status, 200, action + ': ' + (await r.text()));
  }
  const final = (await read()).state.nights[0].matches.find((m) => m.champ);
  r = await change(
    'score',
    { nightId: n.id, matchId: final.id, score: [21, 10] },
    scorer,
  );
  assert.equal(r.status, 200, await r.text());
  r = await change('championshipFormat', { nightId: n.id, bestOf: 3 }, scorer);
  assert.equal(r.status, 200, await r.text());
  const finals = (await read()).state.nights[0].matches.filter((m) => m.champ);
  assert.equal(finals.length, 3);
  assert.equal(finals[0].id, final.id);
  assert.deepEqual(finals[0].score, [21, 10]);
  r = await change(
    'score',
    { nightId: n.id, matchId: finals[1].id, score: [21, 10] },
    scorer,
  );
  assert.equal(r.status, 200, await r.text());
  r = await change('finish', { nightId: n.id }, scorer);
  assert.equal(r.status, 200, await r.text());
  r = await change(
    'score',
    { nightId: n.id, matchId: m.id, score: [10, 21] },
    scorer,
  );
  assert.equal(r.status, 200, await r.text());
  const doublesHistory = (await read()).state.nights;
  r = await change(
    'night',
    {
      name: 'Singles API test',
      mode: 'singles',
      members: ids.slice(0, 3).map((id) => ({ id, table: 1 })),
    },
    scorer,
  );
  assert.equal(r.status, 200, await r.text());
  const singles = (await read()).state.nights.at(-1);
  assert.equal(singles.mode, 'singles');
  assert.equal(singles.matches.length, 3);
  assert.ok(singles.matches.every((m) => m.a.length === 1 && m.b.length === 1));
  r = await change(
    'score',
    { nightId: singles.id, matchId: singles.matches[0].id, score: [21, 10] },
    scorer,
  );
  assert.equal(r.status, 200, await r.text());
  r = await change(
    'addMatch',
    { nightId: singles.id, table: 1, ids: ids.slice(0, 2) },
    scorer,
  );
  assert.equal(r.status, 200, await r.text());
  r = await change(
    'championship',
    { nightId: singles.id, ids: ids.slice(0, 2), bestOf: 1 },
    scorer,
  );
  assert.equal(r.status, 200, await r.text());
  const singlesFinal = (await read()).state.nights
    .at(-1)
    .matches.find((m) => m.champ);
  assert.equal(singlesFinal.a.length, 1);
  r = await change(
    'score',
    { nightId: singles.id, matchId: singlesFinal.id, score: [21, 10] },
    scorer,
  );
  assert.equal(r.status, 200, await r.text());
  r = await change('finish', { nightId: singles.id }, scorer);
  assert.equal(r.status, 200, await r.text());
  assert.deepEqual((await read()).state.nights.slice(0, -1), doublesHistory);
  const unchangedNights = (await read()).state.nights;
  r = await change('settings', { defaultTables: 1 }, admin);
  assert.equal(r.status, 200, await r.text());
  assert.equal((await read(scorer)).state.settings.defaultTables, 1);
  assert.deepEqual((await read()).state.nights, unchangedNights);
  r = await change('settings', { defaultTables: 3 }, admin);
  assert.equal(r.status, 400);
  assert.equal((await read()).state.settings.defaultTables, 1);
  r = await change(
    'player',
    {
      id: ids[0],
      name: '=SUM(1,2) & Player',
      info: 'Public information',
      notes: 'PRIVATE_EXPORT_SENTINEL',
    },
    scorer,
  );
  assert.equal(r.status, 200, await r.text());
  for (const night of (await read()).state.nights) {
    r = await change(
      'renameNight',
      { nightId: night.id, name: 'Players' },
      scorer,
    );
    assert.equal(r.status, 200, await r.text());
  }
  const exportBefore = (await read()).state;
  assert.equal((await fetch(url + '/api/export')).status, 403);
  assert.equal(
    (await fetch(url + '/api/export', { headers: { cookie: scorer } })).status,
    403,
  );
  const download = await fetch(url + '/api/export', {
    headers: { cookie: admin },
  });
  assert.equal(download.status, 200);
  assert.match(download.headers.get('content-type'), /spreadsheetml/);
  assert.match(
    download.headers.get('content-disposition'),
    /attachment; filename="rcc-pingpong-.*\.xlsx"/,
  );
  assert.equal(download.headers.get('cache-control'), 'no-store');
  const bytes = new Uint8Array(await download.arrayBuffer());
  const files = unzipSync(bytes);
  const workbook = strFromU8(files['xl/workbook.xml']);
  assert.match(workbook, /name="Players"/);
  assert.match(workbook, /name="Players \(2\)"/);
  assert.match(workbook, /name="Players \(3\)"/);
  const text = Object.values(files)
    .map((file) => strFromU8(file))
    .join('');
  assert.ok(!text.includes('PRIVATE_EXPORT_SENTINEL'));
  assert.ok(!text.includes('<f>'));
  assert.ok(text.includes('=SUM(1,2) &amp; Player'));
  assert.ok(text.includes('Public information'));
  assert.deepEqual((await read()).state, exportBefore);
  if (process.env.PONG_EXPORT_TEST_FILE)
    writeFileSync(process.env.PONG_EXPORT_TEST_FILE, bytes);
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
    'PASS: manager scoring and night controls, preserved championship expansion, admin-only resets/deletion, manager CRUD permissions, password/session revocation, nonblank-only passwords, admin protection, unchanged history after account changes and restart.',
  );
} finally {
  await stop();
}
