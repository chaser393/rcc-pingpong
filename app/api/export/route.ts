import { db } from '@/lib/server';
import { empty, type State } from '@/lib/pong';
import { exportWorkbook } from '@/lib/spreadsheet-export';
export async function GET() {
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
