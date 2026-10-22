import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// Montants: toujours en ENTIERS FCFA (pas de décimales).
// Périodes de paie: chaîne "YYYY-MM". Dates: chaîne "YYYY-MM-DD".

const ROLE = v.union(
  v.literal("employe"),        // niv. 1
  v.literal("chef_equipe"),    // niv. 2
  v.literal("comptable"),      // niv. 3
  v.literal("gestionnaire_rh"),// niv. 4  (= Directeur RH)
  v.literal("da1"),            // niv. 5  (Directeur Administratif — le niveau 6 ex-DA2 est retiré)
  v.literal("dg"),             // niv. 7  (Admin)
  v.literal("super_admin"),    // niv. 8  (technique : développeur)
  v.literal("auditeur_externe")// spécial (orthogonal)
);

const SOCIETE = v.union(v.literal("SESAME"), v.literal("SOFINA"), v.literal("SGC"));

export default defineSchema({
  // Tables de Convex Auth : authSessions, authAccounts, authRefreshTokens,
  // authVerificationCodes, authVerifiers, authRateLimits — et `users`, que l'on REDÉFINIT
  // juste en dessous pour que la table métier existante SOIT la table d'identité.
  // L'ordre compte : notre définition de `users` écrase celle d'authTables.
  ...authTables,

  // ---- Accès & organisation (Phase 0) ----
  users: defineTable({
    // Champs attendus par Convex Auth (tous optionnels côté métier).
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),

    // Champs métier. `email` reste OBLIGATOIRE : cette application n'a pas de compte
    // anonyme, et toute création de membre passe par `auth.createOrUpdateUser`.
    email: v.string(),
    // Jetons hérités : "dev:dg" (bypass de développement), "demo:*" (jeux de démo),
    // "pending:<email>" (membre pré-provisionné pas encore connecté). Absent pour un
    // compte créé par Convex Auth : l'identité est alors l'_id de la ligne elle-même.
    tokenIdentifier: v.optional(v.string()),
    nom: v.optional(v.string()),
    role: ROLE,
    poste: v.optional(v.string()),
    departement: v.optional(v.string()),
    codeAcces: v.optional(v.string()),// code personnel optionnel
    societe: v.optional(SOCIETE),
    isActive: v.boolean(),
    // Distingue « jamais encore autorisé » (inscription spontanée, en attente d'un DG) de
    // « désactivé » (compte révoqué). Les deux ont isActive: false, mais seul le premier
    // obtient une session — pour afficher un écran d'attente au lieu d'une erreur opaque.
    enAttente: v.optional(v.boolean()),
    // Exceptions individuelles aux droits de son rôle, posées par le directeur (rbac.droitsEffectifs).
    droitsPerso: v.optional(v.array(v.object({ module: v.string(), voir: v.boolean(), faire: v.boolean() }))),
    // Fiche employé du membre (« Mes bulletins ») ; à défaut, rapprochement par e-mail.
    employeId: v.optional(v.id("employes")),
    // Mot de passe provisoire posé par la Direction (création ou réinitialisation) : l'interface impose
    // de le changer avant toute autre chose (décision du 13/10/2026, lib/motDePasse.ts).
    doitChangerMotDePasse: v.optional(v.boolean()),
  })
    .index("by_token", ["tokenIdentifier"])
    // `email` et `phone` sont les noms d'index EXIGÉS par Convex Auth
    // (server/implementation/users.js les interroge tels quels) — ne pas renommer.
    .index("email", ["email"])
    .index("phone", ["phone"]),

  parametresEntreprise: defineTable({ // singleton (une seule ligne)
    nom: v.string(),
    adresse: v.string(),
    logoUrl: v.optional(v.string()),
    filigrane: v.optional(v.string()),
    couleurEntete: v.optional(v.string()),
    modeleCourrier: v.optional(v.string()),   // lettre d'accompagnement ({nom} {periode} {net} {entreprise})
    emailExpediteur: v.optional(v.string()),  // adresse "from" des envois
    congesParMois: v.optional(v.number()),    // jours de congé acquis par mois de service (déf. 1.5)
    niu: v.optional(v.string()),              // NIU de l'entreprise (en-tête bulletin)
    numeroCnps: v.optional(v.string()),       // N° CNPS employeur (en-tête bulletin)
    responsableRH: v.optional(v.string()),    // visa du responsable RH sur les bulletins
    jourPaiement: v.optional(v.number()),     // jour de paiement du mois suivant (déf. 5)
    reglages: v.optional(v.object({           // réglages de fonctionnement — voir lib/reglages.ts (défauts = anciennes constantes)
      crHeureOuverture: v.optional(v.number()), crHeureFermeture: v.optional(v.number()), crSamedi: v.optional(v.boolean()),
      verrouFinancierMin: v.optional(v.number()), verrouCaisseMin: v.optional(v.number()),
      envoiReelActive: v.optional(v.boolean()), whatsappReelActive: v.optional(v.boolean()), iaDocumentsActive: v.optional(v.boolean()), pdfAutoCloture: v.optional(v.boolean()),
      joursBaseDefaut: v.optional(v.number()), plafondSaisie: v.optional(v.number()),
    })),
    // Droits VOIR / FAIRE par rôle et par module, quand ils diffèrent du défaut (rbac.droitsEffectifs).
    droitsRoles: v.optional(v.array(v.object({ role: v.string(), module: v.string(), voir: v.boolean(), faire: v.boolean() }))),
    // Identité DÉCLARANTE de chaque société (lot R2 bis). « SESAME déclare de son côté » : chaque
    // société dépose son propre DIPE sous son propre NIU et son propre numéro CNPS. À défaut, le
    // DIPE retombe sur le NIU et le numéro CNPS de l'entreprise ci-dessus — comportement actuel.
    societes: v.optional(v.array(v.object({
      societe: SOCIETE,
      raisonSociale: v.optional(v.string()),
      adresse: v.optional(v.string()),
      niu: v.optional(v.string()),
      numeroCnps: v.optional(v.string()),
    }))),
  }),

  // Services d'affectation (colonne SERVICE du planning de congé). La COULEUR est un paramètre
  // demandé par la RH : « définir une couleur pour un service pour savoir qui dans quel service a
  // déjà un congé ». Dans la frise, l'encodage principal reste le regroupement des lignes ; la
  // couleur n'est qu'un repère secondaire (lib/planningAnnuel.PALETTE_SERVICES).
  services: defineTable({
    nom: v.string(),
    couleur: v.string(),              // hex "#rrggbb"
    ordre: v.number(),
    actif: v.boolean(),
  }).index("by_nom", ["nom"]),

  // ---- Paie (Phase 1) ----
  employes: defineTable({
    matricule: v.string(),
    nom: v.string(),
    fonction: v.optional(v.string()),
    adresse: v.optional(v.string()),
    cnps: v.optional(v.string()),
    niu: v.optional(v.string()),
    email: v.optional(v.string()),    // destinataire du courrier de paie
    whatsapp: v.optional(v.string()), // numéro WhatsApp (+237…) : courrier de paie par WhatsApp
    societe: SOCIETE,
    // Le SALAIRE DE BASE mensuel : c'est lui qui donne le salaire journalier (÷ joursBase) et
    // dont découle le « Salaire du mois ». Les primes (transport, assiduité, logement,
    // ancienneté…) s'y AJOUTENT dans le récapitulatif du mois : elles ne doivent jamais y être
    // incluses, sous peine d'être comptées deux fois.
    salaireBase: v.optional(v.number()),
    // Ancien nom du même montant (il n'a jamais été un brut, malgré son nom). Conservé le temps
    // de la migration `employes:migrerSalaireBase`, à supprimer ensuite. Lire via
    // `lib/paie.salaireDeBase(employe)`, jamais directement.
    salaireBrut: v.optional(v.number()),
    joursBase: v.optional(v.number()),// jours standard (déf. 30)
    contrat: v.optional(v.string()),  // CDI, CDD…
    dateDebut: v.optional(v.string()),// embauche — base de l'acquisition des congés
    dateFin: v.optional(v.string()),
    congesInitial: v.optional(v.number()), // solde de congés reporté à l'entrée dans l'outil
    categorie: v.optional(v.string()),     // catégorie professionnelle (bulletin)
    echelon: v.optional(v.string()),       // échelon (bulletin)
    actif: v.boolean(),
    // --- Planning des congés (lot R1) ---
    serviceId: v.optional(v.id("services")),  // service d'affectation — colonne SERVICE du planning
    // Le sexe conditionne la majoration « mère de famille » de l'art. 90 ; il n'a pas d'autre usage.
    sexe: v.optional(v.union(v.literal("F"), v.literal("M"))),
    // Enfants à charge : seul l'âge au jour du départ en congé compte (art. 90).
    enfants: v.optional(v.array(v.object({
      prenom: v.optional(v.string()),
      dateNaissance: v.string(),            // "YYYY-MM-DD"
    }))),
    // Groupe de risque CNPS accidents du travail : A 1,75 % / B 2,50 % / C 5 % (voir A-VERIFIER B5).
    groupeRisqueAt: v.optional(v.union(v.literal("A"), v.literal("B"), v.literal("C"))),
  })
    .index("by_matricule", ["matricule"])
    .index("by_societe", ["societe"])
    .index("by_service", ["serviceId"]),

  // Rattachement d'un employé à UNE société employeuse (lot R2 bis, décision du 20/10/2026).
  //
  // « SESAME déclare de son côté » : les trois sociétés sont des employeurs juridiquement
  // distincts, chacun avec son NIU et son numéro CNPS. Un employé peut relever de deux ou trois
  // d'entre elles — pluri-emploi régulier — et chaque société ne verse, ne déclare et ne cotise
  // que sur SA part. Un bulletin par société, un DIPE par déclarant, et donc un plafond CNPS et
  // des tranches d'IRPP PAR EMPLOYEUR, sans consolidation (conséquence assumée).
  //
  // Table dédiée et non tableau sur la fiche : les saisies mensuelles, les bulletins figés et les
  // lignes de primes sont indexés par couple (employé, société), ce qu'un élément de tableau sans
  // identité stable ne permet pas de désigner. Voir `lib/societes.ts` pour la lecture — qui
  // fonctionne AVANT comme APRÈS la migration `employes:migrerRattachements` : sans aucune ligne,
  // c'est `employes.societe` qui fait foi, exactement comme aujourd'hui.
  rattachements: defineTable({
    employeId: v.id("employes"),
    societe: SOCIETE,
    // Données PROPRES À L'EMPLOYEUR : deux sociétés ne numérotent pas, ne classent pas et ne
    // paient pas de la même façon. Toutes optionnelles : la RH déclare l'appartenance d'abord et
    // chiffre ensuite (le repli est la fiche employé, `lib/societes.rattachementsEffectifs`).
    matriculeEmployeur: v.optional(v.string()),
    cnpsEmployeur: v.optional(v.string()),
    niuEmployeur: v.optional(v.string()),
    salaireBase: v.optional(v.number()),   // salaire de base versé par CETTE société (hors primes)
    joursBase: v.optional(v.number()),
    categorie: v.optional(v.string()),
    echelon: v.optional(v.string()),
    contrat: v.optional(v.string()),
    dateDebut: v.optional(v.string()),     // "YYYY-MM-DD" — entrée chez cet employeur
    dateFin: v.optional(v.string()),
    // Indicateur d'activité : c'est lui, et non les dates, qui décide si le couple produit un
    // bulletin — le moteur n'a jamais regardé `employes.dateDebut` pour cela.
    actif: v.boolean(),
    // Société PORTEUSE de la fiche (celle de `employes.societe`). Une seule par employé : elle sert
    // de clé de compatibilité pour les saisies et primes enregistrées avant ce lot, qui n'ont pas
    // de société et lui appartiennent.
    principal: v.optional(v.boolean()),
    creeLe: v.optional(v.string()),
  })
    .index("by_employe", ["employeId"])
    .index("by_societe", ["societe"])
    .index("by_employe_societe", ["employeId", "societe"]),

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
    abattementIrppAnnuel: v.optional(v.number()), // abattement annuel IRPP (déf. 500 000), appliqué ÷ 12
    tdlActif: v.optional(v.boolean()),  // appliquer la taxe de développement local (barème forfaitaire)
    ravActif: v.optional(v.boolean()),  // appliquer la redevance audiovisuelle (barème forfaitaire)
    // --- Corrections du lot R2 (voir lib/paie.ts). ABSENTES = comportement d'avant la
    // correction : une version de barème déjà enregistrée reste donc rejouable à l'identique.
    transportTaxable: v.optional(v.boolean()),          // C1 : le transport entre dans le taxable
    atmpPlafonne: v.optional(v.boolean()),              // C3 : la loi ne plafonne PAS l'AT/MP
    cfcPatronalEtFneSurBrut: v.optional(v.boolean()),   // C4 : base = salaire brut
    seuilExoneration: v.optional(v.number()),           // C6 : 62 000, retenues SALARIALES seules
    groupeRisqueAtmp: v.optional(v.union(v.literal("A"), v.literal("B"), v.literal("C"))), // C8
    source: v.string(),               // origine du barème
    controleLe: v.optional(v.string()),
    statut: v.union(v.literal("actif"), v.literal("brouillon")),
  }).index("by_effective", ["effectiveFrom"]),

  // Catalogue des rubriques de paie et leur APPARTENANCE AUX ASSIETTES (lot R2).
  // Daté comme le barème (décision E4 du 20/10/2026 : « ajout au niveau du barème ») : un
  // bulletin résout la version applicable à SA période, donc un mois clôturé n'est jamais
  // recalculé avec une définition d'assiette plus récente. Voir lib/rubriques.ts.
  rubriquesPaie: defineTable({
    effectiveFrom: v.string(),        // "YYYY-MM-DD" — début d'applicabilité
    source: v.string(),
    rubriques: v.array(v.object({
      code: v.string(),
      libelle: v.string(),
      sens: v.union(v.literal("gain"), v.literal("retenue")),
      ordre: v.number(),
      dansBrut: v.boolean(),               // V  — salaire brut
      dansBrutIntermediaire: v.boolean(),  // W  — éléments entièrement taxables
      dansCotisable: v.boolean(),          // AA — assiette CNPS
      dansAllocConge: v.boolean(),         // assiette de l'allocation de congé (art. 73)
      proratisable: v.boolean(),
      avantageNature: v.optional(v.object({
        tauxForfait: v.number(),           // % du salaire brut intermédiaire (logement 15 %…)
        plafonnerAuForfait: v.boolean(),   // retenir min(forfait ; montant versé)
      })),
    })),
  }).index("by_effective", ["effectiveFrom"]),

  // Éléments variables saisis par mois et par COUPLE (employé, société) depuis le lot R2 bis.
  saisiesMensuelles: defineTable({
    employeId: v.id("employes"),
    // Société qui verse ces éléments. ABSENTE = ligne antérieure au lot R2 bis : elle appartient
    // à la société porteuse de la fiche (`lib/societes.pourSociete`). Jamais requise, pour que
    // les saisies déjà faites restent lisibles et modifiables.
    societe: v.optional(SOCIETE),
    periode: v.string(),              // "YYYY-MM"
    joursTravailles: v.number(),
    absencesJours: v.number(),
    sanctions: v.number(),            // FCFA
    primesVariables: v.number(),      // FCFA (hors primes fixes récurrentes)
    transport: v.number(),
    heuresSup: v.number(),
    anciennete: v.number(),               // ancienneté du groupe « primes fixes »
    ancienneteSeparee: v.optional(v.number()), // ancienneté de la colonne distincte (21/10/2026)
    mutuellePct: v.number(),          // % mutuelle
    dettesSoins: v.number(),
    acompte: v.number(),
    primeAssiduite: v.optional(v.number()),   // prime d'assiduité (FCFA)
    indemniteLogement: v.optional(v.number()),// indemnité de logement (FCFA)
    absences: v.optional(v.number()),         // retenue pour absences (FCFA) — colonne « ABSENCE » du récapitulatif
    // Primes du DIPE ajoutées au récapitulatif le 21/10/2026 (lib/rubriques.CHAMP_SAISIE_VERS_RUBRIQUE).
    primeSalissure: v.optional(v.number()),
    primePanier: v.optional(v.number()),
    primeLait: v.optional(v.number()),
    indemniteRepresentation: v.optional(v.number()),
    indemniteVehicule: v.optional(v.number()),
    primeCaisse: v.optional(v.number()),
    primeRendement: v.optional(v.number()),
    indemniteOutillage: v.optional(v.number()),
    gratification: v.optional(v.number()),
  })
    .index("by_periode", ["periode"])
    .index("by_employe_periode", ["employeId", "periode"]),

  // Lignes libres de primes / charges datées (alimentent les totaux du mois).
  primesCharges: defineTable({
    employeId: v.id("employes"),
    // Société qui verse la prime ou retient la charge. Absente = société porteuse de la fiche
    // (lignes antérieures au lot R2 bis) : une prime ne doit jamais changer de déclarant.
    societe: v.optional(SOCIETE),
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
    // Catalogue légal : voir lib/absencesLegales.ts. Les 4 premières valeurs sont les clés
    // HISTORIQUES et restent acceptées — aucune donnée existante n'est invalidée.
    type: v.union(
      v.literal("conge_paye"), v.literal("absence"), v.literal("maladie"), v.literal("autre"),
      v.literal("maternite"), v.literal("accident_travail"), v.literal("evenement_familial"),
      v.literal("chomage_technique"), v.literal("mise_a_pied"), v.literal("sans_solde"),
      v.literal("formation_syndicale"),
    ),
    // Pièce justificative fournie (certificat médical, acte d'état civil…).
    justificatifFourni: v.optional(v.boolean()),
    /** Événement familial précis, quand le type est `evenement_familial`. */
    evenementFamilial: v.optional(v.string()),
    /** Rang du mois d'absence, pour le barème dégressif du chômage technique. */
    rangMois: v.optional(v.number()),
    dateDebut: v.string(),            // "YYYY-MM-DD"
    dateFin: v.string(),              // inclus
    jours: v.number(),                // jours calendaires inclus
    paye: v.boolean(),                // rémunéré (n'entame pas les jours travaillés) ou non
    motif: v.optional(v.string()),
    // --- Planning annuel (lot R1) ---
    // Année de référence du droit : remplace les en-têtes « RAPPEL 2025 » / « PLANIFICATION 2026 »
    // écrits en dur dans le classeur, qu'il fallait reprendre à la main chaque 1er janvier.
    anneeReference: v.optional(v.number()),
    // Décompte en JOURS OUVRABLES (lib/congesOuvrables) et date de retour calculée.
    // `jours` reste le décompte calendaire dont dépend la paie aujourd'hui : les deux cohabitent
    // jusqu'à la bascule du lot R4.
    joursOuvrables: v.optional(v.number()),
    dateRetour: v.optional(v.string()),   // 1er jour de service après le congé
    // Colonne « observation » réclamée par la RH (lib/planningAnnuel.OBSERVATIONS).
    observation: v.optional(v.string()),
    commentaire: v.optional(v.string()),
    // Colonne REMPLACANT CONGES : un collègue, ou la mention libre « CONTINUITE ».
    remplacantId: v.optional(v.id("employes")),
    remplacantTexte: v.optional(v.string()),
    // Droit à congé : calculé (ancienneté + enfants) mais surchargeable à la main avec motif (E5).
    congeSuppCalcule: v.optional(v.number()),
    congeSuppManuel: v.optional(v.number()),
    congeSuppMotif: v.optional(v.string()),
  })
    .index("by_employe", ["employeId"])
    .index("by_debut", ["dateDebut"])
    .index("by_annee", ["anneeReference"]),

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
    details: v.optional(v.object({       // synthèse figée (format bulletin de référence)
      salaireJournalier: v.number(), salaireBase: v.number(), joursTravailles: v.number(),
      congesAcquis: v.number(), congesPris: v.number(), congesRestants: v.number(), indemniteConges: v.number(),
      primes: v.number(), heuresSup: v.number(), anciennete: v.number(),
      total1: v.number(), total2: v.number(), brutTaxable: v.number(), baseCnps: v.number(),
      mutuelle: v.number(), acompteImpotsCnps: v.number(), chargesSalariales: v.number(), chargesPatronales: v.number(),
      irpp: v.number(), cac: v.number(), tdl: v.number(), rav: v.number(), cnpsSalarie: v.number(),
    })),
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
    // Société du bulletin envoyé (lot R2 bis) : un pluri-employé reçoit un courrier par société.
    // Absente = envoi antérieur, donc société porteuse de la fiche.
    societe: v.optional(SOCIETE),
    periode: v.string(),
    email: v.string(),                // adresse du canal : e-mail, ou numéro WhatsApp
    canal: v.optional(v.union(v.literal("email"), v.literal("whatsapp"))), // absent = e-mail (envois antérieurs)
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
    // Destinataires nominatifs (demande de M. GAMBOU, 28/09/2026) : si la liste est posée, le document
    // n'est visible et téléchargeable QUE par eux et le déposant, quel que soit leur niveau.
    destinataires: v.optional(v.array(v.id("users"))),
  })
    .index("by_categorie", ["categorie"])
    .index("by_depose", ["deposeLe"])
    .index("by_fichier", ["fichierId"]),

  // Répertoire Fournisseurs (légers : nom, téléphone +237 obligatoire, ville)
  fournisseurs: defineTable({
    nom: v.string(),
    telephone: v.string(),             // E.164 (+237...)
    ville: v.optional(v.string()),
    email: v.optional(v.string()),
    categories: v.optional(v.array(v.string())), // ["medicale", "fourniture", "reactifs_labo"]
    actif: v.boolean(),
    creePar: v.optional(v.id("users")),
    creeLe: v.string(),
  })
    .index("by_nom", ["nom"])
    .index("by_actif", ["actif"]),

  // ---- Activité (Phase 3 & Refonte Approvisionnement) ----
  // Commandes médicales, fournitures ou réactifs labo.
  // Workflow en 4 jalons : preparation -> en_attente (validation DG) -> en_reception (litiges) -> cloturee
  commandes: defineTable({
    reference: v.string(),            // "CMD-2026-001" (séquentiel par année)
    type: v.union(v.literal("medicale"), v.literal("fourniture"), v.literal("reactifs_labo")),
    fournisseurId: v.optional(v.id("fournisseurs")),
    libelle: v.optional(v.string()),
    date: v.string(),                 // "YYYY-MM-DD"
    demandeur: v.string(),
    service: v.optional(v.string()),
    statut: v.union(
      v.literal("preparation"),
      v.literal("en_attente"),
      v.literal("validee"),
      v.literal("en_reception"),
      v.literal("en_litige"),
      v.literal("rejetee"),
      v.literal("livree"),
      v.literal("cloturee")
    ),
    lignes: v.array(
      v.object({
        produit: v.string(),
        dci: v.optional(v.string()),
        ancienneDate: v.optional(v.string()),
        ancienneQuantite: v.optional(v.number()),
        quantiteUtilisee: v.optional(v.number()),
        quantiteRestante: v.optional(v.number()),
        quantite: v.number(),
        prixUnitaire: v.number(),
      })
    ),
    litige: v.optional(
      v.object({
        type: v.union(
          v.literal("peremption"),
          v.literal("quantite_insuffisante"),
          v.literal("manquant"),
          v.literal("avarie"),
          v.literal("autre")
        ),
        description: v.string(),
        resolu: v.boolean(),
        dateSignalement: v.string(),
        dateResolution: v.optional(v.string()),
      })
    ),
    proformaRef: v.optional(v.string()),
    proformaDate: v.optional(v.string()),
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
    .index("by_reference", ["reference"])
    .index("by_fournisseur", ["fournisseurId"]),

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
    commentaires: v.optional(
      v.array(
        v.object({
          auteur: v.string(),
          auteurId: v.optional(v.id("users")),
          texte: v.string(),
          date: v.string(),
        })
      )
    ),
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

  // Jours fériés, par année. ADMINISTRABLE : les fêtes religieuses et les dates pascales sont
  // fixées chaque année par acte administratif — elles ne peuvent pas être codées en dur
  // (voir lib/joursFeriesCameroun.ts et docs/rh/CALIBRATION-PLANNING.md).
  joursFeries: defineTable({
    date: v.string(),                 // "YYYY-MM-DD"
    libelle: v.string(),
    chome: v.boolean(),               // false = férié travaillé dans l'entreprise, donc décompté
    annee: v.number(),               // redondant avec `date`, mais indexable
    origine: v.union(                 // d'où vient la date : sert à signaler ce qui reste à confirmer
      v.literal("fixe"),              // date fixe du calendrier camerounais
      v.literal("pascal"),            // calculée par le comput de Pâques
      v.literal("saisi"),             // saisie à la main (Aïd, report administratif)
    ),
  })
    .index("by_date", ["date"])
    .index("by_annee", ["annee"]),

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
