"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, PawPrint } from "lucide-react";
import { CustomerPortal } from "./customer-portal";
import Image from "next/image";

type Member = { memberCode: string; name: string; level: string; points: number; linePictureUrl?: string | null };
type Registration = { firstName: string; lastName: string; gender: string; birthDate: string; phone: string };
type State = "entry" | "loading" | "form" | "member" | "login" | "unavailable";
type PreviewScreen = "register" | "login";
const signedOutKey = "tammy-customer-signed-out";

const emptyForm: Registration = { firstName: "", lastName: "", gender: "", birthDate: "", phone: "" };

export function LineMemberRegistration({ preview, previewScreen = "register" }: { preview: boolean; previewScreen?: PreviewScreen }) {
  const [richMenuView, setRichMenuView] = useState<"points" | "rewards" | "news" | null>(null);
  const [state, setState] = useState<State>(preview ? previewScreen === "login" ? "login" : "form" : "entry");
  const [idToken, setIdToken] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [form, setForm] = useState<Registration>(emptyForm);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [member, setMember] = useState<Member | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [liffUrl, setLiffUrl] = useState("");

  useEffect(() => {
    if (preview) return;
    const query = new URLSearchParams(window.location.search);
    const lineBrowser = /\bLine\/\d/i.test(navigator.userAgent);
    const liffCallback = [...query.keys()].some(key => key.startsWith("liff.")) || query.has("code") && query.has("state") || window.location.hash.includes("access_token=");
    if (lineBrowser || liffCallback) setState("loading");
    let active = true;
    void (async () => {
      try {
        const signedOut = localStorage.getItem(signedOutKey) === "1";
        const configResponse = await fetch("/api/line/member/config", { cache: "no-store", signal: AbortSignal.timeout(10000) });
        const config = await configResponse.json() as { liffId?: string; error?: string };
        if (!configResponse.ok || !config.liffId) throw new Error(config.error || "ร้านยังไม่เปิดใช้งานสมาชิก LINE");
        const canonicalUrl = `https://liff.line.me/${encodeURIComponent(config.liffId)}`;
        setLiffUrl(canonicalUrl);
        if (signedOut) { setState("login"); return; }
        if (!lineBrowser && !liffCallback) { setState("entry"); return; }
        const { default: liff } = await import("@line/liff");
        await Promise.race([
          liff.init({ liffId: config.liffId, withLoginOnExternalBrowser: false }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("LINE ใช้เวลานานเกินไป กรุณาเปิดหน้าใหม่ในแอป LINE")), 20000)),
        ]);
        if (!active) return;
        if (!liff.isInClient()) {
          setState("entry");
          return;
        }
        // LIFF restores rich-menu query parameters only after initialization.
        const finalQuery = new URLSearchParams(window.location.search);
        const finalScreen = finalQuery.get("screen");
        const finalView = finalQuery.get("view");
        const portalView = finalScreen === "news" || finalScreen === "rewards" ? finalScreen : finalView;
        if (portalView === "points" || portalView === "rewards" || portalView === "news") setRichMenuView(portalView);
        if (!liff.isLoggedIn()) {
          setState("entry");
          return;
        }
        const token = liff.getIDToken();
        const access = liff.getAccessToken();
        if (!token && !access) throw new Error("กรุณาเข้าสู่ระบบ LINE อีกครั้ง");
        setIdToken(token || "");
        setAccessToken(access || "");
        const response = await fetch("/api/line/member", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "lookup", idToken: token, accessToken: access }), signal: AbortSignal.timeout(16000),
        });
        const data = await response.json() as { registered?: boolean; member?: Member; error?: string; errorCode?: string };
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
    if (!liffUrl) { setError("กำลังเตรียมลิงก์ LINE กรุณาลองอีกครั้งสักครู่"); return; }
    setState("loading");
  }

  async function logout() {
    localStorage.setItem(signedOutKey, "1");
    setMember(null); setIdToken(""); setAccessToken(""); setError("");
    setState("login");
    try { const { default: liff } = await import("@line/liff"); if (liff.isLoggedIn()) liff.logout(); } catch { /* The local signed-out choice still prevents automatic LINE login. */ }
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!termsAccepted) return;
    if (preview) { setMember({ memberCode: "TM-PREVIEW", name: "แอดมิน", level: "Gold", points: 90 }); setState("member"); return; }
    if ((!idToken && !accessToken) || busy) return;
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/line/member", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register", idToken, accessToken, registration: { ...form, phone: form.phone.replace(/\D/g, ""), termsAccepted } }),
      });
      const data = await response.json() as { member?: Member; error?: string };
      if (!response.ok || !data.member) throw new Error(data.error || "สมัครสมาชิกไม่สำเร็จ");
      setMember(data.member);
      setState("member");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "สมัครสมาชิกไม่สำเร็จ");
    } finally { setBusy(false); }
  }

  if (state === "member" && member) return preview ? <CustomerPortal mode="preview" /> : <CustomerPortal mode="customer" initialView={richMenuView} member={member} idToken={idToken} accessToken={accessToken} onLogout={() => void logout()} onMemberUpdated={name => setMember(value => value ? { ...value, name } : value)} />;

  return <main className={`line-entry line-entry--${state}`}>
    <div className="line-entry-shell">
      <header className="line-entry-brand"><PawPrint size={34} fill="currentColor" /><div><strong>Tammy</strong><span>Pet Shop</span></div></header>
      {preview && <div className="line-signup-preview">ดูหน้าจอก่อนเชื่อม LINE · ยังไม่บันทึกข้อมูล</div>}
      {(state === "entry" || state === "login" || state === "unavailable" || state === "loading") && <section className="line-entry-hero" role={state === "loading" ? "status" : undefined}>
        <div className={`line-entry-orbit${state === "loading" ? " is-loading" : ""}`} aria-hidden="true"><div className="line-entry-orbit-motion"><span className="line-entry-orbit-ring" /><PawPrint className="line-entry-orbit-paw paw-one" size={27} fill="currentColor" /><PawPrint className="line-entry-orbit-paw paw-two" size={23} fill="currentColor" /><PawPrint className="line-entry-orbit-paw paw-three" size={25} fill="currentColor" /><PawPrint className="line-entry-orbit-paw paw-four" size={21} fill="currentColor" /></div><div className="line-entry-logo"><Image src="/assets/tammy-member-entry-logo.png" width={240} height={240} alt="" priority /></div></div>
        <div className="line-entry-copy"><h1>{state === "loading" ? "กำลังเชื่อมต่อ LINE" : state === "login" ? "ยินดีต้อนรับกลับ" : state === "unavailable" ? "เชื่อมต่อไม่สำเร็จ" : "เข้าสู่ระบบสมาชิก"}</h1><p>{state === "loading" ? "ตรวจสอบบัญชีของคุณสักครู่" : state === "login" ? "เข้าสู่ระบบสมาชิกด้วยบัญชี LINE เดิม" : state === "unavailable" ? error : "สมาชิกใหม่จะกรอกข้อมูลสมัครหลังเชื่อม LINE"}</p></div>
        {state === "loading" ? <div className="line-entry-line-button is-waiting" aria-hidden="true">กำลังเชื่อมต่ออย่างปลอดภัย…</div> : preview ? <button className="line-entry-line-button" type="button" onClick={loginWithLine}><span className="line-entry-line-mark">LINE</span>เข้าสู่ระบบด้วย LINE</button> : <a className={`line-entry-line-button${liffUrl ? "" : " is-preparing"}`} href={liffUrl || undefined} aria-disabled={!liffUrl} onClick={event => { if (!liffUrl) { event.preventDefault(); return; } loginWithLine(); }}><span className="line-entry-line-mark">LINE</span>{!liffUrl ? "กำลังเตรียม LINE…" : state === "unavailable" ? "เปิดในแอป LINE อีกครั้ง" : "เข้าสู่ระบบด้วย LINE"}</a>}
        {error && state !== "unavailable" && <p className="line-entry-error" role="alert">{error}</p>}
      </section>}
      {state === "form" && <>
        <div className="line-entry-form-heading"><h1>ข้อมูลสมาชิก</h1><p>กรอกข้อมูลเพื่อเป็นสมาชิกกับแทมมี่</p></div>
        <section className="line-signup-panel line-entry-form-panel">
          <form onSubmit={register} className="line-signup-form">
            <div className="line-signup-row"><label>ชื่อจริง <span>*</span><input autoComplete="given-name" required maxLength={80} value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} placeholder="ชื่อจริง" /></label><label>นามสกุล <span>*</span><input autoComplete="family-name" required maxLength={80} value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} placeholder="นามสกุล" /></label></div>
            <label>เพศ <span>*</span><select required value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}><option value="">เลือกเพศ</option><option value="female">หญิง</option><option value="male">ชาย</option><option value="other">อื่น ๆ</option><option value="prefer_not_to_say">ไม่ประสงค์ระบุ</option></select></label>
            <label>วันเกิด <span>*</span><input type="date" required min="1900-01-01" max={new Date().toISOString().slice(0, 10)} value={form.birthDate} onChange={e => setForm({ ...form, birthDate: e.target.value })} /></label>
            <label>เบอร์โทรศัพท์ <span>*</span><input type="tel" autoComplete="tel" inputMode="numeric" required pattern="0[0-9]{9}" maxLength={10} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })} placeholder="0XXXXXXXXX" /><small>ใช้ตรวจสอบข้อมูลสมาชิก หากมีบัญชีเดิมอยู่แล้วร้านจะช่วยผูกบัญชีให้</small></label>
            <details className="line-signup-terms"><summary>อ่านเงื่อนไขสมาชิก</summary><p>ร้านใช้ชื่อ วันเกิด เบอร์โทร และบัญชี LINE เพื่อสมัครสมาชิก สะสมแต้ม และแสดงสิทธิพิเศษของ Tammy Pet Shop การสมัครทำได้ครั้งเดียวต่อบัญชี LINE และเบอร์โทรหนึ่งเบอร์ใช้กับสมาชิกหนึ่งราย</p></details>
            <label className="line-signup-consent"><input type="checkbox" required checked={termsAccepted} onChange={event => setTermsAccepted(event.target.checked)} /><span>ฉันอ่านและยอมรับเงื่อนไขสมาชิก</span></label>
            {error && <p className="line-signup-error" role="alert">{error}</p>}
            <button type="submit" disabled={busy}>{busy ? "กำลังสมัครสมาชิก…" : "สมัครสมาชิก"}<ArrowRight size={18} /></button>
            <p className="line-signup-privacy">ข้อมูลของคุณใช้สำหรับสมาชิก Tammy Pet Shop เท่านั้น</p>
          </form>
        </section>
      </>}
      <footer className="line-entry-footer"><PawPrint size={19} fill="currentColor" /> เพื่อนซี้ที่อยู่เคียงข้างเสมอ ♡</footer>
    </div>
  </main>;
}
