import { LineMemberRegistration } from "@/components/line-member-registration";

export default function CustomerPreviewPage() {
  // Legacy LIFF endpoint: render the real member app, never the Admin Preview.
  return <LineMemberRegistration preview={false} />;
}
