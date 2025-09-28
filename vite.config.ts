import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  base: "/notizia4/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate", // SW auto-aktualisieren
      includeAssets: ["favicon.svg", "robots.txt", "apple-touch-icon.png"],
      manifest: {
        name: "notizia",
        short_name: "notizia",
        description: "Offline Erfassung & Auswertung",
        start_url: ".", // relativ, damit base wirkt
        scope: ".", // relativ, damit base wirkt
        display: "standalone",
        orientation: "any",
        background_color: "#f6fbf7",
        theme_color: "#1f7a56",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: "/index.html",
        runtimeCaching: [
          // Beispiel: API/Assets von extern (falls du später welche nutzt)
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "ext-fonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
});
