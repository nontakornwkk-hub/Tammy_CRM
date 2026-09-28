export function liffMatchesLoginChannel(loginChannelId: string, liffId: string): boolean {
  return /^\d{5,20}$/.test(loginChannelId) && liffId.startsWith(`${loginChannelId}-`);
}
