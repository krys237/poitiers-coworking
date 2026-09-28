/**
 * Mes bulletins — l'employé consulte et télécharge SES bulletins (demande de M. GAMBOU, 28/09/2026).
 *
 * Seuls les mois clôturés apparaissent : un bulletin provisoire peut encore changer. Le compte est relié
 * à la fiche employé dans Membres (à défaut, par l'e-mail de la fiche). Pensé d'abord pour le téléphone :
 * une carte par mois, le PDF en un geste ; l'aperçu A4 se réduit à la largeur de l'écran.
 */
import * as React from "react";
import { useAction, useQuery } from "convex/react";
import { FileTextIcon, UserXIcon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { fcfa, libellePeriode } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageEnTete } from "@/components/app/en-tete";
import { EtatVide } from "@/components/app/etat-vide";
import { SqueletteTexte } from "@/components/app/chargement";
import { BoutonPdf } from "@/components/app/bouton-pdf";
import { ApercuFeuille } from "@/components/documents/apercu-feuille";
import { BulletinCard } from "../components/BulletinCard";

export function MesBulletins() {
  const liste = useQuery(api.mesBulletins.liste);
  const pdf = useAction(api.paiePdf.pdfMonBulletin);
  const [periode, setPeriode] = React.useState<string | null>(null);
  const choisi = periode ?? liste?.bulletins[0]?.periode ?? null;
  const detail = useQuery(api.mesBulletins.detail, choisi ? { periode: choisi } : "skip");

  if (liste === undefined) return <SqueletteTexte lignes={6} />;

  return (
    <div className="space-y-4">
      <PageEnTete
        titre="Mes bulletins"
        description={liste.employe
          ? `${liste.employe.nom} · ${liste.employe.matricule} · ${liste.employe.societe}. Les bulletins des mois clôturés, à consulter ou télécharger en PDF.`
          : "Vos bulletins de paie, une fois le mois clôturé."}
      />

      {!liste.employe ? (
        <EtatVide icone={UserXIcon} titre="Votre compte n'est relié à aucune fiche employé">
          Demandez à la Direction de relier votre compte à votre fiche dans l'écran Membres. Vos bulletins apparaîtront ici.
        </EtatVide>
      ) : liste.bulletins.length === 0 ? (
        <EtatVide icone={FileTextIcon} titre="Aucun bulletin validé pour l'instant">
          Un bulletin apparaît ici dès que le mois de paie est clôturé.
        </EtatVide>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1" aria-label="Mois disponibles">
            {liste.bulletins.map((b) => (
              <li key={b.periode}>
                <button
                  type="button"
                  onClick={() => setPeriode(b.periode)}
                  aria-current={b.periode === choisi}
                  className={cn(
                    "w-full rounded-xl border bg-surface px-3.5 py-3 text-left shadow-xs transition-colors",
                    b.periode === choisi ? "border-ocean-profond ring-1 ring-ocean-profond" : "border-filet hover:border-ocean-ciel",
                  )}
                >
                  <div className="text-sm font-semibold">{libellePeriode(b.periode)}</div>
                  <div className="mt-0.5 flex items-baseline justify-between gap-2 text-xs">
                    <span className="text-encre-douce">Net à payer</span>
                    <span className="font-mono font-bold text-ocean-profond">{fcfa(b.net)}</span>
                  </div>
                  <div className="text-2xs text-encre-pale">brut {fcfa(b.brut)} · retenues {fcfa(b.retenues)}</div>
                </button>
              </li>
            ))}
          </ul>

          {choisi && (
            <section className="overflow-hidden rounded-xl border border-filet bg-surface shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-filet px-3.5 py-2.5">
                <div className="text-sm font-semibold">Bulletin de {libellePeriode(choisi)}</div>
                <BoutonPdf variant="default" titre="Télécharger ce bulletin en PDF" generer={() => pdf({ periode: choisi })}>Télécharger le PDF</BoutonPdf>
              </div>
              <div className="bg-papier p-2 sm:p-3">
                {detail === undefined ? <SqueletteTexte lignes={8} /> : <ApercuFeuille><BulletinCard b={detail.bulletin} entreprise={detail.entreprise} page="page 1/1" /></ApercuFeuille>}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
