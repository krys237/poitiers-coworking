import { mutation, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { BAREME_DEFAUT } from "./lib/paie";
import { DEV_TOKEN } from "./lib/authz";

// Amorçage de démonstration : membre DG (dev), entreprise, barème, effectif de démo.
// Idempotent : ne recrée pas ce qui existe déjà ; complète la date d'embauche des employés de démo qui n'en ont pas.
const EMPLOYES_DEMO = [
  { matricule: "E001", nom: "ABAMI Rosine Belie", fonction: "Infirmier(ère) diplômé(e) d'État", societe: "SESAME", salaireBrut: 106950, dateDebut: "2021-03-01" },
  { matricule: "E002", nom: "ACHALE Roderick Essoh", fonction: "Aide-soignant(e)", societe: "SGC", salaireBrut: 195941, dateDebut: "2019-09-16" },
  { matricule: "E003", nom: "AMEFFO Lucie C.", fonction: "Agent d'accueil", societe: "SGC", salaireBrut: 122621, dateDebut: "2023-01-09" },
  { matricule: "E004", nom: "ATCHEMO Geneviève", fonction: "Technicien(ne) de laboratoire", societe: "SGC", salaireBrut: 133464, dateDebut: "2020-06-01" },
  { matricule: "E005", nom: "BIAHEU Amandine", fonction: "Agent d'entretien", societe: "SGC", salaireBrut: 123055, dateDebut: "2024-02-05" },
  { matricule: "E006", nom: "BILOA ELOUNDOU Gertrude", fonction: "Sage-femme", societe: "SGC", salaireBrut: 130665, dateDebut: "2018-11-12" },
  { matricule: "E007", nom: "BINAMA Patrick Junior", fonction: "Caissier(ère)", societe: "SOFINA", salaireBrut: 102450, dateDebut: "2026-04-01" },
  { matricule: "E008", nom: "TCHIDJO Magloire", fonction: "Directeur Général", societe: "SGC", salaireBrut: 2500000, dateDebut: "2016-07-01" },
] as const;

export const initialiser = mutation({
  args: {},
  handler: async (ctx) => {
    const r = { user: false, entreprise: false, bareme: false, employes: 0, datesCompletees: 0 };

    const dg = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", DEV_TOKEN)).unique();
    if (!dg) {
      await ctx.db.insert("users", {
        tokenIdentifier: DEV_TOKEN, email: "dg@poitiers.local", nom: "Directeur (dev)",
        role: "dg", poste: "Directeur Général", departement: "Direction", isActive: true,
      });
      r.user = true;
    }

    if (!(await ctx.db.query("parametresEntreprise").first())) {
      await ctx.db.insert("parametresEntreprise", {
        nom: "POITIERS COWORKING", adresse: "Rue de la Joie, Akwa — BP 1234, Douala, Cameroun",
        filigrane: "POITIERS COWORKING", couleurEntete: "#0f2a44", congesParMois: 1.5,
      });
      r.entreprise = true;
    }

    if (!(await ctx.db.query("baremes").first())) {
      await ctx.db.insert("baremes", {
        effectiveFrom: "2016-07-01", ...BAREME_DEFAUT,
        source: "Barème indicatif (à valider : CNPS / CGI)", controleLe: new Date().toISOString(), statut: "actif",
      });
      r.bareme = true;
    }

    for (const e of EMPLOYES_DEMO) {
      const existe = await ctx.db.query("employes").withIndex("by_matricule", (q) => q.eq("matricule", e.matricule)).unique();
      if (!existe) {
        await ctx.db.insert("employes", { ...e, joursBase: 30, actif: true, contrat: "CDI" });
        r.employes++;
      } else if (!existe.dateDebut) {
        await ctx.db.patch(existe._id, { dateDebut: e.dateDebut });
        r.datesCompletees++;
      }
    }
    return r;
  },
});

// ---- Phase 2 : 3 journées financières + 3 documents (idempotent). Action : le stockage de fichiers l'exige.
const jourISO = (decalage: number) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + decalage); return d.toISOString().slice(0, 10); };

