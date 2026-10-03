"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const loadedPictures = new Set<string>();
const failedPictures = new Set<string>();

/** Keep the local shop image visible until the LINE photo has actually decoded. */
export function ProfilePhoto({ src, size, alt = "" }: { src?: string | null; size: number; alt?: string }) {
  const url = src?.startsWith("https://") ? src : null;
  const [ready, setReady] = useState(() => Boolean(url && loadedPictures.has(url)));
  const [failed, setFailed] = useState(() => Boolean(url && failedPictures.has(url)));

  useEffect(() => {
    setReady(Boolean(url && loadedPictures.has(url)));
    setFailed(Boolean(url && failedPictures.has(url)));
  }, [url]);

  return <span className="profile-photo" style={{ width: size, height: size }}>
    <Image src="/assets/shop-logo-original.png" alt={url ? "" : alt} width={size} height={size} className="profile-photo-fallback" />
    {url && !failed ? <img src={url} alt={alt} referrerPolicy="no-referrer" className={`profile-photo-line${ready ? " is-ready" : ""}`} onLoad={event => {
      const image = event.currentTarget;
      if (image.naturalWidth > 0) { loadedPictures.add(url); setReady(true); }
    }} onError={() => { failedPictures.add(url); setFailed(true); }} /> : null}
  </span>;
}
