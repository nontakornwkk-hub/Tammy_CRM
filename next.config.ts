import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: { cpus: 2 },
  redirects() {
    return [{ source: "/customer-preview/:path*", destination: "/customer", permanent: false }];
  },
};

export default nextConfig;
