"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const publicPaths = new Set(["/login", "/reset-password", "/line-membership", "/customer"]);
const AdminAccessGate = dynamic(() => import("./admin-access-gate").then(module => module.AdminAccessGate), {
  ssr: false,
  loading: () => <main className="admin-auth-check" role="status">กำลังตรวจสอบสิทธิ์เข้าระบบ…</main>,
});

// Public entry avoids downloading administrator authentication and CRM modules.
// Protected pages retain the original checks and database authorization.
export function AdminAuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return publicPaths.has(pathname) ? children : <AdminAccessGate>{children}</AdminAccessGate>;
}
