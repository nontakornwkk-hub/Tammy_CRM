"use client";
import { useEffect, useState } from "react";
import { Clock3, MapPin, Navigation, Phone, Globe, ChevronRight, Store, PawPrint } from "lucide-react";
import { SiLine, SiFacebook, SiInstagram, SiTiktok, SiYoutube } from "react-icons/si";
import { StorePinMap } from "./store-pin-map";
import { storeCoordinates, storeDirections } from "@/lib/store-location";
import { compactStoreHours, contactHref, storeStatus, type StoreInfo } from "@/lib/customer-store";
const contactIcons={line:SiLine,facebook:SiFacebook,instagram:SiInstagram,tiktok:SiTiktok,youtube:SiYoutube,phone:Phone,website:Globe};
export function CustomerStore({name,info}:{name:string;info:StoreInfo|null}) {
 const [now,setNow]=useState(()=>new Date());
 useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),60000);return()=>clearInterval(timer);},[]);
 if(!info)return <section className="customer-store-page"><h1>ร้านของเรา</h1><p>ยังไม่มีข้อมูลร้าน</p></section>;
 const status=storeStatus(info,now),directions=storeDirections(info.location);
 return <section className="customer-store-page" aria-label="ร้านของเรา"><header><span className="customer-store-heading-icon"><Store size={27}/></span><div><h1>ร้านของเรา</h1><p>{name}</p></div>{status&&<span className={`customer-store-status ${status}`}>{status==="open"?"เปิดอยู่ตอนนี้":status==="holiday"?"หยุดชั่วคราว":"ปิดแล้ว"}</span>}</header>
 {info.description&&<p className="customer-store-description">{info.description}</p>}
 {info.closure.enabled&&status==="holiday"&&<div className="customer-store-closure"><strong>{info.closure.reason||"ร้านหยุดให้บริการชั่วคราว"}</strong>{info.closure.reopensOn&&<span>กลับมาเปิด {new Date(`${info.closure.reopensOn}T00:00:00+07:00`).toLocaleDateString("th-TH",{day:"numeric",month:"long",year:"numeric",timeZone:"Asia/Bangkok"})}</span>}</div>}
 {info.hoursEnabled&&<article className="customer-store-card customer-store-hours-card"><h2><Clock3 size={19}/>เวลาเปิดร้าน</h2>{info.hours.length?<div className="customer-store-hours-summary">{compactStoreHours(info.hours).map(group=><div className={group.closed?"is-closed":""} key={group.days}><span>{group.days}</span>{!group.closed&&<strong>{group.time}</strong>}</div>)}</div>:<p>ร้านยังไม่ได้กำหนดเวลาเปิด</p>}<PawPrint className="customer-store-hours-paw" size={37} aria-hidden="true"/></article>}
 <article className="customer-store-card"><h2><MapPin size={19}/>แวะมาหาเรา</h2>{info.location.address&&<p>{info.location.address}</p>}{storeCoordinates(info.location)?<StorePinMap location={info.location}/>:<div className="customer-store-map-empty"><MapPin size={28}/><span>ร้านยังไม่ได้ระบุตำแหน่งแผนที่</span></div>}{directions&&<a className="customer-store-directions" href={directions} target="_blank" rel="noreferrer"><Navigation size={17}/>นำทางมาที่ร้าน<ChevronRight size={17}/></a>}</article>
 <article className="customer-store-card"><h2><Phone size={19}/>ช่องทางติดต่อ</h2><div className="customer-store-contacts">{info.contacts.map(contact=>{const Icon=contactIcons[contact.platform]||Globe,href=contactHref(contact),content=<><span className={`customer-store-contact-icon ${contact.platform}`}><Icon size={22}/></span><span><strong>{contact.label}</strong><small>{contact.value}</small></span>{href&&<ChevronRight size={16}/>}</>;return href?<a key={contact.id} href={href} target={contact.platform==="phone"?undefined:"_blank"} rel="noreferrer">{content}</a>:<div key={contact.id}>{content}</div>;})}{!info.contacts.length&&<p>ยังไม่มีช่องทางติดต่อที่เปิดให้แสดง</p>}</div></article></section>;
}
