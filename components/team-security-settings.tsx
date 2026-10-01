"use client";

import { Check, KeyRound, LockKeyhole, LogOut, Mail, MonitorSmartphone, Plus, RefreshCw, ShieldCheck, Trash2, UserRound, UserRoundPlus, Users } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase/client";
import { googleProviderEnabled } from "@/lib/supabase/google-provider";
import { crmOwnerId, verifiedCrmUser } from "@/lib/supabase/crm-data";
import { cachedAdminExtras } from "@/lib/supabase/admin-preload";

type TeamAccount = { id: string; name: string; email: string; role: "manager" | "staff"; active: boolean; user_id: string | null };
type DeviceSession = { id: string; created_at: string; last_seen_at: string; user_agent: string | null; ip: string | null; is_current: boolean };

function sessionDevice(userAgent: string | null) {
  const value = userAgent || "";
  const browser = /Edg\//.test(value) ? "Edge" : /Firefox\//.test(value) ? "Firefox" : /Chrome\//.test(value) ? "Chrome" : /Safari\//.test(value) ? "Safari" : "เบราว์เซอร์ไม่ทราบชนิด";
  const platform = /iPhone/.test(value) ? "iPhone" : /iPad/.test(value) ? "iPad" : /Android/.test(value) ? "Android" : /Windows/.test(value) ? "Windows" : /Macintosh|Mac OS X/.test(value) ? "Mac" : /Linux/.test(value) ? "Linux" : "อุปกรณ์ไม่ทราบชนิด";
  return `${browser} · ${platform}`;
}

