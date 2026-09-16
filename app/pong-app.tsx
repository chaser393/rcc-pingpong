'use client';
import { useEffect, useState } from 'react';
import { Choice } from './choice';
import NightSetup from './night-setup';
import TablePanel from './table-panel';
import ManagerPanel from './manager-panel';
import {
  sortedRoster,
  defaultNightName,
  suggestExtraMatch,
  nightDeletionImpact,
  championshipComplete,
  pairFinalistsByPR,
  latestAttendance,
} from '@/lib/pong';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Trophy,
  Users,
  Table2,
  ArrowUpRight,
  Plus,
  Shuffle,
  Check,
  LockKeyhole,
} from 'lucide-react';
import {
  State,
  Night,
  Match,
  Player,
  empty,
  stats,
  standings,
  adjustment,
} from '@/lib/pong';
export default function PongApp() {
  const [data, setData] = useState<{
    state: State;
    version: number;
    manager: string | null;
    needsSetup: boolean;
    superAdmin: boolean;
  }>({
    state: empty(),
    version: 0,
    manager: null,
    needsSetup: false,
    superAdmin: false,
  });
  const [loaded, setLoaded] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState('night'),
    [modal, setModal] = useState(''),
    [form, setForm] = useState<any>({}),
    [historyId, setHistoryId] = useState('');
  const [rosterSort, setRosterSort] = useState('pr'),
    [showHidden, setShowHidden] = useState(false);
  const s = data.state,
    ranking = stats(s),
    current = s.nights.find((n) => !n.closed),
    night =
      tab === 'history' ? s.nights.find((n) => n.id === historyId) : current;
  const roster = sortedRoster(s, rosterSort, showHidden);
  const visiblePlayers = sortedRoster(s, 'name');
  const name = (id: string) =>
    s.players.find((p) => p.id === id)?.name ?? 'Unknown player';
  async function refresh() {
    const response = await fetch('/api/state', { cache: 'no-store' });
    if (!response.ok) throw Error('Unable to load the club. Please retry.');
    const next: any = await response.json();
    setData(next);
    setLoaded(true);
    return next;
  }
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
    const timer = setInterval(
      () =>
        refresh().catch(() =>
          setError('Connection interrupted. Reconnecting…'),
        ),
      8000,
    );
    return () => clearInterval(timer);
  }, []);
  async function save(action: string, value: any, version = data.version) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version, action, value }),
      });
      const result: any = await response.json();
      if (!response.ok) {
        if (response.status === 409) {
          await refresh();
          if (modal === 'confirm') setModal('');
        }
        throw Error(result.error);
      }
      await refresh();
      setModal('');
      setMessage('Saved. Everyone sees the latest results.');
      return { ok: true };
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  const run = (action: string, value: any, version = data.version) => {
    void save(action, value, version).catch(() => {});
  };
  function open(type: string, value: any = {}) {
    setError('');
    setForm(type === 'confirm' ? { ...value, version: data.version } : value);
    setModal(type);
  }
  function manage(type: string, value: any = {}) {
    if (!data.manager) open('login');
    else open(type, value);
  }
  async function auth(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          action: modal === 'login' ? 'login' : 'create',
        }),
      });
      const result: any = await response.json();
      if (!response.ok) throw Error(result.error);
      await refresh();
      setModal('');
      setMessage(
        modal === 'login'
          ? 'Signed in. Ready to play.'
          : 'Manager account created.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: 'read_pong_night',
            description: 'Read the current roster, Pong Rank and active night.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute: async (input: any) => {
              if (input && Object.keys(input).length)
                throw Error('No inputs expected.');
              const r = await fetch('/api/state');
              if (!r.ok) throw Error('Could not load the club.');
              const d: any = await r.json();
              setData(d);
              return {
                players: d.state.players,
                night: d.state.nights.find((n: Night) => !n.closed) ?? null,
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, []);
  function setup() {
    manage('night', { name: defaultNightName() });
  }
  function finalists(n: Night) {
    const tables = [...new Set(n.members.map((p) => p.table))].sort();
    let ids =
      tables.length > 1
        ? tables.flatMap((t) =>
            standings(n, t)
              .filter((p) => p.active)
              .slice(0, 2)
              .map((p) => p.id),
          )
        : standings(n, tables[0])
            .filter((p) => p.active)
            .slice(0, 4)
            .map((p) => p.id);
    if (n.matches.some((m) => m.champ)) {
      const m = n.matches.find((m) => m.champ)!;
      ids = [...m.a, ...m.b];
    } else ids = pairFinalistsByPR(ids, n.ranks);
    manage('championship', {
      nightId: n.id,
      ids,
      bestOf: String(n.bestOf),
      scored: n.matches.some((m) => m.champ && m.score),
    });
  }
  function matchCard(m: Match, n: Night, index: number) {
    const pr = adjustment(m, n);
    const finals = n.matches.filter((x) => x.champ);
    const previous = finals.slice(
      0,
      finals.findIndex((x) => x.id === m.id),
    );
    const a = previous.filter((x) => x.score && x.score[0] > x.score[1]).length,
      b = previous.filter((x) => x.score && x.score[1] > x.score[0]).length;
    const decided =
      m.champ && !m.score && Math.max(a, b) >= Math.ceil(n.bestOf / 2);
    return (
      <article className={'match ' + (m.score ? 'scored' : '')} key={m.id}>
        <div className="row">
          <span className="eyebrow">
            {m.champ ? 'FINAL' : 'MATCH'} {index + 1}
          </span>
          <span className="badge">
            {m.score ? 'Final score' : decided ? 'Not needed' : pr.label}
          </span>
        </div>
        <div className="team-row">
          <strong>{m.a.map(name).join(' + ')}</strong>
          <b>{m.score?.[0] ?? '—'}</b>
        </div>
        <div className="team-row">
          <strong>{m.b.map(name).join(' + ')}</strong>
          <b>{m.score?.[1] ?? '—'}</b>
        </div>
        <div className="row match-bottom">
          <small>
            {pr.a} vs {pr.b} PR{m.score ? ` · ±${pr.points} each` : ''}
          </small>
          {data.manager && !decided && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                open('score', {
                  nightId: n.id,
                  matchId: m.id,
                  score: m.score?.map(String) ?? ['', ''],
                  match: m,
                  night: n,
                })
              }
            >
              {m.score ? 'Edit score' : 'Enter score'}
            </button>
          )}
        </div>
      </article>
    );
  }
  function board(n: Night) {
    const tables = [...new Set(n.members.map((p) => p.table))].sort(),
      finals = n.matches.filter((m) => m.champ),
      finalWins = [
        finals.filter((m) => m.score && m.score[0] > m.score[1]).length,
        finals.filter((m) => m.score && m.score[1] > m.score[0]).length,
      ];
    const winner = finalWins.findIndex((w) => w >= Math.ceil(n.bestOf / 2));
    const championship = finals.length > 0 && (
      <section className="champ-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THE FINAL TABLE</p>
            <h2>
              <Trophy /> Championship
            </h2>
            <p>
              {n.bestOf === 1 ? 'One game takes it.' : 'Best two out of three.'}
            </p>
          </div>
          {data.manager && !n.closed && n.bestOf === 1 && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                open('confirm', {
                  action: 'championshipFormat',
                  value: { nightId: n.id, bestOf: 3 },
                  title: 'Play best two out of three?',
                  text: 'Keep the teams and first game score, and add two games. The championship will require two wins.',
                })
              }
            >
              Make best of 3
            </button>
          )}
          <strong className="series-score">
            {finalWins[0]} : {finalWins[1]}
          </strong>
        </div>
        {winner >= 0 && (
          <p className="winner">
            <Trophy size={20} /> Champions:{' '}
            {(winner === 0 ? finals[0].a : finals[0].b).map(name).join(' + ')}
          </p>
        )}
        <div className="final-grid">
          {finals.map((m, i) => matchCard(m, n, i))}
        </div>
      </section>
    );
    return (
      <>
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              {n.closed ? 'NIGHT COMPLETE' : 'ON THE TABLES'}
            </p>
            <h2>{n.name}</h2>
            {data.manager && (
              <button
                className="secondary"
                onClick={() =>
                  open('renameNight', { nightId: n.id, name: n.name })
                }
              >
                Edit night name
              </button>
            )}
            <p className="muted">
              {new Date(n.date).toLocaleDateString()} ·{' '}
              {n.members.filter((p) => p.active).length} players ·{' '}
              {n.matches.filter((m) => m.score).length} games played
            </p>
          </div>
          {data.superAdmin && n.closed && (
            <button
              className="secondary danger"
              onClick={() =>
                open('confirm', {
                  action: 'deleteNight',
                  value: { nightId: n.id },
                  title: `Delete ${n.name}?`,
                  text: 'Permanently delete this night, its matches and its change history. Its results are removed from career wins, losses, games and PR. Previously reset results stay excluded. Starting ranks already frozen for other nights stay unchanged.',
                  impact: nightDeletionImpact(s, n.id),
                })
              }
            >
              Delete past night
            </button>
          )}
          {data.manager && !n.closed && (
            <div className="actions">
              <button
                className="secondary"
                onClick={() =>
                  manage('attendance', {
                    nightId: n.id,
                    out: 'none',
                    in: 'none',
                    table: '1',
                    replace: false,
                  })
                }
              >
                Attendance
              </button>
              <button
                className="secondary"
                onClick={() =>
                  open('confirm', {
                    action: 'reshuffle',
                    value: { nightId: n.id },
                    title: 'Reshuffle remaining games?',
                    text: 'Completed scores stay in place. Unplayed matches will be replaced with a new rotation.',
                  })
                }
                disabled={finals.length > 0}
              >
                <Shuffle size={16} /> Reshuffle
              </button>
              <button onClick={() => finalists(n)}>
                <Trophy size={16} /> Championship
              </button>
              <button
                className="secondary"
                onClick={() =>
                  open('confirm', {
                    action: 'finish',
                    value: { nightId: n.id },
                    title: 'Finish this night?',
                    text: 'Unplayed games will not count. You can still correct saved scores from Past nights.',
                  })
                }
              >
                Finish night
              </button>
            </div>
          )}
        </div>
        {(n.closed || championshipComplete(n)) && championship}
        <div className="table-grid">
          {tables.map((t) => (
            <TablePanel key={`${n.id}:${t}`} nightId={n.id} table={t}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead>W</TableHead>
                    <TableHead>L</TableHead>
                    <TableHead>GP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standings(n, t).map((p, i) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <span className="position">{i + 1}</span>
                        {name(p.id)}
                        {!p.active && <small className="muted"> · Left</small>}
                      </TableCell>
                      <TableCell>
                        <strong>{p.wins}</strong>
                      </TableCell>
                      <TableCell>{p.losses}</TableCell>
                      <TableCell>{p.games}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data.manager && !n.closed && (
                <div className="table-actions">
                  <button
                    className="secondary"
                    disabled={
                      busy ||
                      n.members.filter((p) => p.active && p.table === t)
                        .length < 4
                    }
                    onClick={() =>
                      open('addMatch', {
                        nightId: n.id,
                        table: t,
                        ids: suggestExtraMatch(n, t),
                      })
                    }
                  >
                    <Plus size={16} /> Add match
                  </button>
                </div>
              )}
              <div className="matches">
                {n.members.filter((p) => p.table === t && p.active).length <
                  4 &&
                  !n.closed && (
                    <p className="notice">
                      Fewer than four active players. Add or move players to
                      continue.
                    </p>
                  )}
                {n.matches
                  .filter((m) => !m.champ && m.table === t)
                  .map((m, i) => matchCard(m, n, i))}
                {!n.matches.some((m) => !m.champ && m.table === t) && (
                  <p className="muted">No games assigned.</p>
                )}
              </div>
            </TablePanel>
          ))}
        </div>
        {!(n.closed || championshipComplete(n)) && championship}
        <details className="rules night-history">
          <summary>Change history · {n.changes?.length ?? 0} updates</summary>
          <p className="muted">
            Changes are recorded from this update onward. Earlier changes were
            not recorded.
          </p>
          {!n.changes?.length && <p>No recorded changes yet.</p>}
          <ol className="change-list">
            {[...(n.changes ?? [])].reverse().map((entry) => (
              <li key={entry.id}>
                <div className="row">
                  <strong>{entry.summary}</strong>
                  <time dateTime={entry.at}>
                    {new Date(entry.at).toLocaleString()}
                  </time>
                </div>
                <p className="muted">By {entry.actor}</p>
                <details>
                  <summary>View details ({entry.details.length})</summary>
                  <ul>
                    {entry.details.map((detail, i) => (
                      <li key={i}>{detail}</li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ol>
        </details>
      </>
    );
  }
  const patch = (key: string, value: any) =>
    setForm((f: any) => ({ ...f, [key]: value }));
  return (
    <main className="shell">
      <header>
        <a className="brand" href="/">
          PONG<span>NIGHT</span>
          <i>●</i>
        </a>
        <div className="actions">
          {data.manager ? (
            <>
              <span className="manager-name">{data.manager}</span>
              {data.superAdmin && (
                <button className="secondary" onClick={() => open('managers')}>
                  Manage managers
                </button>
              )}
              <button
                className="secondary"
                onClick={async () => {
                  await fetch('/api/auth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'logout' }),
                  });
                  await refresh();
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              className="secondary"
              onClick={() =>
                open(
                  data.needsSetup ? 'setup' : 'login',
                  data.needsSetup ? { username: 'admin' } : {},
                )
              }
            >
              <LockKeyhole size={16} />
              {data.needsSetup ? 'Set up manager' : 'Manager sign in'}
            </button>
          )}
        </div>
      </header>
      <div className="title-row">
        <div>
          <p className="eyebrow">RCC PINGPONG NIGHT</p>
          <h1>
            {current ? 'Game on.' : 'Good games.'}
            <br />
            <span>{current ? 'Every point counts.' : 'Great company.'}</span>
          </h1>
        </div>
        <div className="rank-pill">
          <Trophy />
          <strong>
            {s.players.filter((p) => !p.deleted && !p.hidden).length}
          </strong>
          <span>Players in the club</span>
        </div>
      </div>
      {error && !modal && (
        <div role="alert" className="notice error">
          {error}{' '}
          <button
            className="secondary"
            onClick={() =>
              refresh()
                .then(() => setError(''))
                .catch((e) => setError(e.message))
            }
          >
            Retry
          </button>
        </div>
      )}
      {message && (
        <p className="success" role="status">
          <Check size={16} />
          {message}
        </p>
      )}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="nav">
          <TabsTrigger value="night">
            <Table2 size={18} /> Tonight
          </TabsTrigger>
          <TabsTrigger value="roster">
            <Users size={18} /> Players
          </TabsTrigger>
          <TabsTrigger value="history">
            <Trophy size={18} /> Past nights
          </TabsTrigger>
        </TabsList>
        <TabsContent value="night">
          {current ? (
            board(current)
          ) : (
            <section className="empty-panel">
              <span className="eyebrow">READY WHEN YOU ARE</span>
              <h2>Your next pong night starts here.</h2>
              <p>
                Add your players, pick one or two tables, and let the rotation
                take care of the matchups.
              </p>
              <button disabled={!loaded} onClick={setup}>
                Set up a night <ArrowUpRight size={18} />
              </button>
              <div className="steps">
                <span>01 &nbsp; Pick your players</span>
                <span>02 &nbsp; Set your tables</span>
                <span>03 &nbsp; Play & score</span>
              </div>
            </section>
          )}
        </TabsContent>
        <TabsContent value="roster">
          <div className="section-heading">
            <div>
              <p className="eyebrow">THE REGULARS & THE ROOKIES</p>
              <h2>
                Your club roster{' '}
                <span className="count">
                  {s.players.filter((p) => !p.deleted && !p.hidden).length}
                </span>
              </h2>
            </div>
            <button
              onClick={() =>
                manage('player', { name: '', info: '', notes: '' })
              }
            >
              <Plus size={18} /> Add player
            </button>
          </div>
          <div className="roster-toolbar">
            <Choice
              label="Sort players"
              value={rosterSort}
              onChange={setRosterSort}
              options={[
                { value: 'name', label: 'First name · A–Z' },
                { value: 'wins', label: 'Wins · highest first' },
                { value: 'losses', label: 'Losses · highest first' },
                { value: 'games', label: 'Games · highest first' },
                { value: 'pr', label: 'PR · highest first' },
              ]}
            />
            <label className="check-row">
              <Checkbox checked={showHidden} onCheckedChange={setShowHidden} />{' '}
              Show hidden players
            </label>
          </div>
          {roster.length === 0 ? (
            <section className="empty-panel">
              <h2>No players to show.</h2>
              <p>Add a player or turn on Show hidden players.</p>
            </section>
          ) : (
            <div className="roster-grid">
              {roster.map((p) => (
                <article className="player-card" key={p.id}>
                  <div className="row">
                    <div className="avatar">
                      {p.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="pr">
                      {ranking[p.id].pr}
                      <small>PR</small>
                    </span>
                  </div>
                  <h3>
                    {p.name} {p.hidden && <span className="badge">Hidden</span>}
                  </h3>
                  {p.info && <p className="muted">{p.info}</p>}
                  <div className="player-stats">
                    <span>
                      <b>{ranking[p.id].wins}</b> Wins
                    </span>
                    <span>
                      <b>{ranking[p.id].losses}</b> Losses
                    </span>
                    <span>
                      <b>{ranking[p.id].games}</b> Games
                    </span>
                    <span>
                      <b>{ranking[p.id].championships}</b> Titles
                    </span>
                  </div>
                  {(() => {
                    const last = latestAttendance(s, p.id);
                    return (
                      <p className="last-played">
                        Last attended:{' '}
                        {last ? (
                          <>
                            <a
                              href={last.closed ? '#past-nights' : '#tonight'}
                              onClick={(e) => {
                                e.preventDefault();
                                setHistoryId(last.id);
                                setTab(last.closed ? 'history' : 'night');
                              }}
                            >
                              {last.name}
                            </a>
                            <span>
                              {new Date(last.date).toLocaleDateString()}
                            </span>
                          </>
                        ) : (
                          <span>No nights yet</span>
                        )}
                      </p>
                    );
                  })()}
                  {data.manager && (
                    <>
                      <p className="private-note">
                        {p.notes && `Manager note: ${p.notes}`}
                      </p>
                      <button
                        className="secondary"
                        onClick={() => open('player', p)}
                      >
                        Edit player
                      </button>
                      {p.statsResetAt && (
                        <p className="muted">
                          Career stats reset{' '}
                          {new Date(p.statsResetAt).toLocaleDateString()}
                        </p>
                      )}
                      <div className="actions player-actions">
                        {data.superAdmin && (
                          <button
                            className="secondary"
                            disabled={busy}
                            onClick={() =>
                              open('confirm', {
                                action: 'resetPlayerStats',
                                value: { id: p.id },
                                title: `Reset ${p.name}’s stats?`,
                                text: `Wins ${ranking[p.id].wins} → 0; losses ${ranking[p.id].losses} → 0; games ${ranking[p.id].games} → 0; championships ${ranking[p.id].championships} → 0; PR ${ranking[p.id].pr} → 500. Past matches, nightly standings and other players stay unchanged. Only results not already scored at this reset count toward new career totals. An active night keeps its frozen starting rank.`,
                              })
                            }
                          >
                            Reset stats
                          </button>
                        )}
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() =>
                            run('hidePlayer', { id: p.id, hidden: !p.hidden })
                          }
                        >
                          {p.hidden ? 'Unhide player' : 'Hide player'}
                        </button>
                        <button
                          className="secondary danger"
                          disabled={busy}
                          onClick={() =>
                            open('confirm', {
                              action: 'deletePlayer',
                              value: { id: p.id },
                              title: `Delete ${p.name}?`,
                              text: 'This removes the player from the roster. Past nights and match results stay intact. To temporarily remove someone from the list, use Hide instead.',
                            })
                          }
                        >
                          Delete player
                        </button>
                      </div>
                    </>
                  )}
                </article>
              ))}
            </div>
          )}
          <details className="rules">
            <summary>How Pong Rank works</summary>
            <p>
              Starting rank: 500. Team totals use ranks frozen at the start of
              each night. Every result, including the championship, counts. Each
              teammate receives the full change.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team difference</TableHead>
                  <TableHead>Favorite wins</TableHead>
                  <TableHead>Underdog wins</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ['0–50 · Balanced', '20', '20'],
                  ['51–100 · Unbalanced', '10', '20'],
                  ['101–200 · Unlucky', '5', '25'],
                  ['201+ · Ill-fated', '1', '30'],
                ].map((row) => (
                  <TableRow key={row[0]}>
                    {row.map((x, i) => (
                      <TableCell key={i}>{i ? `±${x}` : x}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p>
              Winners gain points; losers lose the same amount. Editing scores
              recalculates career totals. Past night corrections do not change
              ranks already frozen for later nights.
            </p>
          </details>
        </TabsContent>
        <TabsContent value="history">
          <div className="section-heading">
            <h2>Past nights</h2>
          </div>
          <div className="actions">
            {s.nights
              .filter((n) => n.closed)
              .slice()
              .reverse()
              .map((n) => (
                <button
                  className="secondary"
                  key={n.id}
                  onClick={() => setHistoryId(n.id)}
                >
                  {n.name} · {new Date(n.date).toLocaleDateString()}
                </button>
              ))}
          </div>
          {night ? (
            board(night)
          ) : (
            <section className="empty-panel">
              <h2>A record of every night.</h2>
              <p>
                {s.nights.some((n) => n.closed)
                  ? 'Choose a night to see its games and results.'
                  : 'Completed nights and their results will appear here.'}
              </p>
            </section>
          )}
        </TabsContent>
      </Tabs>
      <footer>
        ROTATING DOUBLES <span>Play to 21. Win by 2. Make it a night.</span>
      </footer>
      <Dialog
        open={!!modal && modal !== 'confirm'}
        onOpenChange={(v) => {
          if (!v && !busy) setModal('');
        }}
      >
        <DialogContent className="pong-dialog">
          <DialogHeader>
            <DialogTitle>
              {
                (
                  {
                    login: 'Manager sign in',
                    setup: 'Create your first manager',
                    manager: 'Add a manager',
                    managers: 'Manage managers',
                    player: form.id ? 'Edit player' : 'Add a player',
                    night: 'Set up tonight',
                    score: 'Record the result',
                    addMatch: `Add match · Table ${form.table}`,
                    attendance: 'Update attendance',
                    championship: 'Set the championship',
                    confirm: form.title,
                    renameNight: 'Edit night name',
                  } as any
                )[modal]
              }
            </DialogTitle>
            <DialogDescription>
              {modal === 'login'
                ? 'Managers can change players, nights, and results.'
                : modal === 'score'
                  ? 'Play to 21, win by 2. Any non-tied final score is accepted.'
                  : modal === 'championship'
                    ? 'The top two at each table are suggested. Resolve ties and swap players here. Starting the final ends unplayed table games.'
                    : modal === 'attendance'
                      ? 'Completed results stay with the people who played. Remaining games are rebuilt.'
                      : modal === 'setup'
                        ? 'Use your private setup key and choose a password for the admin account.'
                        : 'Changes are shared with everyone viewing the club.'}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
          {modal === 'managers' && data.superAdmin && (
            <ManagerPanel
              onChanged={async () => {
                const d = await refresh();
                if (!d.superAdmin) setModal('');
              }}
            />
          )}
          {['login', 'setup', 'manager'].includes(modal) && (
            <form onSubmit={auth} className="form">
              <label className="field">
                Username
                <input
                  autoComplete="username"
                  required
                  minLength={3}
                  maxLength={40}
                  value={form.username ?? ''}
                  onChange={(e) => patch('username', e.target.value)}
                />
              </label>
              <label className="field">
                Password
                <input
                  type="password"
                  autoComplete={
                    modal === 'login' ? 'current-password' : 'new-password'
                  }
                  required
                  value={form.password ?? ''}
                  onChange={(e) => patch('password', e.target.value)}
                />
              </label>
              {modal === 'setup' && (
                <label className="field">
                  Private setup key
                  <input
                    type="password"
                    required
                    value={form.setupKey ?? ''}
                    onChange={(e) => patch('setupKey', e.target.value)}
                  />
                </label>
              )}
              <button disabled={busy}>
                {modal === 'login' ? 'Sign in' : 'Create manager'}
              </button>
            </form>
          )}
          {modal === 'player' && (
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                run('player', form);
              }}
            >
              <label className="field">
                Player name
                <input
                  required
                  maxLength={80}
                  value={form.name}
                  onChange={(e) => patch('name', e.target.value)}
                />
              </label>
              <label className="field">
                Public player info
                <textarea
                  maxLength={300}
                  placeholder="Nickname, playing style, favorite paddle…"
                  value={form.info}
                  onChange={(e) => patch('info', e.target.value)}
                />
              </label>
              <label className="field">
                Manager-only notes
                <textarea
                  maxLength={1000}
                  value={form.notes}
                  onChange={(e) => patch('notes', e.target.value)}
                />
              </label>
              <button disabled={busy}>Save player</button>
            </form>
          )}
          {modal === 'night' && (
            <NightSetup
              players={visiblePlayers}
              initialName={form.name}
              ranks={Object.fromEntries(
                Object.entries(ranking).map(([id, stats]) => [id, stats.pr]),
              )}
              busy={busy}
              onStart={(value) => run('night', value)}
            />
          )}
          {modal === 'renameNight' && (
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                run('renameNight', form);
              }}
            >
              <label className="field">
                Night name
                <input
                  required
                  maxLength={80}
                  value={form.name}
                  onChange={(e) => patch('name', e.target.value)}
                />
              </label>
              <button disabled={busy}>Save night name</button>
            </form>
          )}
          {modal === 'addMatch' && (
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                run('addMatch', {
                  nightId: form.nightId,
                  table: form.table,
                  ids: form.ids,
                });
              }}
            >
              <p>
                Choose two teams for the extra game. Suggested players have the
                fewest games played or scheduled at this table.
              </p>
              {[0, 1, 2, 3].map((i) => (
                <Choice
                  key={i}
                  label={`Team ${i < 2 ? 'A' : 'B'} · Player ${(i % 2) + 1}`}
                  value={form.ids[i] ?? ''}
                  onChange={(value) =>
                    patch(
                      'ids',
                      form.ids.map((id: string, j: number) =>
                        i === j ? value : id,
                      ),
                    )
                  }
                  options={(
                    s.nights.find((n) => n.id === form.nightId)?.members ?? []
                  )
                    .filter((p) => p.active && p.table === form.table)
                    .map((p) => ({ value: p.id, label: name(p.id) }))}
                />
              ))}
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  patch(
                    'ids',
                    suggestExtraMatch(
                      s.nights.find((n) => n.id === form.nightId)!,
                      form.table,
                    ),
                  )
                }
              >
                Randomize suggestion
              </button>
              <button disabled={busy || new Set(form.ids).size !== 4}>
                Add match
              </button>
            </form>
          )}
          {modal === 'score' && (
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                run('score', {
                  nightId: form.nightId,
                  matchId: form.matchId,
                  score: form.score.map(Number),
                });
              }}
            >
              {[form.match.a, form.match.b].map((team: string[], i: number) => (
                <label className="field" key={i}>
                  {team.map(name).join(' + ')}
                  <input
                    type="number"
                    inputMode="numeric"
                    required
                    min={0}
                    max={999}
                    step={1}
                    value={form.score[i]}
                    onChange={(e) =>
                      patch(
                        'score',
                        form.score.map((x: string, j: number) =>
                          i === j ? e.target.value : x,
                        ),
                      )
                    }
                  />
                </label>
              ))}
              <p className="muted">
                {adjustment(form.match, form.night).label} matchup ·{' '}
                {adjustment(form.match, form.night).diff} PR difference
              </p>
              <button disabled={busy}>Save final score</button>
              {form.match.score && (
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    run('score', {
                      nightId: form.nightId,
                      matchId: form.matchId,
                      score: null,
                    })
                  }
                >
                  Clear this result
                </button>
              )}
            </form>
          )}
          {modal === 'attendance' && (
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                run('attendance', {
                  ...form,
                  out: form.out === 'none' ? null : form.out,
                  in: form.in === 'none' ? null : form.in,
                  table: Number(form.table),
                });
              }}
            >
              <Choice
                label="Player leaving (optional)"
                value={form.out}
                onChange={(v) => patch('out', v)}
                options={[
                  { value: 'none', label: 'Nobody leaving' },
                  ...current!.members
                    .filter((m) => m.active)
                    .map((m) => ({ value: m.id, label: name(m.id) })),
                ]}
              />
              <Choice
                label="Player joining (optional)"
                value={form.in}
                onChange={(v) => patch('in', v)}
                options={[
                  { value: 'none', label: 'Nobody joining' },
                  ...visiblePlayers
                    .filter(
                      (p) =>
                        !current!.members.some(
                          (m) => m.active && m.id === p.id,
                        ),
                    )
                    .map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
              <Choice
                label="Joining table"
                value={form.table}
                onChange={(v) => patch('table', v)}
                options={[
                  { value: '1', label: 'Table 1' },
                  { value: '2', label: 'Table 2' },
                ]}
              />
              <label className="check-row">
                <Checkbox
                  checked={form.replace}
                  onCheckedChange={(v) => patch('replace', v)}
                />{' '}
                Replacement inherits scheduling game count
              </label>
              <p className="muted">
                Wins, losses, and PR always remain personal. A replacement’s
                inherited count only helps balance remaining games.
              </p>
              <button
                disabled={busy || (form.out === 'none' && form.in === 'none')}
              >
                Update & rebuild games
              </button>
              <hr />
              <h3>Move between tables</h3>
              {current!.members
                .filter((m) => m.active)
                .map((m) => (
                  <div className="row" key={m.id}>
                    <span>
                      {name(m.id)} · Table {m.table}
                    </span>
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        run('move', {
                          nightId: current!.id,
                          playerId: m.id,
                          table: m.table === 1 ? 2 : 1,
                        })
                      }
                    >
                      Move to {m.table === 1 ? 2 : 1}
                    </button>
                  </div>
                ))}
            </form>
          )}
          {modal === 'championship' && (
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                run(form.scored ? 'championshipFormat' : 'championship', {
                  ...form,
                  bestOf: Number(form.bestOf),
                });
              }}
            >
              {form.scored ? (
                <p>
                  Team A: {form.ids.slice(0, 2).map(name).join(' + ')} · Team B:{' '}
                  {form.ids.slice(2).map(name).join(' + ')}
                </p>
              ) : (
                [0, 1, 2, 3].map((i) => (
                  <Choice
                    key={i}
                    label={`Team ${i < 2 ? 'A' : 'B'} · Player ${(i % 2) + 1}`}
                    value={form.ids[i] ?? ''}
                    onChange={(v) => {
                      const ids = [...form.ids];
                      ids[i] = v;
                      patch('ids', ids);
                    }}
                    options={current!.members.map((m) => ({
                      value: m.id,
                      label: name(m.id),
                    }))}
                  />
                ))
              )}
              <Choice
                label="Format"
                value={form.bestOf}
                onChange={(v) => patch('bestOf', v)}
                options={[
                  { value: '1', label: 'One game' },
                  { value: '3', label: 'Best two out of three' },
                ]}
              />
              <p className="muted">
                Qualification uses individual table wins. Default teams pair the
                highest and lowest night-start PR, with the middle two together.
                Ties and team changes are yours to decide before scoring.
              </p>
              {!form.scored && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    patch('ids', pairFinalistsByPR(form.ids, current!.ranks))
                  }
                >
                  Pair teams by PR
                </button>
              )}
              <button disabled={busy}>
                {form.scored ? 'Update format' : 'Set finalists'}
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={modal === 'confirm'}
        onOpenChange={(v) => {
          if (!v && !busy) setModal('');
        }}
      >
        <AlertDialogContent className="pong-dialog">
          <AlertDialogTitle>{form.title}</AlertDialogTitle>
          <AlertDialogDescription>{form.text}</AlertDialogDescription>
          {form.action === 'deleteNight' && (
            <div className="deletion-impact">
              <h3>Effect on career totals</h3>
              {form.impact?.length ? (
                <ul>
                  {form.impact.map((p: any) => (
                    <li key={p.id}>
                      <strong>{p.name}</strong>
                      <p>
                        Wins {p.before.wins} → {p.after.wins} · Losses{' '}
                        {p.before.losses} → {p.after.losses} · Games{' '}
                        {p.before.games} → {p.after.games}
                      </p>
                      <p>
                        Championships {p.before.championships} →{' '}
                        {p.after.championships} · PR {p.before.pr} →{' '}
                        {p.after.pr}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No current career totals will change.</p>
              )}
            </div>
          )}
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
          <div className="form">
            <button
              disabled={busy}
              className={
                ['deleteNight', 'deletePlayer', 'resetPlayerStats'].includes(
                  form.action,
                )
                  ? 'danger'
                  : ''
              }
              onClick={() => run(form.action, form.value, form.version)}
            >
              {form.action === 'deletePlayer'
                ? 'Delete player'
                : form.action === 'deleteNight'
                  ? 'Delete past night'
                  : form.action === 'resetPlayerStats'
                    ? 'Reset stats & PR'
                    : 'Confirm'}
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setModal('')}
              autoFocus
            >
              Cancel
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