const JOURNEES_DEMO = [
  { decalage: -2, soldesOuverture: { poitiers_f3: 1_250_000, poitiers_om: 340_000, poitiers_momo: 210_000, lilas_f3: 480_000, edrtim: 2_000_000, lilas_om: 95_000, lilas_momo: 60_000, carte_visa: 300_000, edrtim_finance: 720_000 },
    mouvements: { poitiers: { especes: 385_000, cheque: 120_000, visa: 45_000, retrait: 200_000, om: 60_000, retrait_om: 20_000, momo: 35_000, retrait_momo: 0 },
      lilas: { especes: 142_000, cheque: 0, retrait: 50_000, om: 18_000, retrait_om: 0, momo: 9_000, retrait_momo: 0 },
      carte_visa: { depot: 45_000, retrait: 0 }, edrtim_finance: { especes: 60_000, cheque: 0, retrait: 25_000 },
      medicaments: { especes: 88_000, cheque: 0, retrait: 30_000 }, biodiagnostic: { especes: 52_000, cheque: 0, retrait: 0 },
      med_esthetic: { especes: 25_000, cheque: 0, retrait: 0 }, autres: { tdm: 120_000, partage: 0, quantiferon: 24_000, tepscan: 0 } },
    notes: "Journée de démonstration — soldes d'ouverture saisis (J0)." },
  { decalage: -1, mouvements: { poitiers: { especes: 410_000, cheque: 0, visa: 62_000, retrait: 150_000, om: 75_000, retrait_om: 0, momo: 41_000, retrait_momo: 10_000 },
      lilas: { especes: 156_000, cheque: 80_000, retrait: 0, om: 22_000, retrait_om: 5_000, momo: 11_000, retrait_momo: 0 },
      carte_visa: { depot: 62_000, retrait: 100_000 }, edrtim_finance: { especes: 48_000, cheque: 0, retrait: 0 },
      medicaments: { especes: 93_000, cheque: 0, retrait: 0 }, biodiagnostic: { especes: 47_000, cheque: 0, retrait: 20_000 },
      med_esthetic: { especes: 30_000, cheque: 0, retrait: 0 }, autres: { tdm: 90_000, partage: 15_000, quantiferon: 0, tepscan: 250_000 } },
    notes: "Journée de démonstration (report automatique J-1)." },
  { decalage: 0, mouvements: { poitiers: { especes: 298_000, cheque: 200_000, visa: 30_000, retrait: 0, om: 52_000, retrait_om: 0, momo: 28_000, retrait_momo: 0 },
      lilas: { especes: 121_000, cheque: 0, retrait: 60_000, om: 14_000, retrait_om: 0, momo: 6_000, retrait_momo: 0 },
      carte_visa: { depot: 30_000, retrait: 0 }, edrtim_finance: { especes: 35_000, cheque: 40_000, retrait: 0 },
      medicaments: { especes: 76_000, cheque: 0, retrait: 0 }, biodiagnostic: { especes: 58_000, cheque: 0, retrait: 0 },
      med_esthetic: { especes: 18_000, cheque: 0, retrait: 0 }, autres: { tdm: 60_000, partage: 0, quantiferon: 12_000, tepscan: 0 } },
    notes: "Journée du jour (démonstration)." },
];

const DOCUMENTS_DEMO = [
  { titre: "Procédure d'accueil des patients", nomFichier: "procedure-accueil.md", typeMime: "text/markdown", categorie: "Procédures",
    niveauVisible: 1, niveauTelechargement: 2, confidentiel: false, description: "Étapes d'accueil, vérification d'identité et orientation.",
    contenu: "# Procédure d'accueil\n\n1. Saluer et vérifier l'identité.\n2. Enregistrer la visite.\n3. Orienter vers le service.\n" },
  { titre: "Contrat de bail — Espace Akwa", nomFichier: "contrat-bail-akwa.txt", typeMime: "text/plain", categorie: "Contrats",
    niveauVisible: 3, niveauTelechargement: 5, confidentiel: false, codeAcces: "1234", description: "Bail commercial des locaux d'Akwa (code d'accès requis).",
    contenu: "CONTRAT DE BAIL COMMERCIAL\nLocaux : Rue de la Joie, Akwa, Douala\nDurée : 3 ans renouvelables\nLoyer mensuel : 1 800 000 FCFA\n" },
  { titre: "Rapport financier trimestriel T3", nomFichier: "rapport-financier-T3.txt", typeMime: "text/plain", categorie: "Rapports",
    niveauVisible: 5, niveauTelechargement: 5, confidentiel: true, description: "Synthèse des recettes et dépenses du trimestre — DAF/DG uniquement.",
    contenu: "RAPPORT FINANCIER T3\nRecettes : 21 330 000 FCFA\nDépenses : 15 720 000 FCFA\nRésultat : 5 610 000 FCFA\n" },
];

type ResultatPhase2 = { journees: number; documents: number; ignores: number };

export const phase2 = action({
  args: {},
  handler: async (ctx): Promise<ResultatPhase2> => {
    const r: ResultatPhase2 = { journees: 0, documents: 0, ignores: 0 };
    for (const j of JOURNEES_DEMO) {
      const res: { cree: boolean } = await ctx.runMutation(internal.financier.ecrireJourneeInterne, {
        date: jourISO(j.decalage), mouvements: j.mouvements, notes: j.notes, soldesOuverture: j.soldesOuverture,
      });
      res.cree ? r.journees++ : r.ignores++;
    }
    const userId = await ctx.runQuery(internal.seed.userDev, {});
    if (!userId) throw new Error("Initialisez d'abord les données de base (membre dev).");
    for (const d of DOCUMENTS_DEMO) {
      const fichierId = await ctx.storage.store(new Blob([d.contenu], { type: d.typeMime }));
      const res: { cree: boolean } = await ctx.runMutation(internal.documents.deposerInterne, {
        fichierId, nomFichier: d.nomFichier, taille: d.contenu.length, typeMime: d.typeMime, titre: d.titre, description: d.description,
        categorie: d.categorie, niveauVisible: d.niveauVisible, niveauTelechargement: d.niveauTelechargement,
        confidentiel: d.confidentiel, codeAcces: d.codeAcces, uploadedBy: userId,
      });
      res.cree ? r.documents++ : r.ignores++;
    }
    return r;
  },
});

import { internalQuery } from "./_generated/server";
export const userDev = internalQuery({
  args: {},
  handler: async (ctx) => (await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", DEV_TOKEN)).unique())?._id ?? null,
});

// Phase 3 : re-export pour conserver le nom `seed:phase3` / `seed:etatDemo` (code dans seedPhase3.ts).
export { phase3, etatDemo } from "./seedPhase3";
export { phase4, etatDemo4 } from "./seedPhase4";
