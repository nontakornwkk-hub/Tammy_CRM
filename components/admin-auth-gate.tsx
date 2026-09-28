"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase/client";
import { crmRole, setVerifiedCrmUser, verifiedCrmUser } from "@/lib/supabase/crm-data";

const publicPaths = new Set(["/login", "/reset-password", "/line-membership", "/customer"]);
function canOpen(role: ReturnType<typeof crmRole>, pathname: string) {
  if (role === "owner") return true;
  if (role === "manager") return ["/points", "/members", "/rewards", "/reports", "/settings", "/customer-preview", "/line"].includes(pathname) || pathname.startsWith("/customer/") || pathname.startsWith("/customer-preview/");
  return role === "staff" && ["/points", "/settings", "/line"].includes(pathname);
}

export function AdminAuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = publicPaths.has(pathname);
  const [status, setStatus] = useState<"checking" | "allowed" | "pending" | "unconfirmed">("checking");

  useEffect(() => {
    if (isPublic) return;
    let current = true;
    setStatus("checking");
    if (!supabase) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" && current) {
        setVerifiedCrmUser(null);
        setStatus("checking");
        router.replace("/login");
      }
      if (event === "SIGNED_IN" && current && verifiedCrmUser() && session?.user.id !== verifiedCrmUser()) {
        setVerifiedCrmUser(null);
        window.location.reload();
      }
    });
    void (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!current) return;
      if (error || !data.user) { setVerifiedCrmUser(null); router.replace(`/login?next=${encodeURIComponent(pathname)}`); return; }
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
      setStatus(authorized ? "allowed" : "pending");
    })();
    return () => { current = false; authListener.subscription.unsubscribe(); };
    // The root layout stays mounted across admin pages. Only entering from a public
    // page (or a full reload) needs another check; RLS still checks every data call.
  }, [isPublic, router]);

  if (isPublic) return children;
  if (status === "checking") return <main className="admin-auth-check" role="status">กำลังตรวจสอบสิทธิ์เข้าระบบ…</main>;
  if (status === "unconfirmed") return <main className="admin-auth-check"><section className="admin-auth-pending"><h1>กรุณายืนยันอีเมลก่อน</h1><p>เปิดลิงก์ยืนยันที่ส่งไปยังอีเมลของคุณ แล้วกลับมากดตรวจสอบอีกครั้ง</p><button type="button" onClick={() => window.location.reload()}>ตรวจสอบอีกครั้ง</button><button type="button" onClick={async () => { await supabase?.auth.signOut(); router.replace("/login"); }}>ออกจากระบบ</button></section></main>;
  if (status === "pending") return <main className="admin-auth-check"><section className="admin-auth-pending"><h1>บัญชีนี้ยังไม่มีสิทธิ์เข้าร้าน</h1><p>ให้เจ้าของร้านเพิ่มอีเมลบัญชีนี้ในหน้า ตั้งค่าระบบ → ทีมงานและความปลอดภัย แล้วกลับมาตรวจสอบอีกครั้ง</p><button type="button" onClick={() => window.location.reload()}>ตรวจสอบอีกครั้ง</button><button type="button" onClick={async () => { await supabase?.auth.signOut(); router.replace("/login"); }}>ออกจากระบบ</button></section></main>;
  if (!canOpen(crmRole(), pathname)) return <main className="admin-auth-check"><section className="admin-auth-pending"><h1>ไม่มีสิทธิ์เปิดหน้านี้</h1><p>บัญชีทีมงานนี้ได้รับสิทธิ์เฉพาะเมนูที่เจ้าของร้านกำหนด</p><button type="button" onClick={() => router.replace("/points")}>ไปหน้าให้แต้ม</button></section></main>;
  return children;
}
