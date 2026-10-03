// Add each future game's renderer and server outcome verifier here. Wallets,
// purchase credits, claims and history are shared across all game engines.
export const gameEngines = {
  wheel: { name: "วงล้ออุ้งเท้า", difficulty: "easy", outcome: "weighted-server", durationMs: 5200 },
} as const;
export function isSupportedEngine(value: string): value is keyof typeof gameEngines { return Object.hasOwn(gameEngines, value); }
export const GAME_COLORS = ["#1460de", "#039961", "#f47b18", "#edb42d"];
export function wheelTarget(current: number, index: number, count: number) {
  if (!Number.isInteger(index) || index < 0 || index >= count || count < 1) throw new Error("Invalid wheel slot");
  const turn = Math.PI * 2;
  return Math.ceil(current / turn) * turn + turn * 4 + index * turn / count;
}
