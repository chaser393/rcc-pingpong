import { env } from 'cloudflare:workers';
export const db = () => env.DB;
export const runtime = () =>
  env as unknown as { SETUP_KEY?: string; PUBLIC_ORIGIN?: string };
export async function digest(value: string) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
  ]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
export async function hashPassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  return [
    ...new Uint8Array(
      await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          hash: 'SHA-256',
          salt: new TextEncoder().encode(salt),
          iterations: 100000,
        },
        key,
        256,
      ),
    ),
  ]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
export async function manager(req: Request) {
  const token = req.headers
    .get('cookie')
    ?.match(/(?:^|;\s*)pong_session=([^;]+)/)?.[1];
  if (!token) return null;
  return await db()
    .prepare(
      'SELECT sessions.username FROM sessions JOIN managers ON managers.username = sessions.username WHERE token = ? AND expires > ?',
    )
    .bind(await digest(token), Date.now())
    .first<{ username: string }>();
}
export function requestOrigin(req: Request) {
  return runtime().PUBLIC_ORIGIN
    ? new URL(runtime().PUBLIC_ORIGIN!).origin
    : new URL(req.url).origin;
}
export function originCheck(req: Request) {
  if (req.headers.get('origin') !== requestOrigin(req))
    throw Error('Reload the page before saving.');
}
export function json(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', ...headers },
  });
}
