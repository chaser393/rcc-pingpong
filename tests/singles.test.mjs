import assert from 'node:assert/strict';
import {
  empty,
  apply,
  stats,
  schedule,
  teamSize,
  suggestedFinalists,
  suggestExtraMatch,
  standings,
} from '../lib/pong.ts';
function club(count, tables = 1, mode = 'singles') {
  const s = empty();
  for (let i = 0; i < count; i++) apply(s, 'player', { name: `Player ${i}` });
  const ids = s.players.map((p) => p.id);
  apply(s, 'night', {
    mode,
    members: ids.map((id, i) => ({ id, table: (i % tables) + 1 })),
  });
  return { s, n: s.nights[0], ids };
}
for (let count = 2; count <= 14; count++)
  for (const tables of [1, 2]) {
    if (count < tables * 2) continue;
    const { s, n } = club(count, tables);
    for (let table = 1; table <= tables; table++) {
      const members = n.members.filter((p) => p.table === table);
      const matches = n.matches.filter((m) => m.table === table);
      assert.equal(matches.length, (members.length * (members.length - 1)) / 2);
      assert.equal(
        new Set(matches.map((m) => [...m.a, ...m.b].sort().join('|'))).size,
        matches.length,
      );
      for (const m of matches) {
        assert.equal(m.a.length, 1);
        assert.equal(m.b.length, 1);
        assert.notEqual(m.a[0], m.b[0]);
      }
      for (const p of members)
        assert.equal(
          matches.filter((m) => [...m.a, ...m.b].includes(p.id)).length,
          members.length - 1,
        );
    }
    const first = structuredClone(n.matches[0]);
    apply(s, 'score', { nightId: n.id, matchId: first.id, score: [21, 9] });
    apply(s, 'reshuffle', { nightId: n.id });
    assert.equal(
      n.matches.filter(
        (m) =>
          [...m.a, ...m.b].sort().join('|') ===
          [...first.a, ...first.b].sort().join('|'),
      ).length,
      1,
    );
    assert.deepEqual(n.matches.find((m) => m.id === first.id).score, [21, 9]);
    assert.equal(stats(s)[first.a[0]].wins, 1);
    assert.equal(stats(s)[first.a[0]].pr, 520);
    assert.equal(stats(s)[first.b[0]].pr, 480);
    assert.equal(suggestExtraMatch(n, 1).length, 2);
    assert.equal(suggestedFinalists(n).length, 2);
  }
{
  const { s, n, ids } = club(4, 2);
  for (const m of n.matches)
    apply(s, 'score', { nightId: n.id, matchId: m.id, score: [21, 5] });
  const finalists = suggestedFinalists(n);
  assert.deepEqual(finalists, [standings(n, 1)[0].id, standings(n, 2)[0].id]);
  assert.throws(
    () => apply(s, 'championship', { nightId: n.id, ids, bestOf: 1 }),
    /2 different/,
  );
  apply(s, 'championship', { nightId: n.id, ids: finalists, bestOf: 1 });
  const final = n.matches.find((m) => m.champ);
  apply(s, 'score', { nightId: n.id, matchId: final.id, score: [21, 19] });
  assert.equal(stats(s)[finalists[0]].championships, 1);
  const games = stats(s)[finalists[0]].games;
  apply(s, 'championshipFormat', { nightId: n.id, bestOf: 3 });
  assert.equal(stats(s)[finalists[0]].games, games);
  assert.equal(stats(s)[finalists[0]].championships, 0);
  const second = n.matches.filter((m) => m.champ)[1];
  assert.equal(second.a.length, 1);
  apply(s, 'score', { nightId: n.id, matchId: second.id, score: [21, 8] });
  assert.equal(stats(s)[finalists[0]].championships, 1);
}
{
  const { s, n, ids } = club(5);
  const m = n.matches[0];
  apply(s, 'score', { nightId: n.id, matchId: m.id, score: [21, 4] });
  const before = stats(s)[m.a[0]];
  apply(s, 'player', { name: 'Replacement' });
  const replacement = s.players.at(-1).id;
  apply(s, 'attendance', {
    nightId: n.id,
    out: m.a[0],
    in: replacement,
    table: 1,
    replace: true,
  });
  assert.equal(n.members.find((p) => p.id === replacement).credit, 1);
  assert.deepEqual(stats(s)[m.a[0]], before);
  assert.equal(stats(s)[replacement].games, 0);
  assert.ok(
    n.matches
      .filter((x) => !x.score)
      .every((x) => ![...x.a, ...x.b].includes(m.a[0])),
  );
  assert.ok(n.matches.every((x) => x.a.length === 1 && x.b.length === 1));
  const active = n.members.filter((p) => p.active);
  const counts = active.map(
    (p) =>
      p.credit +
      n.matches.filter((m) => [...m.a, ...m.b].includes(p.id)).length,
  );
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
  assert.throws(
    () =>
      apply(s, 'addMatch', { nightId: n.id, table: 1, ids: ids.slice(0, 4) }),
    /2 different/,
  );
  const extra = suggestExtraMatch(n, 1);
  apply(s, 'addMatch', { nightId: n.id, table: 1, ids: extra });
  assert.deepEqual(n.matches.at(-1).a, [extra[0]]);
  assert.deepEqual(n.matches.at(-1).b, [extra[1]]);
}
{
  const { s, n, ids } = club(4, 1, 'doubles');
  delete n.mode;
  assert.equal(teamSize(n), 2);
  assert.ok(schedule(n, 1).every((m) => m.a.length === 2 && m.b.length === 2));
  assert.equal(suggestedFinalists(n).length, 4);
  apply(s, 'finish', { nightId: n.id });
  assert.throws(
    () =>
      apply(s, 'night', {
        mode: 'invalid',
        members: ids.map((id) => ({ id, table: 1 })),
      }),
    /singles or doubles/,
  );
  assert.throws(
    () =>
      apply(s, 'night', {
        mode: 'singles',
        members: [{ id: ids[0], table: 1 }],
      }),
    /at least 2/,
  );
  assert.throws(
    () =>
      apply(s, 'night', {
        mode: 'singles',
        members: [
          { id: ids[0], table: 1 },
          { id: ids[1], table: 2 },
        ],
      }),
    /at least 2/,
  );
}
console.log(
  'PASS: singles 2–14 players, odd/even tables, complete round robin, reshuffles, PR/stats, extra matches, replacements, finalists/titles, format extension and legacy doubles.',
);
