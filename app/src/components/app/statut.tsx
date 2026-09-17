import { LockIcon, CircleDotIcon, ClockIcon, CheckIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * Statuts metier.
 *
 * Un statut se nomme par son SENS, jamais par sa couleur. Le tableau ci-dessous
 * est le dictionnaire unique de la plateforme : si un ecran a besoin d'un etat
 * qui n'y figure pas, on l'ajoute ici plutot que d'ecrire un badge ad hoc —
 * c'est ce qui garantit que « cloture » a la meme tete sur les 21 ecrans.
 *
 * Chaque etat porte une icone en plus de la couleur : la couleur seule ne
 * suffit pas (daltonisme, impression en noir et blanc).
 */
const ETATS = {
  // Paie et grand livre
  ouvert: { libelle: "Ouvert — recalcul en direct", variant: "succes", Icone: CircleDotIcon },
  cloture: { libelle: "Cloture — lecture seule", variant: "verrou", Icone: LockIcon },

  // Cycle de validation (commandes, interventions)
  en_attente: { libelle: "En attente", variant: "attente", Icone: ClockIcon },
  validee: { libelle: "Validee", variant: "succes", Icone: CheckIcon },
  rejetee: { libelle: "Rejetee", variant: "verrou", Icone: XIcon },
  livree: { libelle: "Livree", variant: "info", Icone: CheckIcon },
  en_cours: { libelle: "En cours", variant: "info", Icone: CircleDotIcon },

  // Presence
  soumis: { libelle: "Soumis", variant: "succes", Icone: CheckIcon },
  hors_fenetre: { libelle: "Hors fenetre", variant: "attente", Icone: ClockIcon },
  non_soumis: { libelle: "En attente", variant: "attente", Icone: ClockIcon },

  // Configuration
  configure: { libelle: "Configuree", variant: "succes", Icone: CheckIcon },
  absent: { libelle: "Absente", variant: "verrou", Icone: XIcon },
  non_saisi: { libelle: "Non saisie", variant: "attente", Icone: ClockIcon },

  // Etats generiques
  actif: { libelle: "Actif", variant: "succes", Icone: CircleDotIcon },
  inactif: { libelle: "Inactif", variant: "neutre", Icone: XIcon },
} as const;

export type Etat = keyof typeof ETATS;

export function Statut({
  etat,
  children,
  sansIcone,
}: {
  etat: Etat;
  /** Remplace le libelle par defaut, en gardant couleur et icone. */
  children?: React.ReactNode;
  sansIcone?: boolean;
}) {
  const { libelle, variant, Icone } = ETATS[etat];
  return (
    <Badge variant={variant}>
      {sansIcone ? null : <Icone aria-hidden="true" />}
      {children ?? libelle}
    </Badge>
  );
}

/**
 * Raccourci pour l'etat d'une periode de paie ou d'un mois financier —
 * l'information la plus repetee de la plateforme.
 */
export function StatutMois({ cloture }: { cloture: boolean | undefined }) {
  if (cloture === undefined) return null;
  return <Statut etat={cloture ? "cloture" : "ouvert"} />;
}
