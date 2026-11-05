// Générateur d'actes RH — logique PURE (lot R11).
//
// Les 13 modèles de la responsable RH sont des FORMULAIRES À TROUS, pas des documents libres :
// les pointillés de ses fichiers Word sont des champs. Le générateur remplace donc les trous par
// des jetons `{{champ}}`, et chaque champ déclare ce qui doit le remplir.
//
// Deux observations tirées du dépouillement orientent toute la conception :
//
//  1. **L'attestation de salaire est déjà un bulletin.** Elle reprend seize montants qui sont
//     exactement nos lignes de bulletin et nos quatre assiettes. Elle se PRÉ-REMPLIT donc depuis
//     le bulletin d'une période choisie — aujourd'hui la RH recopie ces seize montants à la main
//     pour chaque salariée en congé de maternité.
//  2. **Les références sont numérotées** (`001/PP/MC/DAF/NG/03-2025`, `02/PP/DAF/DRH/08-2025`) :
//     un numéro séquentiel, un sigle de service, le mois et l'année. Le projet sait déjà faire —
//     `commandes.ts` génère `CMD-AAAA-NNN` par séquence annuelle.
//
// ⚠️ MISE EN PAGE : les actes s'impriment sur du papier à en-tête. Le bandeau de la Polyclinique
// mesuré sur une facture réelle occupe **125 pt (44 mm)** en haut d'une page A4 : c'est la marge
// haute par défaut, pour que le texte ne passe jamais sous le logo imprimé.

export const MARGE_HAUTE_ENTETE = 125; // pt — mesuré sur le papier à en-tête réel
export const MARGE_BASSE = 70;
export const MARGE_LATERALE = 60;

export type TypeChamp = "texte" | "date" | "nombre" | "montant" | "zone";

/** D'où vient la valeur proposée, quand elle peut l'être. */
export type SourceChamp =
  | { de: "employe"; cle: string }
  | { de: "bulletin"; cle: string }
  | { de: "entreprise"; cle: string }
  | { de: "aujourdhui" }
  | { de: "saisie" };

export interface ChampActe {
  nom: string;
  libelle: string;
  type: TypeChamp;
  obligatoire: boolean;
  source: SourceChamp;
  aide?: string;
}

export type FamilleActe = "attestation" | "notification" | "stage" | "contrat";

export interface ModeleActe {
  code: string;
  libelle: string;
  famille: FamilleActe;
  /** Corps à jetons `{{nom}}`. Les sauts de ligne sont des paragraphes. */
  corps: string;
  champs: ChampActe[];
  /** Gabarit de référence ; `{n}` = séquence, `{mm}`/`{aaaa}` = mois et année. */
  formatReference?: string;
  ordre: number;
}

export const LIBELLE_FAMILLE: Record<FamilleActe, string> = {
  attestation: "Attestations",
  notification: "Notifications",
  stage: "Stages",
  contrat: "Contrats",
};

// ---------------------------------------------------------------------------
// Fabriques de champs — pour que les modèles restent lisibles
// ---------------------------------------------------------------------------

const ch = (
  nom: string, libelle: string, type: TypeChamp, source: SourceChamp,
  obligatoire = true, aide?: string,
): ChampActe => ({ nom, libelle, type, obligatoire, source, aide });

const DU_SALARIE = {
  nom: ch("nom", "Nom et prénoms", "texte", { de: "employe", cle: "nom" }),
  fonction: ch("fonction", "Qualité / fonction", "texte", { de: "employe", cle: "fonction" }),
  dateDebut: ch("dateEmbauche", "Date d'entrée", "date", { de: "employe", cle: "dateDebut" }),
  categorie: ch("categorie", "Catégorie", "texte", { de: "employe", cle: "categorie" }, false),
  echelon: ch("echelon", "Échelon", "texte", { de: "employe", cle: "echelon" }, false),
  cnps: ch("matriculeCnps", "Matricule CNPS", "texte", { de: "employe", cle: "cnps" }, false),
};
const SIGNATURE = ch("signataire", "Signataire", "texte", { de: "entreprise", cle: "responsableRH" });
const LE_JOUR = ch("date", "Fait le", "date", { de: "aujourdhui" });

