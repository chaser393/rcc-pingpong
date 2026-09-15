import { readFileSync } from 'node:fs';
import { getDatabase } from './runtime.mjs';
const filename = process.argv[2];
if (!filename)
  throw Error(
    'Usage: node --env-file-if-exists=.env import-state.mjs backup.json',
  );
const backup = JSON.parse(readFileSync(filename, 'utf8'));
const state = backup.state ?? backup;
if (!state || !Array.isArray(state.players) || !Array.isArray(state.nights))
  throw Error('Expected a Pong Night state export.');
for (const p of state.players)
  if (typeof p.id !== 'string' || typeof p.name !== 'string')
    throw Error('Invalid player record.');
for (const n of state.nights)
  if (
    typeof n.id !== 'string' ||
    !Array.isArray(n.members) ||
    !Array.isArray(n.matches) ||
    !n.ranks
  )
    throw Error('Invalid night record.');
const db = getDatabase();
db.exec('BEGIN IMMEDIATE');
try {
  const row = db.prepare('SELECT data FROM club WHERE id=1').get();
  if (row) {
    const current = JSON.parse(row.data);
    if (current.players.length || current.nights.length)
      throw Error(
        'Import only works into an empty club. Existing data has not been changed.',
      );
  }
  db.prepare(
    'INSERT INTO club (id,version,data) VALUES (1,1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,version=club.version+1',
  ).run(JSON.stringify(state));
  db.exec('COMMIT');
  console.log(
    `Imported ${state.players.length} players and ${state.nights.length} nights. Manager accounts are configured separately.`,
  );
} catch (e) {
  db.exec('ROLLBACK');
  throw e;
}
