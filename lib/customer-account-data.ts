import { singleFlight } from "./single-flight";
export type Profile={dogCount:number;catCount:number;memberCode:string;name:string;firstName:string;lastName:string;gender:string;birthDate:string;birthdayChangedAt:string;phone:string;email:string;level:string;points:number;lineDisplayName:string;linePictureUrl:string;privacyConsent:boolean;consentUpdatedAt:string};
export type PointEntry={id:string;points_delta:number;transaction_type:string;note:string;created_at:string};
export type AccountData={profile:Profile;pointsHistory:PointEntry[];hasMore:boolean};
const pending=singleFlight<AccountData>();let snapshot:{key:string;data:AccountData;expires:number}|undefined;let generation=0;
const keyFor=(idToken?:string,accessToken?:string)=>JSON.stringify([idToken||"",accessToken||""]);
export function cachedMemberAccount(idToken?:string,accessToken?:string){return snapshot?.key===keyFor(idToken,accessToken)&&snapshot.expires>Date.now()?snapshot.data:undefined;}
export function clearMemberAccount(){generation++;snapshot=undefined;}
export function seedMemberAccount(data:AccountData,idToken?:string,accessToken?:string){snapshot={key:keyFor(idToken,accessToken),data,expires:Date.now()+30000};}
export function loadMemberAccount(idToken?:string,accessToken?:string,{fresh=false}={}){
 const key=keyFor(idToken,accessToken),epoch=generation,cached=cachedMemberAccount(idToken,accessToken);
 if(!fresh&&cached)return Promise.resolve(cached);
 return pending(`${epoch}:${key}`,async()=>{
  const response=await fetch("/api/line/member/account",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"load",idToken,accessToken}),cache:"no-store",signal:AbortSignal.timeout(12000)});
  const data=await response.json();if(!response.ok||!data.profile)throw new Error(data.error||"โหลดข้อมูลไม่สำเร็จ");
  if(epoch===generation)snapshot={key,data,expires:Date.now()+30000};return data as AccountData;
 });
}
