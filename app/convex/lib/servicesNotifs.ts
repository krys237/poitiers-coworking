// Logique pure du routage par service (lot S6).
// PUR : aucun import serveur, 100 % testable isolément.

/** Normalisation alignée sur `convex/services.ts` : trim, espaces réduits, majuscules. */
export function normaliserNomService(nom: string | undefined | null): string {
  return (nom ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

export type ServiceRef = {
  id: string;
  nom: string;
  responsableId?: string;
  chefs?: string[];
};

/**
 * Service d'affectation d'un membre (spec S6 §3.1) :
 * `membre.serviceId` est prioritaire sur `fiche?.serviceId` ; `undefined` sinon.
 */
export function serviceDuMembre(
  membre: { serviceId?: string | null },
  fiche?: { serviceId?: string | null } | null,
): string | undefined {
  if (membre.serviceId) return membre.serviceId;
  if (fiche?.serviceId) return fiche.serviceId;
  return undefined;
}

/**
 * Service concerné par un objet (commande, intervention — spec S6 §3.3) :
 * `serviceId` d'abord ; à défaut, rapprochement du champ texte libre par nom normalisé.
 */
export function serviceDeLObjet(
  objet: { serviceId?: string | null; service?: string | null },
  services: ServiceRef[],
): ServiceRef | undefined {
  if (objet.serviceId) {
    const trouve = services.find((s) => s.id === objet.serviceId);
    if (trouve) return trouve;
  }
  const cle = normaliserNomService(objet.service);
  if (!cle) return undefined;
  return services.find((s) => normaliserNomService(s.nom) === cle);
}

/**
 * Responsable du service à notifier (spec S6 §3.2).
 * Utilise `responsableId` en priorité, avec repli sur le premier chef (`chefs[0]`) déjà
 * présent dans le référentiel des services.
 */
export function responsableDuService(service: ServiceRef | undefined): string | undefined {
  if (!service) return undefined;
  return service.responsableId ?? service.chefs?.[0] ?? undefined;
}
