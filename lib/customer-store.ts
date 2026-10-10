import type { ShopDay, StoreContact, TemporaryClosure } from "./settings";
import { normalizeStoreLocation, type StoreLocation } from "./store-location";
export type StoreInfo={description:string;hoursEnabled:boolean;hours:ShopDay[];closure:TemporaryClosure;contacts:StoreContact[];location:StoreLocation};
export function customerStoreInfo(data:Record<string,unknown>):StoreInfo {
 const card=data.card_design as Record<string,unknown>|null;
 return {description:typeof data.description==="string"?data.description:"",hoursEnabled:data.store_hours_enabled===true,hours:Array.isArray(data.weekly_hours)?data.weekly_hours:[],contacts:Array.isArray(data.contacts)?data.contacts.filter(contact=>contact&&contact.active===true):[],closure:{enabled:false,startsOn:"",endsOn:"",reopensOn:"",reason:"",...(data.temporary_closure&&typeof data.temporary_closure==="object"?data.temporary_closure:{})},location:normalizeStoreLocation(card?.store_location)};
}
const weekdays=["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"];
export function compactStoreHours(hours:ShopDay[]):{days:string;time:string;closed:boolean}[] {
 const order=["จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์","อาทิตย์"];
 const groups=new Map<string,{indices:number[];time:string;closed:boolean}>();
 order.forEach((name,index)=>{const day=hours.find(item=>item.day===name);if(!day)return;const time=day.open?`${day.opensAt} – ${day.closesAt} น.`:"หยุด",key=day.open?time:"closed",group=groups.get(key)||{indices:[],time,closed:!day.open};group.indices.push(index);groups.set(key,group);});
 return [...groups.values()].map(group=>{
   if(group.indices.length===7)return {days:group.closed?"หยุดทุกวัน":"เปิดทุกวัน",time:group.time,closed:group.closed};
   const ranges:string[]=[];let first=group.indices[0],last=first;
   const flush=()=>ranges.push(first===last?order[first]:last===first+1?`${order[first]}, ${order[last]}`:`${order[first]}–${order[last]}`);
   for(const index of group.indices.slice(1)){if(index===last+1)last=index;else{flush();first=last=index;}}flush();
   return {days:`${group.closed?"หยุด":"เปิด"}${ranges.join(", ")}`,time:group.time,closed:group.closed};
 });
}
const minutes=(value:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(value)?Number(value.slice(0,2))*60+Number(value.slice(3)):null;
export function storeStatus(info:StoreInfo,now=new Date()):"open"|"closed"|"holiday"|null {
 const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now).filter(part=>part.type!=="literal").map(part=>[part.type,part.value]));
 const date=`${parts.year}-${parts.month}-${parts.day}`,day=new Date(`${date}T00:00:00Z`).getUTCDay(),time=Number(parts.hour)*60+Number(parts.minute);
 if(info.closure.enabled&&date>=info.closure.startsOn&&date<=info.closure.endsOn)return "holiday";
 if(!info.hoursEnabled)return null;
 const today=info.hours.find(item=>item.day===weekdays[day]),previous=info.hours.find(item=>item.day===weekdays[(day+6)%7]);
 if(previous?.open){const start=minutes(previous.opensAt),end=minutes(previous.closesAt);if(start!==null&&end!==null&&end<start&&time<end)return "open";}
 if(today?.open){const start=minutes(today.opensAt),end=minutes(today.closesAt);if(start!==null&&end!==null&&(end>start?time>=start&&time<end:end<start&&time>=start))return "open";}
 return "closed";
}
export function contactHref(contact:StoreContact):string|null {
 const candidate=contact.platform==="phone"?`tel:${contact.value.replace(/[^\d+]/g,"")}`:contact.url.trim();
 if(contact.platform==="phone")return /^tel:\+?\d{6,15}$/.test(candidate)?candidate:null;
 try{const url=new URL(candidate);return url.protocol==="https:"||url.protocol==="http:"?url.href:null;}catch{return null;}
}
