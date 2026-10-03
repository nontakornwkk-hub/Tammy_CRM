import Link from "next/link";
import { ChevronRight, Check, Package } from "lucide-react";
import { CustomerRewardArtwork } from "./customer-reward-artwork";

export function CustomerRewardCard({ reward, points, memberMode = false, onSelect }: { reward: { id: string; title: string; points_cost: number; stock?: number | null; image_url: string | null }; points: number; memberMode?: boolean; onSelect?: () => void }) {
  const required = Math.max(0, reward.points_cost);
  const missing = Math.max(0, required - points);
  const available = reward.stock !== 0;
  const ready = missing === 0 && available;
  const progress = required > 0 ? Math.min(100, Math.max(0, points / required * 100)) : 100;
  return <article className={`customer-reward-horizontal${memberMode ? " is-interactive" : ""}${ready ? " is-ready" : ""}`}>
    <div className="customer-reward-horizontal-image">
      <CustomerRewardArtwork title={reward.title} imageUrl={reward.image_url} />
    </div>
    <div className="customer-reward-horizontal-copy">
      <h2>{reward.title}</h2>
      <span className={`customer-reward-stock${!available ? " is-empty" : ""}`}><Package size={11} aria-hidden="true" />{reward.stock == null ? "พร้อมให้แลก" : available ? `เหลือ ${reward.stock.toLocaleString("th-TH")} ชิ้น` : "หมดแล้ว"}</span>
      <strong className="customer-reward-horizontal-price">{required.toLocaleString("th-TH")} <span>แต้ม</span></strong>
      <div className="customer-reward-progress-row"><progress max={100} value={progress} aria-label={`มี ${points.toLocaleString("th-TH")} จาก ${required.toLocaleString("th-TH")} แต้มสำหรับ ${reward.title}`} /></div>
      <div className="customer-reward-card-footer"><p className={ready ? "customer-reward-shortfall is-ready" : "customer-reward-shortfall"}>{!available ? "รอเติมของรางวัล" : ready ? <><Check size={12} />แต้มครบแล้ว</> : `อีก ${missing.toLocaleString("th-TH")} แต้ม`}</p><span className="customer-reward-card-cta">{ready ? "แลกเลย" : "ดูรางวัล"}<ChevronRight size={13} /></span></div>
    </div>
    {memberMode ? <button className="customer-reward-hit" type="button" aria-label={`${ready ? "แลก" : "ดูรายละเอียด"} ${reward.title}`} onClick={onSelect} /> : <Link className="customer-reward-hit" href={`/customer/rewards/${encodeURIComponent(reward.id)}`} aria-label={`ดูรายละเอียด ${reward.title}`} />}
  </article>;
}
