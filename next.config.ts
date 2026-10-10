import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: { cpus: 2 },
  rewrites() {
    // Keep the registered LIFF endpoint intact until the SDK finishes OAuth.
    return [{ source: "/customer-preview/:path*", destination: "/customer" }];
  },
};

export default nextConfig;
