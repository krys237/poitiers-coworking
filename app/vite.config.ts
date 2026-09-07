import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "POITIERS COWORKING",
        short_name: "POITIERS",
        description: "Gestion administrative et paie automatisée",
        theme_color: "#0f2a44",
        background_color: "#0f2a44",
        display: "standalone",
        start_url: "/",
      },
    }),
  ],
});
