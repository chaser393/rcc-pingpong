import assert from 'node:assert/strict';
import {
  empty,
  apply,
  stats,
  assignTablesByPR,
  latestAttendance,
} from '../lib/pong.ts';
for (let count = 4; count <= 14; count++) {
  const ids = Array.from({ length: count }, (_, i) => String(i)),
    ranks = Object.fromEntries(ids.map((id, i) => [id, 400 + i * 20]));
  const assigned = assignTablesByPR(ids, 2, ranks);
  const high = ids.filter((id) => assigned[id] === '1'),
    low = ids.filter((id) => assigned[id] === '2');
  assert.equal(high.length, Math.ceil(count / 2));
  assert.equal(low.length, Math.floor(count / 2));
  assert.ok(
    Math.min(...high.map((id) => ranks[id])) >
      Math.max(...low.map((id) => ranks[id])),
  );
  assert.ok(
    Object.values(assignTablesByPR(ids, 1, ranks)).every((t) => t === '1'),
  );
  assert.deepEqual(Object.keys(assigned).sort(), [...ids].sort());
}
assert.deepEqual(assignTablesByPR(['a', 'b', 'c', 'd'], 2, {}), {
  a: '1',
  b: '1',
  c: '2',
  d: '2',
});
for (const bestOf of [1, 3]) {
  const s = empty();
  for (let i = 0; i < 8; i++) apply(s, 'player', { name: `Player ${i}` });
  const ids = s.players.map((p) => p.id);
  assert.equal(latestAttendance(s, ids[0]), null);
  apply(s, 'night', {
    name: 'First',
    members: ids.map((id, i) => ({ id, table: i < 4 ? 1 : 2 })),
  });
  const n = s.nights[0];
  n.date = '2026-01-01';
  apply(s, 'championship', { nightId: n.id, ids: ids.slice(0, 4), bestOf });
  const finals = n.matches.filter((m) => m.champ);
  assert.equal(stats(s)[ids[0]].championships, 0);
  for (let i = 0; i < Math.ceil(bestOf / 2); i++)
    apply(s, 'score', { nightId: n.id, matchId: finals[i].id, score: [21, 9] });
  assert.equal(stats(s)[ids[0]].championships, 1);
  assert.equal(stats(s)[ids[1]].championships, 1);
  assert.equal(stats(s)[ids[2]].championships, 0);
  for (let i = 0; i < Math.ceil(bestOf / 2); i++)
    apply(s, 'score', { nightId: n.id, matchId: finals[i].id, score: [9, 21] });
  assert.equal(stats(s)[ids[0]].championships, 0);
  assert.equal(stats(s)[ids[2]].championships, 1);
  apply(s, 'resetPlayerStats', { id: ids[2] });
  assert.equal(stats(s)[ids[2]].championships, 0);
  assert.equal(stats(s)[ids[3]].championships, 1);
  apply(s, 'finish', { nightId: n.id });
  apply(s, 'night', {
    name: 'Second',
    members: ids.map((id, i) => ({ id, table: i < 4 ? 1 : 2 })),
  });
  const next = s.nights[1];
  next.date = '2026-02-01';
  assert.equal(latestAttendance(s, ids[0]).name, 'Second');
  apply(s, 'renameNight', { nightId: next.id, name: 'February night' });
  assert.equal(latestAttendance(s, ids[0]).name, 'February night');
  apply(s, 'finish', { nightId: next.id });
  apply(s, 'deleteNight', { nightId: next.id });
  assert.equal(latestAttendance(s, ids[0]).name, 'First');
  apply(s, 'deleteNight', { nightId: n.id });
  assert.equal(stats(s)[ids[3]].championships, 0);
  assert.equal(latestAttendance(s, ids[0]), null);
}
console.log(
  'PASS: PR table splits 4–14, one table, ties, single/best-of-three titles, corrections, resets, deletion, latest attendance and renames.',
);
