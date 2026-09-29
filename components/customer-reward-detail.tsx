"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Check, Gift, Heart, MapPin, PawPrint, ShieldCheck, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type RewardDetail = {
  id: string;
  title: string;
  description: string;
  category: string;
  image_url: string | null;
  points_cost: number;
  stock: number | null;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
};

const previewPoints = 90;

export function CustomerRewardDetail({ id }: { id: string }) {
  const [reward, setReward] = useState<RewardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [section, setSection] = useState<"details" | "terms">("details");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [redeemed, setRedeemed] = useState(false);

  useEffect(() => {
    if (!supabase) { setError("ยังไม่ได้ตั้งค่า Supabase"); setLoading(false); return; }
    let active = true;
    void (async () => {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw new Error("กรุณาเข้าสู่ระบบแอดมินเพื่อดูข้อมูลจริง");
        const access = await supabase.rpc("crm_current_access").maybeSingle();
        let ownerId = (access.data as { owner_id?: string } | null)?.owner_id;
        if (access.error) {
          const fallback = await supabase.from("store_settings").select("owner_id").eq("owner_id", auth.user.id).maybeSingle();
          ownerId = fallback.data?.owner_id;
        }
        if (!ownerId) throw new Error("บัญชีนี้ไม่มีสิทธิ์ดูข้อมูลร้าน");
        const result = await supabase.from("rewards")
          .select("id,title,description,category,image_url,points_cost,stock,starts_at,ends_at,active")
          .eq("owner_id", ownerId).eq("id", id).eq("active", true).maybeSingle();
        if (result.error) throw result.error;
        const item = result.data as RewardDetail | null;
        const now = Date.now();
        if (!item || (item.starts_at && Date.parse(item.starts_at) > now) || (item.ends_at && Date.parse(item.ends_at) < now) || item.stock === 0) {
          throw new Error("ไม่พบของรางวัลที่เปิดให้แลกในขณะนี้");
        }
        if (active) setReward(item);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "โหลดรายละเอียดของรางวัลไม่สำเร็จ");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id]);

  const price = reward?.points_cost.toLocaleString("th-TH") || "0";

  return <main className="customer-portal customer-home-page customer-reward-page">
    <header className="customer-reward-header">
      <Link href="/customer?tab=rewards" aria-label="กลับไปหน้าของรางวัล"><ArrowLeft size={25} /></Link>
      <strong>รายละเอียดของรางวัล</strong>
      <PawPrint size={22} aria-hidden="true" />
    </header>
    {loading ? <p className="customer-reward-load">กำลังโหลดรายละเอียดของรางวัล…</p> : error ? <div className="customer-reward-load" role="alert"><p>{error}</p><Link href="/customer?tab=rewards">กลับไปหน้าของรางวัล</Link></div> : reward ? <>
      <div className="customer-reward-hero">
        {reward.image_url ? <Image className="customer-reward-hero-photo" src={reward.image_url} alt={reward.title} fill sizes="(max-width: 520px) 100vw, 520px" unoptimized /> : <><Image className="customer-reward-hero-mascot" src="/assets/tammy-member-entry-logo.png" alt="" width={255} height={255} /><span><Gift size={54} /><small>Tammy Pet Shop</small></span></>}
        <span className="customer-reward-hero-badge"><PawPrint size={16} /> {price} แต้ม</span>
      </div>
      <div className="customer-reward-sheet">
        <span className="customer-reward-category">{reward.category || "ของรางวัล"}</span>
        <h1>{reward.title}</h1>
        <div className="customer-reward-metrics">
          <strong><PawPrint size={21} /> {price} แต้ม</strong>
          <span>แต้มของคุณ <b>{previewPoints.toLocaleString("th-TH")}</b></span>
        </div>
        <div className="customer-reward-availability"><Gift size={18} /> {reward.stock === null ? "มีของรางวัลพร้อมแลก" : `คงเหลือ ${reward.stock.toLocaleString("th-TH")} ชิ้น`}</div>
        {reward.ends_at ? <div className="customer-reward-date"><CalendarDays size={18} /> แลกได้ถึง {new Date(reward.ends_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" })}</div> : null}
        <div className="customer-reward-sections" role="tablist" aria-label="ข้อมูลของรางวัล">
          <button type="button" role="tab" aria-selected={section === "details"} className={section === "details" ? "active" : ""} onClick={() => setSection("details")}>รายละเอียด</button>
          <button type="button" role="tab" aria-selected={section === "terms"} className={section === "terms" ? "active" : ""} onClick={() => setSection("terms")}>เงื่อนไข</button>
        </div>
        {section === "details" ? <div className="customer-reward-section" role="tabpanel"><h2>รายละเอียดของรางวัล</h2><p>{reward.description || "ของรางวัลพิเศษจาก Tammy Pet Shop สำหรับสมาชิกคนสำคัญ"}</p><div className="customer-reward-info-line"><MapPin size={19} /><span>รับของรางวัลที่หน้าร้านเท่านั้น</span></div></div> : <div className="customer-reward-section" role="tabpanel"><h2>เงื่อนไขการแลก</h2><ul><li>แลกและรับของรางวัลได้ที่หน้าร้าน Tammy Pet Shop เท่านั้น</li><li>กรุณายื่นหน้าจอให้พนักงานตรวจสอบก่อนกดยืนยันแลกของรางวัล</li><li>ของรางวัลขึ้นอยู่กับจำนวนคงเหลือ ณ เวลาที่แลก</li></ul></div>}
      </div>
      <div className="customer-reward-action"><button type="button" onClick={() => { setRedeemed(false); setConfirmOpen(true); }}>แลกของรางวัล</button></div>
    </> : null}
    {confirmOpen && reward ? <div className="customer-reward-confirm" role="dialog" aria-modal="true" aria-labelledby="customer-reward-confirm-title">
      <button type="button" className="customer-reward-confirm-backdrop" onClick={() => setConfirmOpen(false)} aria-label="ปิดหน้าต่างยืนยัน" />
      <section className={`customer-reward-confirm-card${redeemed ? " is-success" : ""}`}><button type="button" className="customer-reward-confirm-close" onClick={() => setConfirmOpen(false)} aria-label="ปิด"><X size={20} /></button><div className="customer-reward-confirm-sparkles" aria-hidden="true"><Sparkles /><Heart /></div>{redeemed ? <><span className="customer-reward-confirm-icon"><Check size={30} /></span><p className="customer-reward-confirm-kicker">เรียบร้อยแล้ว</p><h2 id="customer-reward-confirm-title">แลกสำเร็จแล้ว</h2><p>แสดงหน้านี้ให้พนักงานตรวจสอบเพื่อรับของรางวัล</p><div className="customer-reward-confirm-summary"><span><Gift size={18} /> {reward.title}</span><strong>{price} แต้ม</strong></div><button className="customer-reward-confirm-submit" type="button" onClick={() => setConfirmOpen(false)}><Check size={18} /> เสร็จสิ้น</button></> : <><span className="customer-reward-confirm-icon"><ShieldCheck size={30} /></span><p className="customer-reward-confirm-kicker">เตรียมรับความสุขให้น้อง ๆ</p><h2 id="customer-reward-confirm-title">ยืนยันการแลกรางวัล</h2><p>แสดงหน้านี้ให้พนักงานตรวจสอบก่อน แล้วค่อยกดยืนยันรับของรางวัลนะคะ</p><div className="customer-reward-confirm-summary"><span><Gift size={18} /> {reward.title}</span><strong>{price} แต้ม</strong></div><div className="customer-reward-confirm-points">คะแนนของคุณ <b>{previewPoints.toLocaleString("th-TH")} แต้ม</b></div><button className="customer-reward-confirm-submit" type="button" onClick={() => setRedeemed(true)}><Check size={18} /> ยืนยันแลกรางวัล</button><small>ใช้รับของรางวัลที่หน้าร้าน Tammy Pet Shop</small></>}</section>
    </div> : null}
  </main>;
}
