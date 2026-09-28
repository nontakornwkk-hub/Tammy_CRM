"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, ChevronRight, Crown, Gift, House, LogOut, PawPrint, Star, Tag, Trophy, TicketPercent, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { normalizeCardDesign, type CardDesign } from "@/lib/card-design";
import { normalizePopupDisplay, type PopupDisplay } from "@/lib/popup-content";
import { supabase } from "@/lib/supabase/client";
import { CouponTicketFace } from "./coupon-ticket-face";
import { CustomerRewardCard } from "./customer-reward-card";
import { PopupDetailView } from "./customer-content-detail";
import { CustomerBrandHeader } from "./customer-brand-header";

type Tab = "rewards" | "coupons" | "home" | "lucky" | "account";
type PublicShop = { shop_name: string; shop_name_en: string; logo_url: string | null; card_design: CardDesign };
type Reward = { id: string; title: string; description: string; category: string; points_cost: number; stock: number | null; image_url: string | null; active: boolean; starts_at: string | null; ends_at: string | null };
type Coupon = { id: string; title: string; description: string; code: string; discount_type: string; discount_value: number; min_spend: number; usage_limit: number | null; used_count: number; active: boolean; starts_at: string | null; ends_at: string | null; theme_color: string | null };
type Member = { memberCode: string; name: string; level: string; points: number };
type PortalProps =
  | { mode: "preview"; initialTab?: "home" | "rewards"; initialView?: "points" | "rewards" | "news" | null; member?: never; idToken?: never; onLogout?: never }
  | { mode: "customer"; initialTab?: "home" | "rewards"; initialView?: "points" | "rewards" | "news" | null; member: Member; idToken?: string; onLogout: () => void };

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

