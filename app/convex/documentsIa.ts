"use node";
// Extraction des métadonnées d'un document : API Claude (SDK officiel) si ANTHROPIC_API_KEY est définie,
// sinon repli heuristique (titre depuis le nom de fichier, catégorie par mots-clés).
import { action } from "./_generated/server";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";

type Meta = { titre: string; description: string; categorie: string; mode: "ia" | "heuristique"; detail?: string };

const CATEGORIES = ["Factures", "Contrats", "Paie", "Procédures", "Rapports", "Devis", "Comptes rendus", "Administratif", "Divers"];
const MOTS: [RegExp, string][] = [
  [/factur|invoice|re[cç]u|quittance/i, "Factures"], [/contrat|bail|convention|avenant/i, "Contrats"],
  [/bulletin|paie|salaire|cnps/i, "Paie"], [/proc[eé]dure|process|mode op|guide/i, "Procédures"],
  [/rapport|report|bilan|audit/i, "Rapports"], [/devis|quotation|proforma/i, "Devis"],
  [/compte[- ]?rendu|pv|proc[eè]s[- ]verbal|r[eé]union/i, "Comptes rendus"], [/attestation|courrier|lettre|note de service|formulaire/i, "Administratif"],
];
const TEXTE = /^(text\/|application\/(json|csv|xml))/;
const EXT_TEXTE = /\.(txt|csv|md|json|xml|log)$/i;

function heuristique(nomFichier: string, typeMime: string, taille: number, texte: string | null): Meta {
  const base = nomFichier.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  const titre = base ? base.charAt(0).toUpperCase() + base.slice(1) : nomFichier;
  const source = `${nomFichier} ${texte?.slice(0, 2000) ?? ""}`;
  const categorie = MOTS.find(([re]) => re.test(source))?.[1] ?? "Divers";
  const description = texte ? texte.replace(/\s+/g, " ").trim().slice(0, 180) : `${typeMime || "fichier"} · ${Math.round(taille / 1024)} Ko`;
  return { titre, description, categorie, mode: "heuristique" };
}

export const extraireMetadonnees = action({
  args: { fichierId: v.id("_storage"), nomFichier: v.string(), typeMime: v.string() },
  handler: async (ctx, { fichierId, nomFichier, typeMime }): Promise<Meta> => {
    const blob = await ctx.storage.get(fichierId);
    const taille = blob?.size ?? 0;
    let texte: string | null = null;
    if (blob && (TEXTE.test(typeMime) || EXT_TEXTE.test(nomFichier)) && taille < 400_000) texte = await blob.text();

    const repli = heuristique(nomFichier, typeMime, taille, texte);
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return repli;

    try {
      const client = new Anthropic({ apiKey: key });
      const contenu = texte
        ? `Contenu du fichier « ${nomFichier} » (${typeMime}) :\n\n${texte.slice(0, 12000)}`
        : `Fichier « ${nomFichier} » de type ${typeMime} (${Math.round(taille / 1024)} Ko). Le contenu n'est pas lisible en texte : déduis ce que tu peux du nom et du type.`;
      const response = await client.messages.create({
        model: "claude-opus-5",
        max_tokens: 1024,
        system: `Tu es l'assistant documentaire d'une plateforme de gestion administrative (clinique / coworking, Cameroun). Tu réponds UNIQUEMENT par un objet JSON compact : {"titre": string (≤ 80 caractères, sans extension), "description": string (1 à 2 phrases), "categorie": une valeur parmi ${JSON.stringify(CATEGORIES)}}.`,
        messages: [{ role: "user", content: contenu }],
      });
      if (response.stop_reason === "refusal") return { ...repli, detail: "IA : requête déclinée, repli heuristique." };
      const text = response.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
      const m = /\{[\s\S]*\}/.exec(text);
      if (!m) return { ...repli, detail: "IA : réponse non structurée, repli heuristique." };
      const j = JSON.parse(m[0]) as Partial<Meta>;
      return {
        titre: (j.titre || repli.titre).toString().slice(0, 80),
        description: (j.description || repli.description).toString().slice(0, 400),
        categorie: CATEGORIES.includes(String(j.categorie)) ? String(j.categorie) : repli.categorie,
        mode: "ia",
      };
    } catch (e) {
      return { ...repli, detail: `IA indisponible (${(e as Error).message.slice(0, 120)}), repli heuristique.` };
    }
  },
});
