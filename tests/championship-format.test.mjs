import assert from 'node:assert/strict';
import { empty, apply, stats, pairFinalistsByPR } from '../lib/pong.ts';
assert.deepEqual(
  pairFinalistsByPR(['a', 'b', 'c', 'd'], { a: 600, b: 800, c: 500, d: 700 }),
  ['b', 'c', 'd', 'a'],
);
assert.deepEqual(pairFinalistsByPR(['a', 'b', 'c', 'd'], {}), [
  'a',
  'd',
  'b',
  'c',
]);
const s = empty();
for (let i = 0; i < 4; i++) apply(s, 'player', { name: `Player ${i}` });
const ids = s.players.map((p) => p.id);
apply(s, 'night', { members: ids.map((id) => ({ id, table: 1 })) });
const n = s.nights[0];
apply(s, 'championship', { nightId: n.id, ids, bestOf: 1 });
const first = n.matches[0];
apply(s, 'score', { nightId: n.id, matchId: first.id, score: [21, 10] });
const before = stats(s);
assert.equal(before[ids[0]].championships, 1);
apply(s, 'championshipFormat', { nightId: n.id, bestOf: 3 });
assert.deepEqual(n.matches[0], first);
assert.equal(n.matches.length, 3);
for (const id of ids) {
  assert.deepEqual(
    { ...stats(s)[id], championships: before[id].championships },
    before[id],
  );
  assert.equal(stats(s)[id].championships, 0);
}
apply(s, 'championshipFormat', { nightId: n.id, bestOf: 3 });
assert.equal(n.matches.length, 3);
apply(s, 'score', { nightId: n.id, matchId: n.matches[1].id, score: [10, 21] });
assert.throws(
  () => apply(s, 'championshipFormat', { nightId: n.id, bestOf: 1 }),
  /Clear later/,
);
apply(s, 'score', { nightId: n.id, matchId: n.matches[2].id, score: [10, 21] });
assert.equal(stats(s)[ids[2]].championships, 1);
assert.equal(stats(s)[ids[0]].championships, 0);
assert.ok(n.changes.some((c) => c.summary === 'Championship format changed'));
console.log(
  'PASS: PR pairing, scored final preserved, no duplicate matches/stats, title recalculation and safe format changes.',
);
