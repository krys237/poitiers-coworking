// Périmètre d'un membre sur les ENTITÉS (personnes morales) — logique PURE.
//
// Trois questions, et rien d'autre : quelles entités un membre atteint, quel rôle il y porte, et
// quels droits il y a. Ce module ne connaît ni Convex ni React : il est testable isolément
// (`npm run test:perimetre`).
//
// ⚠️ Une ENTITÉ n'est pas un DÉCLARANT. L'entité est la personne morale — POLYCLINIQUE DE
// POITIERS, EDR-TIM, LES LILAS — et c'est l'espace de travail. Le déclarant (`SESAME | SOFINA |
// SGC`, champ `societe`) est l'employeur au sens de la déclaration de paie, transversal aux
// entités. Voir `docs/multi-societe/MODELE.md` § 1 et § 1 bis.
//
// RÈGLE DE SÉCURITÉ, et c'est la seule qui ne se négocie pas : **le périmètre ne se déduit jamais
// de ce que le client envoie.** Le client propose une entité, le serveur la vérifie ici. C'est le
// seul endroit où cette vérification vit — la dupliquer ailleurs, c'est accepter qu'elle diverge.

import { NIVEAU, droitsEffectifs, type Role, type Droits, type Action, type SurchargeRole, type Exception } from "../rbac.ts";

/** Une ligne de `accesEntites`, réduite à ce dont la logique a besoin. */
export interface AccesEntite {
  entiteId: string;
  /** Rôle porté DANS cette entité. Absent = le rôle global du membre. */
  role?: string;
  /** Exceptions par module, bornées à cette entité. */
  droitsPerso?: Exception[];
  actif: boolean;
}

/** Le membre, réduit à ce dont la logique a besoin. */
export interface MembrePerimetre {
  role: Role;
  /** Entité d'appartenance. Absente = membre sans entité (compte technique, par exemple). */
  entitePrincipaleId?: string;
}

/** Une entité, réduite à ce qui sert au filtrage et au tri. */
export interface EntiteBrute {
  entiteId: string;
  nom: string;
  actif: boolean;
  ordre: number;
}

/**
 * Le niveau à partir duquel un rôle atteint toutes les entités sans ligne d'accès.
 *
 * Décision du propriétaire du 26/11/2026 : le **DG** (7) comme le **super administrateur** (8)
 * y accèdent implicitement — « quelque part c'est un admin, le dev est juste le super ». Tout rôle
 * en dessous n'atteint que son entité principale et ses accès explicites.
 *
 * ⚠️ L'`auditeur_externe` porte le niveau **0** (hors hiérarchie, orthogonal) : il n'est donc
 * jamais implicite, et c'est voulu — on lui ouvre nommément les sociétés qu'il audite.
 */
export const NIVEAU_TOUTES_ENTITES = 7;

/** Le super administrateur voit AUSSI les entités désactivées : sans lui, nul ne pourrait en rouvrir une. */
const NIVEAU_VOIT_INACTIVES = 8;

const parOrdre = (a: EntiteBrute, b: EntiteBrute) => a.ordre - b.ordre || a.nom.localeCompare(b.nom);

/** L'accès ACTIF d'un membre sur une entité, s'il en a un. */
const accesActif = (acces: AccesEntite[], entiteId: string): AccesEntite | undefined =>
  acces.find((a) => a.actif && a.entiteId === entiteId);

/**
 * Les entités qu'un membre peut atteindre, dans l'ordre d'affichage du sélecteur :
 * son entité principale d'abord, puis ses accès, triés par `ordre` puis par `nom`.
 */
