"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, PawPrint, ShieldCheck } from "lucide-react";
import { CustomerPortal } from "./customer-portal";
import { CustomerBrandHeader } from "./customer-brand-header";

type Member = { memberCode: string; name: string; level: string; points: number };
type Registration = { firstName: string; lastName: string; gender: string; birthDate: string; phone: string };
type State = "loading" | "form" | "member" | "login" | "unavailable";
type PreviewScreen = "register" | "login";
const signedOutKey = "tammy-customer-signed-out";

const emptyForm: Registration = { firstName: "", lastName: "", gender: "", birthDate: "", phone: "" };

export function LineMemberRegistration({ preview, previewScreen = "register" }: { preview: boolean; previewScreen?: PreviewScreen }) {
  const [richMenuView, setRichMenuView] = useState<"points" | "rewards" | "news" | null>(null);
  const [state, setState] = useState<State>(preview ? previewScreen === "login" ? "login" : "form" : "loading");
  const [idToken, setIdToken] = useState("");
  const [form, setForm] = useState<Registration>(emptyForm);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [member, setMember] = useState<Member | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (preview) return;
    const query = new URLSearchParams(window.location.search);
    const requestedScreen = query.get("screen");
    let active = true;
    void (async () => {
      try {
        if (requestedScreen === "login" || localStorage.getItem(signedOutKey) === "1") {
          setState("login");
          return;
        }
        const configResponse = await fetch("/api/line/member/config", { cache: "no-store" });
        const config = await configResponse.json() as { liffId?: string; error?: string };
        if (!configResponse.ok || !config.liffId) throw new Error(config.error || "ร้านยังไม่เปิดใช้งานสมาชิก LINE");
        const { default: liff } = await import("@line/liff");
        await liff.init({ liffId: config.liffId, withLoginOnExternalBrowser: true });
        if (!active) return;
        // LIFF restores rich-menu query parameters only after initialization.
        const finalQuery = new URLSearchParams(window.location.search);
        const finalScreen = finalQuery.get("screen");
        const finalView = finalQuery.get("view");
        const portalView = finalScreen === "news" || finalScreen === "rewards" ? finalScreen : finalView;
        if (portalView === "points" || portalView === "rewards" || portalView === "news") setRichMenuView(portalView);
        if (!liff.isLoggedIn()) {
          const validScreen = finalScreen === "register" || finalScreen === "home" || finalScreen === "news" || finalScreen === "rewards";
          const validView = finalView === "points" || finalView === "rewards" || finalView === "news";
          const menuQuery = validScreen ? `?screen=${finalScreen}` : validView ? `?view=${finalView}` : "";
          liff.login({ redirectUri: `${window.location.origin}/customer-preview${menuQuery}` });
          return;
        }
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

  function loginWithLine() {
    if (preview) { setMember({ memberCode: "TM-PREVIEW", name: "แอดมิน", level: "Gold", points: 90 }); setState("member"); return; }
    localStorage.removeItem(signedOutKey);
    window.location.assign("/customer-preview");
  }

  async function logout() {
    localStorage.setItem(signedOutKey, "1");
    setMember(null); setIdToken(""); setError("");
    setState("login");
    try { const { default: liff } = await import("@line/liff"); if (liff.isLoggedIn()) liff.logout(); } catch { /* The local signed-out choice still prevents automatic LINE login. */ }
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!termsAccepted) return;
    if (preview) { setMember({ memberCode: "TM-PREVIEW", name: "แอดมิน", level: "Gold", points: 90 }); setState("member"); return; }
    if (!idToken || busy) return;
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/line/member", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register", idToken, registration: { ...form, phone: form.phone.replace(/\D/g, ""), termsAccepted } }),
      });
      const data = await response.json() as { member?: Member; error?: string };
      if (!response.ok || !data.member) throw new Error(data.error || "สมัครสมาชิกไม่สำเร็จ");
      setMember(data.member);
      setState("member");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "สมัครสมาชิกไม่สำเร็จ");
    } finally { setBusy(false); }
  }

  if (state === "member" && member) return preview ? <CustomerPortal mode="preview" /> : <CustomerPortal mode="customer" initialView={richMenuView} member={member} idToken={idToken} onLogout={() => void logout()} />;

  return <main className="line-signup customer-home-page">
    <CustomerBrandHeader greeting="ยินดีต้อนรับ" />
    <div className="line-signup-shell customer-home-body">
      <div className="line-signup-welcome" aria-hidden="true">
        <div className="line-signup-welcome-copy"><span>TAMMY PET SHOP</span><strong>MEMBERSHIP</strong><small>เพื่อนซี้ที่อยู่เคียงข้างเสมอ ♡</small></div>
      </div>
      {preview && <div className="line-signup-preview">ดูหน้าจอก่อนเชื่อม LINE · ยังไม่บันทึกข้อมูล</div>}
      {state === "loading" && <section className="line-signup-panel line-signup-status" role="status"><div className="line-signup-spinner" /><h1>กำลังตรวจสอบสมาชิก</h1><p>เชื่อมต่อบัญชี LINE ของคุณสักครู่</p></section>}
      {state === "unavailable" && <section className="line-signup-panel line-signup-status" role="alert"><div className="line-signup-icon"><PawPrint /></div><h1>ยังเปิดหน้านี้ไม่ได้</h1><p>{error}</p></section>}
      {state === "login" && <><div className="line-signup-intro"><span className="line-signup-eyebrow">เข้าสู่ระบบสมาชิก</span><h1>ยินดีต้อนรับกลับมา</h1><p>เข้าสู่ระบบด้วยบัญชี LINE ที่ใช้สมัครสมาชิก ไม่ต้องใช้รหัสผ่านหรือ SMS</p></div><section className="line-signup-panel"><div className="line-signup-form"><button type="button" onClick={loginWithLine}>เข้าสู่ระบบด้วย LINE<ArrowRight size={18} /></button><p className="line-signup-privacy"><ShieldCheck size={16} /> ข้อมูลสมาชิกของคุณผูกกับบัญชี LINE เดิม</p></div></section></>}
      {state === "form" && <>
        <div className="line-signup-intro"><span className="line-signup-eyebrow">ยินดีต้อนรับสมาชิกใหม่</span><h1>สมัครสมาชิกกับแทมมี่</h1><p>กรอกข้อมูลเพียงครั้งเดียว แล้วกลับมาเช็กแต้มผ่าน LINE ได้เลย</p></div>
        <section className="line-signup-panel">
          <div className="line-signup-step"><span>01</span><div><strong>ข้อมูลสมาชิก</strong><small>ใช้สำหรับสะสมแต้มและสิทธิพิเศษของคุณ</small></div></div>
          <form onSubmit={register} className="line-signup-form">
            <div className="line-signup-row"><label>ชื่อจริง <span>*</span><input autoComplete="given-name" required maxLength={80} value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} placeholder="ชื่อจริง" /></label><label>นามสกุล <span>*</span><input autoComplete="family-name" required maxLength={80} value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} placeholder="นามสกุล" /></label></div>
            <label>เพศ <span>*</span><select required value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}><option value="">เลือกเพศ</option><option value="female">หญิง</option><option value="male">ชาย</option><option value="other">อื่น ๆ</option><option value="prefer_not_to_say">ไม่ประสงค์ระบุ</option></select></label>
            <label>วันเกิด <span>*</span><input type="date" required min="1900-01-01" max={new Date().toISOString().slice(0, 10)} value={form.birthDate} onChange={e => setForm({ ...form, birthDate: e.target.value })} /></label>
            <label>เบอร์โทรศัพท์ <span>*</span><input type="tel" autoComplete="tel" inputMode="numeric" required pattern="0[0-9]{9}" maxLength={10} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })} placeholder="0XXXXXXXXX" /><small>ใช้ตรวจสอบข้อมูลสมาชิก หากมีบัญชีเดิมอยู่แล้วร้านจะช่วยผูกบัญชีให้</small></label>
            <details className="line-signup-terms"><summary>อ่านเงื่อนไขสมาชิก</summary><p>ร้านใช้ชื่อ วันเกิด เบอร์โทร และบัญชี LINE เพื่อสมัครสมาชิก สะสมแต้ม และแสดงสิทธิพิเศษของ Tammy Pet Shop การสมัครทำได้ครั้งเดียวต่อบัญชี LINE และเบอร์โทรหนึ่งเบอร์ใช้กับสมาชิกหนึ่งราย</p></details>
            <label className="line-signup-consent"><input type="checkbox" required checked={termsAccepted} onChange={event => setTermsAccepted(event.target.checked)} /><span>ฉันอ่านและยอมรับเงื่อนไขสมาชิก</span></label>
            {error && <p className="line-signup-error" role="alert">{error}</p>}
            <button type="submit" disabled={busy}>{busy ? "กำลังสมัครสมาชิก…" : "สมัครสมาชิก"}<ArrowRight size={18} /></button>
            <p className="line-signup-privacy"><ShieldCheck size={16} /> ข้อมูลของคุณใช้สำหรับสมาชิก Tammy Pet Shop เท่านั้น</p>
          </form>
        </section>
      </>}
    </div>
  </main>;
}
