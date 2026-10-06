"use client";

import Image from "next/image";
import { Cat, Dog, Check, ChevronRight, Clock3, LogOut, Minus, Pencil, Plus, ShieldCheck, Star, Trash2, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { watchCatalogChanges, notifyCatalogChanged } from "@/lib/catalog-live";
import { cachedMemberAccount, clearMemberAccount, loadMemberAccount, type Profile, type PointEntry } from "@/lib/customer-account-data";
import { CustomerBirthdayPicker } from "./customer-birthday-picker";
import { CustomerGenderPicker } from "./customer-gender-picker";


const previewProfile: Profile = {
  dogCount: 0, catCount: 0,
  memberCode: "TMA0001", name: "คุณแอดมิน", firstName: "คุณ", lastName: "แอดมิน", gender: "", birthDate: "",
  phone: "", email: "", level: "Gold", points: 90, birthdayChangedAt: "", lineDisplayName: "", linePictureUrl: "", privacyConsent: false, consentUpdatedAt: "",
};
function dateLabel(value: string) {
  return new Date(value).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });
}

function genderLabel(value: string) {
  return { female: "หญิง", male: "ชาย", other: "อื่น ๆ", prefer_not_to_say: "ไม่ประสงค์ระบุ" }[value] || "ยังไม่ระบุ";
}

