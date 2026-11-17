import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite-plus";

// Alchemy inherits these values from the server's Varlock schema.
const devOrigin = new URL(
  process.env.DEV_PUBLIC_ORIGIN ||
    process.env.CORS_ORIGIN ||
    "http://localhost:3003"
);

export default defineConfig({
  server: {
    allowedHosts: [devOrigin.hostname],
    cors: {
      origin: [
        devOrigin.origin,
        /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/u,
      ],
    },
    port: 3003,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:3004",
      "/rpc": "http://localhost:3004",
    },
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
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,webmanifest}"],
        navigateFallback: "/index.html",
        importScripts: ["/push-sw.js"],
      },
      manifest: {
        id: "/",
        name: "Mostly",
        short_name: "Mostly",
        description: "A quiet record of what you did.",
        start_url: "/today",
        scope: "/",
        display: "standalone",
        background_color: "#F7F4EE",
        theme_color: "#F7F4EE",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      pwaAssets: { disabled: false, config: true },
      devOptions: { enabled: process.env.DEV_PWA === "true" },
    }),
  ],
});
