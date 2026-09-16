import type { State } from './pong';

export const isSuperAdmin = (username: string | null | undefined) =>
  username === 'admin';

export function canChangeState(
  username: string,
  state: State,
  action: string,
  value: any,
) {
  if (isSuperAdmin(username)) return true;
  return [
    'player',
    'hidePlayer',
    'deletePlayer',
    'night',
    'score',
    'addMatch',
    'renameNight',
    'attendance',
    'move',
    'reshuffle',
    'championship',
    'championshipFormat',
    'finish',
  ].includes(action);
}
