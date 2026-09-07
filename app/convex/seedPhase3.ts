// Phase 3 — données de démo : membres, commandes, interventions, comptes rendus, caisse, primes (idempotent).
import { query, mutation } from "./_generated/server";
import { DEV_TOKEN } from "./lib/authz";
import { dateDouala, instantDouala, estJourOuvrable } from "./lib/fenetre";
import { montantTotalPrime } from "./lib/stats";

const MEMBRES_DEMO = [
  { token: "demo:employe1", email: "paul.abena@poitiers.local", nom: "ABENA Paul", role: "employe" as const, poste: "Technicien", departement: "Maintenance" },
  { token: "demo:employe2", email: "sylvie.mballa@poitiers.local", nom: "MBALLA Sylvie", role: "employe" as const, poste: "Agent d'accueil", departement: "Accueil" },
  { token: "demo:chef", email: "eric.kamdem@poitiers.local", nom: "KAMDEM Éric", role: "chef_equipe" as const, poste: "Chef d'équipe technique", departement: "Maintenance" },
];

const CONTENUS_CR = [
  "Réunion hebdomadaire exploitation : point sur le taux d'occupation, deux nouvelles entreprises accueillies.",
  "Point sécurité et accès badges : remplacement de 12 badges, mise à jour des horaires d'accès du week-end.",
  "Comité maintenance climatisation : entretien des 6 splits programmé, devis technicien validé.",
  "Préparation du budget T4 : projection des charges et des recettes d'abonnement.",
  "Suivi des commandes médicales : réception partielle, relance du fournisseur pour les consommables.",
];

// Les n derniers jours ouvrables (heure de Douala), du plus ancien au plus récent.
function derniersJoursOuvrables(n: number): string[] {
  const out: string[] = [];
  let t = new Date();
  for (let i = 0; i < 20 && out.length < n; i++) {
    if (estJourOuvrable(t)) out.unshift(dateDouala(t));
    t = new Date(t.getTime() - 86400000);
  }
  return out;
}

