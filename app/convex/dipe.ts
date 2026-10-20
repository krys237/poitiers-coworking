// DIPE — état mensuel pour les impôts et la CNPS (lot R3), dû avant le 15 du mois suivant.
// La logique de mise en forme, de récapitulatif et de comparaison est PURE (`lib/dipe.ts`) :
// l'écran l'importe pour comparer le classeur de la RH sans rien envoyer au serveur.

import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireDroit } from "./lib/authz";
import { bulletinsPourPeriode } from "./lib/calculBulletins";
import { ligneDipe, recapitulatifDipe, type LigneDipe, type SourceBulletin } from "./lib/dipe";
import { rubriquesPourPeriode } from "./rubriques";
import type { Assiettes } from "./lib/rubriques";
import type { LigneCotisation, LigneGain } from "./lib/paie";

const retenue = (c: LigneCotisation[], code: string) =>
  c.find((x) => x.code === code)?.retenue ?? 0;
const patronale = (c: LigneCotisation[], code: string) =>
  c.find((x) => x.code === code)?.chargePatronale ?? 0;

/** Montant par code de rubrique ; les lignes libres de même code sont cumulées. */
function gainsParCode(lignes: LigneGain[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of lignes) if (l.gain) out[l.code] = (out[l.code] ?? 0) + l.gain;
  return out;
}

/**
 * Les mois clôturés AVANT le lot R2 ont un snapshot sans les quatre assiettes. On les
 * reconstitue alors au mieux depuis les champs disponibles, et la ligne est marquée comme
 * telle : il ne faut pas laisser croire que l'assiette a été calculée par le nouveau moteur.
 */
function assiettesOuRepli(
  details: { brutTaxable: number; baseCnps: number; assiettes?: Assiettes } | undefined,
  brut: number,
): { assiettes: Assiettes; reconstituees: boolean } {
  if (details?.assiettes) return { assiettes: details.assiettes, reconstituees: false };
  const taxable = details?.brutTaxable ?? brut;
  const cotisable = details?.baseCnps ?? brut;
  return {
    reconstituees: true,
    assiettes: {
      brut,
      brutIntermediaire: taxable,
      avantagesEvalues: 0,
      avantagesRetenus: 0,
      taxable,
      cotisable,
      cotisablePlafonne: cotisable,
      cotisableAtmp: cotisable,
      allocConge: 0,
      detail: [],
    },
  };
}

export const etat = query({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    // Le DIPE sert la RH et le comptable : son propre module, visible dès le niveau 3.
    await requireDroit(ctx, "/paie/dipe");

    const r = await bulletinsPourPeriode(ctx, periode);
    const rubriques = await rubriquesPourPeriode(ctx, periode);
    const parametres = await ctx.db.query("parametresEntreprise").first();

    const lignes: LigneDipe[] = [];
    let reconstituees = 0;

    r.bulletins.forEach((b, i) => {
      const { assiettes, reconstituees: repli } = assiettesOuRepli(b.details, b.brut);
      if (repli) reconstituees++;
      const src: SourceBulletin = {
        matricule: b.matricule,
        matriculeCnps: b.cnps,
        nom: b.nom,
        societe: b.societe,
        joursTravailles: b.details?.joursTravailles ?? 30,
        gains: gainsParCode(b.lignesGain),
        assiettes,
        irpp: retenue(b.cotisations, "44721"),
        cac: retenue(b.cotisations, "44722"),
        cfcSalarie: retenue(b.cotisations, "44724"),
        tdl: retenue(b.cotisations, "44723"),
        rav: retenue(b.cotisations, "44725"),
        pvidSalarie: retenue(b.cotisations, "43131"),
        cfcPatronal: patronale(b.cotisations, "64132"),
        fne: patronale(b.cotisations, "64131"),
        pvidPatronal: patronale(b.cotisations, "66412"),
        prestationsFamiliales: patronale(b.cotisations, "66411"),
        atmp: patronale(b.cotisations, "66413"),
      };
      lignes.push(ligneDipe(src, i + 1));
    });

    // Échéance légale : avant le 15 du mois suivant la période de paie.
    const [an, mois] = [+periode.slice(0, 4), +periode.slice(5, 7)];
    const suivant = mois === 12 ? { an: an + 1, mois: 1 } : { an, mois: mois + 1 };
    const echeance = `${suivant.an}-${String(suivant.mois).padStart(2, "0")}-15`;

    return {
      periode,
      echeance,
      cloture: r.cloture,
      erreur: r.erreur ?? null,
      entreprise: {
        nom: parametres?.nom ?? "",
        adresse: parametres?.adresse ?? "",
        niu: parametres?.niu ?? "",
        numeroCnps: parametres?.numeroCnps ?? "",
      },
      rubriques,
      lignes,
      recapitulatif: recapitulatifDipe(lignes),
      // Nombre de lignes dont les assiettes ont été reconstituées depuis un ancien snapshot.
      assiettesReconstituees: reconstituees,
    };
  },
});
