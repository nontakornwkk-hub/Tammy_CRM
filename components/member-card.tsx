"use client";

import Image from "next/image";
import QRCode from "qrcode";
import { Bone, CircleDot, Crown, Fish, PawPrint, RotateCw, Sparkles } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { defaultCardDesign, patternForTheme, type CardDesign, type CardPattern } from "@/lib/card-design";

export type CardMember = { name: string; code: string; level: "Member" | "Silver" | "Gold" | "Platinum"; points: number; spending: number };

const patternIcons = { paws: PawPrint, fish: Fish, kibble: CircleDot, stitch: Sparkles, bones: Bone };

function CardPatternArt({ pattern }: { pattern: CardPattern }) {
  const Icon = patternIcons[pattern];
  return <span className={`member-card-art pattern-${pattern}`} aria-hidden="true"><i className="member-card-art-orbit"/><Icon className="member-card-art-icon art-one"/><Icon className="member-card-art-icon art-two"/><Icon className="member-card-art-icon art-three"/></span>;
}

export function MemberCard({ design = defaultCardDesign, member, shopName = "TAMMY", goldThreshold = 5000, platinumThreshold = 20000, className = "" }: { design?: CardDesign; member: CardMember; shopName?: string; goldThreshold?: number; platinumThreshold?: number; className?: string }) {
  const [flipped, setFlipped] = useState(false);
  const [qr, setQr] = useState("");
  const theme = design.themes.find((item) => item.id === design.selectedTheme) ?? design.themes[0] ?? defaultCardDesign.themes[0];
  const pattern = patternForTheme(theme);
  const mascot = design.mascots.find((item) => item.id === design.selectedMascot);
  const target = member.spending < goldThreshold ? goldThreshold : member.spending < platinumThreshold ? platinumThreshold : 0;
  const previous = target === platinumThreshold ? goldThreshold : 0;
  const percent = target ? Math.min(100, Math.max(0, ((member.spending - previous) / Math.max(1, target - previous)) * 100)) : 100;
  const nextRank = target === goldThreshold ? "Gold" : "Platinum";
  const style = { "--card-from": theme.from, "--card-to": theme.to, "--card-ink": theme.ink } as CSSProperties;

  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(member.code, { width: 480, margin: 2, errorCorrectionLevel: "M", color: { dark: "#171a1d", light: "#ffffff" } }).then((value) => { if (active) setQr(value); }).catch(() => { if (active) setQr(""); });
    return () => { active = false; };
  }, [member.code]);

  return <div className={`member-card-control ${className}`}>
    <button type="button" className={`member-card-flipper${flipped ? " is-flipped" : ""}`} style={style} onClick={() => setFlipped((value) => !value)} aria-label={flipped ? "พลิกบัตรกลับด้านหน้า" : "พลิกบัตรดู QR ด้านหลัง"} aria-pressed={flipped}>
      <span className="member-card-face member-card-front" aria-hidden={flipped}>
        <CardPatternArt pattern={pattern}/>
        <span className="member-card-brand"><PawPrint size={23} /> {shopName}</span>
        <span className={`member-card-rank rank-${member.level.toLowerCase()}`}><Crown size={14} /> {member.level}</span>
        <span className="member-card-person"><strong>{member.name}</strong><b>{member.points.toLocaleString()} <small>แต้ม</small></b></span>
        {mascot ? <span className="member-card-mascot" aria-hidden="true">{mascot.image.startsWith("/") || mascot.image.startsWith("http") || mascot.image.startsWith("data:") ? <Image src={mascot.image} alt="" width={138} height={138} unoptimized={mascot.image.startsWith("data:") || mascot.image.startsWith("http")} /> : mascot.image}</span> : null}
        <span className="member-card-progress"><small>{target ? `อีก ฿${Math.max(0, target - member.spending).toLocaleString()} จะเลื่อนเป็น ${nextRank}` : "ระดับสูงสุด Platinum"}</small><i><em style={{ width: `${percent}%` }} /></i></span>
        <span className="member-card-code">{member.code}</span>
      </span>
      <span className="member-card-face member-card-back" aria-hidden={!flipped}>
        <CardPatternArt pattern={pattern}/>
        <span className="member-card-brand"><PawPrint size={23} /> {shopName}</span>
        <span className="member-card-back-note">แสดง QR ให้พนักงานสแกนเพื่อรับแต้ม</span>
        <span className="member-card-qr">{qr ? <Image src={qr} alt="" width={480} height={480} unoptimized /> : <span aria-hidden="true">QR</span>}</span>
        <strong className="member-card-back-code">{member.code}</strong>
        <small className="member-card-back-caption">สะสมแต้มได้เมื่อซื้อสินค้าที่หน้าร้าน ♡</small>
      </span>
    </button>
    <p className="member-card-flip-hint"><RotateCw size={15} /> แตะบัตรเพื่อพลิกดู{flipped ? "ด้านหน้า" : "รหัสสมาชิก"}</p>
  </div>;
}
