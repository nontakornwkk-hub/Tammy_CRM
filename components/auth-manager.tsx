"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import Image from "next/image";
import { supabase } from "@/lib/supabase/client";
import { googleProviderEnabled } from "@/lib/supabase/google-provider";

type Mode = "login" | "forgot";

function destination() {
  const requested = new URLSearchParams(window.location.search).get("next");
  return requested && requested.startsWith("/") && !requested.startsWith("//") && requested !== "/login" ? requested : "/points";
}

export function AuthManager() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleStatus, setGoogleStatus] = useState<"checking" | "enabled" | "disabled" | "unavailable">("checking");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("reset") === "success") setMessage("ตั้งรหัสผ่านใหม่แล้ว กรุณาเข้าสู่ระบบอีกครั้ง");
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => { if (data.user) router.replace(destination()); });
  }, [router]);

  useEffect(() => {
    let active = true;
    void googleProviderEnabled().then((enabled) => { if (active) setGoogleStatus(enabled ? "enabled" : "disabled"); }).catch(() => { if (active) setGoogleStatus("unavailable"); });
    return () => { active = false; };
  }, []);

  async function submit(form: FormData) {
    if (!supabase) { setMessage("ยังไม่ได้ตั้งค่า Supabase"); return; }
    setBusy(true); setMessage("");
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      setBusy(false);
      setMessage(error ? error.status === 429 ? "กดส่งลิงก์ถี่เกินไป กรุณารอประมาณ 1 นาทีแล้วลองใหม่" : `ส่งลิงก์ไม่สำเร็จ: ${error.message}` : "หากอีเมลนี้มีบัญชี ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้ กรุณาตรวจกล่องจดหมายและสแปม");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { setMessage("อีเมลหรือรหัสผ่านไม่ถูกต้อง"); return; }
    router.replace(destination()); router.refresh();
  }

  async function signInWithGoogle() {
    if (!supabase) { setMessage("ยังไม่ได้ตั้งค่า Supabase"); return; }
    setBusy(true); setMessage("");
    try {
      if (!await googleProviderEnabled()) {
        setGoogleStatus("disabled");
        setMessage("Google ยังไม่พร้อมใช้งาน: ต้องเปิด Google provider ใน Supabase ก่อน");
        setBusy(false);
        return;
      }
    } catch {
      setGoogleStatus("unavailable");
      setMessage("ตรวจสอบสถานะ Google ไม่สำเร็จ กรุณาลองใหม่ภายหลัง");
      setBusy(false);
      return;
    }
    const redirect = new URL("/login", window.location.origin);
    redirect.searchParams.set("next", destination());
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirect.toString() } });
    if (error) { setMessage(`เข้าสู่ระบบด้วย Google ไม่สำเร็จ: ${error.message}`); setBusy(false); }
  }

  function changeMode(next: Mode) { setMode(next); setMessage(""); }

  return <main className="auth-page"><section className="auth-card">
    <span><LockKeyhole /></span>
    <h1>{mode === "forgot" ? "ลืมรหัสผ่าน" : "เข้าสู่ระบบหลังบ้าน"}</h1>
    <p>{mode === "forgot" ? "ใส่อีเมลบัญชีของคุณ เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่" : "ใช้บัญชีที่เจ้าของร้านเพิ่มให้เพื่อเข้าสู่ระบบ"}</p>
    <form action={submit}>
      <label>อีเมล<input name="email" type="email" required autoComplete="username" /></label>
      {mode !== "forgot" ? <label>รหัสผ่าน<input name="password" type="password" required autoComplete="current-password" /></label> : null}
      {mode === "login" ? <button className="auth-forgot-link" type="button" onClick={() => changeMode("forgot")}>ลืมรหัสผ่าน?</button> : null}
      <button disabled={busy}>{busy ? "กำลังดำเนินการ…" : mode === "forgot" ? "ส่งลิงก์ตั้งรหัสใหม่" : "เข้าสู่ระบบ"}</button>
    </form>
    {mode === "login" ? <><div className="auth-divider"><span>หรือ</span></div><button className="auth-google" type="button" onClick={() => void signInWithGoogle()} disabled={busy || googleStatus !== "enabled"}><Image src="https://developers.google.com/static/identity/images/g-logo.png" alt="" width={20} height={20} unoptimized /> เข้าสู่ระบบด้วย Google</button>{googleStatus === "disabled" ? <small className="auth-google-note">ยังใช้งานไม่ได้: ต้องเปิด Google provider ใน Supabase ก่อน</small> : googleStatus === "unavailable" ? <small className="auth-google-note">ตรวจสอบสถานะ Google ไม่สำเร็จ กรุณารีเฟรชหน้านี้</small> : null}</> : null}
    {message ? <div className="auth-message" role="status">{message}</div> : null}
    {mode !== "login" ? <button className="auth-mode" type="button" onClick={() => changeMode("login")}>กลับไปเข้าสู่ระบบ</button> : null}
    <small>หากยังไม่มีบัญชี กรุณาให้เจ้าของร้านเพิ่มบัญชีทีมงานจากหน้าตั้งค่าระบบ</small>
  </section></main>;
}
