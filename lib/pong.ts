export type Player = {
  id: string;
  name: string;
  info: string;
  notes: string;
  hidden?: boolean;
  deleted?: boolean;
  resetMatchIds?: string[];
  statsResetAt?: string;
};
export type NightChange = {
  id: string;
  at: string;
  actor: string;
  summary: string;
  details: string[];
};
export type Match = {
  id: string;
  table: number;
  a: string[];
  b: string[];
  score: number[] | null;
  champ: boolean;
};
export type Member = {
  id: string;
  table: number;
  active: boolean;
  credit: number;
};
export type Night = {
  id: string;
  name: string;
  date: string;
  closed: boolean;
  members: Member[];
  ranks: Record<string, number>;
  matches: Match[];
  bestOf: number;
  changes?: NightChange[];
};
export type State = { players: Player[]; nights: Night[] };
export const empty = (): State => ({ players: [], nights: [] });
export const uid = () => crypto.randomUUID();
export function adjustment(m: Match, n: Night) {
  const a = m.a.reduce((v, id) => v + (n.ranks[id] ?? 500), 0),
    b = m.b.reduce((v, id) => v + (n.ranks[id] ?? 500), 0),
    diff = Math.abs(a - b);
  const tier = diff <= 50 ? 0 : diff <= 100 ? 1 : diff <= 200 ? 2 : 3;
  const upset = m.score ? m.score[0] > m.score[1] === a < b : false;
  return {
    a,
    b,
    diff,
    label: ['Balanced', 'Unbalanced', 'Unlucky', 'Ill-fated'][tier],
    points: (upset ? [20, 20, 25, 30] : [20, 10, 5, 1])[tier],
  };
}
export function stats(s: State) {
  const excluded = new Map(
    s.players.map((p) => [p.id, new Set(p.resetMatchIds ?? [])]),
  );
  const r: Record<
    string,
    {
      wins: number;
      losses: number;
      games: number;
      pr: number;
      championships: number;
    }
  > = {};
  for (const p of s.players)
    r[p.id] = { wins: 0, losses: 0, games: 0, pr: 500, championships: 0 };
  for (const n of s.nights)
    for (const m of n.matches) {
      if (!m.score) continue;
      const delta = adjustment(m, n).points;
      [m.a, m.b].forEach((team, i) =>
        team.forEach((id) => {
          if (!r[id] || excluded.get(id)?.has(m.id)) return;
          const win = m.score![i] > m.score![1 - i];
          r[id].games++;
          r[id][win ? 'wins' : 'losses']++;
          r[id].pr += win ? delta : -delta;
        }),
      );
    }
  for (const n of s.nights) {
    const result = championshipResult(n);
    if (result)
      for (const id of result.winners)
        if (r[id] && !excluded.get(id)?.has(result.matchId))
          r[id].championships++;
  }
  return r;
}
export function standings(n: Night, table: number) {
  return n.members
    .filter((m) => m.table === table)
    .map((p) => {
      let wins = 0,
        losses = 0;
      for (const m of n.matches.filter(
        (m) => !m.champ && m.table === table && m.score,
      )) {
        const side = m.a.includes(p.id) ? 0 : m.b.includes(p.id) ? 1 : -1;
        if (side >= 0) {
          if (m.score![side] > m.score![1 - side]) wins++;
          else losses++;
        }
      }
      return { ...p, wins, losses, games: wins + losses };
    })
    .sort((a, b) => b.wins - a.wins);
}
const pair = (a: string, b: string) => [a, b].sort().join('|');
export function schedule(n: Night, table: number) {
  const ids = n.members
    .filter((p) => p.active && p.table === table)
    .map((p) => p.id);
  if (ids.length < 4) return [];
  const counts: Record<string, number> = {},
    partners = new Set<string>(),
    opponents: Record<string, number> = {};
  for (const id of ids) counts[id] = n.members.find((p) => p.id === id)!.credit;
  const record = (m: Match) => {
    for (const id of [...m.a, ...m.b]) if (id in counts) counts[id]++;
    partners.add(pair(...(m.a as [string, string])));
    partners.add(pair(...(m.b as [string, string])));
    for (const a of m.a)
      for (const b of m.b) {
        const k = pair(a, b);
        opponents[k] = (opponents[k] || 0) + 1;
      }
  };
  for (const m of n.matches.filter(
    (m) => !m.champ && m.table === table && m.score,
  ))
    record(m);
  const candidates: { a: string[]; b: string[] }[] = [];
  // Enumerate for normal club sizes; bounded sampling also supports larger tables.
  if (ids.length <= 18) {
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++)
        for (let k = j + 1; k < ids.length; k++)
          for (let l = k + 1; l < ids.length; l++)
            for (const [x, y, z, w] of [
              [i, j, k, l],
              [i, k, j, l],
              [i, l, j, k],
            ])
              candidates.push({ a: [ids[x], ids[y]], b: [ids[z], ids[w]] });
  } else {
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const rest = ids.filter((x) => x !== ids[i] && x !== ids[j]);
        for (let k = 0; k < Math.min(rest.length - 1, 8); k++)
          candidates.push({ a: [ids[i], ids[j]], b: [rest[k], rest[k + 1]] });
      }
  }
  const result: Match[] = [];
  const total = (ids.length * (ids.length - 1)) / 2;
  let covered = () =>
    ids.reduce(
      (v, a, i) =>
        v + ids.slice(i + 1).filter((b) => partners.has(pair(a, b))).length,
      0,
    );
  for (let round = 0; round < total + ids.length; round++) {
    const missing = covered() < total;
    const values = Object.values(counts);
    if (!missing && Math.max(...values) - Math.min(...values) <= 1) break;
    let best: (typeof candidates)[number] | null = null,
      bestCost = Infinity;
    const min = Math.min(...values);
    for (const c of candidates) {
      const group = [...c.a, ...c.b];
      const fresh =
        Number(!partners.has(pair(c.a[0], c.a[1]))) +
        Number(!partners.has(pair(c.b[0], c.b[1])));
      if (missing && fresh === 0) continue;
      const balance = group.reduce(
        (v, id) => v + Math.pow(counts[id] - min + 1, 2),
        0,
      );
      let repeat = 0;
      for (const a of c.a)
        for (const b of c.b) repeat += opponents[pair(a, b)] || 0;
      const cost = balance * 10 - fresh * 35 + repeat + Math.random();
      if (cost < bestCost) {
        best = c;
        bestCost = cost;
      }
    }
    if (!best) break;
    const m: Match = { id: uid(), table, ...best, score: null, champ: false };
    result.push(m);
    record(m);
  }
  return result;
}
export function reshuffle(n: Night) {
  n.matches = n.matches.filter((m) => m.score || m.champ);
  for (const table of [...new Set(n.members.map((p) => p.table))])
    n.matches.push(...schedule(n, table));
}
const normalizedName = (name: string) =>
  name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
