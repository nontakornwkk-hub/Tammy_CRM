import { CustomerPortal } from "@/components/customer-portal";
import { LineMemberRegistration } from "@/components/line-member-registration";

export default async function CustomerPreviewPortalPage({ searchParams }: { searchParams: Promise<{ screen?: string }> }) {
  const { screen } = await searchParams;
  if (screen === "register" || screen === "login") return <LineMemberRegistration preview previewScreen={screen} />;
  return <CustomerPortal mode="preview" initialView={screen === "news" || screen === "rewards" ? screen : null} />;
}
