import { notFound } from "next/navigation";
import { GamesManager } from "@/components/games/games-manager";
export default async function Page({params}:{params:Promise<{gameKey:string}>}){
  const {gameKey}=await params;
  if(gameKey!=="new"&&!/^[a-z][a-z0-9-]{2,49}$/.test(gameKey))notFound();
  return <GamesManager key={gameKey} initialGameKey={gameKey}/>;
}
