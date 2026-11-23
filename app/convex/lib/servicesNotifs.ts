// Logique pure du routage par service (lot S6, correctif C1.3).
// PUR : aucun import serveur, 100 % testable isolément.

/** Normalisation alignée sur `convex/services.ts` : trim, espaces réduits, majuscules. */
export function normaliserNomService(nom: string | undefined | null): string {
  return (nom ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

export type ServiceRef = {
  id: string;
  nom: string;
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
 * Chefs du service à notifier (correctif C1.3).
 *
 * `services.chefs` est la source unique : un ou deux chefs, référencés comme identités.
 * On notifie TOUS les chefs — le schéma en prévoit deux, et n'en prévenir qu'un ferait
 * dépendre le routage de l'ordre d'un tableau.
 */
export function chefsDuService(service: ServiceRef | undefined): string[] {
  return service?.chefs?.filter(Boolean) ?? [];
}
