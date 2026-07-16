import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "node:path";

// Builds the invoice renderer into ONE self-contained HTML (JS + CSS inlined) at
// renderer/dist/index.html, which gets copied into the app's assets for offline WebView use.
export default defineConfig({
  root: __dirname,
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    // Ordered: the offline givens override (inlined footer logo) must win over the "@" prefix.
    alias: [
      { find: "@/lib/givens", replacement: path.resolve(__dirname, "givens.ts") },
      { find: "@", replacement: path.resolve(__dirname, "../src") },
    ],
  },
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
    // Inline everything so the output is a single portable file.
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
  },
});
