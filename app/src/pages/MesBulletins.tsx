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
  // Un pluri-employé a un bulletin par mois ET PAR SOCIÉTÉ : chacun ne porte que la part versée
  // par cet employeur, ce qui est normal et non un oubli. La sélection est donc le couple.
  const [cle, setCle] = React.useState<string | null>(null);
  const choisi = (cle ? liste?.bulletins.find((b) => b.cle === cle) : undefined) ?? liste?.bulletins[0] ?? null;
  const detail = useQuery(api.mesBulletins.detail, choisi ? { periode: choisi.periode, societe: choisi.societe } : "skip");

  if (liste === undefined) return <SqueletteTexte lignes={6} />;

  return (
    <div className="space-y-4">
      <PageEnTete
        titre="Mes bulletins"
        description={liste.employe
          ? `${liste.employe.nom} · ${liste.employe.matricule} · ${liste.employe.societes.join(" · ")}. Les bulletins des mois clôturés, à consulter ou télécharger en PDF.${liste.employe.societes.length > 1 ? " Chaque société vous paie et vous déclare de son côté : vous avez un bulletin par société." : ""}`
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
          {/* `content-start` : sans lui la grille étire ses rangées sur la hauteur de l'aperçu et des trous apparaissent entre les mois. */}
          <ul className="grid content-start gap-2 sm:grid-cols-2 lg:grid-cols-1" aria-label="Mois disponibles">
            {liste.bulletins.map((b) => (
              <li key={b.cle}>
                <button
                  type="button"
                  onClick={() => setCle(b.cle)}
                  aria-current={b.cle === choisi?.cle}
                  className={cn(
                    "w-full rounded-xl border bg-surface px-3.5 py-3 text-left shadow-xs transition-colors",
                    b.cle === choisi?.cle ? "border-ocean-profond ring-1 ring-ocean-profond" : "border-filet hover:border-ocean-ciel",
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold">{libellePeriode(b.periode)}</span>
                    {/* La société n'apparaît que si plusieurs employeurs le rémunèrent. */}
                    {liste.employe.societes.length > 1 ? <span className="rounded-full border border-filet bg-bande px-2 py-0.5 text-[10px] font-semibold tracking-wide text-encre-douce">{b.societe}</span> : null}
                  </div>
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
                <div className="text-sm font-semibold">Bulletin de {libellePeriode(choisi.periode)}{liste.employe.societes.length > 1 ? ` — ${choisi.societe}` : ""}</div>
                <BoutonPdf variant="default" titre="Télécharger ce bulletin en PDF" generer={() => pdf({ periode: choisi.periode, societe: choisi.societe })}>Télécharger le PDF</BoutonPdf>
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