export const etatDemo = query({
  args: {},
  handler: async (ctx) => ({
    phase3: !!(await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", "demo:employe1")).unique()),
  }),
});

export const phase3 = mutation({
  args: {},
  handler: async (ctx) => {
    const r = { membres: 0, commandes: 0, interventions: 0, comptesRendus: 0, caisse: 0, primes: 0, ignores: 0 };
    const dev = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", DEV_TOKEN)).unique();
    if (!dev) throw new Error("Initialisez d'abord les données de base (membre dev).");

    const ids: Record<string, any> = {};
    for (const m of MEMBRES_DEMO) {
      const ex = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", m.token)).unique();
      if (ex) { ids[m.token] = ex._id; r.ignores++; continue; }
      ids[m.token] = await ctx.db.insert("users", { tokenIdentifier: m.token, email: m.email, nom: m.nom, role: m.role, poste: m.poste, departement: m.departement, isActive: true });
      r.membres++;
    }

    const annee = new Date().getUTCFullYear();
    const cmds = [
      { reference: `CMD-${annee}-001`, type: "medicale" as const, libelle: "Commande mensuelle août", date: `${annee}-08-31`, demandeur: "KAMDEM Éric", service: "Pharmacie", statut: "livree" as const,
        lignes: [{ produit: "Doliprane 1000", dci: "Paracétamol", quantite: 50, prixUnitaire: 1000 }, { produit: "Voltarène 50", dci: "Diclofénac", quantite: 30, prixUnitaire: 6300 }, { produit: "Amoxicilline 500", dci: "Amoxicilline", quantite: 40, prixUnitaire: 2500 }],
        commentaires: [{ auteur: "Directeur (dev)", texte: "Validée — réception complète.", date: `${annee}-09-01T09:00:00.000Z` }], validePar: dev._id, valideLe: `${annee}-09-01T09:00:00.000Z`, livreLe: `${annee}-09-03T10:00:00.000Z` },
      { reference: `CMD-${annee}-002`, type: "fourniture" as const, libelle: "Fournitures de bureau", date: `${annee}-09-02`, demandeur: "MBALLA Sylvie", service: "Accueil", statut: "validee" as const,
        lignes: [{ produit: "Ramettes A4 (carton)", quantite: 12, prixUnitaire: 18000 }, { produit: "Café en grains 1 kg", quantite: 24, prixUnitaire: 9500 }, { produit: "Chaises ergonomiques", quantite: 6, prixUnitaire: 85000 }],
        commentaires: [{ auteur: "Directeur (dev)", texte: "OK pour livraison la semaine prochaine.", date: `${annee}-09-03T11:20:00.000Z` }], validePar: dev._id, valideLe: `${annee}-09-03T11:20:00.000Z` },
      { reference: `CMD-${annee}-003`, type: "medicale" as const, libelle: "Commande mensuelle septembre", date: `${annee}-09-05`, demandeur: "KAMDEM Éric", service: "Pharmacie", statut: "en_attente" as const,
        lignes: [{ produit: "Doliprane 1000", dci: "Paracétamol", quantite: 80, prixUnitaire: 1000 }, { produit: "Voltarène 50", dci: "Diclofénac", quantite: 30, prixUnitaire: 6300 }, { produit: "Oméprazole 20", dci: "Oméprazole", quantite: 25, prixUnitaire: 2000 }],
        commentaires: [] },
    ];
    for (const c of cmds) {
      if (await ctx.db.query("commandes").withIndex("by_reference", (q) => q.eq("reference", c.reference)).unique()) { r.ignores++; continue; }
      await ctx.db.insert("commandes", { ...c, creePar: ids["demo:chef"] });
      r.commandes++;
    }

    const ints = [
      { reference: `INT-${annee}-001`, titre: "Remplacement onduleur salle serveurs", priorite: "haute" as const, lieu: "Salle serveurs", service: "Technique", chefService: "KAMDEM Éric", methode: "En personne", dateDemande: `${annee}-09-01`, demandeur: "ABENA Paul", statut: "ouverte" as const,
        lignes: [{ produit: "Onduleur 3 kVA", quantite: 1, prixUnitaire: 450000 }, { produit: "Batteries 12V", quantite: 4, prixUnitaire: 38000 }], commentaireInitial: "L'onduleur actuel ne tient plus la charge.", commentaires: [] as { auteur: string; texte: string; date: string }[] },
      { reference: `INT-${annee}-002`, titre: "Entretien climatisation open space", priorite: "moyenne" as const, lieu: "Open space", service: "Maintenance", chefService: "KAMDEM Éric", methode: "Téléphone", dateDemande: `${annee}-09-03`, demandeur: "KAMDEM Éric", statut: "en_cours" as const,
        lignes: [{ produit: "Gaz réfrigérant R410A", quantite: 2, prixUnitaire: 25000 }], commentaires: [{ auteur: "Directeur (dev)", texte: "Validée, intervention planifiée jeudi.", date: `${annee}-09-04T08:30:00.000Z` }], validePar: dev._id, valideLe: `${annee}-09-04T08:30:00.000Z` },
      { reference: `INT-${annee}-003`, titre: "Changement ampoules LED couloir", priorite: "basse" as const, lieu: "Couloirs", service: "Maintenance", chefService: "KAMDEM Éric", methode: "Email", dateDemande: `${annee}-08-28`, demandeur: "ABENA Paul", statut: "cloturee" as const,
        lignes: [{ produit: "Ampoules LED 9W", quantite: 20, prixUnitaire: 2500 }], commentaires: [{ auteur: "Directeur (dev)", texte: "Terminé, facture reçue.", date: `${annee}-09-02T16:00:00.000Z` }], validePar: dev._id, valideLe: `${annee}-09-02T16:00:00.000Z` },
    ];
    for (const i of ints) {
      if (await ctx.db.query("interventions").withIndex("by_reference", (q) => q.eq("reference", i.reference)).unique()) { r.ignores++; continue; }
      await ctx.db.insert("interventions", { ...i, photos: [], creePar: ids["demo:employe1"] });
      r.interventions++;
    }

    // Comptes rendus des 5 derniers jours ouvrables pour 3 membres ; le 2e jour de MBALLA est hors fenêtre (21h30 → 0 point).
    const jours = derniersJoursOuvrables(5);
    const auteurs = [ids["demo:employe1"], ids["demo:employe2"], ids["demo:chef"]];
    for (const [ji, jour] of jours.entries()) {
      for (const [ai, auteurId] of auteurs.entries()) {
        const ex = await ctx.db.query("comptesRendus").withIndex("by_auteur_date", (q) => q.eq("auteurId", auteurId).eq("date", jour)).unique();
        if (ex) { r.ignores++; continue; }
        const [y, m, d] = jour.split("-").map(Number);
        const horsFenetre = ai === 1 && ji === 1;
        const soumisA = instantDouala(y, m, d, horsFenetre ? 21 : 17, horsFenetre ? 30 : 15 + ai * 7).toISOString();
        const passe = ji < jours.length - 1;
        await ctx.db.insert("comptesRendus", {
          auteurId, date: jour, contenu: CONTENUS_CR[(ji + ai) % CONTENUS_CR.length], soumisA, horsFenetre, points: horsFenetre ? 0 : 1,
          statut: passe ? "valide" : "en_relecture", valideParId: passe ? dev._id : undefined,
        });
        r.comptesRendus++;
      }
    }

    const periode = dateDouala().slice(0, 7);
    if (!(await ctx.db.query("statsCaisse").withIndex("by_periode", (q) => q.eq("periode", periode)).first())) {
      const base = { periode, horaires: "8h–18h", tenofovir: 0, greenEnergy: 0, therapieSommeil: 0 };
      const semaines = [
        { dateDebut: `${periode}-01`, dateFin: `${periode}-07`, caissePP: 1250000, scanner: 900000, quantiferon: 96000, esthetique: 120000, therapieVie: 60000, assurance: 480000, tepScan: 750000, sortiesDuJour: 210000 },
        { dateDebut: `${periode}-08`, dateFin: `${periode}-14`, caissePP: 1180000, scanner: 1050000, quantiferon: 72000, esthetique: 95000, therapieVie: 80000, assurance: 520000, tepScan: 500000, sortiesDuJour: 185000 },
        { dateDebut: `${periode}-15`, dateFin: `${periode}-21`, caissePP: 1320000, scanner: 870000, quantiferon: 120000, esthetique: 140000, therapieVie: 40000, assurance: 610000, tepScan: 1000000, sortiesDuJour: 230000 },
        { dateDebut: `${periode}-22`, dateFin: `${periode}-28`, caissePP: 1090000, scanner: 930000, quantiferon: 84000, esthetique: 110000, therapieVie: 70000, assurance: 450000, tepScan: 250000, sortiesDuJour: 160000 },
      ];
      for (const s of semaines) { await ctx.db.insert("statsCaisse", { ...base, ...s }); r.caisse++; }
    } else r.ignores++;

    if (!(await ctx.db.query("primesMedecins").withIndex("by_contexte_periode", (q) => q.eq("contexte", "stats").eq("periode", periode)).first())) {
      const primes = [
        { categorie: "externes_labo_radio", designation: "Dr. NKENG Alain", actes: 12, montantUnitaire: 15000 },
        { categorie: "externes_labo_radio", designation: "Dr. FOUDA Marlyse", actes: 8, montantUnitaire: 15000 },
        { categorie: "interpretes_scanner", designation: "Dr. TCHOUA Brice", actes: 25, montantUnitaire: 20000 },
        { categorie: "interpretes_scanner", designation: "Dr. NGONO Clarisse", actes: 18, montantUnitaire: 20000 },
        { categorie: "prescripteurs_irm", designation: "Dr. ESSOMBA Jean", actes: 6, montantUnitaire: 30000 },
        { categorie: "prescripteurs_irm", designation: "Dr. BIYA Hortense", actes: 4, montantUnitaire: 30000 },
      ];
      for (const p of primes) {
        await ctx.db.insert("primesMedecins", { contexte: "stats", periode, dateDebut: `${periode}-01`, dateFin: `${periode}-30`, ...p, montant: montantTotalPrime(p.actes, p.montantUnitaire) });
        r.primes++;
      }
    } else r.ignores++;

    return r;
  },
});
