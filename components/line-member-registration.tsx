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
const verifyRetryKey = "tammy-line-verification-retried";
const signupStartedKey = "tammy-line-signup-started";
const handoffKey = "tammy-line-handoff-at";

const emptyForm: Registration = { firstName: "", lastName: "", gender: "", birthDate: "", phone: "" };

export function LineMemberRegistration({ preview, previewScreen = "register" }: { preview: boolean; previewScreen?: PreviewScreen }) {
  const [richMenuView, setRichMenuView] = useState<"points" | "rewards" | "news" | null>(null);
  const [state, setState] = useState<State>(preview ? previewScreen === "login" ? "login" : "form" : "loading");
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
    const requestedScreen = query.get("screen");
    let active = true;
    void (async () => {
      try {
        const signedOut = localStorage.getItem(signedOutKey) === "1";
        const configResponse = await fetch("/api/line/member/config", { cache: "no-store" });
        const config = await configResponse.json() as { liffId?: string; error?: string };
        if (!configResponse.ok || !config.liffId) throw new Error(config.error || "ร้านยังไม่เปิดใช้งานสมาชิก LINE");
        const canonicalUrl = `https://liff.line.me/${encodeURIComponent(config.liffId)}`;
        setLiffUrl(canonicalUrl);
        if (signedOut || requestedScreen === "login") { setState("login"); return; }
        const lineBrowser = /\bLine\/\d/i.test(navigator.userAgent);
        const liffCallback = [...query.keys()].some(key => key.startsWith("liff.")) || query.has("code") && query.has("state") || window.location.hash.includes("access_token=");
        if (!lineBrowser && !liffCallback && window.location.pathname === "/customer") {
          const lastHandoff = Number(localStorage.getItem(handoffKey) || 0);
          if (Date.now() - lastHandoff > 120_000) {
            localStorage.setItem(handoffKey, String(Date.now()));
            window.location.replace(canonicalUrl);
            return;
          }
        }
        const { default: liff } = await import("@line/liff");
        await liff.init({ liffId: config.liffId, withLoginOnExternalBrowser: false });
        if (!active) return;
        if (!liff.isInClient()) {
          const lastHandoff = Number(localStorage.getItem(handoffKey) || 0);
          if (Date.now() - lastHandoff > 120_000) {
            localStorage.setItem(handoffKey, String(Date.now()));
            window.location.replace(canonicalUrl);
            return;
          }
          setState("entry");
          return;
        }
        localStorage.removeItem(handoffKey);
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
          body: JSON.stringify({ action: "lookup", idToken: token, accessToken: access }),
        });
        const data = await response.json() as { registered?: boolean; member?: Member; error?: string; errorCode?: string };
        if (!active) return;
        if (response.status === 401 && data.errorCode === "LINE_ID_TOKEN_REJECTED" && sessionStorage.getItem(verifyRetryKey) !== "1") {
          sessionStorage.setItem(verifyRetryKey, "1");
          window.location.replace(canonicalUrl);
          return;
        }
        if (!response.ok) throw new Error(data.error || "ตรวจสอบสมาชิกไม่สำเร็จ");
        sessionStorage.removeItem(verifyRetryKey);
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

  async function loginWithLine() {
    if (preview) { setMember({ memberCode: "TM-PREVIEW", name: "แอดมิน", level: "Gold", points: 90 }); setState("member"); return; }
    localStorage.removeItem(signedOutKey);
    localStorage.setItem(signupStartedKey, "1");
    sessionStorage.removeItem(verifyRetryKey);
    setState("loading");
    try {
      let target = liffUrl;
      if (!target) {
        const response = await fetch("/api/line/member/config", { cache: "no-store" });
        const config = await response.json() as { liffId?: string; error?: string };
        if (!response.ok || !config.liffId) throw new Error(config.error || "ยังไม่พร้อมเข้าสู่ระบบ LINE");
        target = `https://liff.line.me/${encodeURIComponent(config.liffId)}`;
      }
      localStorage.setItem(handoffKey, String(Date.now()));
      window.location.assign(target);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "เริ่ม LINE Login ไม่สำเร็จ"); setState("entry"); }
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

  if (state === "loading") return <main className="customer-entry-skeleton customer-home-page" role="status" aria-label="กำลังตรวจสอบสมาชิก">
    <header className="customer-entry-skeleton-header"><span className="customer-entry-skeleton-mark"><PawPrint size={23} /></span><span className="customer-entry-skeleton-greeting" /></header>
    <div className="customer-entry-skeleton-body"><div className="customer-entry-skeleton-card"><span className="customer-entry-skeleton-ring" /><span className="customer-entry-skeleton-line short" /><span className="customer-entry-skeleton-line" /><span className="customer-entry-skeleton-line small" /></div><div className="customer-entry-skeleton-news"><span /><span /></div></div>
  </main>;

  return <main className={`line-entry line-entry--${state}`}>
    <div className="line-entry-shell">
      <header className="line-entry-brand"><PawPrint size={34} fill="currentColor" /><div><strong>Tammy</strong><span>Pet Shop</span></div></header>
      {preview && <div className="line-signup-preview">ดูหน้าจอก่อนเชื่อม LINE · ยังไม่บันทึกข้อมูล</div>}
      {(state === "entry" || state === "login" || state === "unavailable") && <section className="line-entry-hero">
        <div className="line-entry-orbit" aria-hidden="true"><span className="line-entry-orbit-ring" /><span className="line-entry-orbit-paw">🐾</span><span className="line-entry-orbit-spark">✦</span><div className="line-entry-logo"><Image src="/assets/tammy-member-entry-logo.png" width={240} height={240} alt="" priority /></div></div>
        <div className="line-entry-copy"><h1>{state === "login" ? "ยินดีต้อนรับกลับ" : state === "unavailable" ? "เชื่อมต่อไม่สำเร็จ" : "สมัครสมาชิก"}</h1><p>{state === "login" ? "เข้าสู่ระบบสมาชิกด้วยบัญชี LINE เดิม" : state === "unavailable" ? error : "เริ่มต้นเป็นสมาชิกกับแทมมี่"}</p></div>
        <button className="line-entry-line-button" type="button" onClick={() => void loginWithLine()}><span className="line-entry-line-mark">LINE</span>{state === "login" ? "เข้าสู่ระบบด้วย LINE" : state === "unavailable" ? "เปิดในแอป LINE อีกครั้ง" : "สมัครสมาชิกผ่าน LINE"}</button>
        {error && state !== "unavailable" && <p className="line-entry-error" role="alert">{error}</p>}
        {state === "entry" && <p className="line-entry-help">หากแอป LINE ไม่เปิดอัตโนมัติ กรุณากดปุ่มด้านบน</p>}
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
