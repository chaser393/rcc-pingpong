import {
  db,
  digest,
  hashPassword,
  manager,
  json,
  originCheck,
  runtime,
  requestOrigin,
} from '@/lib/server';
import { isSuperAdmin } from '@/lib/permissions';
export async function POST(req: Request) {
  try {
    originCheck(req);
    const v = (await req.json()) as any;
    const secure = requestOrigin(req).startsWith('https://') ? '; Secure' : '';
    if (v.action === 'logout') {
      const raw = req.headers
        .get('cookie')
        ?.match(/(?:^|;\s*)pong_session=([^;]+)/)?.[1];
      if (raw)
        await db()
          .prepare('DELETE FROM sessions WHERE token = ?')
          .bind(await digest(raw))
          .run();
      return json({ ok: true }, 200, {
        'Set-Cookie': `pong_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`,
      });
    }
    const username = String(v.username || '')
        .trim()
        .toLowerCase(),
      password = String(v.password || '');
    if (!/^[a-z0-9_.-]{3,40}$/.test(username))
      throw Error('Use a username with 3–40 letters/numbers.');
    if (!password.trim()) throw Error('Password cannot be blank.');
    if (v.action === 'create') {
      const who = await manager(req);
      if (who && !isSuperAdmin(who.username))
        return json(
          { error: 'Only the super admin can create managers.' },
          403,
        );
      if (!who) {
        if (!runtime().SETUP_KEY || v.setupKey !== runtime().SETUP_KEY)
          throw Error(
            'Use your private setup key to create the first manager.',
          );
        const count = await db()
          .prepare('SELECT COUNT(*) AS n FROM managers')
          .first<{ n: number }>();
        if (count?.n)
          throw Error('A manager must sign in to add another manager.');
        if (username !== 'admin')
          throw Error('The first account must use the username admin.');
      }
      const salt = crypto.randomUUID(),
        hash = await hashPassword(password, salt);
      const result = await db()
        .prepare(
          who
            ? 'INSERT OR IGNORE INTO managers (username,salt,hash) VALUES (?,?,?)'
            : 'INSERT OR IGNORE INTO managers (username,salt,hash) SELECT ?,?,? WHERE NOT EXISTS (SELECT 1 FROM managers)',
        )
        .bind(username, salt, hash)
        .run();
      if (!result.meta.changes)
        throw Error('That username exists, or setup is already complete.');
      if (who) return json({ ok: true });
    } else if (v.action === 'login') {
      const key = await digest(username),
        now = Date.now();
      await db()
        .prepare(
          'INSERT INTO attempts (key,count,until) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN until < ? THEN 1 ELSE count + 1 END, until = CASE WHEN until < ? THEN excluded.until ELSE until END',
        )
        .bind(key, now + 900000, now, now)
        .run();
      const limit = await db()
        .prepare('SELECT count FROM attempts WHERE key = ?')
        .bind(key)
        .first<{ count: number }>();
      if ((limit?.count ?? 0) > 15)
        return json(
          { error: 'Too many sign-in attempts. Try again in 15 minutes.' },
          429,
        );
      const user = await db()
        .prepare('SELECT salt,hash FROM managers WHERE username = ?')
        .bind(username)
        .first<{ salt: string; hash: string }>();
      const hash = await hashPassword(password, user?.salt ?? 'unknown-user');
      if (!user || hash !== user.hash)
        throw Error('Username or password is incorrect.');
      await db().prepare('DELETE FROM attempts WHERE key = ?').bind(key).run();
    } else throw Error('Unknown sign-in action.');
    const token = crypto.randomUUID() + crypto.randomUUID();
    await db()
      .prepare('INSERT INTO sessions (token,username,expires) VALUES (?,?,?)')
      .bind(await digest(token), username, Date.now() + 7 * 86400000)
      .run();
    return json({ ok: true }, 200, {
      'Set-Cookie': `pong_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${secure}`,
    });
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : 'Could not sign in.' },
      400,
    );
  }
}
