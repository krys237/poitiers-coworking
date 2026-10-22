// Rattachement d'un employé à une ou plusieurs sociétés — logique PURE (lot R2 bis).
//
// Décision du propriétaire du 20/10/2026 : « SESAME déclare de son côté. » Il n'y a aucune
// sous-déclaration. C'est un cas de PLURI-EMPLOI RÉGULIER : SESAME, SOFINA et SGC sont trois
// employeurs juridiquement distincts, chacun avec son NIU et son numéro CNPS. Il en découle
// un bulletin par société et un DIPE par déclarant.
//
// Conséquence ASSUMÉE, qu'il ne faut surtout pas « corriger » : le plafond CNPS (750 000) et les
// tranches de l'IRPP s'appliquent PAR EMPLOYEUR. Chaque couple (employé, société) se calcule
// indépendamment : aucune consolidation des rémunérations, donc aucune addition des assiettes
// entre sociétés. Un salarié payé 500 000 par SGC et 400 000 par SOFINA cotise sur 900 000 au
// total, alors qu'un salarié payé 900 000 par une seule société ne cotise que sur 750 000. C'est
// exactement ce que produit la déclaration séparée, et c'est le résultat voulu.
//
// Ce module ne connaît ni Convex ni React : il est testable isolément (`npm run test:societes`).

import { salaireDeBase } from "./paie.ts";

export const SOCIETES = ["SESAME", "SOFINA", "SGC"] as const;
export type Societe = (typeof SOCIETES)[number];

/** Jours de référence d'un mois de paie, à défaut de valeur sur la fiche ou le rattachement. */
export const JOURS_BASE_DEFAUT = 30;

export const estSociete = (x: unknown): x is Societe =>
  typeof x === "string" && (SOCIETES as readonly string[]).includes(x);

/**
 * Une ligne de la table `rattachements`, réduite à ce dont la logique a besoin.
 * Tous les champs métier sont optionnels : le rattachement porte ce que l'employeur sait, et la
 * fiche employé sert de repli pour le reste.
 */
export interface RattachementBrut {
  _id?: string;
  societe: Societe;
  /** Matricule du salarié CHEZ CET EMPLOYEUR : deux sociétés ne numérotent pas pareil. */
  matriculeEmployeur?: string;
  /** Numéro CNPS du salarié chez cet employeur (l'immatriculation peut différer). */
  cnpsEmployeur?: string;
  niuEmployeur?: string;
  /** Salaire de base versé PAR CETTE SOCIÉTÉ (hors primes, comme sur la fiche). */
  salaireBase?: number;
  joursBase?: number;
  categorie?: string;
  echelon?: string;
  contrat?: string;
  dateDebut?: string;
  dateFin?: string;
  actif: boolean;
  /** Société « porteuse » de la fiche : celle que `employes.societe` désigne. Une seule. */
  principal?: boolean;
}

/** La fiche employé, réduite aux champs qui servent de repli au rattachement. */
export interface FicheRattachable {
  societe: Societe;
  salaireBase?: number;
  /** Ancien nom du salaire de base (voir `paie.salaireDeBase`) — encore présent avant migration. */
  salaireBrut?: number;
  joursBase?: number;
  matricule?: string;
  cnps?: string;
  niu?: string;
  categorie?: string;
  echelon?: string;
  contrat?: string;
  dateDebut?: string;
}

/** Rattachement RÉSOLU : ce que la paie, le bulletin et le DIPE consomment. */
export interface Rattachement {
  rattachementId?: string;
  societe: Societe;
  salaireBase: number;
  joursBase: number;
  matriculeEmployeur?: string;
  cnpsEmployeur?: string;
  niuEmployeur?: string;
  categorie?: string;
  echelon?: string;
  contrat?: string;
  dateDebut?: string;
  dateFin?: string;
  principal: boolean;
  /**
   * `fiche` = déduit de `employes.societe` parce qu'aucune ligne de rattachement n'existe encore ;
   * `table` = ligne explicite de `rattachements`. Les deux états doivent fonctionner : c'est le
   * motif déjà employé pour `salaireBrut` → `salaireBase` (`paie.salaireDeBase`).
   */
  origine: "fiche" | "table";
}

/** Clé stable d'un couple (employé, société) : un bulletin, une saisie, une ligne d'écran. */
export const cleCouple = (employeId: string, societe: Societe) => `${employeId}:${societe}`;

/** Le rattachement IMPLICITE que porte toute fiche employé, avant comme après la migration. */
export function rattachementDeLaFiche(fiche: FicheRattachable): Rattachement {
  return {
    societe: fiche.societe,
    salaireBase: salaireDeBase(fiche),
    joursBase: fiche.joursBase ?? JOURS_BASE_DEFAUT,
    matriculeEmployeur: fiche.matricule,
    cnpsEmployeur: fiche.cnps,
    niuEmployeur: fiche.niu,
    categorie: fiche.categorie,
    echelon: fiche.echelon,
    contrat: fiche.contrat,
    dateDebut: fiche.dateDebut,
    principal: true,
    origine: "fiche",
  };
}

/** Ordre d'affichage : la société porteuse d'abord, puis l'ordre canonique SESAME / SOFINA / SGC. */
const rang = (r: Rattachement) => (r.principal ? -1 : SOCIETES.indexOf(r.societe));

