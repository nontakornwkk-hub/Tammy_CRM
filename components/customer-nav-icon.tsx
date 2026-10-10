import { useId } from "react";
/** Consistent pastel vectors with rounded shapes and no sprite clipping. */
export function CustomerNavIcon({tab}:{tab:"rewards"|"coupons"|"home"|"store"|"account"}) {
 const id=useId().replace(/:/g,""),colors={rewards:["#ffd9a2","#ffa98b"],coupons:["#b5e4d5","#70c3ad"],home:["#cfc3f9","#a391e7"],store:["#ffcabd","#ee968b"],account:["#cec2fa","#9985dc"]}[tab];
 return <svg className="customer-pastel-nav-art" viewBox="0 0 48 48" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false"><defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop stopColor={colors[0]}/><stop offset="1" stopColor={colors[1]}/></linearGradient></defs><ellipse cx="24" cy="43" rx="15" ry="2" fill="#a497be" opacity=".13"/><g fill={`url(#${id})`} stroke={colors[1]} strokeWidth="1.1" strokeLinejoin="round">
 {tab==="rewards"&&<><rect x="9" y="19" width="30" height="22" rx="5"/><rect x="6" y="14" width="36" height="10" rx="3"/><path d="M24 15C9 17 8 5 16 6c5 0 7 5 8 9Zm0 0C39 17 40 5 32 6c-5 0-7 5-8 9Z" fill="#ffe49c"/><path d="M21 15h6v26h-6z" fill="#fff3c3" stroke="none"/></>}
 {tab==="coupons"&&<g transform="rotate(-10 24 24)"><path d="M7 14h34v7a4 4 0 0 0 0 8v7H7v-7a4 4 0 0 0 0-8Z"/><path d="M24 17v16" stroke="#fff8ec" strokeDasharray="2 3" strokeWidth="2"/><path d="m16 19 2 4 4 .5-3 3 .7 4-3.7-2-3.7 2 .7-4-3-3 4-.5Z" fill="#fffae7" stroke="none"/></g>}
 {tab==="home"&&<><path d="M11 21h26v20H11z" fill="#ffe2c8"/><path d="m5 23 19-17 19 17-4 5-15-13L9 28Z"/><rect x="20" y="29" width="10" height="12" rx="4" fill="#f8a78e" stroke="none"/><rect x="12" y="27" width="5" height="6" rx="1.5" fill="#fff9e7" stroke="none"/></>}
 {tab==="store"&&<><path d="M24 4c-9 0-15 6-15 14 0 12 15 23 15 23s15-11 15-23c0-8-6-14-15-14Z"/><circle cx="24" cy="18" r="8" fill="#fff6e4" stroke="none"/><path d="M20 16h8v8h-8z" fill="#8dcfc0" stroke="none"/><path d="m18 16 6-5 6 5" fill="none" stroke="#8dcfc0" strokeWidth="3" strokeLinecap="round"/></>}
 {tab==="account"&&<><circle cx="24" cy="13" r="9"/><path d="M9 37c0-10 6-16 15-16s15 6 15 16c0 5-30 5-30 0Z"/><path d="M19 7c-3 1-4 3-4 5" stroke="#fff" strokeOpacity=".5" strokeWidth="2.5" strokeLinecap="round"/></>}
 </g></svg>;
}
