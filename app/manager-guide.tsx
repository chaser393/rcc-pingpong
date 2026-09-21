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
    'Find the match at its table and choose Enter score. Enter both teams’ final scores, then Save final score. Use Edit score to correct a result. Normally play to 21 and win by two; the app accepts any non-tied final score.',
  ],
  [
    'Add more matches',
    'Before the championship, choose Add match under the table. Review the suggested players or select your own two teams, then Add match. Reshuffle rebuilds remaining unplayed games while keeping completed scores.',
  ],
  [
    'Start the championship',
    'Choose Championship. Doubles suggests the top two players from each table. Singles suggests the top player from each table, or the top two with one table. Resolve ties yourself and change any finalist using the player selectors. Default doubles teams pair the highest and lowest night-start PR against the middle two. Choose one game or best two out of three, then Set finalists. Unplayed table games are removed. Score finals in order. Make best of 3 can extend a one-game final before the night is finished, keeping its first score.',
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
