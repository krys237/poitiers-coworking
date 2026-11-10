import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import { realpathSync } from "node:fs";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// Dans un arbre de travail git (`git worktree`), `node_modules` est souvent un LIEN vers celui
// du dépôt principal, pour éviter un second `npm install` de 400 Mo. Le serveur de développement
// résout ce lien avant de contrôler l'accès, puis refuse le chemin réel parce qu'il est situé
// hors de la racine du projet — un dossier voisin, pas un descendant.
//
// Conséquence observée le 05/11/2026 : les polices IBM Plex répondaient 404 et les colonnes de
// chiffres se décalaient, la police de secours n'ayant pas des chiffres à largeur fixe.
// `vite build` n'est PAS concerné : la liste blanche ne protège que le serveur de développement.
//
// Deux précautions : le chemin est résolu depuis CE fichier et non depuis le répertoire courant,
// qui dépend de l'endroit d'où `npm run dev` est lancé ; et le try/catch évite qu'une machine
// sans `node_modules` installé ne puisse plus charger la configuration du tout.
//
// On n'essaie PAS de comparer le chemin réel à la racine pour n'ajouter l'entrée qu'en cas de
// lien : une comparaison de chemins Windows (casse, séparateurs, 8.3) se trompe tôt ou tard, et
// autoriser un dossier déjà situé sous la racine ne change rien.
const nodeModulesReel = (() => {
  try {
    return [realpathSync(fileURLToPath(new URL("./node_modules", import.meta.url)))];
  } catch {
    return [];
  }
})();

export default defineConfig({
  server: {
    // `.` = la racine du projet, comportement par défaut de Vite, que l'on conserve.
    fs: { allow: [".", ...nodeModulesReel] },
  },
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
        // `#0f2a44` ne figurait dans aucune charte : remplacé par l'ocean-nuit officiel
        // (.agents/skills/poitiers-ui-ux-system). Le fond de l'écran de démarrage reste blanc,
        // parce que le logo a été dessiné pour du blanc et s'y lit sans halo.
        theme_color: "#03045e",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        lang: "fr", // l'interface est entièrement en français ; le manifeste annonçait « en »
        // Sans ce tableau, Chrome et Android n'ont RIEN à installer : le raccourci bureau retombe
        // sur une pastille générique. C'était la cause de l'absence d'icône.
        icons: [
          { src: "/pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          // `maskable` est une entrée SÉPARÉE et non un remplacement : le lanceur Android rogne
          // jusqu'à 20 % de chaque bord, d'où un logo réduit à 60 % du canevas sur fond opaque.
          { src: "/maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
});
