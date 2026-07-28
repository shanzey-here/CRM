import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Dev-only: lets headless browser test tooling hit the dev server via
  // 127.0.0.1 (Next.js blocks cross-origin HMR requests from that host by
  // default, which otherwise silently breaks client-side hydration).
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
