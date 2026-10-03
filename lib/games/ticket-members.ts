"use client";
import {supabase} from "@/lib/supabase/client";
export type TicketMember={id:string;name:string;member_code:string;phone:string;line_picture_url:string|null};
const cache=new Map<string,{members:TicketMember[];at:number}>();
const requests=new Map<string,Promise<TicketMember[]>>();
export function cachedTicketMembers(owner:string){return cache.get(owner)?.members.slice(0,3)||[];}
export async function findTicketMembers(query="",signal?:AbortSignal,code=""):Promise<TicketMember[]>{
 const session=await supabase?.auth.getSession();if(!session?.data.session)throw new Error("กรุณาเข้าสู่ระบบ");
 const response=await fetch(`/api/admin/games/members?${new URLSearchParams(code?{code}:{q:query})}`,{headers:{Authorization:`Bearer ${session.data.session.access_token}`},signal,cache:"no-store"});const json=await response.json();if(!response.ok)throw new Error(json.error||"ค้นหาสมาชิกไม่สำเร็จ");return json.members||[];
}
export function preloadTicketMembers(owner:string){
 if(!owner)return Promise.resolve([] as TicketMember[]);
 const saved=cache.get(owner);if(saved&&Date.now()-saved.at<30000)return Promise.resolve(saved.members);
 const pending=requests.get(owner);if(pending)return pending;
 const request=findTicketMembers().then(members=>{cache.set(owner,{members:members.slice(0,3),at:Date.now()});return members.slice(0,3);}).finally(()=>requests.delete(owner));requests.set(owner,request);return request;
}
