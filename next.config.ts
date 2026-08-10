import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/crew/sw.ts",
  swDest: "public/crew-sw.js",
  disable: process.env.NODE_ENV === "development",
  register: false,
  cacheOnNavigation: true,
});

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    return [
      {
        source: "/embed/lead-capture/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *",
          },
          {
            key: "X-Frame-Options",
            value: "ALLOWALL", // Although deprecated, overrides strict defaults on some older browsers/proxies
          },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