export function CustomerPortal({ mode, initialTab = "home", initialView, member, idToken, onLogout }: PortalProps) {
  const isMember = mode === "customer";
  const [tab, setTab] = useState<Tab>(initialView === "rewards" ? "rewards" : initialTab);
  const [shop, setShop] = useState<PublicShop | null>(null);
  const [news, setNews] = useState<PopupDisplay[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [adminEmail, setAdminEmail] = useState("");
  const [previewName, setPreviewName] = useState("คุณแอดมิน");
  const [previewQr, setPreviewQr] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [showAllNews, setShowAllNews] = useState(initialView === "news");
  const [selectedNews, setSelectedNews] = useState<PopupDisplay | null>(null);
  const [rewardCategory, setRewardCategory] = useState("ทั้งหมด");

  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [couponUsed, setCouponUsed] = useState(false);
  const [rewardRedeemed, setRewardRedeemed] = useState(false);
  const [memberPoints, setMemberPoints] = useState(Number(member?.points || 0));
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [redeemError, setRedeemError] = useState("");

  useEffect(() => {
    if (initialView === "rewards") setTab("rewards");
    else if (initialView === "news" || initialView === "points") setTab("home");
    if (initialView === "news") {
      setShowAllNews(true);
      const frame = requestAnimationFrame(() => document.querySelector(".customer-home-news")?.scrollIntoView({ block: "start" }));
      return () => cancelAnimationFrame(frame);
    }
  }, [initialView]);

  async function redeem(kind: "reward" | "coupon", itemId: string) {
    if (redeemBusy) return;
    if (!isMember) { if (kind === "reward") setRewardRedeemed(true); else setCouponUsed(true); return; }
    setRedeemBusy(true);
    setRedeemError("");
    try {
      const response = await fetch("/api/line/member/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken, kind, itemId }) });
      const data = await response.json() as { success?: boolean; points?: number; error?: string };
      if (!response.ok || !data.success) throw new Error(data.error || "ทำรายการไม่สำเร็จ");
      if (typeof data.points === "number") setMemberPoints(data.points);
      if (kind === "coupon") { setCouponUsed(true); setCoupons(items => items.filter(item => item.id !== itemId)); }
      else { setRewardRedeemed(true); setRewards(items => items.map(item => item.id === itemId && item.stock !== null ? { ...item, stock: Math.max(0, item.stock - 1) } : item)); }
    } catch (cause) { setRedeemError(cause instanceof Error ? cause.message : "ทำรายการไม่สำเร็จ"); }
    finally { setRedeemBusy(false); }
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
          const response = await fetch("/api/line/member/catalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }), cache: "no-store" });
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
        setAdminEmail(auth.user.email || "");
        setPreviewName(String(auth.user.user_metadata?.full_name || auth.user.user_metadata?.name || "คุณแอดมิน"));
      } catch (error) {
        if (active) setCatalogError(error instanceof Error ? error.message : "โหลดข้อมูลร้านไม่สำเร็จ");
      } finally {
        if (active) setCatalogLoading(false);
      }
    })();
    return () => { active = false; };
  }, [isMember, idToken]);

  const visibleNews = showAllNews ? news : news.slice(0, 2);
  const rewardCategories = ["ทั้งหมด", ...new Set(rewards.map(item => item.category).filter(Boolean))];
  const visibleRewards = rewardCategory === "ทั้งหมด" ? rewards : rewards.filter(item => item.category === rewardCategory);

  if (selectedNews) return <PopupDetailView item={selectedNews} onBack={() => setSelectedNews(null)} />;

  return (
    <main className="customer-portal customer-home-page customer-catalog-refresh">
      <CustomerBrandHeader greeting={`สวัสดี ${isMember ? `คุณ${member!.name}` : previewName}`} />

      <div className="customer-home-body">
        {tab === "home" ? <>
          <section className="customer-home-member reference-member-card" aria-label="บัตรสมาชิก Gold">
            <div className="reference-member-copy">
              <div className="reference-card-brand">TAMMY PET SHOP <PawPrint size={14} /><small>MEMBERSHIP CARD</small></div>
              <span className="reference-card-rank"><Crown size={24} /> {isMember ? member!.level : "Gold"}</span>
              <strong className="reference-card-name">{isMember ? `คุณ${member!.name}` : previewName}</strong>
              <div className="reference-card-balance"><div><span>คะแนนสะสม</span><strong>{isMember ? memberPoints.toLocaleString("th-TH") : "90"} <small>แต้ม</small></strong></div><div className="reference-card-qr">{previewQr ? <Image src={previewQr} alt={isMember ? "QR รหัสสมาชิก" : "QR ตัวอย่างบัตรสมาชิก"} width={70} height={70} unoptimized /> : <span className="reference-qr-placeholder" />}<small>{isMember ? member!.memberCode : "สมาชิก"}</small></div></div>
              <div className="reference-card-progress"><i><span /></i><small>{isMember ? `สมาชิกระดับ ${member!.level}` : "อีก 1,500 บาท ถึง Platinum"}</small></div>
            </div>
            <span className="reference-card-slogan">เพื่อนซี้<br />ที่อยู่เคียงข้าง<br />เสมอ ♡</span>
          </section>

          <section className="customer-home-news" aria-label="ข่าวสารจากร้าน">
            <div className="customer-home-section-heading"><h1>ข่าวสารล่าสุด</h1>{news.length > 0 && <button type="button" onClick={() => setShowAllNews((value) => !value)}>{showAllNews ? "ย่อ" : "ดูทั้งหมด"} <ChevronRight size={18} /></button>}</div>
            {visibleNews.length ? <div className="customer-home-news-list">{visibleNews.map((item) => <Link className="customer-home-news-card" href={`/customer/content/${encodeURIComponent(`${item.source}:${item.id}`)}`} key={item.id} onClick={event => { event.preventDefault(); setSelectedNews(item); }}>
              <div className="customer-home-news-picture">{item.image ? <Image src={item.image} alt="" fill sizes="(max-width: 520px) 36vw, 170px" unoptimized /> : <PawPrint size={48} />}</div>
              <div className="customer-home-news-copy">{item.createdAt && <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" })}</time>}<h2>{item.title}</h2><p>{item.summary}</p></div>
            </Link>)}</div> : <div className="customer-home-empty-news"><PawPrint size={32} /><strong>ยังไม่มีข่าวสารจากร้าน</strong><span>เมื่อร้านเผยแพร่ข่าวหรือโปรโมชั่น จะแสดงตรงนี้ค่ะ</span></div>}
          </section>
        </> : <section className="customer-home-catalog" aria-label={sectionText[tab].title}>
          {(tab === "lucky" || tab === "account") && <div className="customer-home-catalog-heading"><span className="customer-home-subpage-icon">{(() => { const Icon = navigation.find((item) => item.id === tab)?.icon || PawPrint; return <Icon size={28} />; })()}</span><div><small>แทมมี่อาหารสัตว์</small><h1>{sectionText[tab].title}</h1></div></div>}
          {tab === "rewards" && <><div className="customer-catalog-intro"><h1>ของรางวัล</h1><div className="customer-catalog-summary"><span>แต้มของคุณ <strong>{isMember ? memberPoints.toLocaleString("th-TH") : "90"}</strong></span><Star size={30} strokeWidth={1.5} aria-hidden="true" /></div></div>{rewardCategories.length > 2 && <div className="customer-rewards-filters" aria-label="หมวดหมู่ของรางวัล">{rewardCategories.map(category => <button type="button" key={category} className={rewardCategory === category ? "active" : ""} onClick={() => setRewardCategory(category)}>{category}</button>)}</div>}{catalogLoading ? <p className="customer-home-catalog-state">กำลังโหลดของรางวัล…</p> : catalogError ? <p className="customer-home-catalog-state" role="alert">{catalogError}</p> : visibleRewards.length ? <div className="customer-rewards-horizontal-list">{visibleRewards.map(item => <CustomerRewardCard key={item.id} reward={item} points={isMember ? memberPoints : 90} memberMode onSelect={() => { setRedeemError(""); setRewardRedeemed(false); setSelectedReward(item); }} />)}</div> : <p className="customer-home-catalog-state">{sectionText.rewards.empty}</p>}</>}
          {tab === "coupons" && <><div className="customer-catalog-intro"><h1>คูปอง</h1><div className="customer-catalog-summary"><span>สิทธิพิเศษสำหรับคุณ</span><Tag size={29} strokeWidth={1.5} aria-hidden="true" /></div></div>{catalogLoading ? <p className="customer-home-catalog-state">กำลังโหลดคูปอง…</p> : catalogError ? <p className="customer-home-catalog-state" role="alert">{catalogError}</p> : coupons.length ? <div className="customer-coupon-tickets">{coupons.map(item => <article className="customer-coupon-ticket" key={item.id}><CouponTicketFace discountType={item.discount_type} discountValue={Number(item.discount_value)} minSpend={Number(item.min_spend)} code={item.code} endsAt={item.ends_at} theme={item.theme_color} onUse={() => { setSelectedCoupon(item); setCouponUsed(false); }} /><div className="customer-coupon-ticket-footer"><strong className="customer-coupon-ticket-title">{item.title}</strong></div></article>)}</div> : <p className="customer-home-catalog-state">{sectionText.coupons.empty}</p>}</>}
          {tab === "lucky" && <p className="customer-home-catalog-state">{sectionText.lucky.empty}</p>}
          {tab === "account" && <div className="customer-home-admin-account"><strong>ข้อมูลบัญชี</strong><span>{isMember ? `คุณ${member!.name} · ${member!.memberCode}` : adminEmail || "กำลังโหลดข้อมูลบัญชี…"}</span><p>ข้อมูลสมาชิกและสิทธิพิเศษของคุณ</p>{isMember && onLogout && <button type="button" className="customer-member-logout" onClick={onLogout}><LogOut size={18} /> ออกจากระบบ</button>}</div>}
        </section>}
      </div>

      <nav className="customer-nav customer-home-nav" aria-label="เมนูหลัก">{navigation.map(({ id, label, icon: Icon }) => <button type="button" className={tab === id ? "active" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => { setTab(id); window.scrollTo({ top: 0, behavior: "instant" }); }} key={id}><span className="customer-home-nav-icon"><Icon size={23} strokeWidth={2} /></span><span>{label}</span></button>)}</nav>
      {selectedReward ? <div className="customer-reward-confirm" role="dialog" aria-modal="true" aria-labelledby="member-reward-title">
        <button type="button" className="customer-reward-confirm-backdrop" onClick={() => setSelectedReward(null)} aria-label="ปิดรายละเอียดของรางวัล" />
        <section className={`customer-reward-confirm-card${rewardRedeemed ? " is-success" : ""}`}>
          <button type="button" className="customer-reward-confirm-close" onClick={() => setSelectedReward(null)} aria-label="ปิด"><X size={20} /></button>
          <span className="customer-reward-confirm-icon">{rewardRedeemed ? <Check size={30} /> : <Gift size={30} />}</span>
          <p className="customer-reward-confirm-kicker">{selectedReward.category || "ของรางวัล"}</p>
          <h2 id="member-reward-title">{rewardRedeemed ? "แลกสำเร็จแล้ว" : selectedReward.title}</h2>
          <p>{rewardRedeemed ? "แสดงหน้านี้ให้พนักงานตรวจสอบเพื่อรับของรางวัล" : selectedReward.description || "ของรางวัลพิเศษจาก Tammy Pet Shop"}</p>
          <div className="customer-reward-confirm-summary"><span><Gift size={18} /> {selectedReward.title}</span><strong>{selectedReward.points_cost.toLocaleString("th-TH")} แต้ม</strong></div>
          {!rewardRedeemed && <div className="customer-reward-confirm-points">คะแนนของคุณ <b>{memberPoints.toLocaleString("th-TH")} แต้ม</b></div>}
          {redeemError && <p role="alert" className="line-signup-error">{redeemError}</p>}
          <button className="customer-reward-confirm-submit" type="button" disabled={redeemBusy || (!rewardRedeemed && memberPoints < selectedReward.points_cost)} onClick={() => rewardRedeemed ? setSelectedReward(null) : void redeem("reward", selectedReward.id)}><Check size={18} /> {rewardRedeemed ? "เสร็จสิ้น" : redeemBusy ? "กำลังแลก…" : memberPoints < selectedReward.points_cost ? `ขาดอีก ${(selectedReward.points_cost - memberPoints).toLocaleString("th-TH")} แต้ม` : "ยืนยันแลกรางวัล"}</button>
        </section>
      </div> : null}
      {selectedCoupon ? <div className="customer-coupon-use-dialog" role="dialog" aria-modal="true" aria-labelledby="customer-coupon-use-title"><button type="button" className="customer-coupon-use-backdrop" onClick={() => setSelectedCoupon(null)} aria-label="ปิดหน้าคูปอง"/><section className={couponUsed ? "is-success" : undefined}><button type="button" className="customer-coupon-use-close" onClick={() => setSelectedCoupon(null)} aria-label="ปิด"><X size={19}/></button>{couponUsed ? <><span className="customer-coupon-use-icon is-success"><Check size={29}/></span><p>คูปองพิเศษสำหรับคุณ</p><h2 id="customer-coupon-use-title">ใช้คูปองสำเร็จแล้ว</h2><strong className="customer-coupon-use-value">{selectedCoupon.discount_type === "percent" ? `ลด ${Number(selectedCoupon.discount_value).toLocaleString("th-TH")}%` : `ลด ${Number(selectedCoupon.discount_value).toLocaleString("th-TH")} บาท`}</strong><div className="customer-coupon-use-code"><small>แสดงรหัสนี้ให้พนักงาน</small><b>{selectedCoupon.code}</b></div><p className="customer-coupon-use-terms">{selectedCoupon.min_spend > 0 ? `ใช้เมื่อซื้อครบ ${Number(selectedCoupon.min_spend).toLocaleString("th-TH")} บาท` : selectedCoupon.description || "ไม่มีขั้นต่ำ"}</p><button className="customer-coupon-copy-button" type="button" onClick={() => setSelectedCoupon(null)}><Check size={18}/> เสร็จสิ้น</button></> : <><span className="customer-coupon-use-icon"><TicketPercent size={27}/></span><p>คูปองพิเศษสำหรับคุณ</p><h2 id="customer-coupon-use-title">{selectedCoupon.title}</h2><strong className="customer-coupon-use-value">{selectedCoupon.discount_type === "percent" ? `ลด ${Number(selectedCoupon.discount_value).toLocaleString("th-TH")}%` : `ลด ${Number(selectedCoupon.discount_value).toLocaleString("th-TH")} บาท`}</strong><div className="customer-coupon-use-code"><small>รหัสคูปอง</small><b>{selectedCoupon.code}</b></div><p className="customer-coupon-use-terms">{selectedCoupon.min_spend > 0 ? `ใช้เมื่อซื้อครบ ${Number(selectedCoupon.min_spend).toLocaleString("th-TH")} บาท` : selectedCoupon.description || "ไม่มีขั้นต่ำ"}<br/>กดใช้คูปองแล้วแสดงหน้านี้ให้พนักงานที่หน้าร้าน</p>{redeemError && <p role="alert" className="line-signup-error">{redeemError}</p>}<button className="customer-coupon-copy-button" type="button" onClick={() => { if (isMember) void redeem("coupon", selectedCoupon.id); else setCouponUsed(true); }}><Check size={18}/> {redeemBusy ? "กำลังใช้คูปอง…" : "ใช้คูปองเลย"}</button></>}</section></div> : null}
    </main>
  );
}
