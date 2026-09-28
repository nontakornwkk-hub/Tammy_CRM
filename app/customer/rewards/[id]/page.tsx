import { CustomerRewardDetail } from "@/components/customer-reward-detail";

export default async function CustomerRewardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CustomerRewardDetail id={id} />;
}
