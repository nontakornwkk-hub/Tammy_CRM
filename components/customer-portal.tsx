"use client";

import Image from "next/image";
import { Noto_Sans_Thai } from "next/font/google";
import { ArrowLeft, Check, Gift, PawPrint, Star, Tag, TicketPercent, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cachedCouponQr, clearCouponQr, loadCouponQr, localQr, prefetchCouponQr } from "@/lib/customer-qr";
import { prefetchMemberData } from "@/lib/member-bootstrap";
import { normalizeCardDesign, type CardDesign } from "@/lib/card-design";
import { normalizePopupDisplay, type PopupDisplay } from "@/lib/popup-content";
import { supabase } from "@/lib/supabase/client";
import { CouponTicketFace } from "./coupon-ticket-face";
import { CustomerRewardCard } from "./customer-reward-card";
import { CustomerRewardArtwork } from "./customer-reward-artwork";
import { PopupDetailView } from "./customer-content-detail";
import { CustomerBrandHeader } from "./customer-brand-header";
import { CustomerAccount } from "./customer-account";
import { CustomerMemberCard, type RankProgress } from "./customer-member-card";
import { CustomerNewsCarousel } from "./customer-news-carousel";
import { CustomerNavigation } from "./customer-navigation";
import { cachedMemberCatalog, clearMemberCatalog, loadMemberCatalog } from "@/lib/customer-catalog";
import { watchCatalogChanges } from "@/lib/catalog-live";
import { singleFlight } from "@/lib/single-flight";
import { CustomerStore } from "./customer-store";
import { customerStoreInfo, type StoreInfo } from "@/lib/customer-store";

type Tab = "rewards" | "coupons" | "home" | "store" | "account";
const memberFont = Noto_Sans_Thai({ subsets: ["thai", "latin"], display: "swap" });
type PublicShop = { shop_name: string; shop_name_en: string; logo_url: string | null; card_design: CardDesign; storeInfo: StoreInfo };
type Reward = { id: string; title: string; description: string; category: string; points_cost: number; stock: number | null; image_url: string | null; active: boolean; starts_at: string | null; ends_at: string | null };
type Coupon = { id: string; title: string; description: string; discount_type: string; discount_value: number; min_spend: number; usage_limit: number | null; used_count: number; active: boolean; starts_at: string | null; ends_at: string | null; theme_color: string | null; qr_valid_minutes: number };
type Member = { memberCode: string; name: string; level: string; points: number; linePictureUrl?: string | null };
type PortalProps =
  | { mode: "preview"; initialTab?: "home" | "rewards"; initialView?: "points" | "rewards" | "news" | null; member?: never; idToken?: never; accessToken?: never; onLogout?: never; onMemberUpdated?: never }
  | { mode: "customer"; initialTab?: "home" | "rewards"; initialView?: "points" | "rewards" | "news" | null; member: Member; idToken?: string; accessToken?: string; onLogout: () => void; onMemberUpdated?: (name: string) => void };

const sectionText: Record<Exclude<Tab, "home">, { title: string; empty: string }> = {
  rewards: { title: "ของรางวัล", empty: "ยังไม่มีของรางวัลที่เปิดให้แลกในขณะนี้" },
  coupons: { title: "คูปอง", empty: "ยังไม่มีคูปองที่เปิดให้ใช้งานในขณะนี้" },
  account: { title: "ข้อมูลของฉัน", empty: "ข้อมูลสมาชิกและประวัติแต้มจะแสดงเมื่อเชื่อมบัญชีสมาชิกอย่างปลอดภัย" },
  store: {title:"ร้านของเรา",empty:"ยังไม่มีข้อมูลร้าน"},
};
let publicShopSnapshot: { shop: PublicShop; news: PopupDisplay[] } | null = null;
const pendingShop = singleFlight<void>();
export function prepareCustomerShop(fresh=false) {
  if (!fresh && publicShopSnapshot) return Promise.resolve();
  return pendingShop("shop", async () => {
    if (!supabase) throw new Error("ยังไม่ได้ตั้งค่า Supabase");
    const {data,error} = await supabase.from("public_shop_profiles")
      .select("shop_name,shop_name_en,logo_url,card_design,description,store_hours_enabled,weekly_hours,temporary_closure,contacts").eq("slug","tammy").maybeSingle();
    if (error || !data) throw new Error("โหลดข้อมูลร้านไม่สำเร็จ");
    const config=data.card_design as Record<string,unknown>|null;
    publicShopSnapshot={shop:{...data,card_design:normalizeCardDesign(data.card_design),storeInfo:customerStoreInfo(data)},
      news:normalizePopupDisplay(config?.popup_content).filter(item=>item.active&&item.source==="news")};
  });
}

