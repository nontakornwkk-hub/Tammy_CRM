"use client";
import dynamic from "next/dynamic";
import type { PublicPrize } from "@/lib/games/types";
import type { SceneView } from "./admin-game-preview";
const Wheel = dynamic(() => import("./wheel-scene").then(m => m.WheelScene), { ssr: false, loading: () => <div className="game-stage-loading">🐾 กำลังจัดฉาก 3 มิติ</div> });
export type StageSpin = { key: string; targetId: string };
export function GameStage({ engine = "wheel", prizes, spin, onFinish, view, cinematic = false }: { engine?: string; prizes: PublicPrize[]; spin: StageSpin | null; onFinish: () => void; view?:SceneView; cinematic?: boolean }) {
  // Register future renderers here; the shared hub handles tickets and rewards.
  if (engine === "wheel") return <Wheel prizes={prizes} spin={spin} onFinish={onFinish} view={view} cinematic={cinematic}/>;
  return <div className="game-stage-loading">เกมนี้ยังไม่รองรับบนอุปกรณ์นี้</div>;
}
