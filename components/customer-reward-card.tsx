import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Gift } from "lucide-react";

export function CustomerRewardCard({ reward, points, memberMode = false, onSelect }: { reward: { id: string; title: string; points_cost: number; image_url: string | null }; points: number; memberMode?: boolean; onSelect?: () => void }) {
  const required = Math.max(0, reward.points_cost);
  const missing = Math.max(0, required - points);
  const progress = required > 0 ? Math.min(100, Math.max(0, points / required * 100)) : 100;
  return <article className="customer-reward-horizontal">
    <div className="customer-reward-horizontal-image">
      {reward.image_url ? <Image src={reward.image_url} alt={reward.title} fill sizes="(max-width: 520px) 36vw, 170px" unoptimized /> : <Gift size={52} strokeWidth={1.4} aria-hidden="true" />}
    </div>
    <div className="customer-reward-horizontal-copy">
      <h2>{reward.title}</h2>
      <strong className="customer-reward-horizontal-price">{required.toLocaleString("th-TH")} <span>แต้ม</span></strong>
      <div className="customer-reward-progress-row"><progress max={100} value={progress} aria-label={`คะแนนสำหรับ ${reward.title}`} /><span>{Math.round(progress)}%</span></div>
      <p className={missing === 0 ? "customer-reward-shortfall is-ready" : "customer-reward-shortfall"}>{missing === 0 ? "แต้มครบ พร้อมแลกแล้ว" : `ขาดอีก ${missing.toLocaleString("th-TH")} แต้ม`}</p>
      {memberMode ? <button type="button" className="customer-reward-horizontal-link" onClick={onSelect}>ดูรายละเอียด <ChevronRight size={16} /></button> : <Link className="customer-reward-horizontal-link" href={`/customer/rewards/${encodeURIComponent(reward.id)}`}>ดูรายละเอียด <ChevronRight size={16} /></Link>}
    </div>
  </article>;
}
