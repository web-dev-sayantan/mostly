import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite-plus";

// Caddy publishes the dev server over Tailscale HTTPS (see the Homebrew Caddyfile).
const tailscaleHost = "macbook.grouse-ph.ts.net";

export default defineConfig({
  server: {
    allowedHosts: [tailscaleHost],
    cors: {
      origin: [`https://${tailscaleHost}:8083`, /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/],
    },
    host: true,
    port: 3003,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tailwindcss(),
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: { globPatterns: ["**/*.{js,css,html,png,svg,ico}"] },
      manifest: {
        name: "mostly",
        short_name: "mostly",
        description: "A quiet record of what you did.",
        background_color: "#F7F4EE",
        theme_color: "#F7F4EE",
      },
      pwaAssets: { disabled: false, config: true },
      devOptions: { enabled: true },
    }),
  ],
});
