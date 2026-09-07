import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Montants: toujours en ENTIERS FCFA (pas de décimales).
// Périodes de paie: chaîne "YYYY-MM". Dates: chaîne "YYYY-MM-DD".

const ROLE = v.union(
  v.literal("employe"),        // niv. 1
  v.literal("chef_equipe"),    // niv. 2
  v.literal("comptable"),      // niv. 3
  v.literal("gestionnaire_rh"),// niv. 4  (= Directeur RH)
  v.literal("da1"),            // niv. 5
  v.literal("da2"),            // niv. 6
  v.literal("dg"),             // niv. 7  (Admin)
  v.literal("auditeur_externe")// spécial (orthogonal)
);

const SOCIETE = v.union(v.literal("SESAME"), v.literal("SOFINA"), v.literal("SGC"));

export default defineSchema({
  // ---- Accès & organisation (Phase 0) ----
  users: defineTable({
    tokenIdentifier: v.string(),      // identité OIDC
    email: v.string(),
    nom: v.optional(v.string()),
    role: ROLE,
    poste: v.optional(v.string()),
    departement: v.optional(v.string()),
    codeAcces: v.optional(v.string()),// code personnel optionnel
    societe: v.optional(SOCIETE),
    isActive: v.boolean(),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_email", ["email"]),

  parametresEntreprise: defineTable({ // singleton (une seule ligne)
    nom: v.string(),
    adresse: v.string(),
    logoUrl: v.optional(v.string()),
    filigrane: v.optional(v.string()),
    couleurEntete: v.optional(v.string()),
    modeleCourrier: v.optional(v.string()),   // lettre d'accompagnement ({nom} {periode} {net} {entreprise})
    emailExpediteur: v.optional(v.string()),  // adresse "from" des envois
    congesParMois: v.optional(v.number()),    // jours de congé acquis par mois de service (déf. 1.5)
  }),

  // ---- Paie (Phase 1) ----
  employes: defineTable({
    matricule: v.string(),
    nom: v.string(),
    fonction: v.optional(v.string()),
    adresse: v.optional(v.string()),
    cnps: v.optional(v.string()),
    niu: v.optional(v.string()),
    email: v.optional(v.string()),    // destinataire du courrier de paie
    societe: SOCIETE,
    salaireBrut: v.number(),          // brut mensuel de référence
    joursBase: v.optional(v.number()),// jours standard (déf. 30)
    contrat: v.optional(v.string()),  // CDI, CDD…
    dateDebut: v.optional(v.string()),// embauche — base de l'acquisition des congés
    dateFin: v.optional(v.string()),
    congesInitial: v.optional(v.number()), // solde de congés reporté à l'entrée dans l'outil
    actif: v.boolean(),
  })
    .index("by_matricule", ["matricule"])
    .index("by_societe", ["societe"]),

  // Barème officiel DATÉ (CNPS / CGI). Un bulletin référence la version applicable à sa période.
  baremes: defineTable({
    effectiveFrom: v.string(),        // "YYYY-MM-DD" — début d'applicabilité
    plafondCnps: v.number(),          // plafond mensuel CNPS (FCFA)
    tauxPvidSal: v.number(),          // % PVID salarié (ex. 4.2)
    tauxPvidPat: v.number(),          // % PVID patronal
    tauxPf: v.number(),               // % prestations familiales (patronal)
    tauxAtmp: v.number(),             // % accidents travail (patronal)
    tauxCfcSal: v.number(),           // % CFC salarié (ex. 1)
    tauxCfcPat: v.number(),           // % CFC patronal (ex. 1.5)
    tauxFne: v.number(),              // % FNE (patronal)
    abattementIrppPct: v.number(),    // abattement forfaitaire IRPP (ex. 30)
    tauxCac: v.number(),              // % CAC sur IRPP (ex. 10)
    irppBrackets: v.array(v.object({  // barème IRPP progressif (base MENSUELLE)
      jusqua: v.union(v.number(), v.null()), // plafond de tranche, null = au-delà
      taux: v.number(),               // % de la tranche
    })),
    source: v.string(),               // origine du barème
    controleLe: v.optional(v.string()),
    statut: v.union(v.literal("actif"), v.literal("brouillon")),
  }).index("by_effective", ["effectiveFrom"]),

  // Éléments variables saisis par mois et par employé.
  saisiesMensuelles: defineTable({
    employeId: v.id("employes"),
    periode: v.string(),              // "YYYY-MM"
    joursTravailles: v.number(),
    absencesJours: v.number(),
    sanctions: v.number(),            // FCFA
    primesVariables: v.number(),      // FCFA (hors primes fixes récurrentes)
    transport: v.number(),
    heuresSup: v.number(),
    anciennete: v.number(),
    mutuellePct: v.number(),          // % mutuelle
    dettesSoins: v.number(),
    acompte: v.number(),
  })
    .index("by_periode", ["periode"])
    .index("by_employe_periode", ["employeId", "periode"]),

  // Lignes libres de primes / charges datées (alimentent les totaux du mois).
  primesCharges: defineTable({
    employeId: v.id("employes"),
    periode: v.string(),
    libelle: v.string(),
    montant: v.number(),
    type: v.union(v.literal("prime"), v.literal("charge")),
    date: v.string(),
  })
    .index("by_employe_periode", ["employeId", "periode"])
    .index("by_periode", ["periode"]),

  // Événements d'absence (planning). Les agrégats mensuels et le solde de congés en dérivent.
  absences: defineTable({
    employeId: v.id("employes"),
    type: v.union(v.literal("conge_paye"), v.literal("absence"), v.literal("maladie"), v.literal("autre")),
    dateDebut: v.string(),            // "YYYY-MM-DD"
    dateFin: v.string(),              // inclus
    jours: v.number(),                // jours calendaires inclus
    paye: v.boolean(),                // rémunéré (n'entame pas les jours travaillés) ou non
    motif: v.optional(v.string()),
  })
    .index("by_employe", ["employeId"])
    .index("by_debut", ["dateDebut"]),

  // Bulletins GÉNÉRÉS (snapshot). Les mois ouverts sont calculés à la volée;
  // à la génération/clôture on fige le résultat ici.
  bulletins: defineTable({
    employeId: v.id("employes"),
    periode: v.string(),
    baremeId: v.id("baremes"),
    societe: SOCIETE,
    brut: v.number(),
    totalRetenues: v.number(),
    net: v.number(),
    lignesGain: v.array(v.object({ code: v.string(), libelle: v.string(), base: v.number(), gain: v.number() })),
    cotisations: v.array(v.object({ code: v.string(), libelle: v.string(), base: v.number(), taux: v.number(), retenue: v.number(), chargePatronale: v.number() })),
    statut: v.union(v.literal("genere"), v.literal("envoye")),
    envoyeLe: v.optional(v.string()),
    genereLe: v.string(),
    pdfId: v.optional(v.id("_storage")), // PDF archivé (généré par paiePdf.archiverPdfs)
  })
    .index("by_periode", ["periode"])
    .index("by_employe_periode", ["employeId", "periode"]),

  // Clôture d'un mois de paie (fige les bulletins).
  cloturesPaie: defineTable({
    periode: v.string(),
    closedBy: v.id("users"),
    closedAt: v.string(),
    baremeId: v.id("baremes"),
  }).index("by_periode", ["periode"]),

  // Journal des envois de courrier de paie (e-mail). Un enregistrement par tentative.
  envois: defineTable({
    employeId: v.id("employes"),
    periode: v.string(),
    email: v.string(),
    statut: v.union(v.literal("envoye"), v.literal("simule"), v.literal("echec")),
    mode: v.union(v.literal("reel"), v.literal("simulation")),
    envoyeLe: v.string(),
    messageId: v.optional(v.string()),
    erreur: v.optional(v.string()),
  })
    .index("by_periode", ["periode"])
    .index("by_employe_periode", ["employeId", "periode"]),

  // ---- Exploitation financière (Phase 2) ----
  // Grand livre journalier : une ligne par date. mouvements[bloc][ligne] = montant ; soldes calculés (report J-1).
  journeesFinancieres: defineTable({
    date: v.string(),                 // "YYYY-MM-DD"
    periode: v.string(),              // "YYYY-MM"
    mouvements: v.record(v.string(), v.record(v.string(), v.number())),
    pieces: v.optional(v.record(v.string(), v.id("_storage"))), // justificatifs par ligne "bloc.ligne"
    soldesOuverture: v.record(v.string(), v.number()),          // J-1 utilisés (ou J0 saisis)
    soldesOuvertureManuels: v.boolean(),                         // true = J0 saisis à la main
    soldes: v.record(v.string(), v.number()),                   // calculés : J-1 + entrées − retraits
    recetteTotale: v.number(),
    notes: v.optional(v.string()),
    cloture: v.boolean(),             // journée figée (mois clôturé)
    verrouParId: v.optional(v.id("users")),
    verrouAt: v.optional(v.string()),
    verrouNom: v.optional(v.string()),
  })
    .index("by_date", ["date"])
    .index("by_periode", ["periode"]),

  cloturesFinancieres: defineTable({
    periode: v.string(),
    closedBy: v.id("users"),
    closedAt: v.string(),
    journees: v.number(),
  }).index("by_periode", ["periode"]),

  documents: defineTable({
    fichierId: v.id("_storage"),
    nomFichier: v.string(),
    taille: v.number(),
    typeMime: v.string(),
    titre: v.string(),
    description: v.optional(v.string()),
    categorie: v.optional(v.string()),
    niveauVisible: v.number(),        // niveau min pour voir (1..7)
    niveauTelechargement: v.number(), // niveau min pour télécharger
    confidentiel: v.boolean(),        // DAF/DG uniquement
    codeAcces: v.optional(v.string()),
    modeMeta: v.union(v.literal("ia"), v.literal("heuristique"), v.literal("manuel")),
    uploadedBy: v.id("users"),
    deposeLe: v.string(),
  })
    .index("by_categorie", ["categorie"])
    .index("by_depose", ["deposeLe"]),

  // ---- Activité (Phase 3) ----
  // Commandes médicales (avec DCI) ou de fournitures. Workflow : en_attente → validee | rejetee → livree.
  commandes: defineTable({
    reference: v.string(),            // "CMD-2026-001" (séquentiel par année)
    type: v.union(v.literal("medicale"), v.literal("fourniture")),
    libelle: v.optional(v.string()),
    date: v.string(),                 // "YYYY-MM-DD"
    demandeur: v.string(),
    service: v.optional(v.string()),
    statut: v.union(v.literal("en_attente"), v.literal("validee"), v.literal("rejetee"), v.literal("livree")),
    lignes: v.array(v.object({ produit: v.string(), dci: v.optional(v.string()), quantite: v.number(), prixUnitaire: v.number() })),
    commentaires: v.array(v.object({ auteur: v.string(), texte: v.string(), date: v.string() })),
    creePar: v.id("users"),
    validePar: v.optional(v.id("users")),
    valideLe: v.optional(v.string()),
    livreLe: v.optional(v.string()),
  })
    .index("by_type", ["type"])
    .index("by_statut", ["statut"])
    .index("by_date", ["date"])
    .index("by_type_date", ["type", "date"])
    .index("by_reference", ["reference"]),

  // Interventions techniciens (maintenance / matériel). Workflow : ouverte → en_cours → cloturee | rejetee.
  interventions: defineTable({
    reference: v.string(),            // "INT-2026-001"
    titre: v.string(),
    priorite: v.union(v.literal("basse"), v.literal("moyenne"), v.literal("haute")),
    lieu: v.optional(v.string()),
    service: v.optional(v.string()),
    chefService: v.optional(v.string()),
    methode: v.optional(v.string()),  // email, téléphone, en personne…
    dateDemande: v.string(),
    demandeur: v.string(),
    statut: v.union(v.literal("ouverte"), v.literal("en_cours"), v.literal("cloturee"), v.literal("rejetee")),
    photos: v.array(v.id("_storage")),
    lignes: v.array(v.object({ produit: v.string(), quantite: v.number(), prixUnitaire: v.number() })),
    commentaireInitial: v.optional(v.string()),
    commentaires: v.array(v.object({ auteur: v.string(), texte: v.string(), date: v.string() })),
    creePar: v.id("users"),
    validePar: v.optional(v.id("users")),
    valideLe: v.optional(v.string()),
  })
    .index("by_statut", ["statut"])
    .index("by_date", ["dateDemande"])
    .index("by_reference", ["reference"]),

  // Comptes rendus journaliers : un par membre et par jour ; fenêtre 16h–20h jours ouvrables (lib/fenetre.ts).
  comptesRendus: defineTable({
    auteurId: v.id("users"),
    date: v.string(),                 // jour concerné "YYYY-MM-DD" (heure de Douala)
    contenu: v.string(),
    soumisA: v.string(),              // horodatage ISO de la (dernière) soumission
    horsFenetre: v.boolean(),
    points: v.number(),               // points de présence (1 dans la fenêtre, 0 sinon)
    statut: v.union(v.literal("brouillon"), v.literal("en_relecture"), v.literal("valide")),
    valideParId: v.optional(v.id("users")),
  })
    .index("by_date", ["date"])
    .index("by_auteur", ["auteurId"])
    .index("by_auteur_date", ["auteurId", "date"]),

  // Tableau de caisse mensuel (statistiques). Total espèces et chiffre d'affaires sont calculés (lib/stats.ts).
  statsCaisse: defineTable({
    periode: v.string(),              // "YYYY-MM"
    dateDebut: v.string(),
    dateFin: v.string(),
    horaires: v.optional(v.string()),
    caissePP: v.number(), scanner: v.number(), quantiferon: v.number(), tenofovir: v.number(),
    greenEnergy: v.number(), esthetique: v.number(), therapieVie: v.number(), therapieSommeil: v.number(),
    assurance: v.number(), tepScan: v.number(), sortiesDuJour: v.number(),
  }).index("by_periode", ["periode"]),

  // ---- Contrôle (Phase 4) ----
  primesMedecins: defineTable({
    contexte: v.union(v.literal("stats"), v.literal("audit")),
    categorie: v.string(),
    periode: v.string(),
    designation: v.string(),
    dateDebut: v.optional(v.string()),
    dateFin: v.optional(v.string()),
    actes: v.optional(v.number()),
    montantUnitaire: v.optional(v.number()),
    montant: v.number(),
    notes: v.optional(v.string()),
  })
    .index("by_contexte_periode", ["contexte", "periode"])
    .index("by_contexte_periode_categorie", ["contexte", "periode", "categorie"]),

  rapportsAudit: defineTable({
    categorie: v.string(),
    periode: v.string(),
    contenu: v.string(),
    auteurId: v.id("users"),
    majLe: v.optional(v.string()),
  }).index("by_categorie_periode", ["categorie", "periode"]),

  // Journal d'activité : rôles/activations, clôtures, appels API, contrôles du barème (lib/journal.ts).
  journalActivite: defineTable({
    date: v.string(),                 // ISO
    auteurId: v.optional(v.id("users")),
    auteurNom: v.optional(v.string()),
    action: v.string(),
    cible: v.optional(v.string()),
    detail: v.optional(v.string()),
    statut: v.optional(v.number()),   // code HTTP pour les appels API
    ip: v.optional(v.string()),
  })
    .index("by_date", ["date"])
    .index("by_action", ["action", "date"]),
});