export function CustomerPortal({ mode, initialTab = "home", initialView, member, idToken, accessToken, onLogout, onMemberUpdated }: PortalProps) {
  const isMember = mode === "customer";
  const frameClass = accessToken?.startsWith("test:") ? " customer-test-frame" : "";
  const memberName = member?.name.startsWith("คุณ") ? member.name : `คุณ${member?.name || "สมาชิก"}`;
  const [tab, setTab] = useState<Tab>(initialView === "rewards" ? "rewards" : initialTab);
  const [shop, setShop] = useState<PublicShop | null>(() => publicShopSnapshot?.shop ?? null);
  const [news, setNews] = useState<PopupDisplay[]>(() => publicShopSnapshot?.news ?? []);
  const initialCatalog = isMember ? cachedMemberCatalog(idToken, accessToken) : undefined;
  const [rewards, setRewards] = useState<Reward[]>(() => (initialCatalog?.rewards as Reward[] | undefined) || []);
  const [coupons, setCoupons] = useState<Coupon[]>(() => (initialCatalog?.coupons as Coupon[] | undefined) || []);
  const [rankProgress, setRankProgress] = useState<RankProgress | null>(() => (initialCatalog?.rankProgress as RankProgress | undefined) || null);
  const [previewName, setPreviewName] = useState("คุณแอดมิน");
  const [previewQr, setPreviewQr] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(!initialCatalog);
  const [selectedNews, setSelectedNews] = useState<PopupDisplay | null>(null);
  const [rewardCategory, setRewardCategory] = useState("ทั้งหมด");

  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [confirmRewardOpen, setConfirmRewardOpen] = useState(false);
  const rewardRequestId = useRef<string | null>(null);
  const redeemLock = useRef(false);
  const memberRevision = useRef(0);
  const [couponQr, setCouponQr] = useState("");
  const [couponQrExpiresAt, setCouponQrExpiresAt] = useState("");
  const [couponNow, setCouponNow] = useState(Date.now());
  const [couponQrBusy, setCouponQrBusy] = useState(false);
  const couponQrLock = useRef(false);
  const selectedCouponId = useRef<string | null>(null);
  selectedCouponId.current = selectedCoupon?.id || null;
  const [usedCouponTitle, setUsedCouponTitle] = useState("");
  const [couponStatusError, setCouponStatusError] = useState("");
  const [couponToWatch, setCouponToWatch] = useState<{ id: string; title: string; expiresAt: string } | null>(null);
  const [rewardRedeemed, setRewardRedeemed] = useState(false);
  const [memberPoints, setMemberPoints] = useState(Number(member?.points || 0));
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [redeemError, setRedeemError] = useState("");
  const [accountRevision, setAccountRevision] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const previousView = useRef<string | null>(null);
  const viewKey = selectedNews ? `news:${selectedNews.id}` : selectedReward ? `reward:${selectedReward.id}` : tab;

  useEffect(() => {
    if (previousView.current === null) { previousView.current = viewKey; return; }
    if (previousView.current === viewKey) return;
    previousView.current = viewKey;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const element = selectedNews ? document.querySelector<HTMLElement>(".customer-view-entry") : bodyRef.current;
    const animation = element?.animate(
      [{ opacity: 0.65, transform: "translateY(15px)" }, { opacity: 1, transform: "translateY(0)" }],
      { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)" },
    );
    return () => animation?.cancel();
  }, [viewKey, selectedNews]);

  const dialogOpen = Boolean(selectedCoupon || confirmRewardOpen || usedCouponTitle);
  useEffect(() => {
    if (!dialogOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = document.querySelector<HTMLElement>(".customer-coupon-use-dialog > section, .customer-redeem-confirm-card");
    const controls = () => Array.from(panel?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input:not(:disabled), [tabindex='0']") || []).filter(element => element.getClientRects().length > 0);
    const frame = requestAnimationFrame(() => controls()[0]?.focus({ preventScroll:true }));
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !redeemBusy) {
        setSelectedCoupon(null); setConfirmRewardOpen(false); setUsedCouponTitle("");
      }
      if (event.key !== "Tab") return;
      const targets = controls();
      const first = targets[0], last = targets.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !panel?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !panel?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame); document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll:true });
    };
  }, [dialogOpen, redeemBusy]);

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
    if (!isMember) { if (kind === "reward") setRewardRedeemed(true); return; }
    redeemLock.current = true;
    setRedeemBusy(true);
    setConfirmRewardOpen(false);
    setRedeemError("");
    try {
      const requestId = kind === "reward" ? rewardRequestId.current || crypto.randomUUID() : crypto.randomUUID();
      if (kind === "reward") rewardRequestId.current = requestId;
      const response = await fetch("/api/line/member/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken, accessToken, kind, itemId, requestId }) });
      const data = await response.json() as { success?: boolean; points?: number; testMode?: boolean; error?: string };
      if (!response.ok || !data.success) throw new Error(data.error || "ทำรายการไม่สำเร็จ");
      if (typeof data.points === "number") setMemberPoints(data.points);
      memberRevision.current++;
      clearMemberCatalog();
      setAccountRevision(value => value + 1);
      setConfirmRewardOpen(false); setRewardRedeemed(true); setRewards(items => items.map(item => !data.testMode && item.id === itemId && item.stock !== null ? { ...item, stock: Math.max(0, item.stock - 1) } : item)); setSelectedReward(item => !data.testMode && item?.id === itemId && item.stock !== null ? { ...item, stock: Math.max(0, item.stock - 1) } : item);
    } catch (cause) { setConfirmRewardOpen(false); setRedeemError(cause instanceof Error ? cause.message : "ทำรายการไม่สำเร็จ"); }
    finally { redeemLock.current = false; setRedeemBusy(false); }
  }

  function openCoupon(item: Coupon) {
    const cached = isMember ? cachedCouponQr(item.id, idToken, accessToken) : undefined;
    setSelectedCoupon(item); setCouponQr(cached?.url || ""); setCouponQrExpiresAt(cached?.expiresAt || ""); setCouponNow(Date.now()); setRedeemError(""); setCouponStatusError("");
    if (cached) setCouponToWatch({ id:item.id, title:item.title, expiresAt:cached.expiresAt });
    else if (isMember) void prefetchCouponQr(item.id, idToken, accessToken);
  }

  useEffect(() => {
    if (!isMember || !couponToWatch) return;
    const coupon = couponToWatch;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let pending = false;
    let finished = false;
    async function checkStatus() {
      if (pending || finished || controller.signal.aborted) return;
      clearTimeout(timer);
      if (document.visibilityState === "hidden") return;
      pending = true;
      let delay = 1000;
      try {
        const response = await fetch("/api/line/member/coupon-qr", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "status", idToken, accessToken, couponId: coupon.id }),
          cache: "no-store", signal: controller.signal,
        });
        const result = await response.json() as { used?: boolean };
        if (!response.ok) throw new Error("ตรวจสถานะไม่สำเร็จ");
        if (controller.signal.aborted) return;
        setCouponStatusError("");
        if (result.used) {
          finished = true;
          clearCouponQr(coupon.id, idToken, accessToken);
          clearMemberCatalog();
          setCoupons(items => items.filter(item => item.id !== coupon.id));
          setSelectedCoupon(null); setCouponQr(""); setCouponQrExpiresAt("");
          setCouponToWatch(null);
          setUsedCouponTitle(coupon.title);
          setAccountRevision(value => value + 1);
        } else if (Date.parse(coupon.expiresAt) <= Date.now()) {
          finished = true;
          setCouponToWatch(null);
        }
      } catch {
        if (!controller.signal.aborted) setCouponStatusError("กำลังเชื่อมต่อเพื่อตรวจสถานะอีกครั้ง…");
        delay = 5000;
      } finally {
        pending = false;
        if (!finished && !controller.signal.aborted) timer = setTimeout(() => void checkStatus(), delay);
      }
    }
    const resume = () => { if (document.visibilityState === "visible") void checkStatus(); };
    const stopWatching = watchCatalogChanges(resume);
    void checkStatus();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    return () => { stopWatching(); controller.abort(); clearTimeout(timer); document.removeEventListener("visibilitychange", resume); window.removeEventListener("focus", resume); };
  }, [isMember, couponToWatch, idToken, accessToken]);

  async function activateCoupon() {
    if (!selectedCoupon || couponQrLock.current) return;
    const coupon=selectedCoupon;
    couponQrLock.current=true; setCouponQrBusy(true); setRedeemError("");
    try {
      const result=isMember ? await loadCouponQr(coupon.id,idToken,accessToken) : {url:localQr("TAMMY-PREVIEW-NOT-REDEEMABLE"),expiresAt:new Date(Date.now()+(coupon.qr_valid_minutes||15)*60000).toISOString()};
      if(selectedCouponId.current!==coupon.id)return;
      setCouponQr(result.url);setCouponQrExpiresAt(result.expiresAt);setCouponNow(Date.now());
      if(isMember)setCouponToWatch({id:coupon.id,title:coupon.title,expiresAt:result.expiresAt});
    }catch(cause){if(selectedCouponId.current===coupon.id)setRedeemError(cause instanceof Error?cause.message:"เปิด QR ไม่สำเร็จ");}
    finally{couponQrLock.current=false;setCouponQrBusy(false);}
  }

  useEffect(() => {
    if (!couponQrExpiresAt) return;
    const timer = window.setInterval(() => setCouponNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [couponQrExpiresAt]);

  useEffect(() => {
    setPreviewQr(localQr(isMember ? `${accessToken?.startsWith("test:") ? "TAMMY-TEST-MEMBER" : "TAMMY-MEMBER"}:${member!.memberCode}` : "TAMMY-PREVIEW-NOT-REDEEMABLE", 200, 0));
  }, [isMember, member?.memberCode, accessToken]);

  useEffect(() => { if(isMember)prefetchMemberData(idToken,accessToken); },[isMember,idToken,accessToken]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;
    const refreshShop = (fresh=false) => { void prepareCustomerShop(fresh).then(() => {
      if (!active || !publicShopSnapshot) return;
      setShop(publicShopSnapshot.shop);setNews(publicShopSnapshot.news);
    }).catch(()=>undefined); };
    refreshShop();
    const stopWatching = watchCatalogChanges(()=>refreshShop(true));
    return () => { active = false; stopWatching(); };
  }, []);

  useEffect(() => {
    if (isMember) {
      let active = true;
      const refresh = (fresh=false) => { const revision=memberRevision.current; void loadMemberCatalog(idToken, accessToken, {fresh})
        .then(data => { if (active && revision===memberRevision.current) { setRewards((data.rewards as Reward[] | undefined) || []); setCoupons((data.coupons as Coupon[] | undefined) || []); setRankProgress((data.rankProgress as RankProgress | undefined) || null); if(typeof data.points==="number")setMemberPoints(data.points); setCatalogError(""); } })
        .catch(error => { if (active && !cachedMemberCatalog(idToken, accessToken)) setCatalogError(error instanceof Error ? error.message : "โหลดสิทธิพิเศษไม่สำเร็จ"); })
        .finally(() => { if (active) setCatalogLoading(false); }); };
      refresh();
      const stopWatching = watchCatalogChanges(()=>refresh(true));
      return () => { active = false; stopWatching(); };
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
          supabase.from("coupons").select("id,title,description,discount_type,discount_value,min_spend,usage_limit,used_count,active,starts_at,ends_at,theme_color,qr_valid_minutes").eq("owner_id", ownerId).eq("active", true).order("created_at", { ascending: false }),
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
  const couponSecondsLeft = couponQrExpiresAt ? Math.max(0, Math.ceil((Date.parse(couponQrExpiresAt) - couponNow) / 1000)) : 0;

  function chooseReward(item: Reward) {
    setRedeemError(""); setRewardRedeemed(false); setConfirmRewardOpen(false);
    rewardRequestId.current = crypto.randomUUID(); setSelectedReward(item);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (selectedNews) return <div className="customer-view-entry"><PopupDetailView item={selectedNews} onBack={() => setSelectedNews(null)} className={memberFont.className + frameClass} /></div>;

  return (
    <main data-customer-tab={selectedReward ? "reward-detail" : tab} className={`customer-portal customer-home-page customer-catalog-refresh ${memberFont.className}${frameClass}`}>
      <CustomerBrandHeader greeting={isMember ? memberName : previewName} pictureUrl={member?.linePictureUrl} logoUrl={shop?.logo_url} shopName={shop?.shop_name_en || "Tammy"} />

      <div className="customer-home-body" ref={bodyRef}>
        {selectedReward ? <section className="customer-reward-detail-page" aria-labelledby="member-reward-title">
          <button type="button" className="customer-reward-detail-back" onClick={() => { setSelectedReward(null); setRewardRedeemed(false); setConfirmRewardOpen(false); rewardRequestId.current = null; }}><ArrowLeft size={18} />กลับไปของรางวัล</button>
          {rewardRedeemed && <div className="customer-reward-success" role="status"><span><Check size={24} strokeWidth={3} /></span><div><strong>แลกของรางวัลสำเร็จแล้ว!</strong><small>ใช้ {selectedReward.points_cost.toLocaleString("th-TH")} แต้ม · คงเหลือ {memberPoints.toLocaleString("th-TH")} แต้ม</small></div></div>}
          <div className={`customer-reward-detail-hero${!selectedReward.image_url ? " has-artwork" : ""}`}><CustomerRewardArtwork title={selectedReward.title} imageUrl={selectedReward.image_url} detail /></div>
          <p className="customer-reward-detail-category">{selectedReward.category || "ของรางวัล"}</p>
          <h1 id="member-reward-title">{rewardRedeemed ? "แลกสำเร็จแล้ว" : selectedReward.title}</h1>
          <div className="customer-reward-detail-stock"><Gift size={16} />{selectedReward.stock === null ? "มีของรางวัลพร้อมแลก" : selectedReward.stock > 0 ? `คงเหลือ ${selectedReward.stock.toLocaleString("th-TH")} ชิ้น` : "ของรางวัลหมดแล้ว"}</div>
          <p>{rewardRedeemed ? "แสดงหน้านี้ให้พนักงานตรวจสอบเพื่อรับของรางวัล" : selectedReward.description || "ของรางวัลพิเศษจาก Tammy Pet Shop"}</p>
          {rewardRedeemed ? <div className="customer-reward-point-story is-complete"><div className="customer-reward-point-story-result"><span>แต้มคงเหลือ</span><strong>{memberPoints.toLocaleString("th-TH")}</strong><small>แต้ม</small></div></div> : <div className={`customer-reward-point-story${memberPoints < selectedReward.points_cost ? " is-short" : ""}`} aria-label="รายละเอียดแต้มสำหรับแลกรางวัล">
            <div><span>แต้มตอนนี้</span><strong>{memberPoints.toLocaleString("th-TH")}</strong><small>แต้ม</small></div>
            <span className="customer-reward-point-story-symbol" aria-hidden="true">−</span>
            <div><span>ใช้แลกชิ้นนี้</span><strong>{selectedReward.points_cost.toLocaleString("th-TH")}</strong><small>แต้ม</small></div>
            <span className="customer-reward-point-story-symbol" aria-hidden="true">=</span>
            <div className="customer-reward-point-story-result"><span>{memberPoints >= selectedReward.points_cost ? "คงเหลือหลังแลก" : "ยังขาดอีก"}</span><strong>{Math.abs(memberPoints - selectedReward.points_cost).toLocaleString("th-TH")}</strong><small>แต้ม</small></div>
          </div>}
          {redeemError && <p role="alert" className="line-signup-error">{redeemError}</p>}
          <div className="customer-reward-redeem-dock"><div className="customer-reward-redeem-dock-inner"><div className="customer-reward-redeem-dock-caption"><Gift size={17} aria-hidden="true" /><span>{rewardRedeemed ? "รับของรางวัลได้เลย" : selectedReward.stock === 0 ? "ของรางวัลหมดแล้ว" : memberPoints < selectedReward.points_cost ? `อีก ${Math.max(0, selectedReward.points_cost - memberPoints).toLocaleString("th-TH")} แต้มก็แลกได้` : "แต้มครบแล้ว พร้อมแลก"}</span><strong>{selectedReward.points_cost.toLocaleString("th-TH")} แต้ม</strong></div><button className="customer-reward-detail-submit" type="button" disabled={redeemBusy || (!rewardRedeemed && (memberPoints < selectedReward.points_cost || selectedReward.stock === 0))} onClick={() => rewardRedeemed ? setSelectedReward(null) : setConfirmRewardOpen(true)}>{rewardRedeemed ? "เสร็จสิ้น" : redeemBusy ? "กำลังแลก…" : "แลกของรางวัล"}</button></div></div>
          {confirmRewardOpen && !rewardRedeemed && <div className="customer-redeem-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="customer-redeem-confirm-title"><button type="button" className="customer-redeem-confirm-backdrop" aria-label="ปิด" onClick={() => { if (!redeemBusy) setConfirmRewardOpen(false); }} /><section className="customer-redeem-confirm-card"><span className="customer-redeem-confirm-icon"><Gift size={25} /></span><h2 id="customer-redeem-confirm-title">{redeemBusy ? "กำลังบันทึกการแลก…" : "ยืนยันแลกรางวัล"}</h2><p>{redeemBusy ? "รอสักครู่ ระบบกำลังบันทึกแต้มและของรางวัล" : <>ยืนยันใช้ <strong>{selectedReward.points_cost.toLocaleString("th-TH")} แต้ม</strong><br />เพื่อแลก {selectedReward.title}?</>}</p><div className="customer-redeem-confirm-balance"><span>แต้มตอนนี้ <strong>{memberPoints.toLocaleString("th-TH")}</strong></span><span>หลังแลก <strong>{Math.max(0, memberPoints - selectedReward.points_cost).toLocaleString("th-TH")}</strong></span></div><div className="customer-redeem-confirm-actions"><button type="button" disabled={redeemBusy} onClick={() => setConfirmRewardOpen(false)}>ยกเลิก</button><button type="button" disabled={redeemBusy || memberPoints < selectedReward.points_cost} onClick={() => void redeem("reward", selectedReward.id)}>{redeemBusy ? "กำลังบันทึก…" : "ยืนยันแลกรางวัล"}</button></div></section></div>}
        </section> : tab === "home" ? <>
          <CustomerMemberCard name={isMember ? memberName : previewName} level={member?.level || "Gold"} points={isMember ? memberPoints : 90} memberCode={member?.memberCode || "PREVIEW"} qr={previewQr} preview={!isMember} progress={rankProgress} />

          <section className="customer-home-news" aria-label="ข่าวสารจากร้าน">
            <div className="customer-home-section-heading"><h1>ข่าวสารล่าสุด</h1>{news.length > 1 && <span className="customer-news-hint">ปัดเพื่อดูข่าวอื่น</span>}</div>
            {news.length ? <CustomerNewsCarousel news={news} onSelect={setSelectedNews} /> : <div className="customer-home-empty-news"><PawPrint size={32} /><strong>ยังไม่มีข่าวสารจากร้าน</strong></div>}
          </section>
        </> : tab === "store" ? <CustomerStore name={shop?.shop_name||"Tammy Pet Shop"} info={shop?.storeInfo||null}/> : tab !== "account" ? <section className="customer-home-catalog" aria-label={sectionText[tab].title}>
          {tab === "rewards" && <><div className="customer-catalog-intro"><div><h1>ของรางวัล</h1><p className="customer-catalog-description">ของขวัญเล็ก ๆ สำหรับเพื่อนตัวโปรด</p></div><div className="customer-catalog-summary"><span>แต้มของคุณ <strong>{isMember ? memberPoints.toLocaleString("th-TH") : "90"}</strong></span><Star size={30} strokeWidth={1.5} aria-hidden="true" /></div></div>{rewardCategories.length > 2 && <div className="customer-rewards-filters" aria-label="หมวดหมู่ของรางวัล">{rewardCategories.map(category => <button type="button" key={category} className={rewardCategory === category ? "active" : ""} onClick={() => setRewardCategory(category)}>{category}</button>)}</div>}{catalogLoading ? <p className="customer-home-catalog-state">กำลังโหลดของรางวัล…</p> : catalogError ? <p className="customer-home-catalog-state" role="alert">{catalogError}</p> : visibleRewards.length ? <div className="customer-rewards-horizontal-list">{visibleRewards.map(item => <CustomerRewardCard key={item.id} reward={item} points={isMember ? memberPoints : 90} memberMode onSelect={() => chooseReward(item)} />)}</div> : <p className="customer-home-catalog-state">{sectionText.rewards.empty}</p>}</>}
          {tab === "coupons" && <><div className="customer-catalog-intro"><div><h1>คูปองของฉัน</h1><p className="customer-catalog-description">สิทธิพิเศษดี ๆ สำหรับสมาชิก</p></div><div className="customer-catalog-summary"><span>สิทธิพิเศษสำหรับคุณ</span><Tag size={29} strokeWidth={1.5} aria-hidden="true" /></div></div>{catalogLoading ? <p className="customer-home-catalog-state">กำลังโหลดคูปอง…</p> : catalogError ? <p className="customer-home-catalog-state" role="alert">{catalogError}</p> : coupons.length ? <div className="customer-coupon-tickets">{coupons.map(item => <article className="customer-coupon-ticket" key={item.id}><CouponTicketFace variant="member" title={item.title} discountType={item.discount_type} discountValue={Number(item.discount_value)} minSpend={Number(item.min_spend)} remaining={item.usage_limit === null ? null : Math.max(0, item.usage_limit - item.used_count)} endsAt={item.ends_at} theme={item.theme_color} onUse={() => { void openCoupon(item); }} /></article>)}</div> : <p className="customer-home-catalog-state">{sectionText.coupons.empty}</p>}</>}

        </section> : null}
        <section className="customer-home-catalog customer-account-mounted" aria-label="ข้อมูลของฉัน" style={{ display: tab === "account" && !selectedReward ? undefined : "none" }}><CustomerAccount preview={!isMember} member={member} idToken={idToken} accessToken={accessToken} onLogout={onLogout} onMemberUpdated={onMemberUpdated} refreshKey={accountRevision} /></section>
      </div>

      {couponStatusError && selectedCoupon && <p className="customer-coupon-status-notice" role="status">{couponStatusError}</p>}
      {usedCouponTitle && <div className="customer-coupon-use-dialog" role="dialog" aria-modal="true" aria-labelledby="coupon-used-title"><button type="button" className="customer-coupon-use-backdrop" aria-label="ปิด" onClick={() => setUsedCouponTitle("")} /><section className="customer-coupon-used"><span className="customer-coupon-use-icon"><Check size={32} /></span><h2 id="coupon-used-title">ใช้คูปองสำเร็จแล้ว</h2><p role="status">ร้านยืนยันใช้สิทธิ์ของคุณเรียบร้อยแล้ว</p><strong>{usedCouponTitle}</strong><button className="customer-coupon-copy-button" type="button" autoFocus onClick={() => setUsedCouponTitle("")}>เรียบร้อย</button></section></div>}
      {!selectedReward && <CustomerNavigation activeTab={tab} onSelect={setTab} />}
      {selectedCoupon ? <div className="customer-coupon-use-dialog" role="dialog" aria-modal="true" aria-labelledby="customer-coupon-use-title"><button type="button" className="customer-coupon-use-backdrop" onClick={() => setSelectedCoupon(null)} aria-label="ปิดหน้าคูปอง"/><section><button type="button" className="customer-coupon-use-close" onClick={() => setSelectedCoupon(null)} aria-label="ปิด"><X size={19}/></button><span className="customer-coupon-use-icon"><TicketPercent size={27}/></span><p>คูปองเฉพาะของคุณ</p><h2 id="customer-coupon-use-title">{selectedCoupon.title}</h2><strong className="customer-coupon-use-value">{selectedCoupon.discount_type === "percent" ? `ลด ${Number(selectedCoupon.discount_value).toLocaleString("th-TH")}%` : `ลด ${Number(selectedCoupon.discount_value).toLocaleString("th-TH")} บาท`}</strong>{!couponQr ? <><div className="customer-coupon-terms"><strong>เงื่อนไขก่อนใช้สิทธิ์</strong><ul>{selectedCoupon.description ? <li>{selectedCoupon.description}</li> : null}<li>{selectedCoupon.min_spend > 0 ? `ใช้เมื่อซื้อครบ ${Number(selectedCoupon.min_spend).toLocaleString("th-TH")} บาท` : "ไม่มีขั้นต่ำ"}</li><li>ใช้สิทธิ์ได้ที่หน้าร้านเท่านั้น จำกัด 1 ครั้งต่อสมาชิก ให้พนักงานสแกน QR เพื่อยืนยัน</li>{selectedCoupon.ends_at ? <li>คูปองใช้ได้ถึง {new Date(selectedCoupon.ends_at).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" })}</li> : null}<li>QR ใช้ได้ {selectedCoupon.qr_valid_minutes || 15} นาทีตั้งแต่เตรียม QR เมื่อเปิดคูปอง หากหมดเวลาก่อนพนักงานสแกน สามารถเปิด QR ใหม่ได้ โดย QR เดิมจะใช้ไม่ได้</li></ul></div>{redeemError ? <p role="alert" className="line-signup-error">{redeemError}</p> : null}<button className="customer-coupon-copy-button" type="button" disabled={couponQrBusy} onClick={() => void activateCoupon()}>{couponQrBusy ? "กำลังเตรียม QR…" : "ยืนยันใช้คูปอง"}</button></> : couponSecondsLeft > 0 ? <><div className="customer-coupon-personal-qr"><Image src={couponQr} alt="QR คูปองส่วนตัวสำหรับให้พนักงานสแกน" width={224} height={224} unoptimized /><small>ให้พนักงานสแกนและยืนยันใช้สิทธิ์ที่หน้าร้าน</small></div><div className="customer-coupon-countdown" role="timer">QR ใช้ได้อีก <strong>{String(Math.floor(couponSecondsLeft / 60)).padStart(2, "0")}:{String(couponSecondsLeft % 60).padStart(2, "0")}</strong> นาที</div></> : <div className="customer-coupon-expired" role="status"><p>QR หมดเวลาแล้ว</p><small>ยังไม่ได้ใช้สิทธิ์? เปิด QR ใหม่ได้ที่หน้าร้าน โดย QR เดิมจะใช้ไม่ได้</small><button className="customer-coupon-copy-button" type="button" disabled={couponQrBusy} onClick={() => void activateCoupon()}>{couponQrBusy ? "กำลังเตรียม QR…" : "เปิด QR ใหม่"}</button></div>}</section></div> : null}</main>
  );
}