/**
 * Les rattachements EFFECTIFS d'un employé, dans les deux états de la base.
 *
 * Aucune ligne active → on rend le rattachement implicite de la fiche, donc le comportement
 * d'avant la migration, à l'identique. Au moins une ligne active → elles font foi, la fiche ne
 * servant plus que de repli champ par champ.
 *
 * Les DATES ne filtrent pas : le moteur de paie n'a jamais regardé `employes.dateDebut` pour
 * décider d'émettre un bulletin (c'est l'indicateur `actif` qui le dit, et la saisie du mois qui
 * porte les jours travaillés). Les filtrer ici ferait disparaître des bulletins existants.
 */
export function rattachementsEffectifs(
  fiche: FicheRattachable,
  lignes: RattachementBrut[] = [],
): Rattachement[] {
  const actives = lignes.filter((l) => l.actif);
  if (!actives.length) return [rattachementDeLaFiche(fiche)];

  return actives
    .map((l): Rattachement => ({
      rattachementId: l._id,
      societe: l.societe,
      // Un rattachement sans montant retombe sur la fiche : la RH peut déclarer l'appartenance
      // d'abord et chiffrer ensuite, sans produire un bulletin à zéro entre-temps.
      salaireBase: l.salaireBase ?? (l.societe === fiche.societe ? salaireDeBase(fiche) : 0),
      joursBase: l.joursBase ?? fiche.joursBase ?? JOURS_BASE_DEFAUT,
      matriculeEmployeur: l.matriculeEmployeur ?? (l.societe === fiche.societe ? fiche.matricule : undefined),
      cnpsEmployeur: l.cnpsEmployeur ?? (l.societe === fiche.societe ? fiche.cnps : undefined),
      niuEmployeur: l.niuEmployeur ?? (l.societe === fiche.societe ? fiche.niu : undefined),
      categorie: l.categorie ?? fiche.categorie,
      echelon: l.echelon ?? fiche.echelon,
      contrat: l.contrat ?? fiche.contrat,
      dateDebut: l.dateDebut ?? (l.societe === fiche.societe ? fiche.dateDebut : undefined),
      dateFin: l.dateFin,
      principal: l.principal ?? false,
      origine: "table",
    }))
    .sort((a, b) => rang(a) - rang(b) || a.societe.localeCompare(b.societe));
}

/**
 * La société PORTEUSE de la fiche. Elle sert de clé de compatibilité : une saisie mensuelle ou une
 * ligne de prime enregistrée AVANT le lot R2 bis ne porte pas de société, et appartient donc à
 * celle-là. Sans ce point unique, la migration ferait disparaître les saisies déjà faites.
 */
export function societePrincipale(fiche: FicheRattachable, lignes: RattachementBrut[] = []): Societe {
  return lignes.find((l) => l.actif && l.principal)?.societe ?? fiche.societe;
}

/**
 * Retrouve, parmi des lignes datées par couple (saisie mensuelle, prime, bulletin figé), celle qui
 * relève d'une société donnée — en tolérant les lignes ANTÉRIEURES, qui n'ont pas de société et
 * appartiennent à la société porteuse de la fiche.
 */
export function pourSociete<T extends { societe?: string }>(
  lignes: T[],
  societe: Societe,
  principale: Societe,
): T | undefined {
  const exacte = lignes.find((l) => l.societe === societe);
  if (exacte) return exacte;
  return societe === principale ? lignes.find((l) => l.societe === undefined) : undefined;
}

/** Même chose, mais pour toutes les lignes du couple (registre « Primes & charges »). */
export function toutesPourSociete<T extends { societe?: string }>(
  lignes: T[],
  societe: Societe,
  principale: Societe,
): T[] {
  return lignes.filter(
    (l) => l.societe === societe || (l.societe === undefined && societe === principale),
  );
}

/** Masse des salaires de base versés par UNE société (jamais la somme de toutes : voir l'en-tête). */
export const masseParSociete = (rattachements: Rattachement[], societe: Societe) =>
  rattachements.filter((r) => r.societe === societe).reduce((t, r) => t + r.salaireBase, 0);

/**
 * Contrôles d'un rattachement avant écriture. Rendus en clair : c'est la RH qui saisit, pas un
 * développeur, et le message doit dire quoi corriger.
 */
export function erreurRattachement(
  candidat: { societe: Societe; salaireBase?: number; joursBase?: number; dateDebut?: string; dateFin?: string },
  existants: { societe: Societe; rattachementId?: string }[] = [],
  rattachementIdModifie?: string,
): string | null {
  if (!estSociete(candidat.societe)) return "Société inconnue : SESAME, SOFINA ou SGC.";
  const doublon = existants.some(
    (e) => e.societe === candidat.societe && e.rattachementId !== rattachementIdModifie,
  );
  if (doublon) return `${candidat.societe} est déjà rattachée à cet employé : modifiez le rattachement existant.`;
  if (candidat.salaireBase !== undefined) {
    if (!Number.isFinite(candidat.salaireBase) || candidat.salaireBase < 0) return "Salaire de base : montant positif attendu.";
    if (!Number.isInteger(candidat.salaireBase)) return "Salaire de base : entier FCFA attendu (pas de décimale).";
  }
  if (candidat.joursBase !== undefined && (candidat.joursBase < 1 || candidat.joursBase > 31)) {
    return "Jours de base : entre 1 et 31.";
  }
  for (const [cle, val] of [["début", candidat.dateDebut], ["fin", candidat.dateFin]] as const) {
    if (val !== undefined && val !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(val)) return `Date de ${cle} : format AAAA-MM-JJ.`;
  }
  if (candidat.dateDebut && candidat.dateFin && candidat.dateFin < candidat.dateDebut) {
    return "La date de fin précède la date de début.";
  }
  return null;
}
