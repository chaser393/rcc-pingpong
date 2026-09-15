import { db, manager, json, originCheck } from '@/lib/server';
import { apply, empty, State } from '@/lib/pong';
export async function GET(req: Request) {
  const who = await manager(req);
  const row = await db()
    .prepare('SELECT data,version FROM club WHERE id = 1')
    .first<{ data: string; version: number }>();
  const state: State = row ? JSON.parse(row.data) : empty();
  if (!who) state.players = state.players.map((p) => ({ ...p, notes: '' }));
  const count = await db()
    .prepare('SELECT COUNT(*) AS n FROM managers')
    .first<{ n: number }>();
  return json({
    state,
    version: row?.version ?? 0,
    manager: who?.username ?? null,
    needsSetup: !count?.n,
  });
}
export async function POST(req: Request) {
  try {
    originCheck(req);
    const who = await manager(req);
    if (!who)
      return json({ error: 'Sign in as a manager to make changes.' }, 401);
    const body = (await req.json()) as any;
    if (JSON.stringify(body).length > 100000)
      return json({ error: 'Request too large.' }, 413);
    await db()
      .prepare('INSERT OR IGNORE INTO club (id,version,data) VALUES (1,0,?)')
      .bind(JSON.stringify(empty()))
      .run();
    const row = await db()
      .prepare('SELECT data,version FROM club WHERE id = 1')
      .first<{ data: string; version: number }>();
    if (body.version !== row!.version)
      return json(
        {
          error:
            'Someone else saved a change. The latest data has been loaded; please try again.',
        },
        409,
      );
    const state = apply(
      JSON.parse(row!.data),
      body.action,
      body.value ?? {},
      who.username,
    );
    const result = await db()
      .prepare(
        'UPDATE club SET data = ?, version = version + 1 WHERE id = 1 AND version = ?',
      )
      .bind(JSON.stringify(state), row!.version)
      .run();
    if (!result.meta.changes)
      return json(
        { error: 'Another manager saved first. Refresh and try again.' },
        409,
      );
    return json({ ok: true });
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : 'Could not save.' },
      400,
    );
  }
}
