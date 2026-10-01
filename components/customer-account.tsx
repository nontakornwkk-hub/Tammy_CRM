"use client";

import Image from "next/image";
import { Check, ChevronRight, Clock3, LogOut, Minus, Pencil, Plus, ShieldCheck, Star, Trash2, UserRound, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

type Profile = {
  memberCode: string; name: string; firstName: string; lastName: string; gender: string;
  birthDate: string; phone: string; email: string; level: string; points: number;
  lineDisplayName: string; linePictureUrl: string; privacyConsent: boolean; consentUpdatedAt: string;
};
type PointEntry = { id: string; points_delta: number; transaction_type: string; note: string; created_at: string };

const previewProfile: Profile = {
  memberCode: "TMA0001", name: "คุณแอดมิน", firstName: "คุณ", lastName: "แอดมิน", gender: "", birthDate: "",
  phone: "", email: "", level: "Gold", points: 90, lineDisplayName: "", linePictureUrl: "", privacyConsent: false, consentUpdatedAt: "",
};
const thaiMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const currentYear = new Date().getFullYear();
const birthYears = Array.from({ length: currentYear - 1899 }, (_, index) => currentYear - index);
function birthParts(value: string) {
  const [year = "", month = "", day = ""] = value ? value.split("-") : [];
  return { year, month, day: day ? String(Number(day)) : "" };
}

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });
}

function genderLabel(value: string) {
  return { female: "หญิง", male: "ชาย", other: "อื่น ๆ", prefer_not_to_say: "ไม่ประสงค์ระบุ" }[value] || "ยังไม่ระบุ";
}