function sessionDate(value: string) {
  return new Date(value).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

const permissionRows = [
  ["ให้แต้ม", true, true, true],
  ["สมาชิก", true, true, false],
  ["คูปองและของรางวัล", true, true, false],
  ["ตั้งค่าร้าน", true, true, false],
  ["บัญชีและรหัสผ่านของตัวเอง", true, true, true],
  ["จัดการทีมงาน", true, false, false],
] as const;

export function TeamSecuritySettings({ ownerMode }: { ownerMode: boolean }) {
  const preloaded = cachedAdminExtras(verifiedCrmUser() || "", crmOwnerId() || "");
  const [email, setEmail] = useState("");
  const [lastSignIn, setLastSignIn] = useState<string | null>(null);
  const [googleLinked, setGoogleLinked] = useState(false);
  const [googleStatus, setGoogleStatus] = useState<"checking" | "enabled" | "disabled" | "unavailable">("checking");
  const [busy, setBusy] = useState<"password" | "sessions" | "logout" | "google" | "">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sessions, setSessions] = useState<DeviceSession[]>(() => preloaded?.sessions as DeviceSession[] ?? []);
  const [sessionsLoading, setSessionsLoading] = useState(() => !preloaded?.sessions);
  const [sessionBusy, setSessionBusy] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [team, setTeam] = useState<TeamAccount[]>(() => ownerMode ? preloaded?.team as TeamAccount[] ?? [] : []);
  const [teamLoading, setTeamLoading] = useState(() => ownerMode && !preloaded?.team);
  const [teamReady, setTeamReady] = useState(() => ownerMode && Boolean(preloaded?.team));
  const [teamBusy, setTeamBusy] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<TeamAccount["role"]>("staff");
  const [teamMessage, setTeamMessage] = useState("");
  const [teamError, setTeamError] = useState("");

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;
    void client.auth.getUser().then((userResult) => {
      if (!active) return;
      setEmail(userResult.data.user?.email || "");
      setLastSignIn(userResult.data.user?.last_sign_in_at || null);
      setGoogleLinked(Boolean(userResult.data.user?.identities?.some((identity) => identity.provider === "google")));
    });
    void googleProviderEnabled().then((enabled) => { if (active) setGoogleStatus(enabled ? "enabled" : "disabled"); }).catch(() => { if (active) setGoogleStatus("unavailable"); });
    void client.rpc("crm_my_sessions").then(({ data, error: loadError }) => {
      if (!active) return;
      if (loadError) setSessionError("ยังอ่านรายชื่ออุปกรณ์ไม่ได้ กรุณาตรวจว่าติดตั้ง migration ล่าสุดแล้ว");
      else setSessions((data || []) as DeviceSession[]);
      setSessionsLoading(false);
    });
    const ownerId = crmOwnerId();
    if (ownerMode && ownerId) void client.from("team_accounts").select("id,name,email,role,active,user_id").eq("owner_id", ownerId).order("created_at").then(({ data, error: loadError }) => {
      if (!active) return;
      if (loadError) setTeamError("ยังเปิดใช้บัญชีทีมงานไม่ได้: ต้องติดตั้ง migration ทีมงานใน Supabase ก่อน");
      else { setTeam((data || []) as TeamAccount[]); setTeamReady(true); }
      setTeamLoading(false);
    });
    else setTeamLoading(false);
    return () => { active = false; };
  }, [ownerMode]);

  async function reloadTeam() {
    const ownerId = crmOwnerId();
    if (!supabase || !ownerId) return;
    const { data, error: loadError } = await supabase.from("team_accounts").select("id,name,email,role,active,user_id").eq("owner_id", ownerId).order("created_at");
    if (loadError) setTeamError(loadError.message);
    else setTeam((data || []) as TeamAccount[]);
  }

  async function sendTeamLink(account: Pick<TeamAccount, "email">) {
    if (!supabase) return;
    setTeamBusy(account.email); setTeamError(""); setTeamMessage("");
    const redirect = new URL("/login", window.location.origin);
    redirect.searchParams.set("next", "/settings?tab=team");
    const { error: sendError } = await supabase.auth.signInWithOtp({ email: account.email, options: { shouldCreateUser: true, emailRedirectTo: redirect.toString() } });
    setTeamBusy("");
    if (sendError) setTeamError(`บัญชีถูกเพิ่มแล้ว แต่ส่งลิงก์ไม่สำเร็จ: ${sendError.message}`);
    else setTeamMessage(`ส่งลิงก์ให้ ${account.email} แล้ว เมื่อเปิดลิงก์ ให้ตั้งรหัสผ่านในหน้า “บัญชีของฉัน”`);
  }

  async function sendPasswordLink(account: TeamAccount) {
    if (!supabase) return;
    setTeamBusy(account.id); setTeamError(""); setTeamMessage("");
    const { error: sendError } = await supabase.auth.resetPasswordForEmail(account.email, { redirectTo: `${window.location.origin}/reset-password` });
    setTeamBusy("");
    if (sendError) setTeamError(sendError.status === 429 ? "กดส่งลิงก์ถี่เกินไป กรุณารอประมาณ 1 นาที แล้วค่อยลองอีกครั้ง" : `ส่งลิงก์ตั้งรหัสผ่านไม่สำเร็จ: ${sendError.message}`);
    else setTeamMessage(`ส่งลิงก์ตั้งรหัสผ่านไปที่ ${account.email} แล้ว`);
  }

  async function addTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ownerId = crmOwnerId();
    if (!supabase || !ownerId || !teamReady) { setTeamError("ยังไม่พร้อมเพิ่มบัญชีทีมงาน กรุณาติดตั้ง migration ใน Supabase ก่อน"); return; }
    const form = event.currentTarget;
    const fields = new FormData(form);
    const name = String(fields.get("name") || "").trim();
    const teamEmail = String(fields.get("email") || "").trim().toLowerCase();
    const role = inviteRole;
    if (!name || !teamEmail || teamEmail === email.toLowerCase()) { setTeamError("กรุณาใส่ชื่อและอีเมลทีมงานที่ไม่ใช่บัญชีเจ้าของร้าน"); return; }
    setTeamBusy("adding"); setTeamError(""); setTeamMessage("");
    const { error: insertError } = await supabase.from("team_accounts").insert({ owner_id: ownerId, name, email: teamEmail, role }).select("id").single();
    setTeamBusy("");
    if (insertError) { setTeamError(`เพิ่มบัญชีไม่สำเร็จ: ${insertError.message}`); return; }
    form.reset(); setInviteRole("staff"); setInviteOpen(false);
    await reloadTeam();
    await sendTeamLink({ email: teamEmail });
  }

  async function changeTeam(id: string, changes: Partial<Pick<TeamAccount, "role" | "active">>) {
    if (!supabase) return;
    setTeamBusy(id); setTeamError(""); setTeamMessage("");
    const { error: updateError } = await supabase.from("team_accounts").update(changes).eq("id", id).select("id").single();
    setTeamBusy("");
    if (updateError) { setTeamError(updateError.message); return; }
    setTeam((current) => current.map((account) => account.id === id ? { ...account, ...changes } : account));
    setTeamMessage("อัปเดตสิทธิ์ทีมงานแล้ว");
  }

  async function removeTeam(account: TeamAccount) {
    if (!supabase || !window.confirm(`ยกเลิกสิทธิ์ของ ${account.email} ใช่ไหม?`)) return;
    setTeamBusy(account.id); setTeamError(""); setTeamMessage("");
    const { error: deleteError } = await supabase.from("team_accounts").delete().eq("id", account.id);
    setTeamBusy("");
    if (deleteError) { setTeamError(deleteError.message); return; }
    setTeam((current) => current.filter((entry) => entry.id !== account.id));
    setTeamMessage("ยกเลิกสิทธิ์บัญชีนี้แล้ว บัญชี Auth ยังคงอยู่แต่เข้าใช้งานร้านไม่ได้");
  }

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

  async function refreshSessions() {
    const client = supabase;
    if (!client) return;
    setSessionsLoading(true); setSessionError("");
    const { data, error: loadError } = await client.rpc("crm_my_sessions");
    if (loadError) setSessionError("โหลดรายชื่ออุปกรณ์ไม่สำเร็จ กรุณาลองอีกครั้ง");
    else setSessions((data || []) as DeviceSession[]);
    setSessionsLoading(false);
  }

  async function revokeSession(session: DeviceSession) {
    const client = supabase;
    if (!client || session.is_current || !window.confirm(`ออกจากระบบเฉพาะ ${sessionDevice(session.user_agent)} ที่เข้าใช้เมื่อ ${sessionDate(session.created_at)} ใช่ไหม?`)) return;
    setSessionBusy(session.id); setSessionError(""); setMessage("");
    const { data, error: revokeError } = await client.rpc("crm_revoke_my_session", { target_id: session.id });
    setSessionBusy("");
    if (revokeError || !data) { setSessionError("ออกจากอุปกรณ์นี้ไม่สำเร็จ อาจมีการออกจากระบบไปแล้ว กรุณารีเฟรชรายการ"); return; }
    setSessions((current) => current.filter((item) => item.id !== session.id));
    setMessage("ระงับเซสชันที่เลือกแล้ว อุปกรณ์นั้นอาจยังใช้งานได้จน access token เดิมหมดอายุ");
  }

  async function signOutHere() {
    const client = supabase;
    if (!client) return;
    setBusy("logout"); setError("");
    const { error: signOutError } = await client.auth.signOut({ scope: "local" });
    if (signOutError) { setBusy(""); setError(signOutError.message); return; }
    window.location.assign("/login");
  }

  async function linkGoogle() {
    const client = supabase;
    if (!client) return;
    setBusy("google"); setError(""); setMessage("");
    try {
      if (!await googleProviderEnabled()) {
        setGoogleStatus("disabled");
        setError("ยังเชื่อม Google ไม่ได้: ต้องเปิด Google provider ใน Supabase ก่อน");
        setBusy("");
        return;
      }
    } catch {
      setGoogleStatus("unavailable");
      setError("ตรวจสอบสถานะ Google ไม่สำเร็จ กรุณาลองใหม่ภายหลัง");
      setBusy("");
      return;
    }
    const { error: linkError } = await client.auth.linkIdentity({ provider: "google", options: { redirectTo: `${window.location.origin}/settings` } });
    if (linkError) { setError(linkError.message.toLowerCase().includes("manual linking") ? "เชื่อม Google ไม่สำเร็จ: ต้องเปิด Manual Linking ใน Supabase Authentication ก่อน" : `เชื่อม Google ไม่สำเร็จ: ${linkError.message}`); setBusy(""); }
  }

  return <div className={`team-security-page${ownerMode ? "" : " is-personal"}`}>
    <div className="team-security-intro">
      <span className="team-security-intro-icon"><ShieldCheck size={25} /></span>
      <span><strong>{ownerMode ? "บัญชีทีมงานและความปลอดภัย" : "บัญชีของฉันและความปลอดภัย"}</strong><small>{ownerMode ? "เจ้าของร้านเพิ่มทีมงาน กำหนดสิทธิ์ และจัดการบัญชี" : "ดูข้อมูลบัญชี ตั้งรหัสผ่าน และจัดการการเข้าสู่ระบบ"}</small></span>
      {ownerMode ? <em>{team.length + 1} บัญชี</em> : null}
    </div>
    <div className="team-security-grid">
      {ownerMode ? <div className="team-security-column">
        <section className="settings-card team-security-card">
          <div className="team-security-heading"><div><h2><Users size={19} /> บัญชีทีมงาน</h2><p>เจ้าของร้านเป็นผู้เพิ่มบัญชีและกำหนดสิทธิ์เท่านั้น</p></div><span className="team-security-pending">{team.length + 1} บัญชี</span></div>
          <div className="team-security-owner"><span className="team-avatar">{email ? email[0].toUpperCase() : "A"}</span><span><strong>เจ้าของร้าน</strong><small>{email || "กำลังตรวจบัญชี…"}</small></span><b>ผู้ดูแลระบบ</b></div>
          {teamLoading ? <p className="team-security-team-note">กำลังโหลดบัญชีทีมงาน…</p> : team.map((account) => <div className="team-security-person" key={account.id}>
            <div className="team-security-person-main"><span className="team-avatar">{account.name[0]}</span><span className="team-security-person-name"><strong>{account.name}</strong><small>{account.email}</small></span><span className={account.active ? "team-security-status is-on" : "team-security-status"}>{account.active ? account.user_id ? "เข้าใช้งานแล้ว" : "รอเปิดลิงก์" : "ปิดใช้งาน"}</span></div>
            <div className="team-security-person-actions"><span className="team-security-action-label">บทบาท</span><div className="team-security-role-choice" role="group" aria-label={`บทบาทของ ${account.name}`}><button type="button" className={account.role === "staff" ? "is-selected" : ""} aria-pressed={account.role === "staff"} disabled={teamBusy !== ""} onClick={() => void changeTeam(account.id, { role: "staff" })}>พนักงานให้แต้ม</button><button type="button" className={account.role === "manager" ? "is-selected" : ""} aria-pressed={account.role === "manager"} disabled={teamBusy !== ""} onClick={() => void changeTeam(account.id, { role: "manager" })}>ผู้ดูแลร้าน</button></div><label className="team-security-active"><input type="checkbox" checked={account.active} disabled={teamBusy !== ""} onChange={() => void changeTeam(account.id, { active: !account.active })} /><span>เปิดใช้งาน</span></label><div className="team-security-icon-actions"><button type="button" title="ส่งลิงก์เข้าสู่ระบบ" aria-label={`ส่งลิงก์เข้าสู่ระบบให้ ${account.email}`} disabled={teamBusy !== ""} onClick={() => void sendTeamLink(account)}><Mail size={16} /></button>{account.user_id ? <button type="button" className="team-security-password-link" aria-label={`ส่งลิงก์ตั้งรหัสผ่านให้ ${account.email}`} disabled={teamBusy !== ""} onClick={() => void sendPasswordLink(account)}><KeyRound size={16} /><span>ตั้งรหัสผ่าน</span></button> : null}<button type="button" title="ลบสิทธิ์" aria-label={`ลบสิทธิ์ ${account.email}`} disabled={teamBusy !== ""} onClick={() => void removeTeam(account)}><Trash2 size={16} /></button></div></div>
          </div>)}
          <button className="team-security-add-plan" type="button" disabled={!teamReady || teamLoading} onClick={() => setInviteOpen((current) => !current)}><UserRoundPlus size={19} /><span><strong>เพิ่มบัญชีทีมงาน</strong><small>{teamReady ? "กรอกชื่อ อีเมล และสิทธิ์ จากนั้นทีมงานจะได้รับลิงก์เข้าระบบ" : "รอติดตั้งสิทธิ์ทีมงานในฐานข้อมูลก่อน"}</small></span><Plus size={18} /></button>
          {inviteOpen ? <form className="team-security-invite" onSubmit={(event) => void addTeam(event)}><div className="team-security-invite-title"><strong>ข้อมูลทีมงานใหม่</strong><small>เพิ่มได้โดยเจ้าของร้านเท่านั้น</small></div><label>ชื่อทีมงาน<input name="name" maxLength={120} required placeholder="ชื่อที่ใช้แสดงในระบบ" /></label><label>อีเมล<input name="email" type="email" required placeholder="name@example.com" /></label><div className="team-security-invite-role"><span>สิทธิ์การใช้งาน</span><div className="team-security-role-choice" role="group" aria-label="สิทธิ์ของทีมงานใหม่"><button type="button" className={inviteRole === "staff" ? "is-selected" : ""} aria-pressed={inviteRole === "staff"} onClick={() => setInviteRole("staff")}>พนักงานให้แต้ม</button><button type="button" className={inviteRole === "manager" ? "is-selected" : ""} aria-pressed={inviteRole === "manager"} onClick={() => setInviteRole("manager")}>ผู้ดูแลร้าน</button></div></div><button className="team-security-invite-submit" type="submit" disabled={teamBusy !== ""}>{teamBusy === "adding" ? "กำลังเพิ่ม…" : "เพิ่มบัญชีและส่งลิงก์"}</button></form> : null}
          {teamError ? <p className="team-security-message is-error" role="alert">{teamError}</p> : null}
          {teamMessage ? <p className="team-security-message" role="status">{teamMessage}</p> : null}
        </section>
        <section className="settings-card team-security-card">
          <div className="team-security-heading"><div><h2>สิทธิ์การใช้งานตามบทบาท</h2><p>{teamReady ? "บังคับใช้ทั้งในหน้าเว็บและฐานข้อมูล" : "รอติดตั้งนโยบายสิทธิ์ในฐานข้อมูล"}</p></div><span className={teamReady ? "team-security-live" : "team-security-pending"}>{teamReady ? "ใช้งานจริง" : "ยังไม่เปิดใช้"}</span></div>
          <div className="team-security-permissions"><div><b>เมนู</b><b>เจ้าของร้าน</b><b>ผู้ดูแล</b><b>พนักงาน</b></div>{permissionRows.map(([label, admin, manager, staff]) => <div key={label}><span>{label}</span>{[admin, manager, staff].map((allowed, index) => <span key={index}>{allowed ? <Check size={16} aria-label="มีสิทธิ์" /> : "—"}</span>)}</div>)}</div>
        </section>
      </div> : null}
      <div className="team-security-column">
        <section className="settings-card team-security-card">
          <div className="team-security-heading"><div><h2><UserRound size={19} /> บัญชีของฉัน</h2><p>บัญชีที่กำลังเข้าสู่ระบบหลังบ้าน</p></div><span className="team-security-live">ใช้งานอยู่</span></div>
          <div className="team-security-fact"><span>อีเมล</span><strong>{email || "กำลังตรวจบัญชี…"}</strong></div>
          <div className="team-security-fact"><span>เข้าสู่ระบบล่าสุด</span><strong>{lastSignIn ? new Date(lastSignIn).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "—"}</strong></div>
          <div className="team-security-fact"><span>Google</span><strong>{googleLinked ? "เชื่อมกับบัญชีนี้แล้ว" : "ยังไม่เชื่อม"}</strong></div>
          {!googleLinked ? <div className="team-security-google"><p>{googleStatus === "disabled" ? "ยังเชื่อมไม่ได้: ต้องเปิด Google provider ใน Supabase ก่อน" : googleStatus === "unavailable" ? "ตรวจสอบสถานะ Google ไม่สำเร็จ กรุณารีเฟรชหน้านี้" : "เชื่อม Google กับบัญชีนี้เพื่อใช้สิทธิ์เดิมได้ (ต้องเปิด Manual Linking ใน Supabase)"}</p><button type="button" onClick={() => void linkGoogle()} disabled={busy !== "" || googleStatus !== "enabled"}>{busy === "google" ? "กำลังเชื่อม…" : "เชื่อมบัญชี Google"}</button></div> : null}
        </section>
        <section className="settings-card team-security-card">
          <div className="team-security-heading"><div><h2><KeyRound size={19} /> ตั้งหรือเปลี่ยนรหัสผ่าน</h2><p>หลังเปิดลิงก์จากอีเมลครั้งแรก ตั้งรหัสผ่านที่นี่เพื่อใช้เข้าสู่ระบบครั้งต่อไป</p></div></div>
          <form className="team-security-password" onSubmit={(event) => void changePassword(event)}>
            <label>รหัสผ่านใหม่<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
            <label>ยืนยันรหัสผ่านใหม่<input name="confirm" type="password" autoComplete="new-password" minLength={8} required /></label>
            <button type="submit" disabled={busy !== ""}>{busy === "password" ? "กำลังบันทึก…" : "เปลี่ยนรหัสผ่าน"}</button>
          </form>
        </section>
        <section className="settings-card team-security-card">
          <div className="team-security-heading"><div><h2><LockKeyhole size={19} /> เซสชันและอุปกรณ์</h2><p>ดูการเข้าสู่ระบบของบัญชีนี้ และออกเฉพาะอุปกรณ์ที่เลือก</p></div><button className="team-security-refresh" type="button" onClick={() => void refreshSessions()} disabled={sessionsLoading || !!sessionBusy}><RefreshCw size={15} /> รีเฟรช</button></div>
          {sessionsLoading && sessions.length === 0 ? <p className="team-security-help">กำลังโหลดอุปกรณ์…</p> : null}
          {sessionError ? <p className="team-security-message is-error" role="alert">{sessionError}</p> : null}
          {sessions.length ? <details className="team-security-session-details"><summary><span className="team-security-session-summary-icon"><MonitorSmartphone size={19} /></span><span><strong>อุปกรณ์ที่เข้าสู่ระบบ {sessions.length} รายการ</strong><small>{sessions.find((session) => session.is_current) ? `เครื่องนี้: ${sessionDevice(sessions.find((session) => session.is_current)!.user_agent)}` : "กดเพื่อดูและจัดการทีละอุปกรณ์"}</small></span><span className="team-security-session-summary-action">ดูรายละเอียด</span></summary><div className="team-security-session-list">{sessions.map((session) => <div className={`team-security-device${session.is_current ? " is-current" : ""}`} key={session.id}><span className="team-security-device-icon"><MonitorSmartphone size={19} /></span><span className="team-security-device-info"><strong>{sessionDevice(session.user_agent)}</strong><small>ใช้งานล่าสุด {sessionDate(session.last_seen_at)} · เข้าสู่ระบบ {sessionDate(session.created_at)}</small>{session.ip ? <small>IP {session.ip}</small> : null}</span>{session.is_current ? <span className="team-security-current"><span className="team-security-live-dot" /> อุปกรณ์นี้</span> : <button type="button" onClick={() => void revokeSession(session)} disabled={!!sessionBusy || busy !== ""}>{sessionBusy === session.id ? "กำลังออก…" : "ออกจากอุปกรณ์นี้"}</button>}</div>)}</div><p className="team-security-session-note">ชื่ออุปกรณ์ประเมินจากเบราว์เซอร์ อาจไม่ใช่ชื่อเครื่องจริง · หลังออกจากระบบ access token เดิมอาจใช้ได้จนหมดอายุ</p><div className="team-security-buttons"><button type="button" className="is-quiet" onClick={() => void signOutHere()} disabled={busy !== "" || !!sessionBusy}><LogOut size={16} /> {busy === "logout" ? "กำลังออก…" : "ออกจากอุปกรณ์นี้ (เครื่องปัจจุบัน)"}</button></div></details> : null}
          {!sessionsLoading && !sessionError && sessions.length === 0 ? <p className="team-security-help">ไม่พบเซสชันที่กำลังใช้งาน</p> : null}
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
