import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
let database;
export function getDatabase() {
  if (database) return database;
  const filename = resolve(process.env.PONG_DATA_DIR || 'data', 'pong.sqlite');
  mkdirSync(dirname(filename), { recursive: true });
  const connection = new DatabaseSync(filename);
  connection.exec(
    'PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;',
  );
  connection.exec(
    'CREATE TABLE IF NOT EXISTS _pong_migrations (name TEXT PRIMARY KEY, sha256 TEXT NOT NULL)',
  );
  for (const name of readdirSync(resolve('drizzle'))
    .filter((x) => x.endsWith('.sql'))
    .sort()) {
    const sql = readFileSync(resolve('drizzle', name), 'utf8');
    const hash = createHash('sha256').update(sql).digest('hex');
    const previous = connection
      .prepare('SELECT sha256 FROM _pong_migrations WHERE name = ?')
      .get(name);
    if (previous) {
      if (previous.sha256 !== hash)
        throw Error('An applied migration was changed: ' + name);
      continue;
    }
    connection.exec('BEGIN IMMEDIATE');
    try {
      connection.exec(sql);
      connection
        .prepare('INSERT INTO _pong_migrations (name,sha256) VALUES (?,?)')
        .run(name, hash);
      connection.exec('COMMIT');
    } catch (error) {
      connection.exec('ROLLBACK');
      throw error;
    }
  }
  database = connection;
  return database;
}
function prepare(sql, values = []) {
  return {
    bind(...args) {
      return prepare(sql, args);
    },
    async first(column) {
      const row =
        getDatabase()
          .prepare(sql)
          .get(...values) ?? null;
      return column ? (row?.[column] ?? null) : row;
    },
    async all() {
      return {
        results: getDatabase()
          .prepare(sql)
          .all(...values),
        success: true,
      };
    },
    async run() {
      const r = getDatabase()
        .prepare(sql)
        .run(...values);
      return {
        success: true,
        meta: {
          changes: Number(r.changes),
          last_row_id: Number(r.lastInsertRowid),
        },
      };
    },
  };
}
export const env = {
  DB: { prepare },
  get SETUP_KEY() {
    return process.env.SETUP_KEY;
  },
  get PUBLIC_ORIGIN() {
    return process.env.PUBLIC_ORIGIN;
  },
};
