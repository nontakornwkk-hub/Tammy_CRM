import { LineMemberRegistration } from "@/components/line-member-registration";

export default async function LineMembershipPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const { preview } = await searchParams;
  return <LineMemberRegistration preview={preview === "1"} />;
}