export function sortedRoster(s: State, sort = 'pr', showHidden = false) {
  const totals = stats(s);
  return s.players
    .filter((p) => !p.deleted && (showHidden || !p.hidden))
    .sort((a, b) => {
      const alphabetical =
        a.name
          .trim()
          .split(/\s+/)[0]
          .localeCompare(b.name.trim().split(/\s+/)[0], undefined, {
            sensitivity: 'base',
          }) ||
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      if (sort === 'name') return alphabetical;
      const key = (
        ['wins', 'losses', 'games', 'pr'].includes(sort) ? sort : 'pr'
      ) as 'wins' | 'losses' | 'games' | 'pr';
      return totals[b.id][key] - totals[a.id][key] || alphabetical;
    });
}
export function defaultNightName(date = new Date()) {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
export function assignTables(ids: string[], tables: number, random = false) {
  const selected = [...ids];
  if (random)
    for (let i = selected.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [selected[i], selected[j]] = [selected[j], selected[i]];
    }
  return Object.fromEntries(
    selected.map((id, i) => [id, String((i % tables) + 1)]),
  );
}
function applyChange(s: State, action: string, v: any): State {
  const findNight = () => {
    const n = s.nights.find((n) => n.id === v.nightId);
    if (!n) throw Error('Night not found.');
    return n;
  };
  const openNight = () => {
    const n = findNight();
    if (n.closed) throw Error('This night is finished.');
    return n;
  };
  const existing = (id: string) => {
    if (!s.players.some((p) => p.id === id && !p.deleted))
      throw Error('Player not found.');
  };
  if (action === 'player') {
    const name = String(v.name || '').trim();
    if (!name || name.length > 80)
      throw Error('Enter a player name (up to 80 characters).');
    const duplicate = s.players.find(
      (p) =>
        !p.deleted &&
        p.id !== v.id &&
        normalizedName(p.name) === normalizedName(name),
    );
    if (duplicate)
      throw Error(
        `Player already exists: ${duplicate.name}.${duplicate.hidden ? ' Show hidden players to unhide them.' : ''}`,
      );
    const data = {
      name,
      info: String(v.info || '').slice(0, 300),
      notes: String(v.notes || '').slice(0, 1000),
    };
    if (v.id) {
      existing(v.id);
      Object.assign(
        s.players.find((p) => p.id === v.id)!,
        data,
      );
    } else s.players.push({ id: uid(), ...data });
  } else if (action === 'hidePlayer') {
    existing(v.id);
    if (typeof v.hidden !== 'boolean') throw Error('Choose hide or unhide.');
    s.players.find((p) => p.id === v.id)!.hidden = v.hidden;
  } else if (action === 'resetPlayerStats') {
    existing(v.id);
    const player = s.players.find((p) => p.id === v.id)!;
    player.resetMatchIds = [
      ...new Set([
        ...(player.resetMatchIds ?? []),
        ...s.nights.flatMap((n) =>
          n.matches
            .filter((m) => m.score && [...m.a, ...m.b].includes(v.id))
            .map((m) => m.id),
        ),
      ]),
    ];
    player.statsResetAt = new Date().toISOString();
  } else if (action === 'deleteNight') {
    const n = findNight();
    if (!n.closed) throw Error('Finish the night before deleting it.');
    s.nights = s.nights.filter((x) => x.id !== n.id);
  } else if (action === 'addMatch') {
    const n = openNight();
    if (
      ![1, 2].includes(v.table) ||
      !Array.isArray(v.ids) ||
      v.ids.length !== 4 ||
      new Set(v.ids).size !== 4
    )
      throw Error('Choose four different players and a table.');
    for (const id of v.ids)
      if (
        !n.members.some((p) => p.id === id && p.active && p.table === v.table)
      )
        throw Error('Choose active players from this table.');
    n.matches.push({
      id: uid(),
      table: v.table,
      a: v.ids.slice(0, 2),
      b: v.ids.slice(2),
      champ: false,
      score: null,
    });
  } else if (action === 'deletePlayer') {
    existing(v.id);
    if (
      s.nights.some(
        (n) => !n.closed && n.members.some((m) => m.id === v.id && m.active),
      )
    )
      throw Error(
        'Remove this player from the current night using Attendance before deleting them.',
      );
    // Keep an identity record for historical matches and PR calculations.
    Object.assign(
      s.players.find((p) => p.id === v.id)!,
      { deleted: true, hidden: true, notes: '' },
    );
  } else if (action === 'renameNight') {
    const name = String(v.name ?? '').trim();
    if (!name || name.length > 80)
      throw Error('Enter a night name (up to 80 characters).');
    findNight().name = name;
  } else if (action === 'night') {
    if (s.nights.some((n) => !n.closed))
      throw Error('Finish the current night first.');
    if (!Array.isArray(v.members) || v.members.length < 4)
      throw Error('Choose at least four players.');
    const seen = new Set();
    for (const p of v.members) {
      existing(p.id);
      if (seen.has(p.id) || ![1, 2].includes(p.table))
        throw Error('Check player assignments.');
      seen.add(p.id);
    }
    for (const t of [1, 2]) {
      const count = v.members.filter((m: any) => m.table === t).length;
      if (count > 0 && count < 4)
        throw Error('Each active table needs at least four players.');
    }
    const ranks = Object.fromEntries(
      Object.entries(stats(s)).map(([id, x]) => [id, x.pr]),
    );
    const n: Night = {
      id: uid(),
      name: String(v.name || 'Pong night').slice(0, 80),
      date: new Date().toISOString(),
      closed: false,
      members: v.members.map((m: any) => ({
        id: m.id,
        table: m.table,
        active: true,
        credit: 0,
      })),
      ranks,
      matches: [],
      bestOf: 1,
    };
    reshuffle(n);
    s.nights.push(n);
  } else if (action === 'score') {
    const n = findNight(),
      m = n.matches.find((m) => m.id === v.matchId);
    if (!m) throw Error('Match not found.');
    if (
      v.score !== null &&
      (!Array.isArray(v.score) ||
        v.score.length !== 2 ||
        v.score.some((x: any) => !Number.isInteger(x) || x < 0 || x > 999) ||
        v.score[0] === v.score[1])
    )
      throw Error('Use two different whole-number scores from 0 to 999.');
    if (m.champ && v.score) {
      let a = 0,
        b = 0;
      for (const game of n.matches.filter((x) => x.champ)) {
        if (game.id === m.id) break;
        if (!game.score) throw Error('Score championship games in order.');
        if (game.score[0] > game.score[1]) a++;
        else b++;
      }
      if (Math.max(a, b) >= Math.ceil(n.bestOf / 2))
        throw Error('The championship is already decided.');
    }
    const previous = m.score;
    m.score = v.score;
    if (m.champ) {
      let a = 0,
        b = 0,
        over = false;
      for (const game of n.matches.filter((x) => x.champ)) {
        if (game.score) {
          if (over) {
            m.score = previous;
            throw Error(
              'Clear later championship scores before making this change.',
            );
          }
          if (game.score[0] > game.score[1]) a++;
          else b++;
          if (Math.max(a, b) >= Math.ceil(n.bestOf / 2)) over = true;
        } else over = true;
      }
    }
  } else if (action === 'attendance') {
    const n = openNight();
    if (n.matches.some((m) => m.champ))
      throw Error('Attendance is locked once the championship is set.');
    const old = n.members.find((p) => p.id === v.out);
    if (v.out && !old) throw Error('Player not on this night.');
    if (v.in) {
      existing(v.in);
      if (n.members.some((p) => p.id === v.in && p.active))
        throw Error('Player is already playing.');
      if (![1, 2].includes(v.table)) throw Error('Choose a table.');
      let credit = 0;
      if (old && v.replace) {
        credit =
          old.credit +
          n.matches.filter(
            (m) => !m.champ && m.score && [...m.a, ...m.b].includes(old.id),
          ).length;
      }
      let member = n.members.find((p) => p.id === v.in);
      if (member) {
        member.active = true;
        member.table = v.table;
        member.credit = credit;
      } else n.members.push({ id: v.in, table: v.table, active: true, credit });
      if (n.ranks[v.in] === undefined) n.ranks[v.in] = stats(s)[v.in].pr;
    }
    if (old) old.active = false;
    reshuffle(n);
  } else if (action === 'move') {
    const n = openNight();
    if (n.matches.some((m) => m.champ))
      throw Error('Championship is already set.');
    const p = n.members.find((p) => p.id === v.playerId);
    if (!p || ![1, 2].includes(v.table))
      throw Error('Choose a player and table.');
    p.table = v.table;
    reshuffle(n);
  } else if (action === 'reshuffle') {
    const n = openNight();
    if (n.matches.some((m) => m.champ))
      throw Error('Championship is already set.');
    reshuffle(n);
  } else if (action === 'championship') {
    const n = openNight();
    if (n.matches.some((m) => m.champ && m.score))
      throw Error('Clear championship scores before changing finalists.');
    if (
      ![1, 3].includes(v.bestOf) ||
      !Array.isArray(v.ids) ||
      v.ids.length !== 4 ||
      new Set(v.ids).size !== 4
    )
      throw Error('Choose four different finalists.');
    for (const id of v.ids)
      if (!n.members.some((p) => p.id === id))
        throw Error('Finalists must have attended this night.');
    n.bestOf = v.bestOf;
    n.matches = n.matches.filter((m) => !m.champ && m.score);
    for (let i = 0; i < v.bestOf; i++)
      n.matches.push({
        id: uid(),
        table: 0,
        a: v.ids.slice(0, 2),
        b: v.ids.slice(2),
        score: null,
        champ: true,
      });
  } else if (action === 'finish') {
    openNight().closed = true;
  } else throw Error('Unknown action.');
  return s;
}

// Append audit entries in the same version-checked save as the requested change.
export function apply(
  s: State,
  action: string,
  value: any,
  actor = 'Manager',
): State {
  const beforeNames = Object.fromEntries(s.players.map((p) => [p.id, p.name]));
  const snapshots = new Map(
    s.nights.map((n) => [n.id, structuredClone({ ...n, changes: undefined })]),
  );
  applyChange(s, action, value);
  const name = (id: string) =>
    s.players.find((p) => p.id === id)?.name ??
    beforeNames[id] ??
    'Unknown player';
  const matchup = (m: Match) =>
    `${m.champ ? 'Championship' : `Table ${m.table}`}: ${m.a.map(name).join(' + ')} vs ${m.b.map(name).join(' + ')}`;
  const score = (m: Match) => (m.score ? m.score.join('–') : 'unscored');
  const titles: Record<string, string> = {
    addMatch: 'Extra match added',
    resetPlayerStats: 'Player stats reset',
    night: 'Night started',
    renameNight: 'Night renamed',
    score: 'Score updated',
    attendance: 'Attendance changed',
    move: 'Player moved tables',
    reshuffle: 'Remaining games reshuffled',
    championship: 'Championship set',
    finish: 'Night finished',
  };
  for (const n of s.nights) {
    const previous = snapshots.get(n.id);
    const details: string[] = [];
    if (!previous) {
      details.push(
        `Night: ${n.name}`,
        `Players: ${n.members.map((m) => `${name(m.id)} (Table ${m.table})`).join(', ')}`,
      );
    } else {
      if (previous.name !== n.name)
        details.push(`Name: ${previous.name} → ${n.name}`);
      for (const m of n.members) {
        const old = previous.members.find((x) => x.id === m.id);
        if (!old) details.push(`${name(m.id)} joined Table ${m.table}.`);
        else {
          if (old.active !== m.active)
            details.push(
              `${name(m.id)} ${m.active ? 'rejoined' : 'left'} Table ${m.table}.`,
            );
          if (old.table !== m.table)
            details.push(
              `${name(m.id)}: Table ${old.table} → Table ${m.table}.`,
            );
        }
        if ((!old || old.credit !== m.credit) && m.credit)
          details.push(
            `${name(m.id)} received ${m.credit} scheduling games of replacement credit; personal stats stay separate.`,
          );
      }
      if (previous.bestOf !== n.bestOf)
        details.push(
          `Championship format: ${previous.bestOf === 1 ? 'one game' : 'best of three'} → ${n.bestOf === 1 ? 'one game' : 'best of three'}.`,
        );
      if (previous.closed !== n.closed)
        details.push(n.closed ? 'Night marked complete.' : 'Night reopened.');
      for (const old of previous.matches) {
        const match = n.matches.find((x) => x.id === old.id);
        if (!match) details.push(`Removed unplayed game — ${matchup(old)}.`);
        else if (JSON.stringify(old.score) !== JSON.stringify(match.score))
          details.push(`${matchup(match)}: ${score(old)} → ${score(match)}.`);
      }
    }
    for (const m of n.matches)
      if (!previous?.matches.some((x) => x.id === m.id))
        details.push(`Scheduled — ${matchup(m)}.`);
    if (
      action === 'player' &&
      value.id &&
      n.members.some((m) => m.id === value.id) &&
      beforeNames[value.id] !== name(value.id)
    )
      details.push(
        `Player renamed: ${beforeNames[value.id]} → ${name(value.id)}.`,
      );
    if (
      action === 'resetPlayerStats' &&
      n.members.some((m) => m.id === value.id)
    )
      details.push(
        `${name(value.id)}: career wins, losses, games and championships reset to 0; PR reset to 500. Existing results and this night's frozen ranks are retained. Only results not already scored at the reset count toward new career totals.`,
      );
    if (action === 'deletePlayer' && n.members.some((m) => m.id === value.id))
      details.push(
        `${name(value.id)} deleted from the roster. This night's results remain intact.`,
      );
    if (details.length) {
      (n.changes ??= []).push({
        id: uid(),
        at: new Date().toISOString(),
        actor,
        summary:
          titles[action] ??
          (action === 'deletePlayer'
            ? 'Player deleted from roster'
            : 'Player renamed'),
        details,
      });
    }
  }
  return s;
}

export function suggestExtraMatch(n: Night, table: number) {
  const counts = Object.fromEntries(
    n.members
      .filter((p) => p.active && p.table === table)
      .map((p) => [p.id, p.credit]),
  );
  for (const m of n.matches.filter((m) => !m.champ && m.table === table))
    for (const id of [...m.a, ...m.b]) if (id in counts) counts[id]++;
  return Object.keys(counts)
    .map((id) => ({ id, tie: Math.random() }))
    .sort((a, b) => counts[a.id] - counts[b.id] || a.tie - b.tie)
    .slice(0, 4)
    .map((p) => p.id);
}
export function nightDeletionImpact(s: State, nightId: string) {
  const before = stats(s),
    after = stats({ ...s, nights: s.nights.filter((n) => n.id !== nightId) });
  return s.players
    .filter((p) => JSON.stringify(before[p.id]) !== JSON.stringify(after[p.id]))
    .map((p) => ({
      id: p.id,
      name: p.name,
      before: before[p.id],
      after: after[p.id],
    }));
}
export function championshipComplete(n: Night) {
  return championshipResult(n) !== null;
}
export function championshipResult(n: Night) {
  const wins = [0, 0];
  for (const match of n.matches.filter((m) => m.champ)) {
    if (!match.score) return null;
    const side = match.score[0] > match.score[1] ? 0 : 1;
    if (++wins[side] >= Math.ceil(n.bestOf / 2))
      return { winners: side === 0 ? match.a : match.b, matchId: match.id };
  }
  return null;
}
export function latestAttendance(s: State, playerId: string) {
  return (
    s.nights
      .filter((n) => n.members.some((p) => p.id === playerId))
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0] ?? null
  );
}
export function assignTablesByPR(
  ids: string[],
  tables: number,
  ranks: Record<string, number>,
) {
  const ordered = [...ids].sort(
    (a, b) => (ranks[b] ?? 500) - (ranks[a] ?? 500),
  );
  const highCount = Math.ceil(ordered.length / 2);
  return Object.fromEntries(
    ordered.map((id, i) => [id, tables === 1 || i < highCount ? '1' : '2']),
  );
}
