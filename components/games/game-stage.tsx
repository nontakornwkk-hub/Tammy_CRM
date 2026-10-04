"use client";
import { ArtWheelScene as Wheel } from "./art-wheel-scene";
import type { PublicPrize } from "@/lib/games/types";
import type { SceneView } from "./admin-game-preview";
export type StageSpin = { key: string; targetId: string };
export function GameStage({ engine = "wheel", prizes, spin, onFinish, preparing=false, view, cinematic = true, immersive = false }: { engine?: string; prizes: PublicPrize[]; spin: StageSpin | null; onFinish: () => void; preparing?:boolean; view?:SceneView; cinematic?: boolean; immersive?: boolean }) {
  // Register future renderers here; the shared hub handles tickets and rewards.
  if (engine === "wheel") return <Wheel prizes={prizes} spin={spin} onFinish={onFinish} preparing={preparing} view={view} cinematic={cinematic} immersive={immersive}/>;
  return <div className="game-stage-loading">เกมนี้ยังไม่รองรับบนอุปกรณ์นี้</div>;
}
