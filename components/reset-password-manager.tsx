"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

export function ResetPasswordManager() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const client = supabase;
    if (!client) { setError("ยังไม่ได้ตั้งค่า Supabase"); setChecking(false); return; }
    let active = true;
    let timeout: number | undefined;
    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (!active || event !== "PASSWORD_RECOVERY" || !session?.user) return;
      window.clearTimeout(timeout);
      setEmail(session.user.email || "");
      setError("");
      setChecking(false);
    });
    timeout = window.setTimeout(() => {
      if (!active) return;
      setChecking(false);
      setError("ยังไม่พบลิงก์ตั้งรหัสผ่านที่ใช้ได้ กรุณาเปิดลิงก์ล่าสุดจากอีเมล หรือขอลิงก์ใหม่จากหน้าเข้าสู่ระบบ");
    }, 4000);
    return () => { active = false; window.clearTimeout(timeout); listener.subscription.unsubscribe(); };
  }, []);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const confirm = String(form.get("confirm") || "");
    setError("");
    if (password.length < 8) { setError("รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร"); return; }
    if (password !== confirm) { setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน"); return; }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) { setError(updateError.message); setBusy(false); return; }
    const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
    if (signOutError) { setError(`เปลี่ยนรหัสผ่านแล้ว แต่การออกจากระบบไม่สำเร็จ: ${signOutError.message}`); setBusy(false); return; }
    router.replace("/login?reset=success");
  }

  return <main className="auth-page"><section className="auth-card">
    <span><KeyRound /></span><h1>ตั้งรหัสผ่านใหม่</h1>
    {checking ? <p role="status">กำลังตรวจลิงก์จากอีเมล…</p> : email ? <><p>ตั้งรหัสผ่านใหม่สำหรับ {email}</p><form onSubmit={(event) => void updatePassword(event)}>
      <label>รหัสผ่านใหม่<input name="password" type="password" minLength={8} autoComplete="new-password" required /></label>
      <label>ยืนยันรหัสผ่านใหม่<input name="confirm" type="password" minLength={8} autoComplete="new-password" required /></label>
      <button disabled={busy}>{busy ? "กำลังบันทึก…" : "บันทึกรหัสผ่านใหม่"}</button>
    </form></> : null}
    {error ? <div className="auth-message is-error" role="alert">{error}</div> : null}
    <Link className="auth-back-link" href="/login">กลับไปเข้าสู่ระบบ</Link>
  </section></main>;
}
