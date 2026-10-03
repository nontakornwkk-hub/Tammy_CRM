"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { watchCatalogChanges } from "@/lib/catalog-live";
import { singleFlight } from "@/lib/single-flight";

const loadLogo = singleFlight<string | null>();
let currentLogo: string | null = null;
export function CustomerStoreLogo() {
  const [logo, setLogo] = useState(currentLogo);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (!supabase) return;
      void loadLogo("shop", async () => {
        const result = await supabase!.from("public_shop_profiles").select("logo_url").eq("slug", "tammy").maybeSingle();
        if (result.error) throw result.error;
        return result.data?.logo_url || null;
      }).then(value => { if (active) { currentLogo = value; setLogo(value); } }).catch(() => undefined);
    };
    refresh();
    const stop = watchCatalogChanges(refresh);
    return () => { active = false; stop(); };
  }, []);
  return <Image src={logo || "/assets/shop-logo-original.png"} width={240} height={240} alt="โลโก้ร้าน Tammy Pet Shop" unoptimized priority />;
}
