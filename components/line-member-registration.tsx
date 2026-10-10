"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, PawPrint, UserPlus, Dog, Cat, ChevronLeft } from "lucide-react";
import dynamic from "next/dynamic";
import { loadCustomerPortal, prepareCustomerPortal } from "@/lib/customer-portal-loader";
import Image from "next/image";
import { prepareMemberData, clearMemberDisplayData, seedMemberData, type MemberBootstrap } from "@/lib/member-bootstrap";
import { shouldInitializeLine } from "@/lib/line/login-flow";
import { normalizeThaiPhone } from "@/lib/line/phone-input";
import { pendingPhone, pendingPhoneKey, phoneContinuation } from "@/lib/line/phone-confirmation";
import { singleFlight } from "@/lib/single-flight";
import { CustomerBirthdayPicker } from "./customer-birthday-picker";
import { ProfilePhoto } from "./profile-photo";

type Member = { memberCode: string; name: string; level: string; points: number; linePictureUrl?: string | null };
type LineProfile = { displayName: string | null; pictureUrl: string | null };
type Registration = { fullName: string; firstName: string; lastName: string; gender: string; birthDate: string; phone: string; email: string; dogCount: number; catCount: number };
type State = "entry" | "loading" | "form" | "member" | "login" | "unavailable" | "transfer" | "transferDone" | "phone";
type PreviewScreen = "register" | "login" | "loading" | "phone";
const signedOutKey = "tammy-customer-signed-out";
const loginIntentKey = "tammy-line-login-intent";
const transferKey = "tammy-pending-line-transfer";
const richMenuViewKey = "tammy-line-menu-view";

const emptyForm: Registration = { fullName: "", firstName: "", lastName: "", gender: "prefer_not_to_say", birthDate: "", phone: "", email: "", dogCount: 0, catCount: 0 };
const loadConfig = singleFlight<{ liffId: string; logoUrl?: string | null }>();
let publicLineConfig: { liffId: string; logoUrl?: string | null; expiresAt: number } | undefined;
let initializedLiffId = "";
const initializeLine = singleFlight<void>();
type LoginResult = { registered?: boolean; requiresPhone?: boolean; member?: Member; lineProfile?: LineProfile; bootstrap?: MemberBootstrap; error?: string };
const lookupMember = singleFlight<LoginResult>();
const CustomerPortal = dynamic(() => loadCustomerPortal().then(module => module.CustomerPortal), { ssr: false });

function previewState(screen: PreviewScreen): State { return screen === "register" ? "form" : screen; }
function initialState(preview: boolean, screen: PreviewScreen): State {
  if (preview) return previewState(screen);
  if (typeof window !== "undefined" && localStorage.getItem(signedOutKey) === "1"
    && !pendingPhone(sessionStorage.getItem(pendingPhoneKey))) return "entry";
  if (typeof window !== "undefined") {
    const query = new URLSearchParams(window.location.search);
    if (localStorage.getItem("tammy-line-returning") === "1" || pendingPhone(sessionStorage.getItem(pendingPhoneKey))
      || sessionStorage.getItem(loginIntentKey) === "1" || query.has("code") && query.has("state")
      || window.location.hash.includes("access_token=") || query.has("lineTransfer")) return "loading";
  }
  return "entry";
}

