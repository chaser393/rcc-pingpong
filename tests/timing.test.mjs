import assert from 'node:assert/strict';
import { empty, apply, matchSeconds, playerTiming } from '../lib/pong.ts';
const RealDate = Date;
let now = '2026-10-13T18:00:00.000Z';
globalThis.Date = class extends RealDate {
  constructor(value) {
    super(value ?? now);
  }
  static now() {
    return new RealDate(now).getTime();
  }
};
try {
  for (const mode of ['singles', 'doubles']) {
    now = '2026-10-13T18:00:00.000Z';
    const s = empty();
    for (let i = 0; i < 8; i++) apply(s, 'player', { name: `P${i}` });
    const ids = s.players.map((p) => p.id);
    apply(s, 'night', {
      mode,
      members: ids.map((id, i) => ({ id, table: i < 4 ? 1 : 2 })),
    });
    const n = s.nights[0],
      m = n.matches.find((m) => m.table === 1),
      other = n.matches.find((m) => m.table === 2);
    apply(s, 'activeMatch', { nightId: n.id, matchId: m.id, active: true });
    now = '2026-10-13T18:03:00.000Z';
    apply(s, 'activeMatch', { nightId: n.id, matchId: other.id, active: true });
    now = '2026-10-13T18:10:00.000Z';
    apply(s, 'score', { nightId: n.id, matchId: m.id, score: [21, 10] });
    assert.equal(matchSeconds(m), 600);
    const next = n.matches.find((x) => x.table === 1 && x.id !== m.id);
    now = '2026-10-13T18:14:00.000Z';
    apply(s, 'activeMatch', { nightId: n.id, matchId: next.id, active: true });
    assert.equal(next.timing.start, '2026-10-13T18:10:00.000Z');
    apply(s, 'reshuffle', { nightId: n.id });
    assert.equal(
      n.matches.find((x) => x.id === next.id).timing.start,
      next.timing.start,
    );
    now = '2026-10-13T18:20:00.000Z';
    apply(s, 'score', { nightId: n.id, matchId: next.id, score: [21, 12] });
    assert.equal(matchSeconds(next), 600);
    apply(s, 'score', { nightId: n.id, matchId: other.id, score: [21, 12] });
    assert.equal(matchSeconds(other), 1020);
    const before = structuredClone(m.timing);
    now = '2026-10-13T19:00:00.000Z';
    apply(s, 'score', { nightId: n.id, matchId: m.id, score: [10, 21] });
    assert.deepEqual(m.timing, before);
    assert.equal(playerTiming(s)[m.a[0]].average, 600);
    apply(s, 'score', { nightId: n.id, matchId: m.id, score: null });
    assert.equal(matchSeconds(m), null);
    apply(s, 'score', { nightId: n.id, matchId: m.id, score: [21, 10] });
    assert.deepEqual(m.timing, before);
    apply(s, 'resetPlayerStats', { id: m.a[0] });
    assert.equal(playerTiming(s)[m.a[0]].average, null);
    apply(s, 'championship', {
      nightId: n.id,
      ids: ids.slice(0, mode === 'singles' ? 2 : 4),
      bestOf: 1,
    });
    const final = n.matches.find((x) => x.champ);
    apply(s, 'activeMatch', { nightId: n.id, matchId: final.id, active: true });
    assert.equal(final.timing.source, 'start');
    apply(s, 'championshipFormat', { nightId: n.id, bestOf: 3 });
    assert.ok(
      n.matches
        .filter((x) => x.champ && x.id !== final.id)
        .every((x) => !x.timing),
    );
  }
  const s = empty();
  for (let i = 0; i < 3; i++) apply(s, 'player', { name: `U${i}` });
  apply(s, 'night', {
    mode: 'singles',
    members: s.players.map((p) => ({ id: p.id, table: 1 })),
  });
  const n = s.nights[0],
    m = n.matches[0];
  apply(s, 'score', { nightId: n.id, matchId: m.id, score: [21, 10] });
  assert.equal(matchSeconds(m), null);
  assert.equal(playerTiming(s)[m.a[0]].games, 0);
  now = '2026-10-13T19:10:00.000Z';
  apply(s, 'score', {
    nightId: n.id,
    matchId: n.matches[1].id,
    score: [21, 10],
  });
  assert.equal(matchSeconds(n.matches[1]), 600);
  console.log(
    'PASS: table-local timing, gaps, first start, untimed exclusions, correction/clear preservation, resets, reshuffle persistence and independent championship timing.',
  );
} finally {
  globalThis.Date = RealDate;
}
