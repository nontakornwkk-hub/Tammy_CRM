"use client";

import Image from "next/image";
import { Check, ChevronRight, Clock3, Gift, LogOut, Pencil, ShieldCheck, Star, TicketPercent, Trash2, UserRound, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

type Profile = {
  memberCode: string; name: string; firstName: string; lastName: string; gender: string;
  birthDate: string; phone: string; email: string; level: string; points: number;
  lineDisplayName: string; linePictureUrl: string;
};
type PointEntry = { id: string; points_delta: number; transaction_type: string; note: string; created_at: string };
type Redemption = { id: string; kind: "coupon" | "reward"; title: string; pointsSpent: number; status: string; redeemedAt: string };
type HistoryTab = "points" | "coupons" | "rewards";

const previewProfile: Profile = {
  memberCode: "TM000001", name: "คุณแอดมิน", firstName: "คุณ", lastName: "แอดมิน", gender: "", birthDate: "",
  phone: "", email: "", level: "Gold", points: 90, lineDisplayName: "", linePictureUrl: "",
};

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });
}

function genderLabel(value: string) {
  return { female: "หญิง", male: "ชาย", other: "อื่น ๆ", prefer_not_to_say: "ไม่ประสงค์ระบุ" }[value] || "ยังไม่ระบุ";
}

function statusLabel(value: string) {
  return { completed: "สำเร็จ", pending: "รอดำเนินการ", cancelled: "ยกเลิก" }[value] || value;
}

