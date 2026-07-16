import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project (a stray lockfile exists in the home dir).
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Dev-only: let the app's WebView load /_next dev resources (JS chunks + HMR) when it
  // hits the dev server over the LAN — otherwise Next blocks them as cross-origin and the
  // page never hydrates (used by the native-vs-HTML parity harness). No production effect.
  allowedDevOrigins: ["192.168.18.68", "10.0.2.2", "localhost"],
};

export default nextConfig;
