"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { singleFlight } from "@/lib/single-flight";
import { prepareMemberData, clearMemberDisplayData } from "@/lib/member-bootstrap";
import dynamic from "next/dynamic";
import { loadCustomerPortal, prepareCustomerPortal } from "@/lib/customer-portal-loader";
import { LineMemberRegistration } from "./line-member-registration";

type EntryState = "checking" | "admin" | "denied" | "line" | "test-error" | "test-login" | "design";
type TestMember = { memberCode: string; name: string; level: string; points: number; linePictureUrl: string | null };
const testSignedOutKey = "tammy-admin-test-signed-out";
const loadTestMember = singleFlight<{ member: TestMember; token: string }>();
const CustomerPortal = dynamic(() => loadCustomerPortal().then(module => module.CustomerPortal), { ssr: false });

export function CustomerEntry() {
  const router = useRouter();
  const [designScreen,setDesignScreen]=useState<"login"|"register"|"loading">("login");
  const [state, setState] = useState<EntryState>("checking");
  const [testMember, setTestMember] = useState<TestMember | null>(null);
  const [testToken, setTestToken] = useState("");
  const [testError, setTestError] = useState("");
  const [testBusy, setTestBusy] = useState(false);

  const openTestMember = useCallback(async (isActive: () => boolean = () => true, phone?: string) => {
    if(!phone) setState("checking"); setTestError("");
    try {
      const { supabase } = await import("@/lib/supabase/client");
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (!isActive()) return;
      if (!token) { router.replace("/login?next=%2Fcustomer"); return; }
      void prepareCustomerPortal().catch(() => undefined);
      const result = await loadTestMember(`${token}:${phone || "auto"}`, async () => {
        const response = await fetch(`/api/dev/test-member${phone?`?confirmPhone=1&phone=${encodeURIComponent(phone)}`:""}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const data = await response.json() as { member?: TestMember; error?: string };
        if (!response.ok || !data.member) throw new Error(data.error || "เปิดบัญชีทดสอบไม่สำเร็จ");
        return { member: data.member, token };
      });
      if (!isActive()) return;
      setState("checking");
      await Promise.all([prepareMemberData(undefined, `test:${token}`), prepareCustomerPortal()]);
      if (!isActive()) return;
      localStorage.removeItem(testSignedOutKey);
      setTestMember(result.member); setTestToken(token); setState("admin");
    } catch (cause) {
      if (!isActive()) return;
      setTestError(cause instanceof Error ? cause.message : "เปิดบัญชีทดสอบไม่สำเร็จ");
      if(phone) {setState("test-login");throw cause;}
      setState("test-error");
    }
  }, [router]);

  async function changeTestPoints(action: "addPoints" | "reset") {
    if (testBusy) return;
    setTestBusy(true);
    try {
      const { supabase } = await import("@/lib/supabase/client");
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
    const screen=new URLSearchParams(window.location.search).get("authPreview");
    if(screen==="login"||screen==="register"||screen==="loading"){setDesignScreen(screen);setState("design");return;}
    let active = true;
    if (localStorage.getItem(testSignedOutKey) === "1") setState("test-login");
    else void openTestMember(() => active);
    return () => { active = false; };
  }, [openTestMember]);

  if(state === "design") return <LineMemberRegistration preview previewScreen={designScreen}/>;
  if (state === "line") return <LineMemberRegistration preview={false} />;
  if (state === "admin" && testMember) return <><div className="customer-local-test-banner customer-database-test-banner"><span>รายการร้านจริง · ทดสอบไม่ตัดสต็อก</span><div><button type="button" disabled={testBusy} onClick={() => void changeTestPoints("addPoints")}>+500 แต้ม</button><button type="button" disabled={testBusy} onClick={() => void changeTestPoints("reset")}>รีเซ็ตแต้ม</button></div>{testError ? <small role="alert">{testError}</small> : null}</div><CustomerPortal mode="customer" member={testMember} accessToken={`test:${testToken}`} onLogout={() => { clearMemberDisplayData(); localStorage.setItem(testSignedOutKey, "1"); setTestMember(null); setTestToken(""); setState("test-login"); }} onMemberUpdated={name => setTestMember(value => value ? { ...value, name } : value)} /></>;
  if (state === "test-login") return <><div className="customer-local-test-banner">โหมดทดสอบ · ฐานข้อมูลแยกจากร้านจริง</div><LineMemberRegistration preview previewScreen="login" testLogin={() => void openTestMember()} testConfirmPhone={phone => openTestMember(() => true, phone)} /></>;
  if (state === "test-error") return <main className="admin-auth-check" role="alert">{testError}</main>;
  if (state === "denied") return <main className="admin-auth-check" role="alert">บัญชีนี้ไม่มีสิทธิ์ดูหน้าทดสอบลูกค้า</main>;
  return <LineMemberRegistration preview previewScreen="loading" />;
}
