"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, PawPrint, ShieldCheck } from "lucide-react";
import { CustomerPortal } from "./customer-portal";
import { CustomerBrandHeader } from "./customer-brand-header";
import { memberAuth } from "@/lib/supabase/member-client";
import { thaiPhoneToE164 } from "@/lib/line/phone";

type Member = { memberCode: string; name: string; level: string; points: number };
type Registration = { firstName: string; lastName: string; gender: string; birthDate: string; phone: string };
type State = "loading" | "form" | "member" | "phone" | "otp" | "unavailable";
const signedOutKey = "tammy-customer-signed-out";

const emptyForm: Registration = { firstName: "", lastName: "", gender: "", birthDate: "", phone: "" };

export function LineMemberRegistration({ preview }: { preview: boolean }) {
  const [richMenuView, setRichMenuView] = useState<"points" | "rewards" | "news" | null>(null);
  const [state, setState] = useState<State>(preview ? "form" : "loading");
  const [idToken, setIdToken] = useState("");
  const [otpAccessToken, setOtpAccessToken] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [form, setForm] = useState<Registration>(emptyForm);
  const [member, setMember] = useState<Member | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function restorePhoneSession(accessToken: string) {
    const response = await fetch("/api/line/member/phone", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ action: "lookup" }), cache: "no-store",
    });
    const data = await response.json() as { member?: Member; error?: string };
    if (!response.ok || !data.member) throw new Error(data.error || "ตรวจสอบสมาชิกไม่สำเร็จ");
    setOtpAccessToken(accessToken);
    setMember(data.member);
    setState("member");
  }

  useEffect(() => {
    if (preview) return;
    const requestedView = new URLSearchParams(window.location.search).get("view");
    if (requestedView === "points" || requestedView === "rewards" || requestedView === "news") setRichMenuView(requestedView);
    let active = true;
    void (async () => {
      try {
        if (localStorage.getItem(signedOutKey) === "1") {
          const session = await memberAuth?.auth.getSession();
          if (!active) return;
          const token = session?.data.session?.access_token;
          if (token) {
            try { await restorePhoneSession(token); return; }
            catch { await memberAuth?.auth.signOut(); }
          }
          setState("phone");
          return;
        }
        const configResponse = await fetch("/api/line/member/config", { cache: "no-store" });
        const config = await configResponse.json() as { liffId?: string; error?: string };
        if (!configResponse.ok || !config.liffId) throw new Error(config.error || "ร้านยังไม่เปิดใช้งานสมาชิก LINE");
        const { default: liff } = await import("@line/liff");
        await liff.init({ liffId: config.liffId, withLoginOnExternalBrowser: true });
        if (!active) return;
        if (!liff.isLoggedIn()) { liff.login({ redirectUri: `${window.location.origin}/customer${window.location.search}` }); return; }
        const token = liff.getIDToken();
        if (!token) throw new Error("กรุณาเข้าสู่ระบบ LINE อีกครั้ง");
        setIdToken(token);
        const response = await fetch("/api/line/member", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "lookup", idToken: token }),
        });
        const data = await response.json() as { registered?: boolean; member?: Member; error?: string };
        if (!active) return;
        if (!response.ok) throw new Error(data.error || "ตรวจสอบสมาชิกไม่สำเร็จ");
        if (data.registered && data.member) { setMember(data.member); setState("member"); }
        else setState("form");
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "ไม่สามารถเชื่อมต่อ LINE ได้");
        setState("unavailable");
      }
    })();
    return () => { active = false; };
  }, [preview]);

  useEffect(() => {
    if (!memberAuth) return;
    const { data } = memberAuth.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token && localStorage.getItem(signedOutKey) === "1") setOtpAccessToken(session.access_token);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function requestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !thaiPhoneToE164(phone)) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/line/member/phone", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "request", phone }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "ส่งรหัส OTP ไม่สำเร็จ");
      setState("otp");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ส่งรหัส OTP ไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !memberAuth) return;
    const e164 = thaiPhoneToE164(phone);
    if (!e164 || !/^\d{6}$/.test(otp)) return;
    setBusy(true); setError("");
    try {
      const result = await memberAuth.auth.verifyOtp({ phone: e164, token: otp, type: "sms" });
      if (result.error || !result.data.session?.access_token) throw new Error("รหัส OTP ไม่ถูกต้องหรือหมดอายุ กรุณาขอรหัสใหม่");
      await restorePhoneSession(result.data.session.access_token);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ยืนยัน OTP ไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function logout() {
    localStorage.setItem(signedOutKey, "1");
    setMember(null); setIdToken(""); setOtpAccessToken(""); setPhone(""); setOtp(""); setError("");
    setState("phone");
    await memberAuth?.auth.signOut();
    try { const { default: liff } = await import("@line/liff"); if (liff.isLoggedIn()) liff.logout(); } catch { /* The local signed-out choice still prevents automatic LINE login. */ }
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (preview || !idToken || busy) return;
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/line/member", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register", idToken, registration: { ...form, phone: form.phone.replace(/\D/g, "") } }),
      });
      const data = await response.json() as { member?: Member; error?: string };
      if (!response.ok || !data.member) throw new Error(data.error || "สมัครสมาชิกไม่สำเร็จ");
      setMember(data.member);
      setState("member");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "สมัครสมาชิกไม่สำเร็จ");
    } finally { setBusy(false); }
  }

  if (state === "member" && member) return <CustomerPortal mode="customer" initialView={richMenuView} member={member} idToken={idToken} otpAccessToken={otpAccessToken} onLogout={() => void logout()} />;

  return <main className="line-signup customer-home-page">
    <CustomerBrandHeader greeting="ยินดีต้อนรับ" />
    <div className="line-signup-shell customer-home-body">
      <div className="line-signup-welcome" aria-hidden="true">
        <div className="line-signup-welcome-copy"><span>TAMMY PET SHOP</span><strong>MEMBERSHIP</strong><small>เพื่อนซี้ที่อยู่เคียงข้างเสมอ ♡</small></div>
      </div>
      {preview && <div className="line-signup-preview">ดูหน้าจอก่อนเชื่อม LINE · ยังไม่บันทึกข้อมูล</div>}
      {state === "loading" && <section className="line-signup-panel line-signup-status" role="status"><div className="line-signup-spinner" /><h1>กำลังตรวจสอบสมาชิก</h1><p>เชื่อมต่อบัญชี LINE ของคุณสักครู่</p></section>}
      {state === "unavailable" && <section className="line-signup-panel line-signup-status" role="alert"><div className="line-signup-icon"><PawPrint /></div><h1>ยังเปิดหน้านี้ไม่ได้</h1><p>{error}</p></section>}
      {state === "phone" && <><div className="line-signup-intro"><span className="line-signup-eyebrow">เข้าสู่ระบบสมาชิก</span><h1>ยินดีต้อนรับกลับมา</h1><p>กรอกเบอร์โทรที่สมัครสมาชิกไว้ เราจะส่งรหัส OTP เพื่อยืนยันตัวตน</p></div><section className="line-signup-panel"><form className="line-signup-form" onSubmit={requestOtp}><label>เบอร์โทรศัพท์<input type="tel" inputMode="numeric" autoComplete="tel" required pattern="0[0-9]{9}" maxLength={10} value={phone} onChange={event => setPhone(event.target.value.replace(/\D/g, ""))} placeholder="0XXXXXXXXX" /></label>{error && <p className="line-signup-error" role="alert">{error}</p>}<button type="submit" disabled={busy}>{busy ? "กำลังส่งรหัส…" : "ส่งรหัส OTP"}<ArrowRight size={18} /></button><p className="line-signup-privacy"><ShieldCheck size={16} /> ส่งรหัสเฉพาะเบอร์สมาชิกที่ร้านมีข้อมูลอยู่แล้ว</p></form></section></>}
      {state === "otp" && <><div className="line-signup-intro"><span className="line-signup-eyebrow">ยืนยันเบอร์โทร</span><h1>ใส่รหัส OTP</h1><p>หาก {phone} เป็นเบอร์สมาชิก ระบบจะส่งรหัสทาง SMS</p></div><section className="line-signup-panel"><form className="line-signup-form" onSubmit={verifyOtp}><label>รหัส 6 หลัก<input type="text" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, ""))} placeholder="000000" /></label>{error && <p className="line-signup-error" role="alert">{error}</p>}<button type="submit" disabled={busy}>{busy ? "กำลังยืนยัน…" : "ยืนยันและเข้าสู่ระบบ"}<ArrowRight size={18} /></button><button type="button" className="line-signup-text-button" onClick={() => { setOtp(""); setError(""); setState("phone"); }}>เปลี่ยนเบอร์โทรหรือขอรหัสใหม่</button></form></section></>}
      {state === "form" && <>
        <div className="line-signup-intro"><span className="line-signup-eyebrow">ยินดีต้อนรับสมาชิกใหม่</span><h1>สมัครสมาชิกกับแทมมี่</h1><p>กรอกข้อมูลเพียงครั้งเดียว แล้วกลับมาเช็กแต้มผ่าน LINE ได้เลย</p></div>
        <section className="line-signup-panel">
          <div className="line-signup-step"><span>01</span><div><strong>ข้อมูลสมาชิก</strong><small>ใช้สำหรับสะสมแต้มและสิทธิพิเศษของคุณ</small></div></div>
          <form onSubmit={register} className="line-signup-form">
            <div className="line-signup-row"><label>ชื่อจริง <span>*</span><input autoComplete="given-name" required maxLength={80} value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} placeholder="ชื่อจริง" /></label><label>นามสกุล <span>*</span><input autoComplete="family-name" required maxLength={80} value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} placeholder="นามสกุล" /></label></div>
            <label>เพศ <span>*</span><select required value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}><option value="">เลือกเพศ</option><option value="female">หญิง</option><option value="male">ชาย</option><option value="other">อื่น ๆ</option><option value="prefer_not_to_say">ไม่ประสงค์ระบุ</option></select></label>
            <label>วันเกิด <span>*</span><input type="date" required min="1900-01-01" max={new Date().toISOString().slice(0, 10)} value={form.birthDate} onChange={e => setForm({ ...form, birthDate: e.target.value })} /></label>
            <label>เบอร์โทรศัพท์ <span>*</span><input type="tel" autoComplete="tel" inputMode="numeric" required pattern="0[0-9]{9}" maxLength={10} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })} placeholder="0XXXXXXXXX" /><small>ใช้ตรวจสอบข้อมูลสมาชิก หากมีบัญชีเดิมอยู่แล้วร้านจะช่วยผูกบัญชีให้</small></label>
            {error && <p className="line-signup-error" role="alert">{error}</p>}
            <button type="submit" disabled={preview || busy}>{busy ? "กำลังสมัครสมาชิก…" : preview ? "สมัครสมาชิก (รอเชื่อม LINE)" : "สมัครสมาชิก"}<ArrowRight size={18} /></button>
            <p className="line-signup-privacy"><ShieldCheck size={16} /> ข้อมูลของคุณใช้สำหรับสมาชิก Tammy Pet Shop เท่านั้น</p>
          </form>
        </section>
      </>}
    </div>
  </main>;
}
