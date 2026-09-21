const steps = [
  [
    'Add someone to the roster',
    'Open Roster, choose Add player, enter their name and any optional details, then Save player. If the name already exists, use that player instead.',
  ],
  [
    'Start a night and select players',
    'Choose Set up a night. Edit the date-based night name if you want, choose Doubles (2 vs 2) or Singles (1 vs 1), then check everyone attending. Choose Next: assign tables. You need at least four players per table for doubles or two for singles. Singles schedules everyone against every other player at their table. Review the assignments and choose Start night & generate games.',
  ],
  [
    'Sort players and assign tables',
    'In Roster, use Sort players to sort by first name, wins, losses, games, or PR. During setup, choose one or two tables. Assign by PR puts higher ranks at Table 1 and lower ranks at Table 2. Use Random tables or each player’s table selector to change the assignments.',
  ],
  [
    'Record or correct a match score',
    'Find the match at its table and choose Enter score. Enter both players’ scores for singles or both teams’ scores for doubles, then Save final score. Use Edit score to correct a result. Normally play to 21 and win by two; the app accepts any non-tied final score.',
  ],
  [
    'Add more matches',
    'Before the championship, choose Add match under the table. Review the suggested players or select two players for singles or two teams for doubles, then Add match. Reshuffle rebuilds remaining unplayed games while keeping completed scores.',
  ],
  [
    'Start the championship',
    'Choose Championship. Doubles suggests the top two players from each table. Singles suggests the player with the most table wins from each table, or the top two by wins with one table. Resolve ties yourself and change any finalist using the player selectors. Default doubles teams pair the highest and lowest night-start PR against the middle two. Choose one game or best two out of three, then Set finalists. Unplayed table games are removed. Score finals in order. Make best of 3 can extend a one-game final before the night is finished, keeping its first score.',
  ],
  [
    'End the night',
    'Choose Finish night and confirm. Unplayed games do not count. You can find the results in Past nights and still correct scores there.',
  ],
  [
    'Remove a player',
    'If someone leaves tonight, open Attendance, select Player leaving, leave Player joining as Nobody joining, then Update & rebuild games. To remove someone from the roster, use their Hide or Delete control in Roster. Show hidden players lets you unhide them later. Completed results stay recorded.',
  ],
  [
    'Add a player during the night',
    'Add them to Roster first if needed. Return to the active night and open Attendance. Leave Player leaving as Nobody leaving, select Player joining and Joining table, then Update & rebuild games.',
  ],
  [
    'Replace a player',
    'Open Attendance and select both the leaving and joining players, plus the joining table. Check Replacement inherits scheduling game count if the new player should take over their scheduling count, then Update & rebuild games. Wins, losses, games played, and PR remain personal.',
  ],
];
export default function ManagerGuide() {
  return (
    <div className="manager-guide">
      <p className="muted">
        Sign in as a manager to use these controls. Attendance changes and
        reshuffling are available before the championship starts.
      </p>
      <details>
        <summary>How singles matches are scheduled</summary>
        <p>
          At the start of a singles night, everyone plays every other player at
          their own table once. For example, five players need ten matches, with
          four matches per player. Players at different tables meet only in the
          championship unless you move them between tables.
        </p>
        <p>The schedule aims to:</p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Cover every opponent pairing with the fewest matches.</li>
          <li>
            Give earlier turns to players with fewer games played or already
            scheduled.
          </li>
          <li>
            Reduce back-to-back matches where possible. Rest between games is
            not guaranteed.
          </li>
          <li>
            Randomize otherwise similar choices. PR does not decide match order.
          </li>
        </ol>
        <p>
          When attendance changes or you reshuffle, completed scores stay.
          Remaining matches are rebuilt for the current players. Completed
          pairings at that table are not repeated for round-robin coverage, but
          extra repeat matches may be added to bring current players’ scheduling
          totals within one game of each other. With only two active players, an
          existing gap cannot shrink because each match adds a game to both.
        </p>
        <p>
          A replacement can inherit scheduling credit to help balance the
          rotation. Their personal wins, losses, games played and PR stay
          separate from the departing player’s results.
        </p>
        <p>
          Singles uses the same PR rules and career stats as doubles, comparing
          each player’s rank frozen at the start of the night. Championships
          suggest the top player by wins from each table, or the top two at one
          table. Managers resolve ties and can change either finalist.
        </p>
      </details>
      <details>
        <summary>Download players and past nights</summary>
        <p>
          Choose Download spreadsheet at the top of the app. Your browser
          downloads an Excel workbook to the device you are using. It includes a
          Players tab with current career stats, plus a separate tab for each
          completed night with standings and match scores. On a phone, use the
          browser's download or save/share prompt to save it to Files or open it
          in a spreadsheet app. Private notes are not included. This is a
          report, not a restorable database backup.
        </p>
      </details>
      {steps.map(([title, text], i) => (
        <details key={title}>
          <summary>
            {i + 1}. {title}
          </summary>
          <p>{text}</p>
        </details>
      ))}
      <p className="muted">
        Use Hide / Show in a table’s header to focus on your table. This only
        changes your own device’s view. Change history shows the edits made to
        each night.
      </p>
    </div>
  );
}
