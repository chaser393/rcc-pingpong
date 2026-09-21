import { isSuperAdmin } from '@/lib/permissions';
import { db, manager } from '@/lib/server';
import { empty, type State } from '@/lib/pong';
import { exportWorkbook } from '@/lib/spreadsheet-export';
export async function GET(req: Request) {
  const who = await manager(req);
  if (!isSuperAdmin(who?.username))
    return new Response(
      JSON.stringify({
        error: 'Only the super admin can download spreadsheets.',
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      },
    );
  const row = await db()
    .prepare('SELECT data FROM club WHERE id = 1')
    .first<{ data: string }>();
  const state: State = row ? JSON.parse(row.data) : empty();
  const bytes = exportWorkbook(state);
  return new Response(new Blob([new Uint8Array(bytes)]), {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="rcc-pingpong-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
