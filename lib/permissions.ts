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
  if (['player', 'hidePlayer', 'deletePlayer', 'night'].includes(action))
    return true;
  if (action !== 'score') return false;
  const night = state.nights.find((n) => n.id === value?.nightId);
  const match = night?.matches.find((m) => m.id === value?.matchId);
  return (
    !!night &&
    !night.closed &&
    !!match &&
    match.score === null &&
    Array.isArray(value?.score)
  );
}