export function CustomerAccount({ preview, member, idToken, onLogout, onMemberUpdated }: {
  preview: boolean;
  member?: { memberCode: string; name: string; level: string; points: number };
  idToken?: string;
  onLogout?: () => void;
  onMemberUpdated?: (name: string) => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(preview ? previewProfile : null);
  const [form, setForm] = useState<Profile | null>(preview ? previewProfile : null);
  const [pointsHistory, setPointsHistory] = useState<PointEntry[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [historyTab, setHistoryTab] = useState<HistoryTab>("points");
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteCode, setDeleteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!preview);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (preview || !idToken) return;
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/line/member/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "load", idToken }) });
        const data = await response.json() as { profile?: Profile; pointsHistory?: PointEntry[]; redemptions?: Redemption[]; error?: string };
        if (!response.ok || !data.profile) throw new Error(data.error || "โหลดข้อมูลไม่สำเร็จ");
        if (active) { setProfile(data.profile); setForm(data.profile); setPointsHistory(data.pointsHistory || []); setRedemptions(data.redemptions || []); }
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "โหลดข้อมูลไม่สำเร็จ"); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [preview, idToken]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      let savedName = `${form.firstName.trim()} ${form.lastName.trim()}`;
      if (!preview) {
        const response = await fetch("/api/line/member/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update", idToken, profile: form }) });
        const data = await response.json() as { name?: string; error?: string };
        if (!response.ok || !data.name) throw new Error(data.error || "บันทึกข้อมูลไม่สำเร็จ");
        savedName = data.name;
        onMemberUpdated?.(data.name);
      }
      const updatedProfile = { ...form, name: savedName };
      setProfile(updatedProfile); setForm(updatedProfile); setEditing(false); setMessage("บันทึกข้อมูลเรียบร้อยแล้ว");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "บันทึกข้อมูลไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function deleteAccount() {
    if (!profile || deleteCode !== profile.memberCode || busy) return;
    setBusy(true); setError("");
    try {
      if (!preview) {
        const response = await fetch("/api/line/member/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", idToken, memberCode: deleteCode }) });
        const data = await response.json() as { success?: boolean; error?: string };
        if (!response.ok || !data.success) throw new Error(data.error || "ลบบัญชีไม่สำเร็จ");
        onLogout?.();
      } else { setDeleting(false); setDeleteCode(""); setMessage("ปิดหน้าต่างยืนยันแล้ว"); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ลบบัญชีไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  const shown = profile || (member ? { ...previewProfile, ...member, firstName: member.name, memberCode: member.memberCode } : null);
  const items = historyTab === "points" ? pointsHistory : redemptions.filter(item => item.kind === (historyTab === "coupons" ? "coupon" : "reward"));

  return <div className="customer-account">
    {loading && <p className="customer-home-catalog-state" role="status">กำลังโหลดข้อมูลสมาชิก…</p>}
    {error && <p className="line-signup-error" role="alert">{error}</p>}
    {message && <p className="customer-account-success" role="status"><Check size={17} />{message}</p>}
    {shown && <>
      <section className="customer-account-card customer-account-profile">
        <div className="customer-account-identity"><span className="customer-account-avatar">{shown.linePictureUrl ? <Image src={shown.linePictureUrl} alt="รูปโปรไฟล์ LINE" width={66} height={66} unoptimized /> : <UserRound size={29} />}</span><div><small>โปรไฟล์สมาชิก</small><strong>{shown.name}</strong><span>{shown.memberCode} · {shown.level}</span>{shown.lineDisplayName && <em>LINE: {shown.lineDisplayName}</em>}</div></div>
        <div className="customer-account-points"><Star size={18} /> คะแนนสะสม <strong>{Number(shown.points).toLocaleString("th-TH")} แต้ม</strong></div>
      </section>

      <section className="customer-account-card"><div className="customer-account-section-head"><div><small>ข้อมูลสมาชิก</small><h2>ข้อมูลส่วนตัว</h2></div><button type="button" onClick={() => { setForm(profile); setEditing(value => !value); setError(""); }}><Pencil size={16} />{editing ? "ยกเลิก" : "แก้ไข"}</button></div>
        {editing && form ? <form className="customer-account-form" onSubmit={saveProfile}>
          <div className="customer-account-form-row"><label>ชื่อ<input required maxLength={80} autoComplete="given-name" value={form.firstName} onChange={event => setForm({ ...form, firstName: event.target.value })} /></label><label>นามสกุล<input required maxLength={80} autoComplete="family-name" value={form.lastName} onChange={event => setForm({ ...form, lastName: event.target.value })} /></label></div>
          <label>เพศ<select value={form.gender} onChange={event => setForm({ ...form, gender: event.target.value })}><option value="">ไม่ระบุ</option><option value="female">หญิง</option><option value="male">ชาย</option><option value="other">อื่น ๆ</option><option value="prefer_not_to_say">ไม่ประสงค์ระบุ</option></select></label>
          <label>วันเกิด<input type="date" min="1900-01-01" max={new Date().toISOString().slice(0, 10)} value={form.birthDate} onChange={event => setForm({ ...form, birthDate: event.target.value })} /></label>
          <label>เบอร์โทรศัพท์<input type="tel" required inputMode="numeric" autoComplete="tel" pattern="0[0-9]{9}" maxLength={10} value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value.replace(/\D/g, "") })} /><small>เปลี่ยนเองได้ เบอร์ใหม่ต้องยังไม่ซ้ำกับสมาชิกคนอื่น</small></label>
          <label>อีเมล (ถ้ามี)<input type="email" maxLength={254} autoComplete="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} placeholder="ไม่จำเป็นต้องกรอก" /></label>
          <button className="customer-account-save" type="submit" disabled={busy}>{busy ? "กำลังบันทึก…" : "บันทึกข้อมูล"}</button>
        </form> : <div className="customer-account-details"><div><span>ชื่อ–นามสกุล</span><strong>{shown.name}</strong></div><div><span>เพศ</span><strong>{genderLabel(shown.gender)}</strong></div><div><span>วันเกิด</span><strong>{shown.birthDate ? dateLabel(shown.birthDate) : "ยังไม่ระบุ"}</strong></div><div><span>เบอร์โทร</span><strong>{shown.phone || "ยังไม่ระบุ"}</strong></div><div><span>อีเมล</span><strong>{shown.email || "ยังไม่ระบุ"}</strong></div></div>}
      </section>

      <section className="customer-account-card"><div className="customer-account-section-head"><div><small>รายการของฉัน</small><h2>ประวัติการใช้งาน</h2></div><Clock3 size={19} /></div><div className="customer-account-history-tabs" role="tablist" aria-label="ประเภทประวัติ"><button type="button" role="tab" aria-selected={historyTab === "points"} onClick={() => setHistoryTab("points")}>แต้ม</button><button type="button" role="tab" aria-selected={historyTab === "coupons"} onClick={() => setHistoryTab("coupons")}>คูปอง</button><button type="button" role="tab" aria-selected={historyTab === "rewards"} onClick={() => setHistoryTab("rewards")}>ของรางวัล</button></div>
        {items.length ? <div className="customer-account-history-list">{historyTab === "points" ? pointsHistory.map(item => <div key={item.id} className="customer-account-history-item"><span className="customer-account-history-icon"><Star size={18} /></span><div><strong>{item.note || (item.points_delta >= 0 ? "ได้รับแต้ม" : "ใช้แต้ม")}</strong><small>{dateLabel(item.created_at)} · สำเร็จ</small></div><b className={item.points_delta >= 0 ? "is-positive" : ""}>{item.points_delta > 0 ? "+" : ""}{item.points_delta.toLocaleString("th-TH")} แต้ม</b></div>) : redemptions.filter(item => item.kind === (historyTab === "coupons" ? "coupon" : "reward")).map(item => <div key={item.id} className="customer-account-history-item"><span className="customer-account-history-icon">{item.kind === "coupon" ? <TicketPercent size={18} /> : <Gift size={18} />}</span><div><strong>{item.title}</strong><small>{dateLabel(item.redeemedAt)} · {statusLabel(item.status)}</small></div><b>{item.pointsSpent > 0 ? `−${item.pointsSpent.toLocaleString("th-TH")} แต้ม` : "ใช้สิทธิ์"}</b></div>)}</div> : <p className="customer-account-empty">ยังไม่มีประวัติ{historyTab === "points" ? "แต้ม" : historyTab === "coupons" ? "การใช้คูปอง" : "การแลกของรางวัล"}</p>}
      </section>

      <section className="customer-account-card customer-account-actions"><div className="customer-account-section-head"><div><small>บัญชีของคุณ</small><h2>จัดการบัญชี</h2></div><ShieldCheck size={19} /></div><button type="button" onClick={onLogout} disabled={!onLogout}><LogOut size={18} />ออกจากระบบ<ChevronRight size={17} /></button><button type="button" className="is-danger" onClick={() => { setDeleting(true); setError(""); }}><Trash2 size={18} />ลบบัญชี<ChevronRight size={17} /></button></section>
    </>}

    {deleting && profile && <div className="customer-account-dialog" role="dialog" aria-modal="true" aria-labelledby="customer-delete-title"><div className="customer-account-dialog-card"><button className="customer-account-dialog-close" type="button" onClick={() => setDeleting(false)} aria-label="ปิด"><X size={19} /></button><span className="customer-account-delete-icon"><Trash2 size={25} /></span><h2 id="customer-delete-title">ยืนยันลบบัญชี?</h2><p>ข้อมูลสมาชิก แต้มคงเหลือ ประวัติแต้ม คูปอง ของรางวัลที่แลก และประวัติแชตกับร้านจะถูกลบและกู้คืนไม่ได้</p><label>พิมพ์รหัสสมาชิก {profile.memberCode} เพื่อยืนยัน<input value={deleteCode} onChange={event => setDeleteCode(event.target.value.trim().toUpperCase())} autoComplete="off" /></label>{error && <p className="line-signup-error" role="alert">{error}</p>}<button className="customer-account-delete-submit" type="button" disabled={busy || deleteCode !== profile.memberCode} onClick={() => void deleteAccount()}>{busy ? "กำลังลบ…" : "ลบบัญชีถาวร"}</button><button className="customer-account-delete-cancel" type="button" onClick={() => { setDeleting(false); setDeleteCode(""); }}>เก็บบัญชีไว้</button></div></div>}
  </div>;
}
