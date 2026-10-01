"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { prefetchCrmPages, setVerifiedCrmUser } from "@/lib/supabase/crm-data";
import { prefetchAdminExtras } from "@/lib/supabase/admin-preload";
import { CustomerPortal } from "./customer-portal";
import { LineMemberRegistration } from "./line-member-registration";

type EntryState = "checking" | "admin" | "denied" | "line" | "test-error" | "test-login";
type TestMember = { memberCode: string; name: string; level: string; points: number; linePictureUrl: string | null };
const testSignedOutKey = "tammy-admin-test-signed-out";

export function CustomerEntry() {
  const router = useRouter();
  const [state, setState] = useState<EntryState>("checking");
  const [testMember, setTestMember] = useState<TestMember | null>(null);
  const [testToken, setTestToken] = useState("");
  const [testError, setTestError] = useState("");
  const [testBusy, setTestBusy] = useState(false);

  async function openTestMember() {
    setState("checking"); setTestError("");
    try {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (!token) throw new Error("กรุณาเข้าสู่ระบบแอดมินใหม่");
      const response = await fetch("/api/dev/test-member", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const result = await response.json() as { member?: TestMember; error?: string };
      if (!response.ok || !result.member) throw new Error(result.error || "เปิดบัญชีทดสอบไม่สำเร็จ");
      localStorage.removeItem(testSignedOutKey);
      setTestMember(result.member); setTestToken(token); setState("admin");
    } catch (cause) {
      setTestError(cause instanceof Error ? cause.message : "เปิดบัญชีทดสอบไม่สำเร็จ");
      setState("test-error");
    }
  }

  async function changeTestPoints(action: "addPoints" | "reset") {
    if (testBusy) return;
    setTestBusy(true);
    try {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (!token) throw new Error("กรุณาเข้าสู่ระบบใหม่");
      const response = await fetch("/api/dev/test-member", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }), cache: "no-store",
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "ทำรายการไม่สำเร็จ");
      window.location.reload();
    } catch (cause) { setTestError(cause instanceof Error ? cause.message : "ทำรายการไม่สำเร็จ"); setTestBusy(false); }
  }

  useEffect(() => {
    if (!["localhost", "127.0.0.1"].includes(window.location.hostname)) {
      setState("line");
      return;
    }
    let active = true;
    void (async () => {
      if (!supabase) { setState("denied"); return; }
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;
      if (error || !data.user) { router.replace("/login?next=%2Fcustomer"); return; }
      const access = await supabase.rpc("crm_current_access").maybeSingle();
      if (!active) return;
      let role = (access.data as { role?: string } | null)?.role;
      let ownerId = (access.data as { owner_id?: string } | null)?.owner_id;
      if (access.error) {
        const fallback = await supabase.from("store_settings").select("owner_id").eq("owner_id", data.user.id).maybeSingle();
        if (!active) return;
        if (fallback.data && !fallback.error) { role = "owner"; ownerId = fallback.data.owner_id; }
      }
      if ((role === "owner" || role === "manager") && ownerId) {
        setVerifiedCrmUser(data.user.id, ownerId, role);
        void Promise.allSettled([
          prefetchCrmPages(),
          prefetchAdminExtras(data.user.id, ownerId, role === "owner"),
        ]);
        if (localStorage.getItem(testSignedOutKey) === "1") { if (active) setState("test-login"); return; }
        if (active) await openTestMember();
      } else setState("denied");
    })();
    return () => { active = false; };
  }, [router]);

  if (state === "line") return <LineMemberRegistration preview={false} />;
  if (state === "admin" && testMember) return <><div className="customer-local-test-banner customer-database-test-banner"><span>บัญชีสมาชิกทดสอบ · ฐานข้อมูลแยกจากร้านจริง</span><div><button type="button" disabled={testBusy} onClick={() => void changeTestPoints("addPoints")}>+500 แต้ม</button><button type="button" disabled={testBusy} onClick={() => void changeTestPoints("reset")}>รีเซ็ตแต้ม</button></div>{testError ? <small role="alert">{testError}</small> : null}</div><CustomerPortal mode="customer" member={testMember} accessToken={`test:${testToken}`} onLogout={() => { localStorage.setItem(testSignedOutKey, "1"); setTestMember(null); setTestToken(""); setState("test-login"); }} onMemberUpdated={name => setTestMember(value => value ? { ...value, name } : value)} /></>;
  if (state === "test-login") return <><div className="customer-local-test-banner">โหมดทดสอบ · ฐานข้อมูลแยกจากร้านจริง</div><LineMemberRegistration preview previewScreen="login" testLogin={() => void openTestMember()} /></>;
  if (state === "test-error") return <main className="admin-auth-check" role="alert">{testError}</main>;
  if (state === "denied") return <main className="admin-auth-check" role="alert">บัญชีนี้ไม่มีสิทธิ์ดูหน้าทดสอบลูกค้า</main>;
  return <main className="admin-auth-check" role="status">กำลังตรวจสอบบัญชีแอดมิน…</main>;
}