export function CustomerAccount({ preview, member, idToken, accessToken, onLogout, onMemberUpdated, refreshKey = 0 }: {
  preview: boolean;
  refreshKey?: number;
  member?: { memberCode: string; name: string; level: string; points: number; linePictureUrl?: string | null };
  idToken?: string;
  accessToken?: string;
  onLogout?: () => void;
  onMemberUpdated?: (name: string) => void;
}) {
  const initialAccount = preview ? undefined : cachedMemberAccount(idToken, accessToken);
  const [profile, setProfile] = useState<Profile | null>(preview ? previewProfile : initialAccount?.profile || null);
  const [form, setForm] = useState<Profile | null>(preview ? previewProfile : initialAccount?.profile || null);
  const [pointsHistory, setPointsHistory] = useState<PointEntry[]>(initialAccount?.pointsHistory || []);
  const [hasMore, setHasMore] = useState(Boolean(initialAccount?.hasMore));
  const [historyBusy, setHistoryBusy] = useState(false);
  const [consent, setConsent] = useState(Boolean(initialAccount?.profile.privacyConsent));
  const editingRef=useRef(false),consentDirty=useRef(false);
  const [consentBusy, setConsentBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteCode, setDeleteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!preview && !initialAccount);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  editingRef.current=editing;
  useEffect(() => {
    if (!editing) return;
    const frame = requestAnimationFrame(() => document.querySelector(".customer-account-form")?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    return () => cancelAnimationFrame(frame);
  }, [editing]);

useEffect(() => {
    if (preview || (!idToken && !accessToken)) return;
    let active = true;
    const refresh = async (fresh=false) => {
      try {
        const data = await loadMemberAccount(idToken, accessToken, { fresh: fresh || refreshKey > 0 });
        if (active) { setProfile(data.profile); if(!editingRef.current)setForm(data.profile); if(!consentDirty.current)setConsent(data.profile.privacyConsent); setPointsHistory(items=>items.length>5?[...(data.pointsHistory||[]),...items.filter(item=>!data.pointsHistory.some(next=>next.id===item.id))]:(data.pointsHistory||[])); setHasMore(Boolean(data.hasMore)); }
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "โหลดข้อมูลไม่สำเร็จ"); }
      finally { if (active) setLoading(false); }
    };
    void refresh();
    const stopWatching=watchCatalogChanges(()=>void refresh(true));
    return () => { active = false; stopWatching(); };
  }, [preview, idToken, accessToken, refreshKey]);

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
      consentDirty.current=false;
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
      const birthDate = form.birthDate;
      if (profile?.birthDate && !birthDate) throw new Error("กรุณาเลือกวันเกิดให้ครบก่อนบันทึก");
      const updatedForm = { ...form, birthDate };
      let savedName = `${form.firstName.trim()} ${form.lastName.trim()}`;
      if (!preview) {
        const response = await fetch("/api/line/member/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update", idToken, accessToken, profile: updatedForm }) });
        const data = await response.json() as { name?: string; birthdayChangedAt?: string; error?: string };
        if (!response.ok || !data.name) throw new Error(data.error || "บันทึกข้อมูลไม่สำเร็จ");
        savedName = data.name;
        updatedForm.birthdayChangedAt = data.birthdayChangedAt || "";
        onMemberUpdated?.(data.name);
        clearMemberAccount();
        notifyCatalogChanged();
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
  const visibleHistory = showAllHistory ? pointsHistory : pointsHistory.slice(0, 5);
  const nextBirthdayEdit = shown?.birthdayChangedAt ? new Date(shown.birthdayChangedAt) : null;
  nextBirthdayEdit?.setUTCFullYear(nextBirthdayEdit.getUTCFullYear() + 1);
  const birthdayLocked = Boolean(nextBirthdayEdit && nextBirthdayEdit.getTime() > Date.now());

  return <div className="customer-account">
    <div className="customer-account-page-title"><h1>ข้อมูลของฉัน</h1><span aria-hidden="true">✦</span></div>
    {loading && !shown && <p className="customer-home-catalog-state" role="status">กำลังโหลดข้อมูลสมาชิก…</p>}
    {error && <p className="line-signup-error" role="alert">{error}</p>}
    {message && <p className="customer-account-success" role="status"><Check size={17} />{message}</p>}
    {shown && <>
      <section className="customer-account-card customer-account-profile">
        <div className="customer-account-identity"><span className="customer-account-avatar">{shown.linePictureUrl ? <Image src={shown.linePictureUrl} alt="รูปโปรไฟล์ LINE" width={66} height={66} unoptimized /> : <UserRound size={29} />}</span><div><small>โปรไฟล์สมาชิก</small><strong>{shown.name}</strong><span>{shown.memberCode} · {shown.level}</span>{shown.lineDisplayName && <em>LINE: {shown.lineDisplayName}</em>}</div></div>
        <div className="customer-account-points"><Star size={18} /> คะแนนสะสม <strong>{Number(member?.points ?? shown.points).toLocaleString("th-TH")} แต้ม</strong></div>
      </section>

      <section className="customer-account-card"><div className="customer-account-section-head"><div><small>ข้อมูลสมาชิก</small><h2>ข้อมูลส่วนตัว</h2></div><button type="button" onClick={() => { setForm(profile);  setEditing(value => !value); setError(""); }}><Pencil size={16} />{editing ? "ยกเลิก" : "แก้ไข"}</button></div>
        {editing && form ? <form className="customer-account-form" onSubmit={saveProfile}>
          <div className="customer-account-form-row"><label>ชื่อ<input required maxLength={80} autoComplete="given-name" value={form.firstName} onChange={event => setForm({ ...form, firstName: event.target.value })} /></label><label>นามสกุล<input required maxLength={80} autoComplete="family-name" value={form.lastName} onChange={event => setForm({ ...form, lastName: event.target.value })} /></label></div>
          <CustomerGenderPicker value={form.gender} onChange={gender => setForm({ ...form, gender })} />
          <CustomerBirthdayPicker value={form.birthDate} onChange={birthDate => setForm({ ...form, birthDate })} disabled={birthdayLocked} />
          <p className="customer-birthday-rule" role="note">{birthdayLocked && nextBirthdayEdit ? `วันเกิดแก้ได้ปีละครั้ง · แก้ได้อีกครั้ง ${dateLabel(nextBirthdayEdit.toISOString())}` : "วันเกิดแก้ได้ปีละครั้ง โปรดตรวจสอบก่อนบันทึก"}</p>
          <label>เบอร์โทรศัพท์<input type="tel" required inputMode="numeric" autoComplete="tel" pattern="0[0-9]{9}" maxLength={10} value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value.replace(/\D/g, "") })} /><small>เปลี่ยนเองได้ เบอร์ใหม่ต้องยังไม่ซ้ำกับสมาชิกคนอื่น</small></label>
          <label>อีเมล (ถ้ามี)<input type="email" maxLength={254} autoComplete="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} placeholder="ไม่จำเป็นต้องกรอก" /></label>
          <fieldset className="customer-pet-fields"><legend>สัตว์เลี้ยงของฉัน</legend><div className="customer-account-form-row">{([{ key: "dogCount", label: "สุนัข", Icon: Dog }, { key: "catCount", label: "แมว", Icon: Cat }] as const).map(({ key, label, Icon }) => <label key={key}><span><Icon size={18} />{label} (ตัว)</span><input type="number" required min={0} max={999} step={1} inputMode="numeric" value={Number.isNaN(form[key]) ? "" : form[key] ?? 0} onChange={event => setForm({ ...form, [key]: event.target.value === "" ? NaN : Number(event.target.value) })} /></label>)}</div><small>ถ้าไม่ได้เลี้ยง ให้ใส่ 0</small></fieldset>
          <button className="customer-account-save" type="submit" disabled={busy}>{busy ? "กำลังบันทึก…" : "บันทึกข้อมูล"}</button>
        </form> : <div className="customer-account-details"><div><span>ชื่อ–นามสกุล</span><strong>{shown.name}</strong></div><div><span>เพศ</span><strong>{genderLabel(shown.gender)}</strong></div><div><span>วันเกิด</span><strong>{shown.birthDate ? dateLabel(shown.birthDate) : "ยังไม่ระบุ"}</strong></div><div><span>เบอร์โทร</span><strong>{shown.phone || "ยังไม่ระบุ"}</strong></div><div><span>อีเมล</span><strong>{shown.email || "ยังไม่ระบุ"}</strong></div></div>}
      </section>

      <section className="customer-account-card customer-pets"><div className="customer-account-section-head"><div><small>เพื่อนตัวน้อยของคุณ</small><h2>สัตว์เลี้ยงของฉัน</h2></div></div><div className="customer-pet-summary"><div><span className="customer-pet-icon"><Dog size={24} /></span><span>สุนัข<strong>{shown.dogCount ?? 0} <small>ตัว</small></strong></span></div><div><span className="customer-pet-icon is-cat"><Cat size={24} /></span><span>แมว<strong>{shown.catCount ?? 0} <small>ตัว</small></strong></span></div></div><p className="customer-pet-hint">เปลี่ยนจำนวนได้ที่ปุ่มแก้ไขข้อมูลส่วนตัว</p></section>

      <section className="customer-account-card customer-account-history"><div className="customer-account-section-head"><h2>{showAllHistory ? "ประวัติแต้มทั้งหมด" : "ประวัติแต้มล่าสุด"}</h2>{(pointsHistory.length > 5 || hasMore) ? <button type="button" className="customer-history-view-all" onClick={() => { if (!showAllHistory && hasMore && pointsHistory.length <= 5) void loadHistory(); setShowAllHistory(value => !value); }}>{showAllHistory ? "ย่อรายการ" : "ดูทั้งหมด"}<ChevronRight size={16} /></button> : <Clock3 size={19} />}</div>
        {pointsHistory.length ? <div className="customer-account-history-list">{visibleHistory.map(item => <div key={item.id} className="customer-account-history-item"><span className={`customer-account-history-icon ${item.points_delta >= 0 ? "is-positive" : "is-negative"}`}>{item.points_delta >= 0 ? <Plus size={17} /> : <Minus size={17} />}</span><div><strong>{item.note || (item.points_delta >= 0 ? "ได้รับแต้ม" : "ใช้แต้ม")}</strong><small>{dateLabel(item.created_at)} · {new Date(item.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" })}</small></div><b className={item.points_delta >= 0 ? "is-positive" : ""}>{item.points_delta > 0 ? "+" : ""}{item.points_delta.toLocaleString("th-TH")}</b></div>)}</div> : <p className="customer-account-empty">ยังไม่มีประวัติแต้ม</p>}
        {showAllHistory && hasMore && <button type="button" className="customer-history-more" disabled={historyBusy} onClick={() => void loadHistory()}>{historyBusy ? "กำลังโหลด…" : "โหลดรายการก่อนหน้า"}</button>}
      </section>

      <section className="customer-account-card customer-account-actions"><div className="customer-account-section-head"><h2>จัดการบัญชี</h2><ShieldCheck size={19} /></div><div className="customer-account-line-status"><Check size={18} />{preview ? "บัญชี LINE" : "เชื่อมต่อ LINE แล้ว"}</div><button type="button" onClick={onLogout} disabled={!onLogout}><LogOut size={18} />ออกจากระบบ<ChevronRight size={17} /></button><button type="button" className="is-danger" onClick={() => { setDeleting(true); setError(""); }}><Trash2 size={18} />ลบบัญชี<ChevronRight size={17} /></button></section>
      <section className="customer-account-card customer-account-privacy">
        <h2>ข้อมูลส่วนบุคคล (PDPA)</h2>
        <details className="customer-privacy-details"><summary>อ่านรายละเอียดการใช้ข้อมูล</summary><h3>ข้อมูลสำหรับการเป็นสมาชิก</h3><p>ร้าน Tammy Pet Shop ใช้ข้อมูลบัญชี LINE ชื่อ เบอร์โทร และข้อมูลที่คุณกรอก เพื่อระบุตัวสมาชิก จัดการแต้มและสิทธิพิเศษ และแสดงประวัติการใช้งานของคุณ</p><h3>ความยินยอมรับข่าวสาร</h3><p>เมื่อเลือกยินยอม ร้านจะใช้ข้อมูลติดต่อและข้อมูลสมาชิกเพื่อส่งข่าวสาร โปรโมชั่น และสิทธิพิเศษผ่าน LINE คุณเปลี่ยนตัวเลือกนี้ได้ทุกเมื่อ โดยยังใช้บัญชีสมาชิกและแต้มได้ตามปกติ</p><p>คุณแก้ไขข้อมูลหรือลบบัญชีได้ในเมนูจัดการบัญชี หากต้องการสอบถามการใช้ข้อมูล ติดต่อร้านผ่าน LINE Official Account</p></details>
        <label className="customer-consent-label"><input type="checkbox" checked={consent} disabled={consentBusy || loading || preview} onChange={event => {consentDirty.current=true;setConsent(event.target.checked);}} /><span>ฉันยินยอมให้ร้านใช้ข้อมูลส่วนบุคคลเพื่อส่งข่าวสาร โปรโมชั่น และสิทธิพิเศษผ่าน LINE</span></label>
        <p>ไม่บังคับ · ถอนความยินยอมได้ทุกเมื่อ</p>
        <button type="button" className="customer-consent-save" disabled={consentBusy || loading || !profile || preview || (consent === profile.privacyConsent && Boolean(profile.consentUpdatedAt))} onClick={() => void saveConsent()}>{consentBusy ? "กำลังบันทึก…" : "บันทึกความยินยอม"}</button>
        {shown.consentUpdatedAt && <p role="status">บันทึกล่าสุด {dateLabel(shown.consentUpdatedAt)} · {shown.privacyConsent ? "ยินยอม" : "ไม่ยินยอม"}</p>}
      </section>
    </>}

    {deleting && profile && <div className="customer-account-dialog" role="dialog" aria-modal="true" aria-labelledby="customer-delete-title"><div className="customer-account-dialog-card"><button className="customer-account-dialog-close" type="button" onClick={() => setDeleting(false)} aria-label="ปิด"><X size={19} /></button><span className="customer-account-delete-icon"><Trash2 size={25} /></span><h2 id="customer-delete-title">ยืนยันลบบัญชี?</h2><p>ข้อมูลสมาชิก แต้มคงเหลือ ประวัติแต้ม คูปอง ของรางวัลที่แลก และประวัติแชตกับร้านจะถูกลบและกู้คืนไม่ได้</p><label>พิมพ์รหัสสมาชิก {profile.memberCode} เพื่อยืนยัน<input value={deleteCode} onChange={event => setDeleteCode(event.target.value.trim().toUpperCase())} autoComplete="off" /></label>{error && <p className="line-signup-error" role="alert">{error}</p>}<button className="customer-account-delete-submit" type="button" disabled={busy || deleteCode !== profile.memberCode} onClick={() => void deleteAccount()}>{busy ? "กำลังลบ…" : "ลบบัญชีถาวร"}</button><button className="customer-account-delete-cancel" type="button" onClick={() => { setDeleting(false); setDeleteCode(""); }}>เก็บบัญชีไว้</button></div></div>}
  </div>;
}
