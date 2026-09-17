import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Slot } from "radix-ui";

/**
 * Le badge « tampon ».
 *
 * Angles droits et filet apparent : dans un registre, un statut est un tampon
 * appose, pas une pastille. Cela le distingue aussi nettement des boutons, qui
 * eux sont arrondis — on ne clique pas sur un statut.
 *
 * Les variantes portent les etats METIER de la plateforme, pas des couleurs :
 * on ecrit `variant="verrou"`, jamais `variant="rouge"`.
 */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-sm border px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        /** Etat nominal : ouvert, actif, conforme, configure. */
        succes: "border-sceau/30 bg-sceau-clair text-sceau",
        /** Attente d'une action : non saisi, en attente de validation. */
        attente: "border-ocre/30 bg-ocre-clair text-ocre",
        /** Fige ou interdit : mois cloture, document verrouille, cle absente. */
        verrou: "border-carmin/30 bg-carmin-clair text-carmin",
        /** Information neutre : reference, categorie, societe. */
        info: "border-ardoise/30 bg-ardoise-clair text-ardoise",
        /** Sans couleur : compteurs, libelles secondaires. */
        neutre: "border-filet bg-bande text-encre-douce",
        /** Plein, pour un statut qui doit dominer la ligne. */
        plein: "border-transparent bg-sceau text-primary-foreground",
      },
    },
    defaultVariants: {
      variant: "neutre",
    },
  }
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
