"use client";

import { Plus, Tag, X } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { MemberTagDefinition } from "@/lib/database.types";
import { supabase } from "@/lib/supabase/client";
import { clearCachedData, crmOwnerId } from "@/lib/supabase/crm-data";

const colors: { value: MemberTagDefinition["color"]; label: string }[] = [
  { value: "coral", label: "ชมพู" }, { value: "sky", label: "ฟ้า" },
  { value: "mint", label: "เขียว" }, { value: "lavender", label: "ม่วง" },
  { value: "honey", label: "เหลือง" },
];

export function MemberTagSettings({ onChanged }: { onChanged?: () => void }) {
  const [tags, setTags] = useState<MemberTagDefinition[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState<MemberTagDefinition["color"]>("coral");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    const ownerId = crmOwnerId();
    if (!supabase || !ownerId) return;
    const { data, error } = await supabase.from("member_tag_definitions").select("*").eq("owner_id", ownerId).order("name");
    if (error) setNotice(`โหลดแท็กไม่สำเร็จ: ${error.message}`);
    else setTags((data ?? []) as MemberTagDefinition[]);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function createTag(event: FormEvent) {
    event.preventDefault();
    const ownerId = crmOwnerId();
    const trimmed = name.trim().replace(/\s+/g, " ");
    if (!supabase || !ownerId || !trimmed || busy) return;
    if (tags.some((tag) => tag.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) { setNotice("มีแท็กชื่อนี้แล้ว"); return; }
    setBusy(true); setNotice("");
    const { data, error } = await supabase.from("member_tag_definitions").insert({ owner_id: ownerId, name: trimmed, color }).select("*").single();
    setBusy(false);
    if (error || !data) { setNotice(`สร้างแท็กไม่สำเร็จ: ${error?.message ?? "ไม่พบข้อมูล"}`); return; }
    setTags((current) => [...current, data as MemberTagDefinition].sort((a, b) => a.name.localeCompare(b.name, "th")));
    setName(""); clearCachedData("members"); onChanged?.(); setNotice("สร้างแท็กแล้ว");
  }
  async function changeColor(tag: MemberTagDefinition, nextColor: MemberTagDefinition["color"]) {
    if (!supabase || busy || tag.color === nextColor) return;
    setBusy(true); setNotice("");
    const { data, error } = await supabase.from("member_tag_definitions").update({ color: nextColor }).eq("id", tag.id).eq("owner_id", crmOwnerId() || "").select("*").single();
    setBusy(false);
    if (error || !data) { setNotice(`เปลี่ยนสีไม่สำเร็จ: ${error?.message ?? "ไม่พบข้อมูล"}`); return; }
    setTags((current) => current.map((item) => item.id === tag.id ? data as MemberTagDefinition : item));
    clearCachedData("members"); onChanged?.();
  }
  async function deleteTag(tag: MemberTagDefinition) {
    if (!supabase || busy || !window.confirm(`ลบแท็ก “${tag.name}” ออกจากสมาชิกทุกคน?`)) return;
    setBusy(true); setNotice("");
    const { error } = await supabase.from("member_tag_definitions").delete().eq("id", tag.id).eq("owner_id", crmOwnerId() || "");
    setBusy(false);
    if (error) { setNotice(`ลบแท็กไม่สำเร็จ: ${error.message}`); return; }
    setTags((current) => current.filter((item) => item.id !== tag.id));
    clearCachedData("members"); onChanged?.(); setNotice("ลบแท็กออกจากสมาชิกทุกคนแล้ว");
  }

  return <section className="settings-card member-tag-settings">
    <div className="card-heading"><div><h2><Tag size={21} /> จัดการแท็กสมาชิก</h2><p>สร้างแท็กและกำหนดสีที่นี่ แล้วเลือกใช้ในข้อมูลสมาชิกแต่ละคน</p></div></div>
    <form className="member-tag-create" onSubmit={createTag}>
      <label htmlFor="settings-tag-name">ชื่อแท็ก<input id="settings-tag-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={30} placeholder="เช่น ลูกค้าประจำ" /></label>
      <button type="submit" disabled={busy || !name.trim()}><Plus size={16} /> สร้างแท็ก</button>
      <div className="member-tag-color-picker" role="group" aria-label="เลือกสีแท็กใหม่">{colors.map(({ value, label }) => <button key={value} type="button" className={`tag-color-${value}${color === value ? " selected" : ""}`} aria-label={`สี${label}`} aria-pressed={color === value} onClick={() => setColor(value)} />)}</div>
    </form>
    <div className="member-tag-manage"><strong>แท็กทั้งหมด</strong>{tags.length ? tags.map((tag) => <div className="member-tag-manage-row" key={tag.id}><span className={`member-profile-tag tag-color-${tag.color}`}>{tag.name}</span><div className="member-tag-color-picker" role="group" aria-label={`สีของแท็ก ${tag.name}`}>{colors.map(({ value, label }) => <button key={value} type="button" className={`tag-color-${value}${tag.color === value ? " selected" : ""}`} aria-label={`เปลี่ยนแท็ก ${tag.name} เป็นสี${label}`} aria-pressed={tag.color === value} disabled={busy} onClick={() => void changeColor(tag, value)} />)}</div><button className="member-tag-delete" type="button" disabled={busy} onClick={() => void deleteTag(tag)}><X size={14} /> ลบแท็ก</button></div>) : <p>ยังไม่มีแท็ก</p>}</div>
    {notice ? <p role="status" className="member-tag-settings-notice">{notice}</p> : null}
  </section>;
}
