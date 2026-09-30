import assert from 'node:assert/strict';
import { empty, apply, stats } from '../lib/pong.ts';
for (const mode of ['singles', 'doubles']) {
  const s = empty();
  for (let i = 0; i < 10; i++) apply(s, 'player', { name: `P${i}` });
  const ids = s.players.map((p) => p.id);
  apply(s, 'night', {
    mode,
    members: ids.slice(0, 8).map((id, i) => ({ id, table: i < 4 ? 1 : 2 })),
  });
  const n = s.nights[0],
    first = n.matches.find((m) => m.table === 1);
  apply(s, 'activeMatch', { nightId: n.id, matchId: first.id, active: true });
  assert.equal(stats(s)[first.a[0]].games, 0);
  const table2 = structuredClone(n.matches.filter((m) => m.table === 2));
  apply(s, 'attendance', { nightId: n.id, in: ids[8], table: 1 });
  assert.deepEqual(
    n.matches.filter((m) => m.table === 2),
    table2,
  );
  assert.equal(
    n.matches.find((m) => m.id === first.id),
    first,
  );
  apply(s, 'attendance', { nightId: n.id, out: ids[8] });
  assert.deepEqual(
    n.matches.filter((m) => m.table === 2),
    table2,
  );
  apply(s, 'attendance', {
    nightId: n.id,
    out: first.a[0],
    in: ids[9],
    table: 1,
    replace: true,
  });
  assert.deepEqual(
    n.matches.filter((m) => m.table === 2),
    table2,
  );
  assert.equal(n.matches.find((m) => m.id === first.id).active, true);
  apply(s, 'reshuffle', { nightId: n.id });
  assert.equal(n.matches.find((m) => m.id === first.id).active, true);
  assert.throws(() => apply(s, 'finish', { nightId: n.id }), /in-progress/);
  apply(s, 'score', { nightId: n.id, matchId: first.id, score: [21, 10] });
  assert.equal(first.active, false);
  assert.equal(stats(s)[first.a[0]].games, 1);
  assert.equal(stats(s)[ids[9]].games, 0);
  apply(s, 'deleteMatch', { nightId: n.id, matchId: first.id });
  assert.equal(stats(s)[first.a[0]].games, 0);
  assert.ok(
    n.changes.some(
      (c) =>
        c.summary === 'Match deleted' &&
        c.details.some((d) => d.includes('21')),
    ),
  );
  const next = n.matches.find((m) => m.table === 1 && !m.score);
  apply(s, 'activeMatch', { nightId: n.id, matchId: next.id, active: true });
  const other = n.matches.find((m) => m.table === 1 && m.id !== next.id);
  assert.throws(
    () =>
      apply(s, 'activeMatch', {
        nightId: n.id,
        matchId: other.id,
        active: true,
      }),
    /other in-progress/,
  );
  assert.throws(
    () =>
      apply(s, 'championship', {
        nightId: n.id,
        ids: ids.slice(0, mode === 'singles' ? 2 : 4),
        bestOf: 1,
      }),
    /in-progress/,
  );
  apply(s, 'activeMatch', { nightId: n.id, matchId: next.id, active: false });
  apply(s, 'championship', {
    nightId: n.id,
    ids: ids.slice(0, mode === 'singles' ? 2 : 4),
    bestOf: 1,
  });
  const final = n.matches.find((m) => m.champ);
  apply(s, 'activeMatch', { nightId: n.id, matchId: final.id, active: true });
  apply(s, 'championshipFormat', { nightId: n.id, bestOf: 3 });
  assert.equal(n.matches.filter((m) => m.active).length, 1);
  apply(s, 'score', { nightId: n.id, matchId: final.id, score: [21, 10] });
  assert.equal(final.active, false);
}
console.log(
  'PASS: table-isolated attendance changes, active-match preservation, scoring clears status, deletion recalculates totals, audit history, active-match conflicts and protected championships in singles/doubles.',
);
