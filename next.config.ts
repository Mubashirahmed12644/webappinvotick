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

  async headers() {
    return [
      {
        // Apple fetches this file to decide whether a link may open in the app, and it requires
        // `application/json`. The file has no extension on purpose — Apple's own convention — so
        // Next would otherwise serve it as octet-stream and iOS would reject it **silently**:
        // no error, no log, the link simply keeps opening in Safari. That failure mode is the
        // reason this header is here rather than left to a default.
        source: "/.well-known/apple-app-site-association",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
    ];
  },
};

export default nextConfig;
