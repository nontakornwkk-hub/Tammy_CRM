"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase/client";

const publicPaths = new Set(["/login", "/customer"]);
const adminEmail = "nontakorn.wn@gmail.com";

export function AdminAuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = publicPaths.has(pathname) || pathname.startsWith("/customer/");
  const [status, setStatus] = useState<"checking" | "allowed" | "pending">("checking");

  useEffect(() => {
    if (isPublic) return;
    let current = true;
    setStatus("checking");
    if (!supabase) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && current) {
        setStatus("checking");
        router.replace("/login");
      }
    });
    void (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!current) return;
      if (error || !data.user) { router.replace(`/login?next=${encodeURIComponent(pathname)}`); return; }
      if (data.user.email?.toLowerCase() !== adminEmail || !data.user.email_confirmed_at) { setStatus("pending"); return; }
      const access = await supabase.from("store_settings").select("owner_id").eq("owner_id", data.user.id).maybeSingle();
      if (!current) return;
      setStatus(access.data && !access.error ? "allowed" : "pending");
    })();
    return () => { current = false; authListener.subscription.unsubscribe(); };
    // The root layout stays mounted across admin pages. Only entering from a public
    // page (or a full reload) needs another check; RLS still checks every data call.
  }, [isPublic, router]);

  if (isPublic) return children;
  if (status === "checking") return <main className="admin-auth-check" role="status">กำลังตรวจสอบสิทธิ์เข้าระบบ…</main>;
  if (status === "pending") return <main className="admin-auth-check"><section className="admin-auth-pending"><h1>บัญชียังไม่ผูกกับร้าน</h1><p>บัญชีนี้ยังไม่ได้รับสิทธิ์ดูข้อมูลลูกค้าของร้าน กรุณาแจ้งอีเมลแอดมินเพื่อผูกข้อมูลก่อน</p><button type="button" onClick={() => window.location.reload()}>ตรวจสอบอีกครั้ง</button><button type="button" onClick={async () => { await supabase?.auth.signOut(); router.replace("/login"); }}>ออกจากระบบ</button></section></main>;
  return children;
}
