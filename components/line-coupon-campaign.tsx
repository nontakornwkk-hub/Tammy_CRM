"use client";

import { useEffect, useState } from "react";
import { Check, Gift, RefreshCw, Send, Users } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Rank = "Member" | "Silver" | "Gold" | "Platinum";
type Segment = { tags: string[]; tagMode: "any" | "all"; ranks: Rank[]; lapsedDays: number | null; includeNeverVisited: boolean; minSpend: number | null };
type Coupon = { id: string; title: string; description: string };
type Preview = { counts: { matched: number; consented: number; linked: number; alreadyUsed: number; eligible: number }; message: string; couponTitle: string; previewHash: string; remaining: number | null; connected: boolean };
type Campaign = { id: string; coupon_title: string; recipient_count: number; status: string; created_at: string; error_message: string | null };
const allRanks: Rank[] = ["Member", "Silver", "Gold", "Platinum"];

export function LineCouponCampaign() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [tags, setTags] = useState<{ name: string; color: string }[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [couponId, setCouponId] = useState("");
  const [intro, setIntro] = useState("");
  const [segment, setSegment] = useState<Segment>({ tags: [], tagMode: "any", ranks: [], lapsedDays: null, includeNeverVisited: false, minSpend: null });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());

  async function api(method: "GET" | "POST", body?: Record<string, unknown>) {
    if (!supabase) throw new Error("ยังไม่ได้เชื่อมฐานข้อมูล");
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) throw new Error("กรุณาเข้าสู่ระบบเจ้าของร้าน");
    const response = await fetch("/api/line/messaging/coupon-campaign", { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
    const data = await response.json() as Record<string, unknown> & { error?: string };
    if (!response.ok) throw new Error(data.error || "โหลดข้อมูลไม่สำเร็จ");
    return data;
  }

  async function load() {
    setError("");
    try { const data = await api("GET"); const nextCoupons = data.coupons as Coupon[] || []; setCoupons(nextCoupons); setTags(data.tags as { name: string; color: string }[] || []); setCampaigns(data.campaigns as Campaign[] || []); setCouponId(current => current && nextCoupons.some(item => item.id === current) ? current : nextCoupons[0]?.id || ""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "โหลดข้อมูลไม่สำเร็จ"); }
  }
  useEffect(() => { void load(); }, []);
  function changeSegment(next: Segment) { setSegment(next); setPreview(null); setSuccess(""); }
  async function showPreview() {
    if (!couponId) { setError("กรุณาสร้างคูปองแบบเฉพาะผู้รับก่อน"); return; }
    setBusy(true); setError(""); setSuccess("");
    try { const data = await api("POST", { action: "preview", couponId, intro, segment }); setPreview(data as unknown as Preview); setRequestId(crypto.randomUUID()); }
    catch (cause) { setPreview(null); setError(cause instanceof Error ? cause.message : "ดูตัวอย่างไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  async function send() {
    if (!preview || busy) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      const data = await api("POST", { action: "send", couponId, intro, segment, previewHash: preview.previewHash, expectedCount: preview.counts.eligible, requestId });
      setSuccess(`LINE รับคำขอส่งคูปองให้ ${data.sent} คนแล้ว`); setPreview(null); setRequestId(crypto.randomUUID()); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ส่งคูปองไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  return <section className="line-coupon-campaign" aria-labelledby="line-coupon-title"><div className="line-coupon-heading"><span><Gift size={23} /></span><div><h2 id="line-coupon-title">ส่งคูปองตามกลุ่มลูกค้า</h2><p>เลือกคูปองและเงื่อนไขผู้รับ ตรวจจำนวนและข้อความก่อนส่ง สิทธิ์ QR จะเป็นของสมาชิกแต่ละคนเท่านั้น</p></div></div>
    <div className="line-coupon-grid"><label>คูปองเฉพาะผู้รับ<select value={couponId} onChange={event => { setCouponId(event.target.value); setPreview(null); }}><option value="">เลือกคูปอง</option>{coupons.map(item => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label><label>ข้อความนำ (ไม่บังคับ)<input value={intro} onChange={event => { setIntro(event.target.value); setPreview(null); }} maxLength={300} placeholder="เช่น คิดถึงน้องแมวแล้ว แวะมาใช้คูปองกันนะ" /></label></div>
    {!coupons.length ? <p className="line-coupon-hint">สร้างคูปองในหน้า “คูปอง ของรางวัล และข่าวสาร” แล้วเลือก “เฉพาะสมาชิกที่ได้รับคูปองจาก LINE”</p> : null}
    <div className="line-coupon-filters"><h3>เลือกผู้รับ</h3><p>ไม่เลือกเงื่อนไขใด = สมาชิกทุกคนที่ยินยอมรับข่าวสารและเชื่อม LINE</p><strong>แท็กสมาชิก</strong><div className="line-coupon-chips">{tags.map(tag => <button type="button" key={tag.name} className={segment.tags.includes(tag.name) ? "selected" : ""} onClick={() => changeSegment({ ...segment, tags: segment.tags.includes(tag.name) ? segment.tags.filter(name => name !== tag.name) : [...segment.tags, tag.name] })}>{segment.tags.includes(tag.name) ? <Check size={14} /> : null}{tag.name}</button>)}</div>{segment.tags.length > 1 ? <div className="line-coupon-mode"><label><input type="radio" checked={segment.tagMode === "any"} onChange={() => changeSegment({ ...segment, tagMode: "any" })} /> มีแท็กใดก็ได้</label><label><input type="radio" checked={segment.tagMode === "all"} onChange={() => changeSegment({ ...segment, tagMode: "all" })} /> มีครบทุกแท็ก</label></div> : null}
      <strong>แรงค์สมาชิก</strong><div className="line-coupon-chips">{allRanks.map(rank => <button type="button" key={rank} className={segment.ranks.includes(rank) ? "selected" : ""} onClick={() => changeSegment({ ...segment, ranks: segment.ranks.includes(rank) ? segment.ranks.filter(value => value !== rank) : [...segment.ranks, rank] })}>{segment.ranks.includes(rank) ? <Check size={14} /> : null}{rank}</button>)}</div>
      <div className="line-coupon-grid"><label>ไม่ได้มาร้านเกินกี่วัน<input type="number" min="1" max="365" inputMode="numeric" value={segment.lapsedDays ?? ""} onChange={event => changeSegment({ ...segment, lapsedDays: event.target.value === "" ? null : Number(event.target.value) })} placeholder="เช่น 7 · เว้นว่าง = ทุกคน" /></label><label>ยอดซื้อสะสมขั้นต่ำ (บาท)<input type="number" min="0" inputMode="numeric" value={segment.minSpend ?? ""} onChange={event => changeSegment({ ...segment, minSpend: event.target.value === "" ? null : Number(event.target.value) })} placeholder="เว้นว่าง = ไม่จำกัด" /></label></div>{segment.lapsedDays !== null ? <label className="line-coupon-check"><input type="checkbox" checked={segment.includeNeverVisited} onChange={event => changeSegment({ ...segment, includeNeverVisited: event.target.checked })} /> รวมสมาชิกที่ยังไม่เคยมาร้าน</label> : null}
    </div>
    <button className="button" type="button" disabled={busy || !couponId} onClick={() => void showPreview()}><Users size={17} /> {busy ? "กำลังตรวจ…" : "ดูจำนวนผู้รับและข้อความ"}</button>
    {preview ? <div className="line-coupon-preview"><h3>ตัวอย่างก่อนส่ง</h3><div className="line-coupon-count"><Users size={20} /><strong>{preview.counts.eligible.toLocaleString("th-TH")} คน</strong><small>ตรงเงื่อนไข {preview.counts.matched} · ยินยอม {preview.counts.consented} · เชื่อม LINE {preview.counts.linked}</small></div><pre>{preview.message}</pre>{preview.remaining !== null ? <p>คูปองคงเหลือ {preview.remaining} สิทธิ์</p> : null}<button className="button primary" type="button" disabled={busy || !preview.connected || preview.counts.eligible === 0 || preview.remaining !== null && preview.remaining < preview.counts.eligible} onClick={() => void send()}><Send size={17} /> {busy ? "กำลังส่ง…" : `ส่งคูปองให้ ${preview.counts.eligible} คน`}</button>{!preview.connected ? <p>ยังไม่ได้เชื่อม LINE Messaging API</p> : null}</div> : null}
    {error ? <p className="rewards-gallery-error" role="alert">{error}</p> : null}{success ? <p className="line-coupon-success" role="status">{success}</p> : null}
    {campaigns.length ? <div className="line-coupon-history"><h3>ส่งล่าสุด</h3>{campaigns.map(item => <div key={item.id}><span>{item.coupon_title}</span><small>{item.recipient_count} คน · {new Date(item.created_at).toLocaleString("th-TH")}</small><b>{item.status === "sent" ? "ส่งแล้ว" : item.status === "failed" ? "ส่งไม่สำเร็จ" : "กำลังส่ง"}</b></div>)}</div> : null}
    <button className="line-coupon-refresh" type="button" onClick={() => void load()}><RefreshCw size={15} /> รีเฟรชข้อมูล</button>
  </section>;
}
