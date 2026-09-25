"use client";

import { Check, KeyRound, LockKeyhole, LogOut, ShieldCheck, UserRound, UserRoundPlus, Users } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase/client";

const permissionRows = [
  ["ให้แต้ม", true, true, true],
  ["สมาชิก", true, true, false],
  ["คูปองและของรางวัล", true, true, false],
  ["ตั้งค่าระบบ", true, false, false],
] as const;

export function TeamSecuritySettings() {
  const [email, setEmail] = useState("");
  const [lastSignIn, setLastSignIn] = useState<string | null>(null);
  const [busy, setBusy] = useState<"password" | "sessions" | "logout" | "">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;
    void client.auth.getUser().then((userResult) => {
      if (!active) return;
      setEmail(userResult.data.user?.email || "");
      setLastSignIn(userResult.data.user?.last_sign_in_at || null);
    });
    return () => { active = false; };
  }, []);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = supabase;
    if (!client) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const password = String(fields.get("password") || "");
    const confirm = String(fields.get("confirm") || "");
    setError(""); setMessage("");
    if (password.length < 8) { setError("รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร"); return; }
    if (password !== confirm) { setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน"); return; }
    setBusy("password");
    const { error: updateError } = await client.auth.updateUser({ password });
    setBusy("");
    if (updateError) { setError(updateError.message); return; }
    form.reset();
    setMessage("เปลี่ยนรหัสผ่านสำเร็จ");
  }

  async function signOutOthers() {
    const client = supabase;
    if (!client) return;
    setBusy("sessions"); setError(""); setMessage("");
    const { error: signOutError } = await client.auth.signOut({ scope: "others" });
    setBusy("");
    if (signOutError) { setError(signOutError.message); return; }
    setMessage("ยกเลิกเซสชันอื่นแล้ว อุปกรณ์อื่นอาจยังใช้งานได้จน access token เดิมหมดอายุ");
  }

  async function signOutHere() {
    const client = supabase;
    if (!client) return;
    setBusy("logout"); setError("");
    const { error: signOutError } = await client.auth.signOut({ scope: "local" });
    if (signOutError) { setBusy(""); setError(signOutError.message); return; }
    window.location.assign("/login");
  }

  return <div className="team-security-page">
    <div className="team-security-intro">
      <span className="team-security-intro-icon"><ShieldCheck size={25} /></span>
      <span><strong>บัญชีทีมงานและความปลอดภัย</strong><small>ดูแลบัญชีเจ้าของร้าน และวางสิทธิ์ผู้ดูแลกับพนักงาน</small></span>
      <em>บัญชีหลัก 1 บัญชี</em>
    </div>
    <div className="team-security-grid">
      <div className="team-security-column">
        <section className="settings-card team-security-card">
          <div className="team-security-heading"><div><h2><Users size={19} /> บัญชีทีมงาน</h2><p>ขณะนี้ใช้งานบัญชีเจ้าของร้านเพียงบัญชีเดียว</p></div><span className="team-security-pending">1 บัญชี</span></div>
          <div className="team-security-owner"><span className="team-avatar">{email ? email[0].toUpperCase() : "A"}</span><span><strong>เจ้าของร้าน</strong><small>{email || "กำลังตรวจบัญชี…"}</small></span><b>ผู้ดูแลระบบ</b></div>
          <div className="team-security-add-plan"><UserRoundPlus size={19} /><span><strong>เพิ่มผู้ดูแลหรือพนักงาน</strong><small>ต้องเชื่อมบัญชีเชิญและสิทธิ์ฐานข้อมูลก่อน จึงจะเปิดให้เพิ่มบัญชีได้อย่างปลอดภัย</small></span><span className="team-security-pending">ยังไม่พร้อมใช้</span></div>
        </section>
        <section className="settings-card team-security-card">
          <div className="team-security-heading"><div><h2>สิทธิ์การใช้งานตามบทบาท</h2><p>โครงสิทธิ์ที่เตรียมไว้เมื่อมีทีมงานในอนาคต</p></div><span className="team-security-pending">ยังไม่บังคับใช้</span></div>
          <div className="team-security-permissions"><div><b>เมนู</b><b>ผู้ดูแล</b><b>ผู้จัดการ</b><b>พนักงาน</b></div>{permissionRows.map(([label, admin, manager, staff]) => <div key={label}><span>{label}</span>{[admin, manager, staff].map((allowed, index) => <span key={index}>{allowed ? <Check size={16} aria-label="มีสิทธิ์" /> : "—"}</span>)}</div>)}</div>
        </section>
      </div>
      <div className="team-security-column">
        <section className="settings-card team-security-card">
          <div className="team-security-heading"><div><h2><UserRound size={19} /> บัญชีของฉัน</h2><p>บัญชีที่กำลังเข้าสู่ระบบหลังบ้าน</p></div><span className="team-security-live">ใช้งานอยู่</span></div>
          <div className="team-security-fact"><span>อีเมล</span><strong>{email || "กำลังตรวจบัญชี…"}</strong></div>
          <div className="team-security-fact"><span>เข้าสู่ระบบล่าสุด</span><strong>{lastSignIn ? new Date(lastSignIn).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "—"}</strong></div>
        </section>
        <section className="settings-card team-security-card">
          <div className="team-security-heading"><div><h2><KeyRound size={19} /> เปลี่ยนรหัสผ่าน</h2><p>รหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร</p></div></div>
          <form className="team-security-password" onSubmit={(event) => void changePassword(event)}>
            <label>รหัสผ่านใหม่<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
            <label>ยืนยันรหัสผ่านใหม่<input name="confirm" type="password" autoComplete="new-password" minLength={8} required /></label>
            <button type="submit" disabled={busy !== ""}>{busy === "password" ? "กำลังบันทึก…" : "เปลี่ยนรหัสผ่าน"}</button>
          </form>
        </section>
        <section className="settings-card team-security-card">
          <div className="team-security-heading"><div><h2><LockKeyhole size={19} /> เซสชันและอุปกรณ์</h2><p>จัดการการเข้าสู่ระบบของบัญชีนี้</p></div></div>
          <div className="team-security-session"><span className="team-security-live-dot" /><span><strong>อุปกรณ์นี้กำลังใช้งาน</strong><small>ระบบยังไม่แสดงรายชื่ออุปกรณ์อื่นเป็นรายเครื่อง</small></span></div>
          <div className="team-security-buttons"><button type="button" onClick={() => void signOutOthers()} disabled={busy !== ""}>{busy === "sessions" ? "กำลังดำเนินการ…" : "ออกจากระบบอุปกรณ์อื่น"}</button><button type="button" className="is-quiet" onClick={() => void signOutHere()} disabled={busy !== ""}><LogOut size={16} /> {busy === "logout" ? "กำลังออก…" : "ออกจากอุปกรณ์นี้"}</button></div>
        </section>
        <section className="settings-card team-security-card team-security-next">
          <div className="team-security-heading"><div><h2>ฟังก์ชันที่จะเพิ่มภายหลัง</h2><p>MFA, แจ้งเตือนล็อกอินใหม่ และออกจากระบบอัตโนมัติ</p></div><span className="team-security-pending">ยังไม่เปิดใช้</span></div>
          <p className="team-security-help">ส่วนนี้จะไม่แสดงสวิตช์ว่า “เปิด” จนกว่าจะเชื่อมการป้องกันจริงทั้งตอนเข้าสู่ระบบและฐานข้อมูล</p>
        </section>
        {error ? <p className="team-security-message is-error" role="alert">{error}</p> : null}
        {message ? <p className="team-security-message" role="status">{message}</p> : null}
      </div>
    </div>
  </div>;
}
