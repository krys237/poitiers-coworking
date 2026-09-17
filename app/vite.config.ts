import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        // Les polices sont ajoutees au pre-cache (workbox ne prend pas woff2
        // par defaut) : sans elles, l'application hors ligne retombe sur la
        // police systeme et toute la mise en page des tableaux se decale.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Mais uniquement le latin : un navigateur francophone ne telecharge
        // jamais les autres sous-ensembles (unicode-range). Les pre-cacher
        // ferait payer ~100 Ko a l'installation, sur une connexion lente,
        // pour des caracteres qui ne seront jamais affiches.
        globIgnores: [
          "**/*-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese,thai}-*.woff2",
        ],
      },
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
