"use client";
import { useState } from "react";
import { MapPin, PawPrint, ExternalLink } from "lucide-react";
import { googleMapEmbed, parseGoogleCoordinates, storeCoordinates, type StoreLocation } from "@/lib/store-location";
export function StorePinMap({location,onPick}:{location:StoreLocation;onPick?:(lat:number,lng:number)=>void}) {
 const [draft,setDraft]=useState(""),[error,setError]=useState("");
 const point=storeCoordinates(location),src=googleMapEmbed(location);
 const search=`https://www.google.com/maps/search/?${new URLSearchParams({api:"1",query:location.address||point?.join(",")||""})}`;
 function apply(){const next=parseGoogleCoordinates(draft);if(!next){setError("วางพิกัด เช่น 13.747921, 100.518015 หรือลิงก์ Google Maps แบบเต็ม");return;}onPick?.(...next);setError("");setDraft("");}
 return <div className="store-google-map-wrap">
  <div className="store-google-map-heading"><span><MapPin size={17}/>หมุดร้านของเรา</span><PawPrint size={18}/></div>
  {src?<div className="store-pin-map store-google-map"><iframe title="ตำแหน่งร้านบน Google Maps" src={src} width="100%" height="280" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/></div>:<div className="customer-store-map-empty"><MapPin size={28}/><span>เลือกตำแหน่งร้านใน Google Maps</span></div>}
  {onPick&&<div className="store-google-map-editor"><a href={search} target="_blank" rel="noreferrer"><ExternalLink size={15}/>เลือกตำแหน่งใน Google Maps</a><p>คลิกขวาที่ตำแหน่งร้านใน Google Maps แล้วคัดลอกพิกัดมาวางด้านล่าง</p><div><input aria-label="พิกัดหรือลิงก์ Google Maps" value={draft} onChange={event=>{setDraft(event.target.value);setError("");}} placeholder="ละติจูด, ลองจิจูด หรือ URL แบบเต็ม"/><button type="button" onClick={apply} disabled={!draft.trim()}>ใช้หมุดนี้</button></div>{error&&<small role="alert">{error}</small>}</div>}
 </div>;
}