/** Les seize montants de son attestation de salaire — tous tirés du bulletin de la période. */
const MONTANTS_BULLETIN: ChampActe[] = [
  ch("salaireBase", "Salaire de base", "montant", { de: "bulletin", cle: "salaireBase" }),
  ch("anciennete", "Prime d'ancienneté", "montant", { de: "bulletin", cle: "anciennete" }, false),
  ch("assiduite", "Prime d'assiduité", "montant", { de: "bulletin", cle: "primeAssiduite" }, false),
  ch("transport", "Indemnité de transport", "montant", { de: "bulletin", cle: "transport" }, false),
  ch("logement", "Logement", "montant", { de: "bulletin", cle: "indemniteLogement" }, false),
  ch("salissure", "Prime de salissure", "montant", { de: "bulletin", cle: "primeSalissure" }, false),
  ch("lait", "Prime de lait", "montant", { de: "bulletin", cle: "primeLait" }, false),
  ch("cnps", "Retenue CNPS", "montant", { de: "bulletin", cle: "cnpsSalarie" }),
  ch("irpp", "Retenue IRPP", "montant", { de: "bulletin", cle: "irpp" }),
  ch("cac", "CAC", "montant", { de: "bulletin", cle: "cac" }),
  ch("cfc", "CFC PS", "montant", { de: "bulletin", cle: "cfcSalarie" }),
  ch("tdl", "TC / TDL", "montant", { de: "bulletin", cle: "tdl" }),
  ch("rav", "RAV", "montant", { de: "bulletin", cle: "rav" }),
  ch("taxable", "Salaire taxable", "montant", { de: "bulletin", cle: "salaireTaxable" }),
  ch("cotisable", "Salaire cotisable", "montant", { de: "bulletin", cle: "salaireCotisable" }),
  ch("net", "Net perçu", "montant", { de: "bulletin", cle: "net" }),
];

// ---------------------------------------------------------------------------
// Les modèles, repris mot à mot de ses fichiers Word
// ---------------------------------------------------------------------------

