import { defaultGameSetup, playablePrizes } from "./config";
// Only a fallback when no configured game is available. Real games and their practice rounds share their configured slots.
export const practicePrizes=playablePrizes(defaultGameSetup().game.prizes);
