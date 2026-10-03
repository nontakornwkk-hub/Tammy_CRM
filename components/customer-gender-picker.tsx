"use client";
import { useId } from "react";
const choices=[{value:"female",label:"หญิง"},{value:"male",label:"ชาย"},{value:"other",label:"อื่น ๆ"},{value:"prefer_not_to_say",label:"ไม่ระบุ"}];
export function CustomerGenderPicker({value,onChange,required=false}:{value:string;onChange:(gender:string)=>void;required?:boolean}) {
  const id=useId();
  return <div className="customer-gender-picker"><span id={id}>เพศ{required&&" *"}</span><div role="radiogroup" aria-labelledby={id} aria-required={required}>{choices.map((choice,index)=><button key={choice.value} type="button" role="radio" aria-checked={value===choice.value} onClick={()=>onChange(choice.value)} onKeyDown={event=>{if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key))return;event.preventDefault();const next=(index+(["ArrowRight","ArrowDown"].includes(event.key)?1:3))%4;onChange(choices[next].value);(event.currentTarget.parentElement?.children[next] as HTMLElement)?.focus();}}>{choice.label}</button>)}</div></div>;
}