export const MODELES_DEFAUT: ModeleActe[] = [
  {
    code: "ATT_SALAIRE",
    libelle: "Attestation de salaire",
    famille: "attestation",
    ordre: 10,
    corps: `ATTESTATION DE SALAIRE

Nous soussignés, POLYCLINIQUE DE POITIERS, attestons par la présente que Mme/Mlle/M. {{nom}} est employé(e) dans notre structure depuis le {{dateEmbauche}}, en qualité de {{fonction}}, classé(e) en catégorie {{categorie}} échelon {{echelon}}.

{{situation}}, il/elle perçoit régulièrement le salaire net ainsi structuré :

Salaire de base : {{salaireBase}} FCFA
Prime d'ancienneté : {{anciennete}} FCFA
Prime d'assiduité : {{assiduite}} FCFA
Indemnité Transport : {{transport}} FCFA
Logement : {{logement}} FCFA
Prime de salissure : {{salissure}} FCFA
Prime de lait : {{lait}} FCFA
Retenue CNPS : {{cnps}} FCFA
Retenue IRPP : {{irpp}} FCFA
CAC : {{cac}} FCFA
CFC PS : {{cfc}} FCFA
TC/TDL : {{tdl}} FCFA
RAV : {{rav}} FCFA
Salaire taxable : {{taxable}} FCFA
Salaire cotisable : {{cotisable}} FCFA
Net perçu : {{net}} FCFA

En foi de quoi cette attestation lui est délivrée pour servir et valoir ce que de droit.

Douala, le {{date}}

{{signataire}}`,
    champs: [
      DU_SALARIE.nom, DU_SALARIE.dateDebut, DU_SALARIE.fonction, DU_SALARIE.categorie, DU_SALARIE.echelon,
      ch("situation", "Situation", "texte", { de: "saisie" }, true,
        "Ex. : « Mise en congés de maternité depuis le 09 juin 2026 »"),
      ...MONTANTS_BULLETIN, LE_JOUR, SIGNATURE,
    ],
  },
  {
    code: "ATT_PRESENCE",
    libelle: "Attestation de présence effective au service",
    famille: "attestation",
    ordre: 20,
    formatReference: "{n}/PP/MC/DAF/NG/{mm}-{aaaa}",
    corps: `ATTESTATION DE PRÉSENCE EFFECTIVE AU SERVICE

Réf. {{reference}}

Je soussigné(e), {{signataire}}, atteste que Mme/Mlle/M. {{nom}}, matricule CNPS numéro {{matriculeCnps}}, est employé(e) dans notre structure depuis le {{dateEmbauche}}. Il/Elle exerce en qualité de {{fonction}}.

En foi de quoi, la présente attestation lui est délivrée pour servir et valoir ce que de droit.

Fait à Douala, le {{date}}

{{signataire}}`,
    champs: [DU_SALARIE.nom, DU_SALARIE.cnps, DU_SALARIE.dateDebut, DU_SALARIE.fonction, LE_JOUR, SIGNATURE],
  },
  {
    code: "ATT_REPRISE",
    libelle: "Attestation de reprise de service",
    famille: "attestation",
    ordre: 30,
    corps: `ATTESTATION DE REPRISE DE SERVICE

Je soussigné(e), {{signataire}}, atteste que Mme/Mlle/M. {{nom}} a repris service dans notre structure en date du {{dateReprise}}.

En foi de quoi, la présente attestation lui est délivrée pour servir et valoir ce que de droit.

Fait à Douala, le {{date}}

{{signataire}}`,
    champs: [
      DU_SALARIE.nom,
      ch("dateReprise", "Date de reprise", "date", { de: "saisie" }),
      LE_JOUR, SIGNATURE,
    ],
  },
  {
    code: "ATT_NON_REPRISE",
    libelle: "Attestation de non-reprise de service",
    famille: "attestation",
    ordre: 40,
    corps: `ATTESTATION DE NON REPRISE DE SERVICE

Je soussigné(e), {{signataire}}, atteste que Mme/Mlle/M. {{nom}} n'a pas repris le service dans notre structure au cours du mois de {{mois}} et ce depuis son congé de maternité.

En foi de quoi, la présente attestation lui est délivrée pour servir et valoir ce que de droit.

Fait à Douala, le {{date}}

{{signataire}}`,
    champs: [
      DU_SALARIE.nom,
      ch("mois", "Mois concerné", "texte", { de: "saisie" }, true, "Ex. : « octobre 2026 »"),
      LE_JOUR, SIGNATURE,
    ],
  },
  {
    code: "CESSATION_SALAIRE",
    libelle: "Cessation de perception de salaire",
    famille: "notification",
    ordre: 50,
    corps: `Douala, le {{date}}

CESSATION DE PERCEPTION DE SALAIRE

Mme/Mlle/M. {{nom}},

Nous vous notifions par la présente note que vous ne pourriez plus percevoir de salaire à compter du {{dateEffet}}, pour motif de {{motif}}, et ce jusqu'à la reprise de service.

Par ailleurs vous voudriez bien prendre attache avec les services sociaux pour la perception de vos droits durant cette période.

{{signataire}}

Ampliations :
DAF/PP
Chrono
Intéressé(e)`,
    champs: [
      DU_SALARIE.nom,
      ch("dateEffet", "Date d'effet", "date", { de: "saisie" }),
      ch("motif", "Motif", "zone", { de: "saisie" }),
      LE_JOUR, SIGNATURE,
    ],
  },
  {
    code: "STAGE_ACCORD_NON_REMUNERE",
    libelle: "Accord de stage non rémunéré",
    famille: "stage",
    ordre: 60,
    formatReference: "{n}/PP/DAF/DRH/{mm}-{aaaa}",
    corps: `Douala, le {{date}}

Nos réf. {{reference}}

Objet : Votre demande de stage

Mme/Mlle/M. {{nom}},

Suite à votre candidature en tant que stagiaire dans notre structure, nous avons le plaisir de vous annoncer que votre demande a été retenue. Vous pourrez donc intégrer notre structure pour un stage de {{duree}} mois qui débutera le {{dateDebutStage}} et s'achèvera le {{dateFinStage}}.

Par ailleurs, nous vous informons que ce stage n'est pas rémunéré.

Nous vous prions de recevoir l'expression de nos salutations distinguées.

{{signataire}}`,
    champs: [
      ch("nom", "Nom et prénoms du stagiaire", "texte", { de: "saisie" }),
      ch("duree", "Durée (mois)", "nombre", { de: "saisie" }),
      ch("dateDebutStage", "Début du stage", "date", { de: "saisie" }),
      ch("dateFinStage", "Fin du stage", "date", { de: "saisie" }),
      LE_JOUR, SIGNATURE,
    ],
  },
  {
    code: "STAGE_ACCORD_REMUNERE",
    libelle: "Accord de stage rémunéré",
    famille: "stage",
    ordre: 70,
    formatReference: "{n}/PP/DAF/DRH/{mm}-{aaaa}",
    corps: `Douala, le {{date}}

Nos réf. {{reference}}

Objet : Votre demande de stage

Mme/Mlle/M. {{nom}},

Suite à votre candidature en tant que stagiaire dans notre structure, nous avons le plaisir de vous annoncer que votre demande a été retenue. Vous pourrez donc intégrer notre structure pour un stage de {{duree}} mois qui débutera le {{dateDebutStage}}.

Par ailleurs, nous vous informons que durant votre stage vous percevrez une rémunération de {{gratification}} francs CFA. Cette rémunération ne constitue en aucun cas et ne pourrait être assimilée à un salaire ; elle est une mesure d'accompagnement dont les conditions d'octroi relèvent du pouvoir discrétionnaire de la haute hiérarchie. Elle pourra faire l'objet de modification à tout moment sans besoin de votre accord préalable.

Nous vous prions de recevoir l'expression de nos salutations distinguées.

{{signataire}}`,
    champs: [
      ch("nom", "Nom et prénoms du stagiaire", "texte", { de: "saisie" }),
      ch("duree", "Durée (mois)", "nombre", { de: "saisie" }),
      ch("dateDebutStage", "Début du stage", "date", { de: "saisie" }),
      ch("gratification", "Gratification mensuelle", "montant", { de: "saisie" }),
      LE_JOUR, SIGNATURE,
    ],
  },
  {
    code: "STAGE_ATT_FIN",
    libelle: "Attestation de fin de stage",
    famille: "stage",
    ordre: 80,
    formatReference: "{n}/PP/DAF/DRH/{mm}-{aaaa}",
    corps: `ATTESTATION DE FIN DE STAGE N° {{reference}}

Je soussigné(e), {{signataire}}, atteste que Mme/Mlle/M. {{nom}} a effectué au sein de notre établissement un stage {{natureStage}}. Ce dernier s'est étalé sur la période allant du {{dateDebutStage}} au {{dateFinStage}}. Au cours de son stage, il/elle a exercé dans le(s) service(s) {{services}}.

En foi de quoi, nous lui délivrons cette attestation pour servir et valoir ce que de droit.

Fait à Douala, le {{date}}

{{signataire}}`,
    champs: [
      ch("nom", "Nom et prénoms du stagiaire", "texte", { de: "saisie" }),
      ch("natureStage", "Nature du stage", "texte", { de: "saisie" }, true, "Ex. : « académique », « professionnel »"),
      ch("dateDebutStage", "Début du stage", "date", { de: "saisie" }),
      ch("dateFinStage", "Fin du stage", "date", { de: "saisie" }),
      ch("services", "Service(s)", "texte", { de: "saisie" }),
      LE_JOUR, SIGNATURE,
    ],
  },
  {
    code: "ENGAGEMENT_ESSAI",
    libelle: "Engagement à l'essai",
    famille: "contrat",
    ordre: 90,
    formatReference: "{n}/PP/DAF/DRH/{mm}-{aaaa}",
    corps: `ENGAGEMENT À L'ESSAI N° {{reference}}

Entre les soussignés :

La Polyclinique de Poitiers représentée par son gérant Monsieur TCHIDJO KENMEGNIE MAGLOIRE, NIU M110800026452Z enregistré au registre du commerce au numéro RC/DOUALA/2008/B/2014, ci-après désigné l'employeur d'une part ;

Et

Mme/Mlle/M. {{nom}}
Né(e) le {{dateNaissance}} à {{lieuNaissance}}
Fils/fille de {{pere}} et de {{mere}}
Résidant à {{residence}}, quartier {{quartier}}
Statut matrimonial : {{statutMatrimonial}}
Ayant à sa charge {{enfants}} enfant(s)
Profession : {{profession}} — diplôme : {{diplome}}
CNI N° {{cni}} délivrée le {{dateCni}}
ci-après dénommé(e) l'employé(e) d'autre part ;

Il est établi le présent contrat.

Article 1 : De la durée
Le présent contrat est conclu pour une période de {{dureeEssai}} mois renouvelable une fois à compter du {{dateDebutContrat}}. À l'issue de cette période d'essai, un test d'évaluation pourra être effectué avant l'embauche définitive de l'employé(e).

Article 2 : Des obligations des parties
L'employé(e) s'engage pour la période qui lui est due à exercer les fonctions de {{fonction}} qui le situe à la catégorie {{categorie}} échelon {{echelon}} selon la grille salariale de la structure.
Par ailleurs l'employé(e) est tenu(e) au respect strict de la réglementation au sein de l'entreprise, notamment le règlement intérieur, la discipline, la déontologie et toutes les instructions administratives qui lui seront transmises.
En retour l'employeur garantit au travailleur la mise en place d'un cadre de travail dans le respect des mesures de sécurité sociale. Il lui fournira les outils nécessaires à l'exécution de ses tâches au sein de la structure.

Article 3 : De la rémunération
Au cours de son activité l'employé(e) percevra une rémunération mensuelle égale à {{remuneration}} francs CFA.

Article 4 : De la résiliation du contrat
Le présent contrat pourra être résilié dans les conditions prévues aux articles 34 et suivants du Code du travail.

Article 5 : Des dispositions transitoires et finales
L'employé(e) prendra connaissance du règlement intérieur et des règles de travail lors de la période de son insertion sociale. Le présent contrat est régi par le droit camerounais en vigueur. En cas de conflit, seules les juridictions camerounaises seront compétentes pour en répondre.

Fait à Douala, le {{date}}

L'employé(e)                                        L'Employeur`,
    champs: [
      DU_SALARIE.nom,
      ch("dateNaissance", "Date de naissance", "date", { de: "saisie" }),
      ch("lieuNaissance", "Lieu de naissance", "texte", { de: "saisie" }),
      ch("pere", "Nom du père", "texte", { de: "saisie" }, false),
      ch("mere", "Nom de la mère", "texte", { de: "saisie" }, false),
      ch("residence", "Résidence", "texte", { de: "employe", cle: "adresse" }),
      ch("quartier", "Quartier", "texte", { de: "saisie" }, false),
      ch("statutMatrimonial", "Statut matrimonial", "texte", { de: "saisie" }, false),
      ch("enfants", "Enfants à charge", "nombre", { de: "saisie" }, false),
      ch("profession", "Profession", "texte", { de: "saisie" }, false),
      ch("diplome", "Diplôme", "texte", { de: "saisie" }, false),
      ch("cni", "N° CNI", "texte", { de: "saisie" }, false),
      ch("dateCni", "CNI délivrée le", "date", { de: "saisie" }, false),
      ch("dureeEssai", "Durée de l'essai (mois)", "nombre", { de: "saisie" }),
      ch("dateDebutContrat", "Prise d'effet", "date", { de: "employe", cle: "dateDebut" }),
      DU_SALARIE.fonction, DU_SALARIE.categorie, DU_SALARIE.echelon,
      ch("remuneration", "Rémunération mensuelle", "montant", { de: "employe", cle: "salaireBase" }),
      LE_JOUR,
    ],
  },
];

