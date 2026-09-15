# Pong Night

Phone-friendly rotating doubles tracker built with React, Vinext and Cloudflare D1.

## First use

Open the site, select **Set up manager**, and enter the private `SETUP_KEY` from your local `.env.local` file. Choose your own username and any nonblank password. The setup key only permits the first manager account; later accounts require an existing manager to sign in. Never commit or share the setup key. Managers can add other managers using **Add manager**.

Add players, start a night, select attendees and assign tables (or randomize the selected players), then record match results. Attendance changes rebuild unscored games. A replacement can inherit scheduling credit; completed results and qualification wins stay personal. Start the championship to end unplayed table games, select or override the suggested finalists, and choose one game or best of three. Finish the night to archive it. Scores can still be corrected from Past nights.

The app supports anonymous viewing, but the hosting platform's audience setting must also permit public access for visitors to avoid platform sign-in. The initial deployment is private to its owner.

## Rules

- Always 2v2, one or two tables; at least four players per table to start.
- The randomized greedy scheduler covers every teammate pair and balances game counts. It aims for a short schedule, not a mathematically proven minimum. Opponent repetition is penalized.
- A non-tied integer score between 0 and 999 is accepted, including scores outside 21/win-by-two.
- PR starts at 500 with no floor. Team totals use that night's frozen ranks. The first nightly snapshot includes the whole existing roster, so late arrivals use their start-of-night rank. A brand-new player starts at 500.
- Team PR difference 0–50: ±20; 51–100: favorite ±10 / underdog ±20; 101–200: favorite ±5 / underdog ±25; 201+: favorite ±1 / underdog ±30. Each player receives the full change.
- Career stats are derived from saved scores, so edits never double-count. Historical edits do not rewrite subsequent nights' frozen PR snapshots.
- Standings count individual table wins; managers resolve ties and can override finalists. Championship games count toward career results and PR.
- Clients refresh every eight seconds. Server-side optimistic version checks prevent silent overwrites; retry a conflicting edit after refreshed data loads.

## Development and validation

Requires Node 22.13+ and npm. `npm install`, then `npm run dev`.
Generate migrations using `npm run db:generate`. Apply `drizzle/*.sql` to the local DB using Wrangler before testing. For local Worker secrets, mirror `.env.local` into ignored `.dev.vars`.

- `node --experimental-strip-types tests/pong.test.mjs` checks schedule coverage and balance for 4–14 players, PR tier boundaries/upsets, score corrections, replacements and championship clinches.
- `node tests/api.test.mjs` runs against localhost:3000 and creates **local-only** test records and a local manager; it checks persistence, private fields, authentication and write conflicts. Do not point it at production.
- `node node_modules/typescript/bin/tsc --noEmit`
- `npm run build`

The build targets Cloudflare Workers with a D1 binding named `DB`. Source and migrations are retained for self-hosting; configure the binding, migrations and `SETUP_KEY` on your chosen compatible host. This is not a static-only site.

A feature-detected WebMCP read tool exposes the same read-only club data as the interface. No supported WebMCP browser validation context was available; that integration is not verified. Browser UI testing was not requested; validation used builds, type checking, business-logic tests and HTTP integration tests.


## Roster management and night history

Sort the roster by first name (A–Z), wins, losses, games played or PR (highest first). Duplicate player names are rejected ignoring capitalization, repeated spaces and equivalent Unicode character widths, including hidden players. Hidden players can be shown and unhidden; they are omitted from the normal attendance picker. Deletion removes a player from roster selection but retains their identity and results in past nights. Players still active in an open night must first be removed through Attendance.

Night setup first selects attendees, then assigns only those players to one or two tables, manually or with a balanced random split. The name defaults to the local calendar date. Managers can edit names on active nights and under Past nights.

Each night's Change history records new changes with the manager username, timestamp and details, including scores before/after, attendance, replacement credits, table moves, schedule changes, finalist changes and completion. Old events have no invented audit history; logging begins with their next change. Player renames/deletions affecting past records are also noted. Logs and the related change are saved atomically under the existing version check.

`node --experimental-strip-types tests/roster.test.mjs` validates roster management, assignments, naming and audit history while retaining historical stats.

## Extra games, resets, and deleted nights

New score forms start empty; editing a result shows its saved scores. Each open table has Add match, with editable teams and a randomized suggestion prioritizing the fewest played/scheduled games. Existing games stay intact.

Delete past night previews each affected player's current and resulting wins, losses, games and PR. It permanently removes that night's matches and audit history. Career totals are recalculated from the remaining results. Other nights' frozen PR snapshots stay unchanged. A player reset excludes the results already scored for that player (by stable match ID), resets career totals to 0 and PR to 500, and preserves historical scores and nightly standings. Other players are unaffected. Later edits to excluded results do not resurrect old stats; previously unscored and new matches count when scored. Repeated resets retain previous exclusions. Confirmation saves use the data version from when the impact was shown, so concurrent changes require a fresh confirmation.

Completed championships appear before the table results. Phone UI was tested at 390×844 and 360×800 using local demo data: blank score entry, score saving, extra match creation, final placement, deletion-impact and reset dialogs. `node --experimental-strip-types tests/night-controls.test.mjs` covers reset/deletion semantics and extra-match validation. `tests/phone-fixture.mjs` creates local-only demo players and a night; it never targets production.

## PR tables, attendance and championships

Night setup defaults to PR order: the higher-ranked half goes to Table 1 and the lower-ranked half to Table 2, with the extra player at Table 1 for odd counts. Assign by PR reapplies this split; random and manual choices remain available. Equal ranks retain attendance selection order. One-table nights keep everyone together.

Roster cards show championship titles and the name/date of the most recent attended night, linked to that night. Titles count once per winning player per completed championship series. Score corrections, deleted nights and player resets update totals. The clinching match identifies the title for reset exclusions.

## Windows hosting

For a Docker server, use [DOCKER.md](DOCKER.md). The included Dockerfile builds the full app with Node 24 and Compose stores the database in a persistent volume. Copy `docker.env.example` to `docker.env`, set a private setup key, and run `docker compose --env-file docker.env up -d --build`.

Run `npm run build:windows` to create a standalone Node.js package in `outputs`. It includes a SQLite adapter, migrations, startup script and transfer instructions. See [windows/HOSTING.md](windows/HOSTING.md) for setup on another Windows PC and a Cloudflare Tunnel using `pong.kor.red`. Node.js 24 or newer is required. The Windows database is separate from Sites; migrate state at cutover. Standard `npm run build` continues to target Sites/Cloudflare.

`tests/rank-tables.test.mjs` checks PR splits, titles and last attendance. `tests/windows-host.test.mjs` runs the standalone package with a separate temporary database to check persistence, authentication and proxy settings.
