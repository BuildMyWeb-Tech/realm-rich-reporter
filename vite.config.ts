import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    historyApiFallback: true,
    hmr: { overlay: false },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),

    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: [
        "favicon.ico",
        "robots.txt",
        "icons/*.png",
        "icons/apple-touch-icon.png",
      ],

      // Use the manifest.json we created in /public
      manifest: false,
      manifestFilename: "manifest.json",

      workbox: {
        // Cache shell + all built assets
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],

        // Runtime caching strategies
        runtimeCaching: [
          // Supabase API — network first, fall back to cache
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api-cache",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
              networkTimeoutSeconds: 10,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // OpenAI / Claude API — network only (never cache AI calls)
          {
            urlPattern: /^https:\/\/(api\.openai\.com|api\.anthropic\.com)\/.*/i,
            handler: "NetworkOnly",
          },
          // Google Fonts
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Images
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],

        // Skip waiting — activate new SW immediately
        skipWaiting: true,
        clientsClaim: true,

        // Don't try to cache these at all
        navigateFallbackDenylist: [/^\/api\//],
      },

      devOptions: {
        // Enable PWA in dev so you can test install prompt locally
        enabled: false,
        type: "module",
      },
    }),
  ].filter(Boolean),

  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
}));