// ---------------------------------------------------------------------------
// Rendu
// ---------------------------------------------------------------------------

const JETON = /\{\{([a-zA-Z0-9_]+)\}\}/g;

/** Les jetons présents dans un corps, dans l'ordre et sans doublon. */
export function jetonsDuCorps(corps: string): string[] {
  const vus: string[] = [];
  for (const m of corps.matchAll(JETON)) if (!vus.includes(m[1])) vus.push(m[1]);
  return vus;
}

/**
 * Remplace les jetons par les valeurs. Un jeton SANS valeur devient une ligne de pointillés,
 * et non une chaîne vide : l'acte reste imprimable et complétable à la main, comme ses modèles
 * Word d'origine.
 */
export function rendreActe(corps: string, valeurs: Record<string, string>): string {
  return corps.replace(JETON, (_, nom) => {
    const v = valeurs[nom];
    return v !== undefined && String(v).trim() !== "" ? String(v) : "……………………";
  });
}

/** Champs obligatoires non renseignés — bloque la génération. */
export function champsManquants(modele: ModeleActe, valeurs: Record<string, string>): ChampActe[] {
  return modele.champs.filter(
    (c) => c.obligatoire && !(valeurs[c.nom] ?? "").toString().trim(),
  );
}

/**
 * Cohérence d'un modèle : tout jeton doit avoir son champ, et tout champ doit servir.
 * `reference` est le seul jeton implicite, rempli par la numérotation.
 */
