import { CustomerContentDetail } from "@/components/customer-content-detail";
export default async function CustomerContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CustomerContentDetail id={decodeURIComponent(id)}/>;
}
