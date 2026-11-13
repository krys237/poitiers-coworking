// Immatriculation fiscale du salarié — logique PURE (lot R8).
//
// Arbitrage du propriétaire du 04/11/2026 : « l'immatriculation est celle de l'employé », et non
// celle de la société. Cinq demandes de la RH n'en font qu'une, et c'est ce drapeau qui les relie :
//
//   · « Changer *Bulletin de paie* en *Récapitulatif de paie* pour ceux qui ne sont pas à SGC » ;
//   · « Il faut un filtre d'immatriculation des impôts » ;
//   · « Récap non téléchargeable pour les non immatriculés » ;
//   · « Les employés non immatriculés n'apparaissent pas sur le DIPE » ;
//   · « Les bulletins considérés sont ceux de SGC ; SESAME et SOFINA ne sont pas pris en compte ».
//
// ⚠️ TROIS états, pas deux. Le drapeau peut être absent, et c'est le cas de toutes les fiches
// antérieures au lot R7. Une fiche non renseignée est traitée comme IMMATRICULÉE — sans quoi le
// déploiement priverait d'un coup tout l'effectif de son bulletin et de son PDF. L'écran le
// signale pour que la RH complète, mais le comportement ne change pas tant qu'elle ne l'a pas fait.

export type EtatImmatriculation = "immatricule" | "non_immatricule" | "non_renseigne";

export interface StatutDocument {
  etat: EtatImmatriculation;
  /** Vrai si les règles fiscales s'appliquent : déclaration au DIPE, PDF téléchargeable. */
  immatricule: boolean;
  /** Faux quand le drapeau n'a jamais été renseigné : à faire remonter à l'écran. */
  renseigne: boolean;
  /** Intitulé du document remis au salarié. */
  titre: string;
  /** Intitulé court, pour une colonne ou une puce. */
  titreCourt: string;
  telechargeable: boolean;
  /** Pourquoi le téléchargement est refusé, le cas échéant — jamais un refus muet. */
  motifRefus?: string;
  /** Le salarié entre-t-il dans le DIPE ? */
  dansDipe: boolean;
}

export const TITRE_BULLETIN = "Bulletin de paie";
export const TITRE_RECAPITULATIF = "Récapitulatif de paie";

const MOTIF_REFUS =
  "Ce salarié n'est pas immatriculé aux impôts : le document est un récapitulatif de paie, " +
  "consultable mais non téléchargeable, et il n'entre pas dans la déclaration DIPE.";

/**
 * Statut documentaire d'un salarié, à partir de son seul drapeau d'immatriculation.
 * Unique source de vérité : l'écran, le PDF, le DIPE et la garde serveur l'appellent tous.
 */
export function statutDocument(immatriculeImpots: boolean | undefined): StatutDocument {
  const renseigne = immatriculeImpots !== undefined;
  // Non renseigné → immatriculé, pour ne pas retirer un droit existant par simple absence
  // de donnée. Voir l'en-tête de ce fichier.
  const immatricule = immatriculeImpots ?? true;

  return {
    etat: !renseigne ? "non_renseigne" : immatricule ? "immatricule" : "non_immatricule",
    immatricule,
    renseigne,
    titre: immatricule ? TITRE_BULLETIN : TITRE_RECAPITULATIF,
    titreCourt: immatricule ? "Bulletin" : "Récapitulatif",
    telechargeable: immatricule,
    motifRefus: immatricule ? undefined : MOTIF_REFUS,
    dansDipe: immatricule,
  };
}

/** Libellés des trois états, pour un filtre ou une légende. */
export const LIBELLE_IMMATRICULATION: Record<EtatImmatriculation, string> = {
  immatricule: "Immatriculé aux impôts",
  non_immatricule: "Non immatriculé",
  non_renseigne: "À renseigner",
};

/** Répartition d'un effectif par état — alimente le filtre et son indicateur. */
export function repartitionImmatriculation(
  employes: { immatriculeImpots?: boolean }[],
): Record<EtatImmatriculation, number> {
  const out: Record<EtatImmatriculation, number> = {
    immatricule: 0,
    non_immatricule: 0,
    non_renseigne: 0,
  };
  for (const e of employes) out[statutDocument(e.immatriculeImpots).etat]++;
  return out;
}

/**
 * Filtre un effectif sur l'état d'immatriculation. `"tous"` ne filtre rien.
 * Les trois états sont distingués pour que la RH puisse isoler ce qu'il lui reste à renseigner.
 */
export function filtrerParImmatriculation<T extends { immatriculeImpots?: boolean }>(
  employes: T[],
  etat: EtatImmatriculation | "tous",
): T[] {
  if (etat === "tous") return employes;
  return employes.filter((e) => statutDocument(e.immatriculeImpots).etat === etat);
}
