import { CustomerPortal } from "@/components/customer-portal";
export default async function CustomerPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <CustomerPortal initialTab={tab === "rewards" ? "rewards" : "home"} />;
}
