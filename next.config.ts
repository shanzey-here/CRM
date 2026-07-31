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
};

export default withSerwist(nextConfig);
