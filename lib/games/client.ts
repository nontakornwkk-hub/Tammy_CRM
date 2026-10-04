import { singleFlight } from "../single-flight";
import type { MemberGames } from "./types";
const pending=singleFlight<MemberGames>();
let snapshot:{key:string;data:MemberGames;expires:number}|undefined;
let generation=0;
const keyFor=(idToken?:string,accessToken?:string)=>JSON.stringify([idToken||"",accessToken||""]);
// Display cache only: every draw still validates identity, version and balance on the server.
export function cachedMemberGames(idToken?:string,accessToken?:string){return snapshot?.key===keyFor(idToken,accessToken)&&snapshot.expires>Date.now()?snapshot.data:undefined;}
export function clearMemberGames(){generation++;snapshot=undefined;}
export function loadMemberGames(idToken?:string,accessToken?:string,{fresh=false}={}){
 const key=keyFor(idToken,accessToken),epoch=generation;
 const cached=cachedMemberGames(idToken,accessToken);
 if(!fresh&&cached)return Promise.resolve(cached);
 return pending(`${epoch}:${key}`,async()=>{
  const response=await fetch("/api/line/member/games",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"status",idToken,accessToken}),cache:"no-store",signal:AbortSignal.timeout(12000)});
  const data=await response.json();if(!response.ok)throw new Error(data.error||"โหลดเกมไม่สำเร็จ");
  if(epoch===generation)snapshot={key,data,expires:Date.now()+30000};
  return data as MemberGames;
 });
}
