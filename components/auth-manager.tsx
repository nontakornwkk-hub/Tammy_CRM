"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LockKeyhole } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

export function AuthManager() {
  const router = useRouter(); const [mode,setMode]=useState<"login"|"signup">("login"); const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false);
  async function submit(form: FormData) { if(!supabase)return; setBusy(true); setMessage(""); const email=String(form.get("email")); const password=String(form.get("password"));
    const result=mode==="login"?await supabase.auth.signInWithPassword({email,password}):await supabase.auth.signUp({email,password,options:{emailRedirectTo:`${window.location.origin}/login`}});
    if(result.error){setMessage(result.error.message);setBusy(false);return;} if(!result.data.session){setMessage("สมัครสำเร็จ กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ");setBusy(false);return;}
    await supabase.rpc("claim_starter_data"); router.push("/database"); router.refresh(); }
  return <main className="auth-page"><section className="auth-card"><span><LockKeyhole /></span><h1>{mode==="login"?"เข้าสู่ระบบ Tammy CRM":"สร้างบัญชีผู้ดูแล"}</h1><p>ข้อมูลสมาชิกและธุรกิจได้รับการป้องกันด้วย Supabase Auth และ RLS</p><form action={submit}><label>อีเมล<input name="email" type="email" required autoComplete="email" /></label><label>รหัสผ่าน<input name="password" type="password" minLength={8} required autoComplete={mode==="login"?"current-password":"new-password"} /></label><button disabled={busy}>{busy?"กำลังดำเนินการ…":mode==="login"?"เข้าสู่ระบบ":"สมัครและเริ่มใช้งาน"}</button></form>{message&&<div className="auth-message"><CheckCircle2 />{message}</div>}<button className="auth-mode" onClick={()=>setMode(mode==="login"?"signup":"login")}>{mode==="login"?"ยังไม่มีบัญชี? สมัครผู้ดูแล":"มีบัญชีแล้ว? เข้าสู่ระบบ"}</button><Link href="/">กลับหน้าหลัก</Link></section></main>;
}
