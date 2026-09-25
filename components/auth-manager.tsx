"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

const ADMIN_EMAIL = "nontakorn.wn@gmail.com";

function destination() {
  const requested = new URLSearchParams(window.location.search).get("next");
  return requested && requested.startsWith("/") && !requested.startsWith("//") && requested !== "/login" ? requested : "/points";
}

export function AuthManager() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "setup">("login");
  const [localSetup, setLocalSetup] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLocalSetup(window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => { if (data.user) router.replace(destination()); });
  }, [router]);

  async function submit(form: FormData) {
    if (!supabase) { setMessage("ยังไม่ได้ตั้งค่า Supabase"); return; }
    setBusy(true); setMessage("");
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    if (mode === "setup") {
      if (!localSetup || email !== ADMIN_EMAIL) { setMessage("ใช้เฉพาะอีเมลแอดมินที่กำหนดไว้"); setBusy(false); return; }
      if (password.length < 8) { setMessage("ตั้งรหัสผ่านอย่างน้อย 8 ตัวอักษร"); setBusy(false); return; }
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/login` } });
      setBusy(false);
      if (error) { setMessage(error.message); return; }
      await supabase.auth.signOut();
      setMode("login");
      setMessage("สร้างบัญชีแล้ว กรุณายืนยันอีเมล และแจ้งอีเมลแอดมินเพื่อผูกข้อมูลร้านก่อนเข้าสู่ระบบ");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { setMessage("อีเมลหรือรหัสผ่านไม่ถูกต้อง"); return; }
    router.replace(destination()); router.refresh();
  }

return <main className="auth-page"><section className="auth-card"><span><LockKeyhole /></span><h1>{mode === "setup" ? "สร้างบัญชีแอดมิน" : "เข้าสู่ระบบหลังบ้าน"}</h1><p>{mode === "setup" ? "ตั้งรหัสผ่านอย่างน้อย 8 ตัวอักษร ระบบจะไม่แสดงหรือบันทึกรหัสไว้ในหน้าเว็บ" : "เข้าสู่ระบบครั้งเดียวเพื่อใช้งานหน้าให้แต้ม สมาชิก และตั้งค่าระบบ"}</p><form action={submit}><label>อีเมลแอดมิน<input name="email" type="email" defaultValue={ADMIN_EMAIL} readOnly={mode === "setup"} required autoComplete="username" /></label><label>รหัสผ่าน<input name="password" type="password" minLength={mode === "setup" ? 8 : undefined} required autoComplete={mode === "setup" ? "new-password" : "current-password"} /></label><button disabled={busy}>{busy ? "กำลังดำเนินการ…" : mode === "setup" ? "สร้างบัญชี" : "เข้าสู่ระบบ"}</button></form>{message ? <div className="auth-message" role="alert">{message}</div> : null}{localSetup ? <button className="auth-mode" type="button" onClick={() => { setMode(mode === "login" ? "setup" : "login"); setMessage(""); }}>{mode === "login" ? "ตั้งค่าบัญชีแอดมินบน localhost" : "กลับไปเข้าสู่ระบบ"}</button> : null}<small>บัญชีแอดมินต้องได้รับการผูกกับข้อมูลร้านก่อนใช้งานจริง</small></section></main>;
}
