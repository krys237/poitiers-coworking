import { createServerFn } from "@tanstack/react-start";

const SOURCE_URL = "https://www.cnps.cm/";

const empreinteDe = (texte: string) => {
  let h = 5381;
  for (let i = 0; i < texte.length; i++) h = ((h << 5) + h + texte.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
};

export type EtatBareme = {
  ok: boolean;
  empreinte: string | null;
  url: string;
  verifieLe: string;
  message: string;
};

/**
 * Interroge le site officiel de la CNPS et renvoie une empreinte de la page
 * des cotisations. Si l'empreinte change d'un mois à l'autre, l'application
 * prévient que le barème a peut-être été modifié.
 */
export const verifierBareme = createServerFn({ method: "GET" }).handler(
  async (): Promise<EtatBareme> => {
    const verifieLe = new Date().toISOString().slice(0, 10);
    try {
      const res = await fetch(SOURCE_URL, {
        headers: { accept: "text/html" },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        return {
          ok: false,
          empreinte: null,
          url: SOURCE_URL,
          verifieLe,
          message: `Source officielle injoignable (code ${res.status}).`,
        };
      }
      const html = await res.text();
      const texte = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return {
        ok: true,
        empreinte: empreinteDe(texte),
        url: SOURCE_URL,
        verifieLe,
        message: "Barème officiel consulté avec succès.",
      };
    } catch {
      return {
        ok: false,
        empreinte: null,
        url: SOURCE_URL,
        verifieLe,
        message: "Source officielle injoignable pour le moment.",
      };
    }
  },
);
