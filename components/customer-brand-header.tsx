import Image from "next/image";
import { PawPrint } from "lucide-react";

export function CustomerBrandHeader({ greeting }: { greeting: string }) {
  return <header className="customer-home-header">
    <div className="customer-home-brand">
      <Image src="/assets/tammy-logo-cat.png" alt="" width={58} height={58} />
      <span><strong>Tammy</strong><small>Pet Shop</small></span>
    </div>
    <div className="customer-home-greeting"><strong>{greeting}</strong><PawPrint size={24} aria-hidden="true" /></div>
  </header>;
}