export function CustomerAccount({ preview, member, idToken, accessToken, onLogout, onMemberUpdated }: {
  preview: boolean;
  member?: { memberCode: string; name: string; level: string; points: number };
  idToken?: string;
  accessToken?: string;
  onLogout?: () => void;
  onMemberUpdated?: (name: string) => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(preview ? previewProfile : null);
  const [form, setForm] = useState<Profile | null>(preview ? previewProfile : null);
  const [birthday, setBirthday] = useState(() => birthParts(preview ? previewProfile.birthDate : ""));
  const [pointsHistory, setPointsHistory] = useState<PointEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteCode, setDeleteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!preview);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!editing) return;
    const frame = requestAnimationFrame(() => document.querySelector(".customer-account-form")?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    return () => cancelAnimationFrame(frame);
  }, [editing]);

  useEffect(() => {
    if (preview || (!idToken && !accessToken)) return;
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/line/member/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "load", idToken, accessToken }) });
        const data = await response.json() as { profile?: Profile; pointsHistory?: PointEntry[]; hasMore?: boolean; error?: string };
        if (!response.ok || !data.profile) throw new Error(data.error || "โหลดข้อมูลไม่สำเร็จ");
        if (active) { setProfile(data.profile); setForm(data.profile); setBirthday(birthParts(data.profile.birthDate)); setConsent(data.profile.privacyConsent); setPointsHistory(data.pointsHistory || []); setHasMore(Boolean(data.hasMore)); }
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "โหลดข้อมูลไม่สำเร็จ"); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [preview, idToken, accessToken]);

  async function loadHistory() {
    if (historyBusy || !hasMore) return;
    setHistoryBusy(true); setError("");
    try {
      const response = await fetch("/api/line/member/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "history", idToken, accessToken, offset: pointsHistory.length }) });
      const data = await response.json() as { pointsHistory?: PointEntry[]; hasMore?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || "โหลดประวัติไม่สำเร็จ");
      setPointsHistory(items => [...items, ...(data.pointsHistory || []).filter(entry => !items.some(item => item.id === entry.id))]);
      setHasMore(Boolean(data.hasMore));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "โหลดประวัติไม่สำเร็จ"); }
    finally { setHistoryBusy(false); }
  }

  async function saveConsent() {
    if (consentBusy || preview) return;
    setConsentBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/line/member/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "consent", idToken, accessToken, consent }) });
      const data = await response.json() as { consent: boolean; consentUpdatedAt: string; error?: string };
      if (!response.ok) throw new Error(data.error || "บันทึกความยินยอมไม่สำเร็จ");
      setProfile(value => value ? { ...value, privacyConsent: data.consent, consentUpdatedAt: data.consentUpdatedAt } : value);
      setForm(value => value ? { ...value, privacyConsent: data.consent, consentUpdatedAt: data.consentUpdatedAt } : value);
      setMessage(data.consent ? "บันทึกความยินยอมแล้ว" : "บันทึกการไม่ยินยอมแล้ว");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "บันทึกความยินยอมไม่สำเร็จ"); }
    finally { setConsentBusy(false); }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const birthDate = birthday.year && birthday.month && birthday.day ? `${birthday.year}-${birthday.month.padStart(2, "0")}-${birthday.day.padStart(2, "0")}` : "";
      const updatedForm = { ...form, birthDate };
      let savedName = `${form.firstName.trim()} ${form.lastName.trim()}`;
      if (!preview) {
        const response = await fetch("/api/line/member/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update", idToken, accessToken, profile: updatedForm }) });
        const data = await response.json() as { name?: string; error?: string };
        if (!response.ok || !data.name) throw new Error(data.error || "บันทึกข้อมูลไม่สำเร็จ");
        savedName = data.name;
        onMemberUpdated?.(data.name);
      }
      const updatedProfile = { ...updatedForm, name: savedName };
      setProfile(updatedProfile); setForm(updatedProfile); setEditing(false); setMessage("บันทึกข้อมูลเรียบร้อยแล้ว");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "บันทึกข้อมูลไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function deleteAccount() {
    if (!profile || deleteCode !== profile.memberCode || busy) return;
    setBusy(true); setError("");
    try {
      if (!preview) {
        const response = await fetch("/api/line/member/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", idToken, accessToken, memberCode: deleteCode }) });
        const data = await response.json() as { success?: boolean; error?: string };
        if (!response.ok || !data.success) throw new Error(data.error || "ลบบัญชีไม่สำเร็จ");
        onLogout?.();
      } else { setDeleting(false); setDeleteCode(""); setMessage("ปิดหน้าต่างยืนยันแล้ว"); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ลบบัญชีไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  const shown = profile || (member ? { ...previewProfile, ...member, firstName: member.name, memberCode: member.memberCode } : null);

  return <div className="customer-account">
    {loading && !shown && <p className="customer-home-catalog-state" role="status">กำลังโหลดข้อมูลสมาชิก…</p>}
    {error && <p className="line-signup-error" role="alert">{error}</p>}
    {message && <p className="customer-account-success" role="status"><Check size={17} />{message}</p>}
    {shown && <>
      <section className="customer-account-card customer-account-profile">
        <div className="customer-account-identity"><span className="customer-account-avatar">{shown.linePictureUrl ? <Image src={shown.linePictureUrl} alt="รูปโปรไฟล์ LINE" width={66} height={66} unoptimized /> : <UserRound size={29} />}</span><div><small>โปรไฟล์สมาชิก</small><strong>{shown.name}</strong><span>{shown.memberCode} · {shown.level}</span>{shown.lineDisplayName && <em>LINE: {shown.lineDisplayName}</em>}</div></div>
        <div className="customer-account-points"><Star size={18} /> คะแนนสะสม <strong>{Number(shown.points).toLocaleString("th-TH")} แต้ม</strong></div>
      </section>

      <section className="customer-account-card"><div className="customer-account-section-head"><div><small>ข้อมูลสมาชิก</small><h2>ข้อมูลส่วนตัว</h2></div><button type="button" onClick={() => { setForm(profile); setBirthday(birthParts(profile?.birthDate || "")); setEditing(value => !value); setError(""); }}><Pencil size={16} />{editing ? "ยกเลิก" : "แก้ไข"}</button></div>
        {editing && form ? <form className="customer-account-form" onSubmit={saveProfile}>
          <div className="customer-account-form-row"><label>ชื่อ<input required maxLength={80} autoComplete="given-name" value={form.firstName} onChange={event => setForm({ ...form, firstName: event.target.value })} /></label><label>นามสกุล<input required maxLength={80} autoComplete="family-name" value={form.lastName} onChange={event => setForm({ ...form, lastName: event.target.value })} /></label></div>
          <label>เพศ<select value={form.gender} onChange={event => setForm({ ...form, gender: event.target.value })}><option value="">ไม่ระบุ</option><option value="female">หญิง</option><option value="male">ชาย</option><option value="other">อื่น ๆ</option><option value="prefer_not_to_say">ไม่ประสงค์ระบุ</option></select></label>
          <fieldset className="customer-birthday-field"><legend>วันเกิด <span>เลือกวัน เดือน และปี</span></legend><div className="customer-birthday-inputs"><label>วัน<select aria-label="วันเกิด วันที่" value={birthday.day} onChange={event => setBirthday(value => ({ ...value, day: event.target.value }))}><option value="">วัน</option>{Array.from({ length: birthday.year && birthday.month ? new Date(Number(birthday.year), Number(birthday.month), 0).getDate() : 31 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label><label>เดือน<select aria-label="วันเกิด เดือน" value={birthday.month} onChange={event => setBirthday(value => ({ ...value, month: event.target.value, day: "" }))}><option value="">เดือน</option>{thaiMonths.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select></label><label>ปีเกิด<select aria-label="วันเกิด ปี" value={birthday.year} onChange={event => setBirthday(value => ({ ...value, year: event.target.value, day: "" }))}><option value="">ปี</option>{birthYears.map(year => <option key={year} value={year}>{year + 543}</option>)}</select></label></div></fieldset>
          <label>เบอร์โทรศัพท์<input type="tel" required inputMode="numeric" autoComplete="tel" pattern="0[0-9]{9}" maxLength={10} value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value.replace(/\D/g, "") })} /><small>เปลี่ยนเองได้ เบอร์ใหม่ต้องยังไม่ซ้ำกับสมาชิกคนอื่น</small></label>
          <label>อีเมล (ถ้ามี)<input type="email" maxLength={254} autoComplete="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} placeholder="ไม่จำเป็นต้องกรอก" /></label>
          <button className="customer-account-save" type="submit" disabled={busy}>{busy ? "กำลังบันทึก…" : "บันทึกข้อมูล"}</button>
        </form> : <div className="customer-account-details"><div><span>ชื่อ–นามสกุล</span><strong>{shown.name}</strong></div><div><span>เพศ</span><strong>{genderLabel(shown.gender)}</strong></div><div><span>วันเกิด</span><strong>{shown.birthDate ? dateLabel(shown.birthDate) : "ยังไม่ระบุ"}</strong></div><div><span>เบอร์โทร</span><strong>{shown.phone || "ยังไม่ระบุ"}</strong></div><div><span>อีเมล</span><strong>{shown.email || "ยังไม่ระบุ"}</strong></div></div>}
      </section>

      <section className="customer-account-card"><div className="customer-account-section-head"><h2>ประวัติแต้มทั้งหมด</h2><Clock3 size={19} /></div>
        {pointsHistory.length ? <div className="customer-account-history-list">{pointsHistory.map(item => <div key={item.id} className="customer-account-history-item"><span className={`customer-account-history-icon ${item.points_delta >= 0 ? "is-positive" : "is-negative"}`}>{item.points_delta >= 0 ? <Plus size={17} /> : <Minus size={17} />}</span><div><strong>{item.note || (item.points_delta >= 0 ? "ได้รับแต้ม" : "ใช้แต้ม")}</strong><small>{dateLabel(item.created_at)} · {new Date(item.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" })}</small></div><b className={item.points_delta >= 0 ? "is-positive" : ""}>{item.points_delta > 0 ? "+" : ""}{item.points_delta.toLocaleString("th-TH")}</b></div>)}</div> : <p className="customer-account-empty">ยังไม่มีประวัติแต้ม</p>}
        {hasMore && <button type="button" className="customer-history-more" disabled={historyBusy} onClick={() => void loadHistory()}>{historyBusy ? "กำลังโหลด…" : "ดูรายการก่อนหน้า"}</button>}
      </section>

      <section className="customer-account-card customer-account-actions"><div className="customer-account-section-head"><h2>จัดการบัญชี</h2><ShieldCheck size={19} /></div><div className="customer-account-line-status"><Check size={18} />{preview ? "บัญชี LINE" : "เชื่อมต่อ LINE แล้ว"}</div><button type="button" onClick={onLogout} disabled={!onLogout}><LogOut size={18} />ออกจากระบบ<ChevronRight size={17} /></button><button type="button" className="is-danger" onClick={() => { setDeleting(true); setError(""); }}><Trash2 size={18} />ลบบัญชี<ChevronRight size={17} /></button></section>
      <section className="customer-account-card customer-account-privacy">
        <h2>ข้อมูลส่วนบุคคล (PDPA)</h2>
        <details className="customer-privacy-details"><summary>อ่านรายละเอียดการใช้ข้อมูล</summary><h3>ข้อมูลสำหรับการเป็นสมาชิก</h3><p>ร้าน Tammy Pet Shop ใช้ข้อมูลบัญชี LINE ชื่อ เบอร์โทร และข้อมูลที่คุณกรอก เพื่อระบุตัวสมาชิก จัดการแต้มและสิทธิพิเศษ และแสดงประวัติการใช้งานของคุณ</p><h3>ความยินยอมรับข่าวสาร</h3><p>เมื่อเลือกยินยอม ร้านจะใช้ข้อมูลติดต่อและข้อมูลสมาชิกเพื่อส่งข่าวสาร โปรโมชั่น และสิทธิพิเศษผ่าน LINE คุณเปลี่ยนตัวเลือกนี้ได้ทุกเมื่อ โดยยังใช้บัญชีสมาชิกและแต้มได้ตามปกติ</p><p>คุณแก้ไขข้อมูลหรือลบบัญชีได้ในเมนูจัดการบัญชี หากต้องการสอบถามการใช้ข้อมูล ติดต่อร้านผ่าน LINE Official Account</p></details>
        <label className="customer-consent-label"><input type="checkbox" checked={consent} disabled={consentBusy || loading || preview} onChange={event => setConsent(event.target.checked)} /><span>ฉันยินยอมให้ร้านใช้ข้อมูลส่วนบุคคลเพื่อส่งข่าวสาร โปรโมชั่น และสิทธิพิเศษผ่าน LINE</span></label>
        <p>ไม่บังคับ · ถอนความยินยอมได้ทุกเมื่อ</p>
        <button type="button" className="customer-consent-save" disabled={consentBusy || loading || !profile || preview || (consent === profile.privacyConsent && Boolean(profile.consentUpdatedAt))} onClick={() => void saveConsent()}>{consentBusy ? "กำลังบันทึก…" : "บันทึกความยินยอม"}</button>
        {shown.consentUpdatedAt && <p role="status">บันทึกล่าสุด {dateLabel(shown.consentUpdatedAt)} · {shown.privacyConsent ? "ยินยอม" : "ไม่ยินยอม"}</p>}
      </section>
    </>}

    {deleting && profile && <div className="customer-account-dialog" role="dialog" aria-modal="true" aria-labelledby="customer-delete-title"><div className="customer-account-dialog-card"><button className="customer-account-dialog-close" type="button" onClick={() => setDeleting(false)} aria-label="ปิด"><X size={19} /></button><span className="customer-account-delete-icon"><Trash2 size={25} /></span><h2 id="customer-delete-title">ยืนยันลบบัญชี?</h2><p>ข้อมูลสมาชิก แต้มคงเหลือ ประวัติแต้ม คูปอง ของรางวัลที่แลก และประวัติแชตกับร้านจะถูกลบและกู้คืนไม่ได้</p><label>พิมพ์รหัสสมาชิก {profile.memberCode} เพื่อยืนยัน<input value={deleteCode} onChange={event => setDeleteCode(event.target.value.trim().toUpperCase())} autoComplete="off" /></label>{error && <p className="line-signup-error" role="alert">{error}</p>}<button className="customer-account-delete-submit" type="button" disabled={busy || deleteCode !== profile.memberCode} onClick={() => void deleteAccount()}>{busy ? "กำลังลบ…" : "ลบบัญชีถาวร"}</button><button className="customer-account-delete-cancel" type="button" onClick={() => { setDeleting(false); setDeleteCode(""); }}>เก็บบัญชีไว้</button></div></div>}
  </div>;
}
