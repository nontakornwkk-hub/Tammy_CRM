"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Check, Gift, PawPrint, ShieldCheck } from "lucide-react";

type Member = { memberCode: string; name: string; level: string; points: number };
type Registration = { firstName: string; lastName: string; gender: string; birthDate: string; phone: string };
type State = "loading" | "form" | "member" | "unavailable";

const emptyForm: Registration = { firstName: "", lastName: "", gender: "", birthDate: "", phone: "" };

export function LineMemberRegistration({ preview }: { preview: boolean }) {
  const [state, setState] = useState<State>(preview ? "form" : "loading");
  const [idToken, setIdToken] = useState("");
  const [form, setForm] = useState<Registration>(emptyForm);
  const [member, setMember] = useState<Member | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (preview) return;
    let active = true;
    void (async () => {
      try {
        const configResponse = await fetch("/api/line/member/config", { cache: "no-store" });
        const config = await configResponse.json() as { liffId?: string; error?: string };
        if (!configResponse.ok || !config.liffId) throw new Error(config.error || "ร้านยังไม่เปิดใช้งานสมาชิก LINE");
        const { default: liff } = await import("@line/liff");
        await liff.init({ liffId: config.liffId, withLoginOnExternalBrowser: true });
        if (!active) return;
        if (!liff.isLoggedIn()) { liff.login({ redirectUri: window.location.href }); return; }
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

  return <main className="line-signup">
    <div className="line-signup-shell">
      <header className="line-signup-header">
        <div className="line-signup-logo"><PawPrint size={23} strokeWidth={2.4} /></div>
        <div><strong>Tammy</strong><span>Pet Shop Membership</span></div>
      </header>
      {preview && <div className="line-signup-preview">ดูหน้าจอก่อนเชื่อม LINE · ยังไม่บันทึกข้อมูล</div>}
      {state === "loading" && <section className="line-signup-panel line-signup-status" role="status"><div className="line-signup-spinner" /><h1>กำลังตรวจสอบสมาชิก</h1><p>เชื่อมต่อบัญชี LINE ของคุณสักครู่</p></section>}
      {state === "unavailable" && <section className="line-signup-panel line-signup-status" role="alert"><div className="line-signup-icon"><PawPrint /></div><h1>ยังเปิดหน้านี้ไม่ได้</h1><p>{error}</p></section>}
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
      {state === "member" && member && <>
        <div className="line-signup-intro"><span className="line-signup-eyebrow">TAMMY MEMBER</span><h1>สวัสดี คุณ{member.name}</h1><p>ยินดีต้อนรับกลับมา ไม่ต้องสมัครใหม่แล้วนะ</p></div>
        <section className="line-signup-member-card"><div className="line-signup-member-top"><span><PawPrint size={17} /> Tammy Pet Shop</span><span>{member.level}</span></div><div className="line-signup-points"><small>แต้มสะสมของคุณ</small><strong>{Number(member.points).toLocaleString("th-TH")} <span>แต้ม</span></strong></div><div className="line-signup-member-bottom"><span>รหัสสมาชิก</span><strong>{member.memberCode}</strong></div></section>
        <div className="line-signup-success"><Check size={17} /> บัญชี LINE นี้ผูกกับสมาชิกเรียบร้อยแล้ว</div>
        <div className="line-signup-hint"><Gift size={18} /><span>กลับมาเช็กแต้มและสิทธิพิเศษได้จากเมนู LINE ของร้าน</span></div>
      </>}
    </div>
  </main>;
}
