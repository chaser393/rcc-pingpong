# Pong Night

Phone-friendly rotating doubles tracker built with React, Vinext and Cloudflare D1.

## First use

Open the site, select **Set up manager**, and enter the private `SETUP_KEY` from your local `.env.local` file. Use `admin` as the first username and any nonblank password. The setup key only permits the first manager account; later accounts require the super admin to sign in. Never commit or share the setup key. The super admin can add accounts using **Manage managers**.

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

## Table visibility and manager permissions

Each table header has Hide/Show. Only that table's content is collapsed; the header stays visible so it can be restored. The preference is stored in that browser's local storage per night/table, never in the shared database. Other phones are unaffected. If browser storage is unavailable, the toggle still works until reload.

The existing account named `admin` is now the super admin; its password is unchanged. Every other account remains a manager. Before upgrading an existing installation, ensure you can sign in as `admin`. Fresh installations require `admin` as the first account username.

| Action | Manager | Super admin |
| --- | --- | --- |
| View results, hide/show tables on own device | Yes | Yes |
| Maintain roster and start a new night | Yes | Yes |
| Enter the first score of an unscored match in an open night | Yes | Yes |
| Edit/clear scores and score closed nights | Yes | Yes |
| Reset career stats or delete nights | No | Yes |
| Change attendance, reshuffle, add matches, set finals/format, finish/rename nights | Yes | Yes |
| List/add/remove managers and change their passwords | No | Yes |

Sign in as admin and choose **Manage managers**. Removing a manager or changing their password signs that account out. The admin account cannot be removed. Account removal does not delete players, matches or their recorded history. Passwords still only need to be nonblank.

Permissions are enforced in API routes, using the stored state and authenticated session. No schema or data migration is needed. Upgrade the app container while retaining the existing data volume and backup first; do not use `down -v`.

Validation: `tests/permissions-api.test.mjs` covers manager scoring and night controls, championship expansion, forbidden resets and night deletion, manager administration, session revocation, and preserved history after account changes and restart. Run it with `PONG_TEST_PACKAGE_DIR` pointing to a built standalone folder containing the `drizzle` migrations. Browser visual QA for these controls was unavailable during implementation.

Championship finalists default to highest + lowest night-start PR versus the middle two. Managers can change these teams before scoring. Use **Make best of 3** on an open night to extend a one-game final, including after its first result. Existing teams, match IDs, scores and PR results are retained. Titles are recalculated when a team reaches two wins. Shortening a series requires clearing any later scores first.

## Manager guide and defaults

Signed-in managers can open **Manager guide** in the header for instructions covering roster, attendance, scores, extra matches, championships and finishing nights. The footer credits Creator Kor-Travis and Hosted by Chase-WolfFather.

The super admin can open **Options** to save a shared one- or two-table default for new nights. Existing installs default to two tables until changed. Managers can override the default during setup; fewer than eight attendees still use one table. Settings are saved in the existing database state, so keep the same Docker data volume when upgrading. Existing nights and results are unchanged.

## Singles tournaments

During player selection, choose **Tournament format: Singles - 1 vs 1** or keep Doubles. Each table needs two singles players (four for doubles); odd counts are supported. Singles schedules every pair at the same table exactly once for a fresh night. After attendance changes, completed scores stay and remaining pairings are rebuilt; extra games may be added to balance current players' totals, including replacement scheduling credit. With only two active players, an existing games-played gap cannot shrink.

Singles shares existing career stats and PR rules, using each player's frozen starting PR. Championships suggest one player per table, or the top two at a single table, based on wins. Managers resolve ties and can override finalists. One-game/best-of-three finals, extra matches, attendance changes and score corrections work in either format. A night's format is chosen at creation; old nights without a format remain doubles. Existing data needs no migration.

`tests/singles.test.mjs` checks schedules for 2-14 players, PR/stats, attendance/replacements, extra matches, finals and legacy doubles; the permission API test covers a persisted singles night alongside existing doubles history.

## Download spreadsheet

The super admin’s **Options → Download spreadsheet** link downloads an `.xlsx` report on the visitor's current device without changing the database. The server restricts downloads to the super admin; other managers and signed-out visitors cannot export. It contains public fields only (never private player notes or account information). The Players tab includes active/hidden roster entries, career wins/losses/games/PR/titles and last attendance. Deleted players are retained by name only where needed in past-night results. Each completed night gets its own tab with standings, starting PR, match-derived night PR change, scheduling credits and match scores. Unplayed matches are labeled and not counted as results; active nights do not get a past-night tab. Duplicate or invalid night names are converted into unique Excel tab names. Strings are literal text, never executable formulas.

The browser handles the attachment: desktop downloads normally go to Downloads; phones may show a save/share or spreadsheet-app prompt. This is a report, not a database backup. The report uses one consistent saved state and current career totals, including any resets. Night PR changes describe that night's match results, while career totals honor reset exclusions.
