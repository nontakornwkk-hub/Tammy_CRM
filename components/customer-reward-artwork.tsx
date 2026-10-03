"use client";

import Image from "next/image";
import { useState } from "react";

/** Decorative fallback when the shop has not uploaded a product photo. */
export function CustomerRewardArtwork({ title, imageUrl, detail = false }: { title: string; imageUrl: string | null; detail?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (imageUrl && imageUrl !== failedUrl) return <Image src={imageUrl} alt={title} fill sizes={detail ? "(max-width: 520px) 90vw, 460px" : "(max-width: 520px) 120px, 150px"} unoptimized onError={() => setFailedUrl(imageUrl)} />;
  return <div className={`customer-reward-artwork${detail ? " is-detail" : ""}`}>
    <svg viewBox="0 0 180 160" fill="none" aria-hidden="true">
      <ellipse cx="92" cy="143" rx="52" ry="8" fill="#BEB0F2" opacity=".25" />
      <circle cx="93" cy="77" r="62" fill="#FFF" opacity=".55" />
      <path d="m30 45 3-9 3 9 9 3-9 3-3 9-3-9-9-3 9-3Z" fill="#B69AEF" />
      <path d="m143 106 2-7 3 7 7 3-7 2-3 7-2-7-7-2 7-3Z" fill="#EEA756" />
      <circle cx="143" cy="41" r="4" fill="#F7B4C2" /><circle cx="34" cy="111" r="3" fill="#B9DACC" />
      <g transform="rotate(-8 90 86)">
        <rect x="51" y="71" width="83" height="65" rx="13" fill="#A893EF" /><path d="M51 88h83v9H51z" fill="#9380DA" opacity=".5" />
        <rect x="45" y="58" width="95" height="29" rx="9" fill="#BDAAF8" /><path d="M83 58h18v78H83z" fill="#FFF0C9" />
        <path d="M90 58C68 62 53 49 60 39c8-11 25 1 30 19Zm5 0c22 4 37-9 30-19-8-11-25 1-30 19Z" fill="#FFDE9B" stroke="#E8BA66" strokeWidth="3" />
        <path d="M72 108c0-7 7-12 12-5 5-7 12-2 12 5 0 6-12 13-12 13s-12-7-12-13Z" fill="#FFF" opacity=".85" transform="translate(26 -5) scale(.8)" />
      </g>
      <path d="M143 67c0-4 5-7 8-3 3-4 8-1 8 3 0 4-8 8-8 8s-8-4-8-8Z" fill="#F6A6B8" />
    </svg>
    {detail && <span>ของรางวัลสำหรับสมาชิก</span>}
    <span className="customer-reward-photo-note">ยังไม่มีรูปสินค้า</span>
  </div>;
}
