import assert from 'node:assert/strict';
import { empty, apply, stats, playerTiming } from '../lib/pong.ts';
for (const mode of ['singles', 'doubles']) {
  const s = empty();
  for (let i = 0; i < 16; i++) apply(s, 'player', { name: `P${i}` });
  apply(s, 'night', {
    mode,
    members: s.players.map((p, i) => ({ id: p.id, table: i < 8 ? 1 : 2 })),
  });
  const n = s.nights[0],
    games = n.matches.filter((m) => m.table === 1),
    other = structuredClone(n.matches.filter((m) => m.table === 2));
  for (const i of [0, 5, 9])
    apply(s, 'score', { nightId: n.id, matchId: games[i].id, score: [21, 10] });
  apply(s, 'activeMatch', {
    nightId: n.id,
    matchId: games[1].id,
    active: true,
  });
  const before = structuredClone(n.matches),
    totals = stats(s),
    timing = playerTiming(s);
  apply(s, 'completedFirst', { nightId: n.id, table: 1 });
  assert.deepEqual(
    n.matches.filter((m) => m.table === 1).map((m) => m.id),
    [...games.filter((m) => m.score), ...games.filter((m) => !m.score)].map(
      (m) => m.id,
    ),
  );
  assert.deepEqual(
    n.matches.filter((m) => m.table === 2),
    other,
  );
  for (const m of n.matches)
    assert.deepEqual(
      m,
      before.find((x) => x.id === m.id),
    );
  assert.deepEqual(stats(s), totals);
  assert.deepEqual(playerTiming(s), timing);
  assert.equal(n.changes.at(-1).summary, 'Completed games moved to top');
  const sorted = structuredClone(n);
  apply(s, 'completedFirst', { nightId: n.id, table: 1 });
  assert.deepEqual(n, sorted);
}
console.log(
  'PASS: out-of-order completed games move first; all match data, other table, stats and timing preserved; repeated action is a no-op.',
);
