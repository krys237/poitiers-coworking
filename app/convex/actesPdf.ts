"use node";

// PDF des actes RH (lot R11).
//
// L'inverse exact du bulletin de paie : **aucun en-tête, aucun pied de page**. Les actes
// s'impriment sur le papier à en-tête de la Polyclinique, dont le bandeau a été mesuré sur une
// facture réelle — il occupe 125 pt (44 mm) en haut d'une page A4. Le corps commence donc sous
// cette hauteur, pour qu'aucune ligne ne passe sous le logo imprimé.
//
// ⚠️ Les polices standard du PDF n'encodent que le Latin-1. `nettoyerPourPdf()` (dans
// `lib/actes.ts`, testable isolément) est repris de `paiePdf.ts` pour la même raison : les
// modèles sont pleins de tirets longs, de points de suspension, de guillemets français et de
// l'espace fine insécable des montants. Sans ce nettoyage, pdf-lib lève sur le premier caractère
// non encodable.

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { PDFDocument, StandardFonts, rgb, PDFFont } from "pdf-lib";
import { MARGE_BASSE, MARGE_HAUTE_ENTETE, MARGE_LATERALE, nettoyerPourPdf, paragraphesActe } from "./lib/actes";

const A4 = { w: 595.28, h: 841.89 };
const ENCRE = rgb(0.04, 0.07, 0.17);

/** Découpe un paragraphe en lignes qui tiennent dans la largeur utile. */
function decouper(texte: string, font: PDFFont, taille: number, largeur: number): string[] {
  const mots = texte.split(/\s+/).filter(Boolean);
  if (!mots.length) return [""];
  const lignes: string[] = [];
  let courante = "";
  for (const mot of mots) {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (font.widthOfTextAtSize(essai, taille) <= largeur) {
      courante = essai;
    } else {
      if (courante) lignes.push(courante);
      // Un mot plus long que la ligne (une référence, une URL) est coupé de force,
      // sinon il déborderait silencieusement de la page.
      if (font.widthOfTextAtSize(mot, taille) > largeur) {
        let reste = mot;
        while (font.widthOfTextAtSize(reste, taille) > largeur) {
          let n = 1;
          while (n < reste.length && font.widthOfTextAtSize(reste.slice(0, n + 1), taille) <= largeur) n++;
          lignes.push(reste.slice(0, n));
          reste = reste.slice(n);
        }
        courante = reste;
      } else {
        courante = mot;
      }
    }
  }
  if (courante) lignes.push(courante);
  return lignes;
}

/**
 * Rend le corps d'un acte en PDF A4.
 * `margeHaute` est réglable : 125 pt dégage le papier à en-tête, 60 pt suffit sur papier vierge.
 */
export async function construireActePdf(args: {
  corps: string;
  margeHaute?: number;
  titreOnglet?: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const gras = await doc.embedFont(StandardFonts.TimesRomanBold);
  if (args.titreOnglet) doc.setTitle(nettoyerPourPdf(args.titreOnglet));

  const margeHaute = args.margeHaute ?? MARGE_HAUTE_ENTETE;
  const largeur = A4.w - 2 * MARGE_LATERALE;
  const TAILLE = 11.5;
  const INTERLIGNE = 16;
  const ESPACE_PARA = 8;

  let page = doc.addPage([A4.w, A4.h]);
  let y = A4.h - margeHaute;

  const nouvellePage = () => {
    page = doc.addPage([A4.w, A4.h]);
    // Les pages suivantes n'ont pas de bandeau à dégager : une marge normale suffit.
    y = A4.h - 60;
  };

  for (const { texte: paragraphe, estTitre } of paragraphesActe(args.corps)) {
    if (!paragraphe.trim()) {
      y -= ESPACE_PARA;
      continue;
    }
    const f = estTitre ? gras : font;
    const taille = estTitre ? TAILLE + 1.5 : TAILLE;

    for (const ligne of decouper(paragraphe, f, taille, largeur)) {
      if (y < MARGE_BASSE) nouvellePage();
      const x = estTitre
        ? MARGE_LATERALE + (largeur - f.widthOfTextAtSize(ligne, taille)) / 2
        : MARGE_LATERALE;
      page.drawText(ligne, { x, y, size: taille, font: f, color: ENCRE });
      y -= INTERLIGNE;
    }
    y -= estTitre ? ESPACE_PARA * 1.5 : ESPACE_PARA;
  }

  return await doc.save();
}

/** Génère le PDF d'un acte déjà délivré — son texte figé, jamais recalculé. */
export const pdfActe = action({
  args: { id: v.id("actes"), margeHaute: v.optional(v.number()) },
  handler: async (ctx, { id, margeHaute }): Promise<{ pdf: ArrayBuffer; nomFichier: string }> => {
    const acte: any = await ctx.runQuery(api.actes.pourPdf, { id });
    const octets = await construireActePdf({
      corps: acte.corpsRendu,
      margeHaute,
      titreOnglet: `${acte.modeleLibelle} - ${acte.nomBeneficiaire}`,
    });
    const nom = `${acte.modeleLibelle} - ${acte.nomBeneficiaire}${acte.reference ? ` - ${acte.reference.replace(/\//g, "-")}` : ""}.pdf`;
    return {
      pdf: octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength) as ArrayBuffer,
      nomFichier: nom.replace(/[\\/:*?"<>|]/g, "-"),
    };
  },
});

/** Aperçu avant délivrance : même rendu, sans rien enregistrer. */
export const pdfApercu = action({
  args: { corps: v.string(), titre: v.optional(v.string()), margeHaute: v.optional(v.number()) },
  handler: async (_ctx, { corps, titre, margeHaute }): Promise<{ pdf: ArrayBuffer; nomFichier: string }> => {
    const octets = await construireActePdf({ corps, margeHaute, titreOnglet: titre });
    return {
      pdf: octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength) as ArrayBuffer,
      nomFichier: `${(titre ?? "acte").replace(/[\\/:*?"<>|]/g, "-")} - apercu.pdf`,
    };
  },
});
