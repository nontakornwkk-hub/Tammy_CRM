import { redirect } from "next/navigation";

export default function LinePage() {
  redirect("/settings?tab=connection");
}
