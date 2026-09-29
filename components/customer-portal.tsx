"use client";

import Image from "next/image";
import { Noto_Sans_Thai } from "next/font/google";
import { ArrowLeft, Check, Gift, House, PawPrint, Star, Tag, Trophy, TicketPercent, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { normalizeCardDesign, type CardDesign } from "@/lib/card-design";
import { normalizePopupDisplay, type PopupDisplay } from "@/lib/popup-content";
import { supabase } from "@/lib/supabase/client";
import { CouponTicketFace } from "./coupon-ticket-face";
import { CustomerRewardCard } from "./customer-reward-card";
import { PopupDetailView } from "./customer-content-detail";
import { CustomerBrandHeader } from "./customer-brand-header";
import { CustomerAccount } from "./customer-account";
import { CustomerMemberCard } from "./customer-member-card";
import { CustomerNewsCarousel } from "./customer-news-carousel";

type Tab = "rewards" | "coupons" | "home" | "lucky" | "account";
const memberFont = Noto_Sans_Thai({ subsets: ["thai", "latin"], display: "swap" });
type PublicShop = { shop_name: string; shop_name_en: string; logo_url: string | null; card_design: CardDesign };
type Reward = { id: string; title: string; description: string; category: string; points_cost: number; stock: number | null; image_url: string | null; active: boolean; starts_at: string | null; ends_at: string | null };
type Coupon = { id: string; title: string; description: string; code: string; discount_type: string; discount_value: number; min_spend: number; usage_limit: number | null; used_count: number; active: boolean; starts_at: string | null; ends_at: string | null; theme_color: string | null };
type Member = { memberCode: string; name: string; level: string; points: number; linePictureUrl?: string | null };
type PortalProps =
  | { mode: "preview"; initialTab?: "home" | "rewards"; initialView?: "points" | "rewards" | "news" | null; member?: never; idToken?: never; accessToken?: never; onLogout?: never; onMemberUpdated?: never }
  | { mode: "customer"; initialTab?: "home" | "rewards"; initialView?: "points" | "rewards" | "news" | null; member: Member; idToken?: string; accessToken?: string; onLogout: () => void; onMemberUpdated?: (name: string) => void };

const navigation = [
  { id: "rewards", label: "ของรางวัล", icon: Gift },
  { id: "coupons", label: "คูปอง", icon: TicketPercent },
  { id: "home", label: "หน้าหลัก", icon: House },
  { id: "lucky", label: "ลุ้นรางวัล", icon: Trophy },
  { id: "account", label: "ข้อมูลของฉัน", icon: UserRound },
] as const;

const sectionText: Record<Exclude<Tab, "home">, { title: string; empty: string }> = {
  rewards: { title: "ของรางวัล", empty: "ยังไม่มีของรางวัลที่เปิดให้แลกในขณะนี้" },
  coupons: { title: "คูปอง", empty: "ยังไม่มีคูปองที่เปิดให้ใช้งานในขณะนี้" },
  lucky: { title: "ลุ้นรางวัล", empty: "ยังไม่มีกิจกรรมลุ้นรางวัลในขณะนี้" },
  account: { title: "ข้อมูลของฉัน", empty: "ข้อมูลสมาชิกและประวัติแต้มจะแสดงเมื่อเชื่อมบัญชีสมาชิกอย่างปลอดภัย" },
};

export function CustomerPortal({ mode, initialTab = "home", initialView, member, idToken, accessToken, onLogout, onMemberUpdated }: PortalProps) {
  const isMember = mode === "customer";
  const [tab, setTab] = useState<Tab>(initialView === "rewards" ? "rewards" : initialTab);
  const [shop, setShop] = useState<PublicShop | null>(null);
  const [news, setNews] = useState<PopupDisplay[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [previewName, setPreviewName] = useState("คุณแอดมิน");
  const [previewQr, setPreviewQr] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [selectedNews, setSelectedNews] = useState<PopupDisplay | null>(null);
  const [rewardCategory, setRewardCategory] = useState("ทั้งหมด");

  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [confirmRewardOpen, setConfirmRewardOpen] = useState(false);
  const rewardRequestId = useRef<string | null>(null);
  const redeemLock = useRef(false);
  const [couponUsed, setCouponUsed] = useState(false);
  const [rewardRedeemed, setRewardRedeemed] = useState(false);
  const [memberPoints, setMemberPoints] = useState(Number(member?.points || 0));
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [redeemError, setRedeemError] = useState("");

  useEffect(() => {
    if (initialView === "rewards") setTab("rewards");
    else if (initialView === "news" || initialView === "points") setTab("home");
    if (initialView === "news") {
      const frame = requestAnimationFrame(() => document.querySelector(".customer-home-news")?.scrollIntoView({ block: "start" }));
      return () => cancelAnimationFrame(frame);
    }
  }, [initialView]);

  async function redeem(kind: "reward" | "coupon", itemId: string) {
    if (redeemLock.current) return;
    if (!isMember) { if (kind === "reward") setRewardRedeemed(true); else setCouponUsed(true); return; }
    redeemLock.current = true;
    setRedeemBusy(true);
    setRedeemError("");
    try {
      const requestId = kind === "reward" ? rewardRequestId.current || crypto.randomUUID() : crypto.randomUUID();
      if (kind === "reward") rewardRequestId.current = requestId;
      const response = await fetch("/api/line/member/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken, accessToken, kind, itemId, requestId }) });
      const data = await response.json() as { success?: boolean; points?: number; error?: string };
      if (!response.ok || !data.success) throw new Error(data.error || "ทำรายการไม่สำเร็จ");
      if (typeof data.points === "number") setMemberPoints(data.points);
      if (kind === "coupon") { setCouponUsed(true); setCoupons(items => items.filter(item => item.id !== itemId)); }
      else { setRewardRedeemed(true); setRewards(items => items.map(item => item.id === itemId && item.stock !== null ? { ...item, stock: Math.max(0, item.stock - 1) } : item)); }
    } catch (cause) { setRedeemError(cause instanceof Error ? cause.message : "ทำรายการไม่สำเร็จ"); }
    finally { redeemLock.current = false; setRedeemBusy(false); }
  }

  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(isMember ? `TAMMY-MEMBER:${member!.memberCode}` : "TAMMY-PREVIEW-NOT-REDEEMABLE", { width: 200, margin: 0 }).then((url) => { if (active) setPreviewQr(url); });
    return () => { active = false; };
  }, [isMember, member]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.from("public_shop_profiles")
      .select("shop_name,shop_name_en,logo_url,card_design")
      .eq("slug", "tammy")
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        const config = data.card_design as Record<string, unknown> | null;
        setShop({
          shop_name: data.shop_name,
          shop_name_en: data.shop_name_en,
          logo_url: data.logo_url,
          card_design: normalizeCardDesign(data.card_design),
        });
        setNews(normalizePopupDisplay(config?.popup_content).filter((item) => item.active && item.source === "news"));
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (isMember) {
      let active = true;
      void (async () => {
        try {
          const response = await fetch("/api/line/member/catalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken, accessToken }), cache: "no-store" });
          const data = await response.json() as { rewards?: Reward[]; coupons?: Coupon[]; error?: string };
          if (!response.ok) throw new Error(data.error || "โหลดสิทธิพิเศษไม่สำเร็จ");
          if (active) { setRewards(data.rewards || []); setCoupons(data.coupons || []); }
        } catch (error) { if (active) setCatalogError(error instanceof Error ? error.message : "โหลดสิทธิพิเศษไม่สำเร็จ"); }
        finally { if (active) setCatalogLoading(false); }
      })();
      return () => { active = false; };
    }
    if (!supabase) { setCatalogError("ยังไม่ได้ตั้งค่า Supabase"); setCatalogLoading(false); return; }
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
        const [rewardResult, couponResult] = await Promise.all([
          supabase.from("rewards").select("id,title,description,category,points_cost,stock,image_url,active,starts_at,ends_at").eq("owner_id", ownerId).eq("active", true).order("created_at", { ascending: false }),
          supabase.from("coupons").select("id,title,description,code,discount_type,discount_value,min_spend,usage_limit,used_count,active,starts_at,ends_at,theme_color").eq("owner_id", ownerId).eq("active", true).order("created_at", { ascending: false }),
        ]);
        if (rewardResult.error || couponResult.error) throw rewardResult.error || couponResult.error;
        const now = Date.now();
        const withinDates = (item: { starts_at: string | null; ends_at: string | null }) => (!item.starts_at || Date.parse(item.starts_at) <= now) && (!item.ends_at || Date.parse(item.ends_at) >= now);
        if (!active) return;
        setRewards((rewardResult.data || []).filter((item) => withinDates(item) && (item.stock === null || item.stock > 0)));
        setCoupons((couponResult.data || []).filter((item) => withinDates(item) && (item.usage_limit === null || (item.used_count ?? 0) < item.usage_limit)));
        setPreviewName(String(auth.user.user_metadata?.full_name || auth.user.user_metadata?.name || "คุณแอดมิน"));
      } catch (error) {
        if (active) setCatalogError(error instanceof Error ? error.message : "โหลดข้อมูลร้านไม่สำเร็จ");
      } finally {
        if (active) setCatalogLoading(false);
      }
    })();
    return () => { active = false; };
  }, [isMember, idToken, accessToken]);

  const rewardCategories = ["ทั้งหมด", ...new Set(rewards.map(item => item.category).filter(Boolean))];
  const visibleRewards = rewardCategory === "ทั้งหมด" ? rewards : rewards.filter(item => item.category === rewardCategory);

  if (selectedNews) return <PopupDetailView item={selectedNews} onBack={() => setSelectedNews(null)} />;

  return (
    <main className={`customer-portal customer-home-page customer-catalog-refresh ${memberFont.className}`}>
      <CustomerBrandHeader greeting={isMember ? `คุณ${member!.name}` : previewName} pictureUrl={member?.linePictureUrl} logoUrl={shop?.logo_url} shopName={shop?.shop_name_en || "Tammy"} />

      <div className="customer-home-body">
        {selectedReward ? <section className="customer-reward-detail-page" aria-labelledby="member-reward-title">
          <button type="button" className="customer-reward-detail-back" onClick={() => { setSelectedReward(null); setRewardRedeemed(false); setConfirmRewardOpen(false); rewardRequestId.current = null; }}><ArrowLeft size={18} />กลับไปของรางวัล</button>
          <div className="customer-reward-detail-hero">{selectedReward.image_url ? <Image src={selectedReward.image_url} alt={selectedReward.title} fill sizes="(max-width:520px) 100vw, 480px" unoptimized /> : <Gift size={75} strokeWidth={1.3} />}</div>
          <p className="customer-reward-detail-category">{selectedReward.category || "ของรางวัล"}</p>
          <h1 id="member-reward-title">{rewardRedeemed ? "แลกสำเร็จแล้ว" : selectedReward.title}</h1>
          <p>{rewardRedeemed ? "แสดงหน้านี้ให้พนักงานตรวจสอบเพื่อรับของรางวัล" : selectedReward.description || "ของรางวัลพิเศษจาก Tammy Pet Shop"}</p>
          <div className="customer-reward-detail-points"><span>{selectedReward.points_cost.toLocaleString("th-TH")} แต้ม</span><strong>แต้มของคุณ {memberPoints.toLocaleString("th-TH")}</strong></div>
          {redeemError && <p role="alert" className="line-signup-error">{redeemError}</p>}
          <button className="customer-reward-detail-submit" type="button" disabled={redeemBusy || (!rewardRedeemed && memberPoints < selectedReward.points_cost)} onClick={() => rewardRedeemed ? setSelectedReward(null) : setConfirmRewardOpen(true)}>{rewardRedeemed ? "เสร็จสิ้น" : redeemBusy ? "กำลังแลก…" : memberPoints < selectedReward.points_cost ? "แต้มไม่เพียงพอ" : "แลกรางวัล"}</button>
          {confirmRewardOpen && !rewardRedeemed && <div className="customer-redeem-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="customer-redeem-confirm-title"><button type="button" className="customer-redeem-confirm-backdrop" aria-label="ปิด" onClick={() => { if (!redeemBusy) setConfirmRewardOpen(false); }} /><section className="customer-redeem-confirm-card"><span className="customer-redeem-confirm-icon"><Gift size={25} /></span><h2 id="customer-redeem-confirm-title">ยืนยันแลกรางวัล</h2><p>ยืนยันใช้ <strong>{selectedReward.points_cost.toLocaleString("th-TH")} แต้ม</strong><br />เพื่อแลก {selectedReward.title}?</p><div className="customer-redeem-confirm-actions"><button type="button" disabled={redeemBusy} onClick={() => setConfirmRewardOpen(false)}>ยกเลิก</button><button type="button" disabled={redeemBusy || memberPoints < selectedReward.points_cost} onClick={() => void redeem("reward", selectedReward.id)}>{redeemBusy ? "กำลังตรวจสอบ…" : "ยืนยันแลกรางวัล"}</button></div></section></div>}
        </section> : tab === "home" ? <>
          <CustomerMemberCard name={isMember ? `คุณ${member!.name}` : previewName} level={member?.level || "Gold"} points={isMember ? memberPoints : 90} memberCode={member?.memberCode || "PREVIEW"} qr={previewQr} preview={!isMember} />

          <section className="customer-home-news" aria-label="ข่าวสารจากร้าน">
            <div className="customer-home-section-heading"><h1>ข่าวสารล่าสุด</h1>{news.length > 1 && <span className="customer-news-hint">เลื่อนดูข่าวสาร</span>}</div>
            {news.length ? <CustomerNewsCarousel news={news} onSelect={setSelectedNews} /> : <div className="customer-home-empty-news"><PawPrint size={32} /><strong>ยังไม่มีข่าวสารจากร้าน</strong></div>}
          </section>
        </> : tab !== "account" ? <section className="customer-home-catalog" aria-label={sectionText[tab].title}>
          {tab === "rewards" && <><div className="customer-catalog-intro"><h1>ของรางวัล</h1><div className="customer-catalog-summary"><span>แต้มของคุณ <strong>{isMember ? memberPoints.toLocaleString("th-TH") : "90"}</strong></span><Star size={30} strokeWidth={1.5} aria-hidden="true" /></div></div>{rewardCategories.length > 2 && <div className="customer-rewards-filters" aria-label="หมวดหมู่ของรางวัล">{rewardCategories.map(category => <button type="button" key={category} className={rewardCategory === category ? "active" : ""} onClick={() => setRewardCategory(category)}>{category}</button>)}</div>}{catalogLoading ? <p className="customer-home-catalog-state">กำลังโหลดของรางวัล…</p> : catalogError ? <p className="customer-home-catalog-state" role="alert">{catalogError}</p> : visibleRewards.length ? <div className="customer-rewards-horizontal-list">{visibleRewards.map(item => <CustomerRewardCard key={item.id} reward={item} points={isMember ? memberPoints : 90} memberMode onSelect={() => { setRedeemError(""); setRewardRedeemed(false); setConfirmRewardOpen(false); rewardRequestId.current = crypto.randomUUID(); setSelectedReward(item); window.scrollTo({ top: 0, behavior: "smooth" }); }} />)}</div> : <p className="customer-home-catalog-state">{sectionText.rewards.empty}</p>}</>}
          {tab === "coupons" && <><div className="customer-catalog-intro"><h1>คูปอง</h1><div className="customer-catalog-summary"><span>สิทธิพิเศษสำหรับคุณ</span><Tag size={29} strokeWidth={1.5} aria-hidden="true" /></div></div>{catalogLoading ? <p className="customer-home-catalog-state">กำลังโหลดคูปอง…</p> : catalogError ? <p className="customer-home-catalog-state" role="alert">{catalogError}</p> : coupons.length ? <div className="customer-coupon-tickets">{coupons.map(item => <article className="customer-coupon-ticket" key={item.id}><CouponTicketFace discountType={item.discount_type} discountValue={Number(item.discount_value)} minSpend={Number(item.min_spend)} code={item.code} endsAt={item.ends_at} theme={item.theme_color} onUse={() => { setSelectedCoupon(item); setCouponUsed(false); }} /><div className="customer-coupon-ticket-footer"><strong className="customer-coupon-ticket-title">{item.title}</strong></div></article>)}</div> : <p className="customer-home-catalog-state">{sectionText.coupons.empty}</p>}</>}
          {tab === "lucky" && <div className="customer-lucky-placeholder"><div className="customer-lucky-art" aria-hidden="true"><Star className="lucky-star-one" /><Gift size={82} strokeWidth={1.2} /><PawPrint className="lucky-paw" /><Star className="lucky-star-two" /></div><h1>ลุ้นรางวัล</h1><span>เร็ว ๆ นี้</span><p>เตรียมพบกับกิจกรรมและของรางวัลพิเศษ<br />จาก Tammy Pet Shop</p></div>}
        </section> : null}
        <section className="customer-home-catalog customer-account-mounted" aria-label="ข้อมูลของฉัน" style={{ display: tab === "account" && !selectedReward ? undefined : "none" }}><CustomerAccount preview={!isMember} member={member} idToken={idToken} accessToken={accessToken} onLogout={onLogout} onMemberUpdated={onMemberUpdated} /></section>
      </div>

      {!selectedReward && <nav className="customer-nav customer-home-nav" aria-label="เมนูหลัก">{navigation.map(({ id, label, icon: Icon }) => <button type="button" className={tab === id ? "active" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => { setTab(id); window.scrollTo({ top: 0, behavior: "instant" }); }} key={id}><span className="customer-home-nav-icon"><Icon size={23} strokeWidth={2} /></span><span>{label}</span></button>)}</nav>}
      {selectedCoupon ? <div className="customer-coupon-use-dialog" role="dialog" aria-modal="true" aria-labelledby="customer-coupon-use-title"><button type="button" className="customer-coupon-use-backdrop" onClick={() => setSelectedCoupon(null)} aria-label="ปิดหน้าคูปอง"/><section className={couponUsed ? "is-success" : undefined}><button type="button" className="customer-coupon-use-close" onClick={() => setSelectedCoupon(null)} aria-label="ปิด"><X size={19}/></button>{couponUsed ? <><span className="customer-coupon-use-icon is-success"><Check size={29}/></span><p>คูปองพิเศษสำหรับคุณ</p><h2 id="customer-coupon-use-title">ใช้คูปองสำเร็จแล้ว</h2><strong className="customer-coupon-use-value">{selectedCoupon.discount_type === "percent" ? `ลด ${Number(selectedCoupon.discount_value).toLocaleString("th-TH")}%` : `ลด ${Number(selectedCoupon.discount_value).toLocaleString("th-TH")} บาท`}</strong><div className="customer-coupon-use-code"><small>แสดงรหัสนี้ให้พนักงาน</small><b>{selectedCoupon.code}</b></div><p className="customer-coupon-use-terms">{selectedCoupon.min_spend > 0 ? `ใช้เมื่อซื้อครบ ${Number(selectedCoupon.min_spend).toLocaleString("th-TH")} บาท` : selectedCoupon.description || "ไม่มีขั้นต่ำ"}</p><button className="customer-coupon-copy-button" type="button" onClick={() => setSelectedCoupon(null)}><Check size={18}/> เสร็จสิ้น</button></> : <><span className="customer-coupon-use-icon"><TicketPercent size={27}/></span><p>คูปองพิเศษสำหรับคุณ</p><h2 id="customer-coupon-use-title">{selectedCoupon.title}</h2><strong className="customer-coupon-use-value">{selectedCoupon.discount_type === "percent" ? `ลด ${Number(selectedCoupon.discount_value).toLocaleString("th-TH")}%` : `ลด ${Number(selectedCoupon.discount_value).toLocaleString("th-TH")} บาท`}</strong><div className="customer-coupon-use-code"><small>รหัสคูปอง</small><b>{selectedCoupon.code}</b></div><p className="customer-coupon-use-terms">{selectedCoupon.min_spend > 0 ? `ใช้เมื่อซื้อครบ ${Number(selectedCoupon.min_spend).toLocaleString("th-TH")} บาท` : selectedCoupon.description || "ไม่มีขั้นต่ำ"}<br/>กดใช้คูปองแล้วแสดงหน้านี้ให้พนักงานที่หน้าร้าน</p>{redeemError && <p role="alert" className="line-signup-error">{redeemError}</p>}<button className="customer-coupon-copy-button" type="button" onClick={() => { if (isMember) void redeem("coupon", selectedCoupon.id); else setCouponUsed(true); }}><Check size={18}/> {redeemBusy ? "กำลังใช้คูปอง…" : "ใช้คูปองเลย"}</button></>}</section></div> : null}
    </main>
  );
}
