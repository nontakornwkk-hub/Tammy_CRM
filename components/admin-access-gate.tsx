"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase/client";
import { crmRole, prefetchCrmPages, setVerifiedCrmUser, verifiedCrmUser } from "@/lib/supabase/crm-data";
import { clearAdminExtras, prefetchAdminExtras } from "@/lib/supabase/admin-preload";

const publicPaths = new Set(["/login", "/reset-password", "/line-membership", "/customer"]);
function canOpen(role: ReturnType<typeof crmRole>, pathname: string) {
  if (role === "owner") return true;
  if (role === "manager") return ["/points", "/members", "/rewards", "/reports", "/settings", "/line"].includes(pathname) || pathname.startsWith("/customer/");
  return role === "staff" && (["/points", "/settings", "/line"].includes(pathname));
}

export function AdminAccessGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = publicPaths.has(pathname);
  const [status, setStatus] = useState<"checking" | "allowed" | "pending" | "unconfirmed" | "offline">("checking");
  const alreadyVerified = Boolean(verifiedCrmUser() && canOpen(crmRole(), pathname));

  useEffect(() => {
    if (isPublic) return;
    let current = true;
    let warmupTimer: ReturnType<typeof setTimeout> | undefined;
    setStatus("checking");
    if (!supabase) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" && current) {
        setVerifiedCrmUser(null);
        clearAdminExtras();
        setStatus("checking");
        router.replace("/login");
      }
      if (event === "SIGNED_IN" && current && verifiedCrmUser() && session?.user.id !== verifiedCrmUser()) {
        setVerifiedCrmUser(null);
        window.location.reload();
      }
    });
    void (async () => {
      const stored = await supabase.auth.getSession();
      if (!current) return;
      if (!stored.data.session) { setVerifiedCrmUser(null); router.replace(`/login?next=${encodeURIComponent(pathname)}`); return; }
      const { data, error } = await supabase.auth.getUser();
      if (!current) return;
      if (error || !data.user) { setStatus("offline"); return; }
      if (!data.user.email_confirmed_at) { setVerifiedCrmUser(null); setStatus("unconfirmed"); return; }
      const access = await supabase.rpc("crm_current_access").maybeSingle();
      if (!current) return;
      let account = access.data as { owner_id: string; role: string } | null;
      if (access.error) {
        // Keep the existing owner login working until the team migration is applied.
        const fallback = await supabase.from("store_settings").select("owner_id").eq("owner_id", data.user.id).maybeSingle();
        if (!current) return;
        account = fallback.data && !fallback.error ? { owner_id: fallback.data.owner_id, role: "owner" } : null;
      }
      const role = account?.role;
      const authorized = Boolean(account?.owner_id && (role === "owner" || role === "manager" || role === "staff"));
      setVerifiedCrmUser(authorized ? data.user.id : null, authorized ? account!.owner_id : null, role === "owner" || role === "manager" || role === "staff" ? role : null);
      if (!current) return;
      setStatus(authorized ? "allowed" : "pending");
      if (authorized) warmupTimer = setTimeout(() => {
        if (!current || window.location.pathname === "/line") return;
        void Promise.allSettled([
          prefetchCrmPages(),
          prefetchAdminExtras(data.user.id, account!.owner_id, role === "owner"),
        ]);
      }, 1200);
    })();
    return () => { current = false; if (warmupTimer) clearTimeout(warmupTimer); authListener.subscription.unsubscribe(); };
    // The root layout stays mounted across admin pages. Only entering from a public
    // page (or a full reload) needs another check; RLS still checks every data call.
  }, [isPublic, router]);

  if (isPublic) return children;
  if (status === "checking" && !alreadyVerified) return <main className="admin-auth-check" role="status">กำลังตรวจสอบสิทธิ์เข้าระบบ…</main>;
  if (status === "offline") return <main className="admin-auth-check"><section className="admin-auth-pending"><h1>ตรวจสอบการเชื่อมต่อไม่สำเร็จ</h1><p>บัญชีของคุณยังอยู่ในเครื่อง กรุณาตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง</p><button type="button" onClick={() => window.location.reload()}>ลองอีกครั้ง</button></section></main>;
  if (status === "unconfirmed") return <main className="admin-auth-check"><section className="admin-auth-pending"><h1>กรุณายืนยันอีเมลก่อน</h1><p>เปิดลิงก์ยืนยันที่ส่งไปยังอีเมลของคุณ แล้วกลับมากดตรวจสอบอีกครั้ง</p><button type="button" onClick={() => window.location.reload()}>ตรวจสอบอีกครั้ง</button><button type="button" onClick={async () => { await supabase?.auth.signOut(); router.replace("/login"); }}>ออกจากระบบ</button></section></main>;
  if (status === "pending") return <main className="admin-auth-check"><section className="admin-auth-pending"><h1>บัญชีนี้ยังไม่มีสิทธิ์เข้าร้าน</h1><p>ให้เจ้าของร้านเพิ่มอีเมลบัญชีนี้ในหน้า ตั้งค่าระบบ → ทีมงานและความปลอดภัย แล้วกลับมาตรวจสอบอีกครั้ง</p><button type="button" onClick={() => window.location.reload()}>ตรวจสอบอีกครั้ง</button><button type="button" onClick={async () => { await supabase?.auth.signOut(); router.replace("/login"); }}>ออกจากระบบ</button></section></main>;
  if (!canOpen(crmRole(), pathname)) return <main className="admin-auth-check"><section className="admin-auth-pending"><h1>ไม่มีสิทธิ์เปิดหน้านี้</h1><p>บัญชีทีมงานนี้ได้รับสิทธิ์เฉพาะเมนูที่เจ้าของร้านกำหนด</p><button type="button" onClick={() => router.replace("/points")}>ไปหน้าให้แต้ม</button></section></main>;
  return children;
}