export function validerModele(m: ModeleActe): string[] {
  const e: string[] = [];
  const jetons = jetonsDuCorps(m.corps).filter((j) => j !== "reference");
  const noms = new Set(m.champs.map((c) => c.nom));
  for (const j of jetons) if (!noms.has(j)) e.push(`Le jeton {{${j}}} n'a pas de champ déclaré.`);
  for (const c of m.champs) if (!jetons.includes(c.nom)) e.push(`Le champ « ${c.libelle} » n'apparaît pas dans le corps.`);
  if (jetonsDuCorps(m.corps).includes("reference") && !m.formatReference)
    e.push("Le corps porte {{reference}} mais aucun format de référence n'est défini.");
  const doublons = m.champs.map((c) => c.nom).filter((n, i, a) => a.indexOf(n) !== i);
  for (const d of new Set(doublons)) e.push(`Champ en double : ${d}.`);
  return e;
}

/**
 * Référence d'un acte. `{n}` est la séquence de l'année, sur 3 chiffres ; `{mm}` et `{aaaa}`
 * le mois et l'année de délivrance. Même principe que `CMD-AAAA-NNN` des commandes.
 */
export function construireReference(format: string, sequence: number, date: string): string {
  return format
    .replace("{n}", String(sequence).padStart(3, "0"))
    .replace("{mm}", date.slice(5, 7))
    .replace("{aaaa}", date.slice(0, 4));
}

/**
 * Prochaine séquence de l'année : la plus haute déjà attribuée + 1, et non le nombre d'actes.
 * `commandes.ts` a connu ce défaut — après une suppression, compter les lignes réattribue une
 * référence déjà portée.
 */
export function prochaineSequence(referencesExistantes: string[], annee: number): number {
  let max = 0;
  for (const r of referencesExistantes) {
    if (!r.includes(String(annee))) continue;
    const m = r.match(/^(\d+)/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}
