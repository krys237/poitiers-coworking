// Verrou de saisie (demande de M. GAMBOU, 28/09/2026), partagé par la Caisse du mois et les Primes médecins.
//
// Une ligne reste modifiable `verrouCaisseMin` minutes après sa saisie (Paramètres → Fonctionnement, 60 par
// défaut). Au-delà, seul le droit « … : modifier après le délai » du module concerné peut la corriger ou la
// supprimer — et la correction tardive est journalisée. Chaque module a son propre droit de déverrouillage
// (`/caisse/deverrouillage`, `/primes-medecins/deverrouillage`) : les deux écrans ne relèvent pas des mêmes
// personnes (décision du 09/10/2026).
import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc } from "../_generated/dataModel";
import { droitsDuMembre } from "./authz";
import { journaliser } from "./journal";
import { lireReglages } from "../parametres";

/** Délai en vigueur et droit de l'appelant de passer outre — renvoyé aux écrans avec la liste. */
export async function etatVerrou(ctx: QueryCtx | MutationCtx, user: Doc<"users">, moduleDeverrouillage: string) {
  const { verrouCaisseMin } = await lireReglages(ctx);
  const peutDeverrouiller = (await droitsDuMembre(ctx, user))[moduleDeverrouillage].faire;
  return { verrouMin: verrouCaisseMin, peutDeverrouiller };
}

/** Refuse une modification tardive sans le droit ; l'accepte et la journalise avec. */
export async function controlerVerrou(
  ctx: MutationCtx,
  user: Doc<"users">,
  doc: { _creationTime: number },
  moduleDeverrouillage: string,
  quoi: string,
) {
  const { verrouMin, peutDeverrouiller } = await etatVerrou(ctx, user, moduleDeverrouillage);
  if (Date.now() - doc._creationTime <= verrouMin * 60_000) return;
  if (!peutDeverrouiller) throw new Error(`Saisie verrouillée : une ligne reste modifiable ${verrouMin} min après sa saisie. Au-delà, seul un administrateur peut la corriger.`);
  await journaliser(ctx, {
    auteurId: user._id, auteurNom: user.nom ?? user.email, action: "caisse_modification_tardive", cible: quoi,
    detail: `saisie du ${new Date(doc._creationTime).toLocaleString("fr-FR", { timeZone: "Africa/Douala" })}`,
  });
}

/** Les n derniers mois jusqu'à `periode` incluse, pour les graphes des deux écrans. */
export const moisPrecedents = (periode: string, n: number) => {
  const out: string[] = [];
  let y = +periode.slice(0, 4), m = +periode.slice(5, 7);
  for (let i = 0; i < n; i++) { out.unshift(`${y}-${String(m).padStart(2, "0")}`); m--; if (m === 0) { m = 12; y--; } }
  return out;
};