export function entitesAccessibles(
  membre: MembrePerimetre,
  acces: AccesEntite[],
  entites: EntiteBrute[],
): EntiteBrute[] {
  const niveau = NIVEAU[membre.role] ?? 0;
  const visibles = entites.filter((e) => e.actif || niveau >= NIVEAU_VOIT_INACTIVES);

  if (niveau >= NIVEAU_TOUTES_ENTITES) {
    // Même pour un implicite, l'entité principale passe devant : c'est son chez-lui.
    const principale = visibles.filter((e) => e.entiteId === membre.entitePrincipaleId);
    const autres = visibles.filter((e) => e.entiteId !== membre.entitePrincipaleId).sort(parOrdre);
    return [...principale, ...autres];
  }

  const atteintes = new Set<string>();
  if (membre.entitePrincipaleId) atteintes.add(membre.entitePrincipaleId);
  for (const a of acces) if (a.actif) atteintes.add(a.entiteId);

  // Une entité hors de `visibles` est écartée même si un accès la désigne : désactivée, elle ne
  // s'ouvre pas par une ligne oubliée.
  const retenues = visibles.filter((e) => atteintes.has(e.entiteId));
  const principale = retenues.filter((e) => e.entiteId === membre.entitePrincipaleId);
  const autres = retenues.filter((e) => e.entiteId !== membre.entitePrincipaleId).sort(parOrdre);
  return [...principale, ...autres];
}

/** Le membre atteint-il cette entité ? */
export function atteintEntite(membre: MembrePerimetre, acces: AccesEntite[], entites: EntiteBrute[], entiteId: string): boolean {
  return entitesAccessibles(membre, acces, entites).some((e) => e.entiteId === entiteId);
}

/**
 * Le rôle d'un membre DANS une entité : celui de son accès s'il en porte un, sinon son rôle global.
 * `null` si l'entité est hors de son périmètre.
 *
 * **Un accès ne peut jamais porter un rôle d'un niveau supérieur au rôle global du membre.** Sans
 * cette borne, l'écran d'attribution deviendrait une porte d'escalade de privilèges : accorder une
 * société à un comptable en le nommant DG dessus lui donnerait des droits qu'il n'a pas ailleurs.
 */
export function roleDansEntite(
  membre: MembrePerimetre,
  acces: AccesEntite[],
  entites: EntiteBrute[],
  entiteId: string,
): Role | null {
  if (!atteintEntite(membre, acces, entites, entiteId)) return null;
  const a = accesActif(acces, entiteId);
  if (!a?.role) return membre.role;
  const demande = a.role as Role;
  if (NIVEAU[demande] === undefined) return membre.role;      // rôle inconnu : on ne promeut pas
  return (NIVEAU[demande] ?? 0) > (NIVEAU[membre.role] ?? 0) ? membre.role : demande;
}

/**
 * Les droits effectifs d'un membre dans une entité, ou `null` si elle est hors périmètre.
 *
 * La composition va du plus général au plus spécifique : défaut du rôle retenu → surcharges
 * globales de rôle → exceptions globales du membre → exceptions de l'accès. Les exceptions de
 * l'accès passent **en tête** du tableau parce que `rbac.droitsEffectifs` retient la première
 * correspondance : le plus spécifique gagne.
 */
export function droitsDansEntite(
  membre: MembrePerimetre,
  acces: AccesEntite[],
  entites: EntiteBrute[],
  entiteId: string,
  surchargesGlobales: SurchargeRole[] = [],
  exceptionsGlobales: Exception[] = [],
): Droits | null {
  const role = roleDansEntite(membre, acces, entites, entiteId);
  if (!role) return null;
  const a = accesActif(acces, entiteId);
  return droitsEffectifs(role, surchargesGlobales, [...(a?.droitsPerso ?? []), ...exceptionsGlobales]);
}

/** Raccourci de lisibilité : le membre peut-il cette action, sur ce module, dans cette entité ? */
export function peutDansEntite(
  membre: MembrePerimetre,
  acces: AccesEntite[],
  entites: EntiteBrute[],
  entiteId: string,
  module: string,
  action: Action = "voir",
  surchargesGlobales: SurchargeRole[] = [],
  exceptionsGlobales: Exception[] = [],
): boolean {
  const d = droitsDansEntite(membre, acces, entites, entiteId, surchargesGlobales, exceptionsGlobales);
  return !!d?.[module]?.[action];
}

/**
 * Le rôle qu'un auteur peut accorder sur une entité : jamais au-dessus du sien.
 *
 * Même règle que `users.modifier` — « nul n'attribue un rôle au-dessus du sien » — appliquée ici à
 * l'attribution d'accès. Exposée pour que l'écran n'ait pas à la redéduire.
 */
export function peutAccorderRole(auteur: Role, role: Role): boolean {
  return (NIVEAU[role] ?? 0) <= (NIVEAU[auteur] ?? 0);
}