export function LineMemberRegistration({ preview, previewScreen = "register", testLogin, testConfirmPhone }: { preview: boolean; previewScreen?: PreviewScreen; testLogin?: () => void; testConfirmPhone?: (phone: string) => Promise<void> }) {
  const [richMenuView, setRichMenuView] = useState<"points" | "rewards" | "news" | null>(null);
  const [state, setState] = useState<State>(() => initialState(preview, previewScreen));
  const [idToken, setIdToken] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [form, setForm] = useState<Registration>(emptyForm);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [member, setMember] = useState<Member | null>(null);
  const [lineProfile, setLineProfile] = useState<LineProfile | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [liffUrl, setLiffUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(publicLineConfig?.logoUrl || null);
  const [connectRequested, setConnectRequested] = useState(0);
  const [phone, setPhone] = useState("");
  const [transferId, setTransferId] = useState("");

  useEffect(() => {
    if (preview) { setState(previewState(previewScreen)); return; }
    const submittedPhone = pendingPhone(sessionStorage.getItem(pendingPhoneKey));
    // Logout returns to the welcome screen. A button opens phone confirmation locally.
    if (localStorage.getItem(signedOutKey) === "1" && !submittedPhone && !connectRequested) {
      sessionStorage.removeItem(pendingPhoneKey);
      setState("entry");
      return;
    }
    const query = new URLSearchParams(window.location.search);
    const requestedTransfer = query.get("lineTransfer");
    const requestedView = query.get("view") || query.get("screen");
    if (requestedView === "points" || requestedView === "rewards" || requestedView === "news") sessionStorage.setItem(richMenuViewKey, requestedView);
    if (requestedTransfer && /^[0-9a-f-]{36}$/i.test(requestedTransfer)) sessionStorage.setItem(transferKey, requestedTransfer);
    const liffCallback = query.has("code") && query.has("state") || query.has("liff.state") || window.location.hash.includes("access_token=");
    const oauthCallback = query.has("code") && query.has("state") || window.location.hash.includes("access_token=");
    if (connectRequested || oauthCallback) setState("loading");
    let active = true;
    void (async () => {
      try {
        const signedOut = localStorage.getItem(signedOutKey) === "1";
        const requested = Boolean(connectRequested || submittedPhone || oauthCallback || sessionStorage.getItem(loginIntentKey) === "1"
          || !signedOut && localStorage.getItem("tammy-line-returning") === "1" || sessionStorage.getItem(transferKey));
        void prepareCustomerPortal().catch(() => undefined);
        const sdk = import("@line/liff");
        void sdk.catch(() => undefined);
        const config = await loadConfig("config", async () => {
          if (publicLineConfig && publicLineConfig.expiresAt > Date.now()) return { liffId: publicLineConfig.liffId, logoUrl: publicLineConfig.logoUrl };
          const response = await fetch("/api/line/member/config", { cache: "default", signal: AbortSignal.timeout(10000) });
          const data = await response.json() as { liffId?: string; logoUrl?: string | null; error?: string };
          if (!response.ok || !data.liffId) throw new Error(data.error || "ร้านยังไม่เปิดใช้งานสมาชิก LINE");
          publicLineConfig = { liffId: data.liffId, logoUrl: data.logoUrl, expiresAt: Date.now() + 60000 };
          return { liffId: data.liffId, logoUrl: data.logoUrl };
        });
        if (!active) return;
        setLogoUrl(config.logoUrl || null);
        const pendingTransfer = sessionStorage.getItem(transferKey);
        const canonicalUrl = `https://liff.line.me/${encodeURIComponent(config.liffId)}${pendingTransfer ? `/?lineTransfer=${encodeURIComponent(pendingTransfer)}` : ""}`;
        setLiffUrl(canonicalUrl);
        const { default: liff } = await sdk;
        // LIFF initialization can itself request consent inside LINE. Keep it behind
        // the welcome buttons for a new visitor, even when liff.state is present.
        if (!requested) { setState("entry"); return; }
        if (!shouldInitializeLine({signedOut,connectRequested:requested || !signedOut && localStorage.getItem("tammy-line-returning") === "1",liffCallback,pendingTransfer:Boolean(pendingTransfer),inClient:liff.isInClient()})) { setState("entry"); return; }
        if (requested) setState("loading");
        performance.mark("tammy-line:init-start");
        await initializeLine(config.liffId, async () => {
          if(initializedLiffId === config.liffId) return;
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            await Promise.race([
              liff.init({ liffId: config.liffId, withLoginOnExternalBrowser: false }),
              new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("LINE ใช้เวลานานเกินไป กรุณาลองเข้าสู่ระบบอีกครั้ง")), 20000); }),
            ]);
            initializedLiffId = config.liffId;
          } finally { clearTimeout(timer); }
        });
        if (!active) return;
        performance.mark("tammy-line:init-end");
        performance.measure("tammy-line:init","tammy-line:init-start","tammy-line:init-end");
        if (!requested) {
          setState("entry");
          return;
        }
        // LIFF restores rich-menu query parameters only after initialization.
        const finalQuery = new URLSearchParams(window.location.search);
        const finalTransfer = finalQuery.get("lineTransfer") || sessionStorage.getItem(transferKey) || "";
        if (finalTransfer && /^[0-9a-f-]{36}$/i.test(finalTransfer)) setTransferId(finalTransfer);
        const finalScreen = finalQuery.get("screen");
        const finalView = finalQuery.get("view");
        const portalView = (finalScreen === "news" || finalScreen === "rewards" ? finalScreen : finalView) || sessionStorage.getItem(richMenuViewKey);
        if (portalView === "points" || portalView === "rewards" || portalView === "news") setRichMenuView(portalView);
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }
        const token = liff.getIDToken();
        const access = liff.getAccessToken();
        if (!token && !access) throw new Error("กรุณาเข้าสู่ระบบ LINE อีกครั้ง");
        setIdToken(token || "");
        setAccessToken(access || "");
        void prepareCustomerPortal().catch(() => undefined);
        performance.mark("tammy-line:lookup-start");
        const action = submittedPhone ? "confirmPhone" : "lookup";
        const data = await lookupMember(JSON.stringify([token || access!, action, submittedPhone || "", signedOut]), async () => {
          const response = await fetch("/api/line/member", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, idToken: token, accessToken: access, phone: submittedPhone, requirePhoneConfirmation: signedOut, includeBootstrap: true }), cache: "no-store", signal: AbortSignal.timeout(20000),
          });
          const result = await response.json() as LoginResult;
          if (!response.ok) throw new Error(result.error || "ตรวจสอบสมาชิกไม่สำเร็จ");
          return result;
        });
        performance.mark("tammy-line:lookup-end");
        performance.measure("tammy-line:lookup","tammy-line:lookup-start","tammy-line:lookup-end");
        if (!active) return;
        setLineProfile(data.lineProfile || null);
        if (data.requiresPhone) { setState("phone"); return; }
        if (data.registered && data.member) {
          if (finalTransfer) { setError("LINE นี้เชื่อมกับสมาชิกอยู่แล้ว กรุณาให้ร้านตรวจสอบก่อนย้ายบัญชี"); setState("unavailable"); }
          else {
            await prepareCustomerPortal();
            if (!active) return;
            if (data.bootstrap) seedMemberData(data.bootstrap, token || undefined, access || undefined);
            else await prepareMemberData(token || undefined, access || undefined);
            if (!active) return;
            localStorage.removeItem(signedOutKey);
            sessionStorage.removeItem(richMenuViewKey);
            sessionStorage.removeItem(pendingPhoneKey);
            localStorage.setItem("tammy-line-returning", "1"); sessionStorage.removeItem(loginIntentKey); setMember(data.member); setState("member");
          }
        }
        else {
          if (submittedPhone) setForm(value => ({ ...value, phone: submittedPhone }));
          sessionStorage.removeItem(pendingPhoneKey);
          sessionStorage.removeItem(loginIntentKey);
          setState(finalTransfer && /^[0-9a-f-]{36}$/i.test(finalTransfer) ? "transfer" : "form");
        }
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "ไม่สามารถเชื่อมต่อ LINE ได้");
        if (submittedPhone) {
          setPhone(submittedPhone);
          sessionStorage.removeItem(pendingPhoneKey);
          sessionStorage.removeItem(loginIntentKey);
          setState("phone");
        } else setState("unavailable");
      } finally {
        if (active) setBusy(false);
      }
    })();
    return () => { active = false; };
  }, [preview, previewScreen, connectRequested]);

  function loginWithLine() {
    if (testLogin) { if (testConfirmPhone) setState("phone"); else testLogin(); return; }
    if (preview) { setMember({ memberCode: "TM-PREVIEW", name: "แอดมิน", level: "Gold", points: 90 }); setState("member"); return; }
    if (localStorage.getItem(signedOutKey) === "1") { setError(""); setState("phone"); return; }
    startLineConnection();
  }

  function startLineConnection() {
    sessionStorage.setItem(loginIntentKey, "1");
    setError(""); setConnectRequested(value => value + 1); setState("loading");
  }

  function logout() {
    clearMemberDisplayData(); localStorage.setItem(signedOutKey, "1");
    sessionStorage.removeItem(loginIntentKey); localStorage.removeItem("tammy-line-returning");
    sessionStorage.removeItem(pendingPhoneKey);
    sessionStorage.removeItem(richMenuViewKey); setRichMenuView(null);
    setConnectRequested(0);
    setMember(null); setIdToken(""); setAccessToken(""); setError("");
    setPhone(""); setBusy(false); setState("entry");
    // Keep LINE's transport session; the next phone submit still gets verified by the server.
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.gender) { setError("กรุณาเลือกเพศก่อนสมัครสมาชิก"); return; }
    if(!form.firstName.trim() || !form.lastName.trim()) {setError("กรุณากรอกชื่อและนามสกุล");return;}
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
      setState("loading");
      await Promise.all([prepareMemberData(idToken || undefined, accessToken || undefined), prepareCustomerPortal()]);
      localStorage.removeItem(signedOutKey); localStorage.setItem("tammy-line-returning", "1"); sessionStorage.removeItem(loginIntentKey);
      setMember(data.member);
      setState("member");
    } catch (cause) {
      setState("form");
      setError(cause instanceof Error ? cause.message : "สมัครสมาชิกไม่สำเร็จ");
    } finally { setBusy(false); }
  }

  async function confirmPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || !/^0\d{9}$/.test(phone)) return;
    setBusy(true); setError(""); setState("loading");
    if (testConfirmPhone) {
      try { await testConfirmPhone(phone); }
      catch(cause) {setState("phone");setError(cause instanceof Error?cause.message:"ยืนยันเบอร์ไม่สำเร็จ");}
      finally {setBusy(false);}
      return;
    }
    sessionStorage.setItem(pendingPhoneKey, phoneContinuation(phone));
    sessionStorage.setItem(loginIntentKey, "1");
    setConnectRequested(value => value + 1);
  }

  async function claimTransfer() {
    if (busy || (!idToken && !accessToken) || !transferId) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/line/member/transfer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: transferId, idToken, accessToken }), cache: "no-store",
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "ส่งคำขอไม่สำเร็จ");
      sessionStorage.removeItem(transferKey);
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("lineTransfer");
      window.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
      setState("transferDone");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ส่งคำขอไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  if (state === "member" && member) return preview ? <CustomerPortal mode="preview" /> : <CustomerPortal mode="customer" initialView={richMenuView} member={member} idToken={idToken} accessToken={accessToken} onLogout={() => void logout()} onMemberUpdated={name => setMember(value => value ? { ...value, name } : value)} />;

  return <main className={`line-entry line-entry-redesign line-entry--${state}`}>
    <div className="line-entry-shell">
      <header className="line-entry-brand"><PawPrint size={34} fill="currentColor" /><div><strong>Tammy</strong><span>Pet Shop</span></div></header>

      {(state === "entry" || state === "login" || state === "unavailable" || state === "loading") && <section className="line-entry-hero" role={state === "loading" ? "status" : undefined}>
        <div className={`line-entry-orbit${state === "loading" ? " is-loading" : ""}`} aria-hidden="true"><div className="line-entry-orbit-motion"><span className="line-entry-orbit-ring" /><PawPrint className="line-entry-orbit-paw paw-one" size={27} fill="currentColor" /><PawPrint className="line-entry-orbit-paw paw-two" size={23} fill="currentColor" /><PawPrint className="line-entry-orbit-paw paw-three" size={25} fill="currentColor" /><PawPrint className="line-entry-orbit-paw paw-four" size={21} fill="currentColor" /></div><div className="line-entry-logo"><Image src={logoUrl || "/assets/shop-logo-original.png"} width={240} height={240} alt="โลโก้ร้าน Tammy Pet Shop" unoptimized priority /></div></div>
        <div className="line-entry-copy"><h1>{state === "loading" ? "กำลังเข้าสู่ระบบ" : state === "login" ? "ยินดีต้อนรับกลับ" : state === "unavailable" ? "เชื่อมต่อไม่สำเร็จ" : "ยินดีต้อนรับกลับ"}</h1><p>{state === "loading" ? "กำลังตรวจสอบบัญชี LINE" : state === "login" ? "เข้าสู่ระบบสมาชิกด้วยบัญชี LINE เดิม" : state === "unavailable" ? error : "เข้าสู่ระบบด้วยบัญชี LINE ของคุณ"}</p></div>
        {state === "loading" ? null : preview ? <button className="line-entry-line-button" type="button" onClick={loginWithLine}><span className="line-entry-line-mark">LINE</span>เข้าสู่ระบบด้วย LINE</button> : <a className="line-entry-line-button" href={liffUrl || undefined} onClick={event => { event.preventDefault(); loginWithLine(); }}><span className="line-entry-line-mark">LINE</span>{state === "unavailable" ? "เปิดในแอป LINE อีกครั้ง" : "เข้าสู่ระบบด้วย LINE"}</a>}
        {state !== "loading" && <button className="line-entry-signup-link" type="button" onClick={() => { if(preview) setState("form"); else startLineConnection(); }}><UserPlus size={19}/>สมัครสมาชิก</button>}
        {error && state !== "unavailable" && <p className="line-entry-error" role="alert">{error}</p>}
      </section>}
      {state === "phone" && <section className="line-phone-confirm"><h1>ยืนยันเบอร์โทรศัพท์</h1><p>กรอกเบอร์สมาชิกที่เชื่อมกับบัญชี LINE นี้หนึ่งครั้ง</p><form onSubmit={confirmPhone}><label>เบอร์โทรศัพท์<input type="tel" inputMode="numeric" autoComplete="tel" required pattern="0[0-9]{9}" value={phone} onChange={e=>setPhone(normalizeThaiPhone(e.target.value))} placeholder="0XXXXXXXXX"/></label>{error&&<p role="alert" className="line-entry-error">{error}</p>}<button type="submit" disabled={busy}>{busy?"กำลังยืนยัน…":"ยืนยันและเข้าสู่ระบบ"}</button></form></section>}
      {state === "form" && <>
        <button type="button" className="line-entry-back" aria-label="กลับหน้าเข้าสู่ระบบ" onClick={()=>setState("login")}><ChevronLeft/></button><div className="line-entry-form-heading"><h1>สมัครสมาชิก</h1><p>เริ่มสะสมแต้มกับ Tammy</p></div><div className="line-signup-identity"><div className="line-signup-profile"><ProfilePhoto src={lineProfile?.pictureUrl} size={42} alt="รูปโปรไฟล์ LINE"/><span>{lineProfile?.displayName || (preview ? "ชื่อ LINE ตัวอย่าง" : "สมาชิก LINE")}</span></div><small>{preview ? "ตัวอย่างโปรไฟล์" : "✓ เชื่อมต่อ LINE แล้ว"}</small></div>
        <section className="line-signup-panel line-entry-form-panel">
          <form onSubmit={register} className="line-signup-form">
            <label><span className="line-signup-field-label">ชื่อ–นามสกุล <b aria-hidden="true">*</b></span><input autoComplete="name" required maxLength={161} value={form.fullName} onChange={e=>{const fullName=e.target.value,parts=fullName.trim().split(/\s+/);setForm({...form,fullName,firstName:parts[0]||"",lastName:parts.slice(1).join(" ")});}} placeholder="กรอกชื่อ–นามสกุล"/></label>
            <label><span className="line-signup-field-label">เบอร์โทรศัพท์ <b aria-hidden="true">*</b></span><input type="tel" autoComplete="tel" inputMode="numeric" required pattern="0[0-9]{9}" value={form.phone} onChange={e => setForm({ ...form, phone: normalizeThaiPhone(e.target.value) })} placeholder="0XXXXXXXXX" /></label>
            <div className="customer-gender-picker"><span id="signup-gender-label">เพศ</span><div role="radiogroup" aria-labelledby="signup-gender-label">{[{value:"male",label:"ชาย"},{value:"female",label:"หญิง"},{value:"prefer_not_to_say",label:"ไม่ระบุ"}].map(choice=><button type="button" key={choice.value} role="radio" aria-checked={form.gender===choice.value} onClick={()=>setForm({...form,gender:choice.value})}>{choice.label}</button>)}</div></div>
            <label>อีเมล (ไม่บังคับ)<input type="email" autoComplete="email" maxLength={254} value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="example@email.com"/></label>
            <CustomerBirthdayPicker value={form.birthDate} onChange={birthDate=>setForm({...form,birthDate})}/>
            <fieldset className="line-signup-pets"><legend>สัตว์เลี้ยงของคุณ (ไม่บังคับ)</legend>{([{key:"dogCount",label:"สุนัข",Icon:Dog},{key:"catCount",label:"แมว",Icon:Cat}] as const).map(({key,label,Icon})=><div className="line-signup-pet" key={key}><strong><span><Icon size={27}/></span>{label}</strong><div><button type="button" aria-label={`ลดจำนวน${label}`} disabled={form[key]===0} onClick={()=>setForm({...form,[key]:Math.max(0,form[key]-1)})}>−</button><output>{form[key]} <small>ตัว</small></output><button type="button" aria-label={`เพิ่มจำนวน${label}`} disabled={form[key]>=999} onClick={()=>setForm({...form,[key]:Math.min(999,form[key]+1)})}>+</button></div></div>)}</fieldset>
            <details className="line-signup-terms"><summary>อ่านเงื่อนไขสมาชิก</summary><p>ร้านใช้ชื่อ วันเกิด เบอร์โทร และบัญชี LINE เพื่อสมัครสมาชิก สะสมแต้ม และแสดงสิทธิพิเศษของ Tammy Pet Shop การสมัครทำได้ครั้งเดียวต่อบัญชี LINE และเบอร์โทรหนึ่งเบอร์ใช้กับสมาชิกหนึ่งราย</p></details>
            <label className="line-signup-consent"><input type="checkbox" required checked={termsAccepted} onChange={event => setTermsAccepted(event.target.checked)} /><span>ยอมรับเงื่อนไขและนโยบายความเป็นส่วนตัว</span></label>
            {error && <p className="line-signup-error" role="alert">{error}</p>}
            <button type="submit" disabled={busy}>{busy ? "กำลังสมัครสมาชิก…" : "สมัครสมาชิก"}<ArrowRight size={18} /></button>
            <p className="line-signup-privacy">ข้อมูลของคุณใช้สำหรับสมาชิก Tammy Pet Shop เท่านั้น</p>
          </form>
        </section>
      </>}
      {(state === "transfer" || state === "transferDone") && <section className="line-transfer-customer-panel">
        <span className="line-transfer-customer-icon"><PawPrint size={27} /></span>
        <h1>{state === "transferDone" ? "ส่งคำขอเชื่อม LINE แล้ว" : "เชื่อม LINE ใหม่กับสมาชิกเดิม"}</h1>
        <p>{state === "transferDone" ? "กรุณาให้พนักงานตรวจและยืนยันบนหน้าร้าน เมื่อสำเร็จแล้วเปิดหน้าสมาชิกอีกครั้ง" : "คุณกำลังยืนยัน LINE ใหม่บนโทรศัพท์เครื่องนี้ ร้านจะตรวจสอบสมาชิกเดิมก่อนย้ายการเชื่อมต่อ แต้มและสิทธิ์ของคุณยังอยู่ในบัญชีเดิม"}</p>
        {error ? <p role="alert" className="line-entry-error">{error}</p> : null}
        {state === "transfer" ? <button type="button" disabled={busy} onClick={() => void claimTransfer()}>{busy ? "กำลังส่งคำขอ…" : "ยืนยันใช้ LINE นี้"}<ArrowRight size={17} /></button> : null}
      </section>}
      {state !== "loading" && <footer className="line-entry-footer"><PawPrint size={19} fill="currentColor" /> เพื่อนซี้ที่อยู่เคียงข้างเสมอ ♡</footer>}
    </div>
  </main>;
}
