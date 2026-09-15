import {
  db,
  manager,
  json,
  originCheck,
  hashPassword,
  digest,
} from '@/lib/server';
import { isSuperAdmin } from '@/lib/permissions';

export async function GET(req: Request) {
  const who = await manager(req);
  if (!isSuperAdmin(who?.username))
    return json({ error: 'Super admin access required.' }, 403);
  const rows = await db()
    .prepare('SELECT username FROM managers ORDER BY username')
    .all<{ username: string }>();
  return json({
    managers: rows.results.map((p) => ({
      username: p.username,
      role: isSuperAdmin(p.username) ? 'Super admin' : 'Manager',
    })),
  });
}

export async function POST(req: Request) {
  try {
    originCheck(req);
    const who = await manager(req);
    if (!isSuperAdmin(who?.username))
      return json({ error: 'Super admin access required.' }, 403);
    const v = (await req.json()) as any;
    const username = String(v.username ?? '')
      .trim()
      .toLowerCase();
    if (!/^[a-z0-9_.-]{3,40}$/.test(username))
      throw Error('Choose a valid username.');
    if (
      !(await db()
        .prepare('SELECT username FROM managers WHERE username = ?')
        .bind(username)
        .first())
    )
      throw Error('Manager not found.');
    if (v.action === 'delete') {
      if (username === 'admin')
        throw Error('The super admin account cannot be deleted.');
      await db()
        .prepare('DELETE FROM managers WHERE username = ?')
        .bind(username)
        .run();
    } else if (v.action === 'password') {
      const password = String(v.password ?? '');
      if (!password.trim()) throw Error('Password cannot be blank.');
      const salt = crypto.randomUUID(),
        hash = await hashPassword(password, salt);
      await db()
        .prepare('UPDATE managers SET salt = ?, hash = ? WHERE username = ?')
        .bind(salt, hash, username)
        .run();
    } else throw Error('Unknown manager action.');
    await db()
      .prepare('DELETE FROM sessions WHERE username = ?')
      .bind(username)
      .run();
    await db()
      .prepare('DELETE FROM attempts WHERE key = ?')
      .bind(await digest(username))
      .run();
    return json({ ok: true });
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : 'Could not update manager.' },
      400,
    );
  }
}
