// Keep one side of each easily confused pair: 0/O, 1/I/L, 2/Z, 5/S,
// 6/G and 8/B. Codes are read aloud and entered on phone screens.
export const LOBBY_CODE_CHARS = 'ACDEFHJKMNPQRTUVWXY23456789';
export const LOBBY_CODE_LENGTH = 3;
const PUBLISHED_GAME_URL = 'https://daily-daily-games.itch.io/suits-mp';

// Invite links must point to the published game even when a host opens a
// GitHub Pages or local preview build.
export function lobbyInviteUrl(code: string): string {
  return `${PUBLISHED_GAME_URL}?lobby=${encodeURIComponent(code)}`;
}

export function randomLobbyCode(): string {
  let code = '';
  for (let i = 0; i < LOBBY_CODE_LENGTH; i++) {
    code += LOBBY_CODE_CHARS[Math.floor(Math.random() * LOBBY_CODE_CHARS.length)];
  }
  return code;
}

export function isValidLobbyCode(code: string): boolean {
  if (code.length !== LOBBY_CODE_LENGTH) return false;
  return [...code].every((char) => LOBBY_CODE_CHARS.includes(char));
}

// Normalizes user-typed input the same way the input field forces it, so a
// pasted or lowercase code from a link still validates.
export function normalizeLobbyCode(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, '');
}
