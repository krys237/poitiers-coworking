/**
 * Mon compte — l'identité du membre connecté et le changement de son mot de passe (décision du 13/10/2026).
 * Les champs d'identité se modifient dans Membres (Direction) : ici on les lit, on ne les change pas.
 */
import { KeyRoundIcon, UserRoundIcon } from "lucide-react";
import { useMe } from "@/auth/useMe";
import { FormulaireMotDePasse } from "@/auth/FormulaireMotDePasse";
import { formaterTelephone } from "../../convex/lib/telephone";
import { estEmailTechnique } from "../../convex/lib/motDePasse";
import { PageEnTete } from "@/components/app/en-tete";
import { SqueletteTexte } from "@/components/app/chargement";
import { Avis } from "@/components/app/avis";
import { Flag } from "@/components/ui/flag";

export function MonCompte() {
  const me = useMe();
  if (!me) return <SqueletteTexte lignes={6} />;
  const lignes: [string, React.ReactNode][] = [
    ["Nom", me.nom ?? <span className="text-encre-pale">(sans nom)</span>],
    ["Rôle", `${me.roleLibelle}${me.niveau ? ` · niveau ${me.niveau}` : ""}`],
    ["Téléphone", me.phone ? formaterTelephone(me.phone) : <span className="text-encre-pale">non renseigné</span>],
    ["E-mail", estEmailTechnique(me.email) ? <span className="text-encre-pale">aucun · connexion par téléphone</span> : me.email],
    ["Poste", me.poste ? `${me.poste}${me.departement ? ` · ${me.departement}` : ""}` : <span className="text-encre-pale">—</span>],
    ["Société", me.societe ?? <span className="text-encre-pale">—</span>],
  ];
  return (
    <div className="space-y-4">
      <PageEnTete
        titre="Mon compte"
        description="Vos identifiants de connexion et votre mot de passe. Pour corriger un nom, un téléphone ou un poste, adressez-vous à la Direction (écran Membres)."
        statut={me.doitChangerMotDePasse ? <Flag variant="a-renseigner" size="sm">mot de passe provisoire</Flag> : <Flag variant="renseigne" size="sm">compte actif</Flag>}
      />

      {me.doitChangerMotDePasse && (
        <Avis ton="attention" titre="Votre mot de passe est provisoire">
          Il a été posé par la Direction. Choisissez le vôtre ci-dessous : il sera demandé à chaque connexion.
        </Avis>
      )}

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <section className="rounded-xl border border-filet bg-surface p-4 shadow-xs" aria-labelledby="identite">
          <div className="mb-3 flex items-center gap-2 border-b border-filet pb-2">
            <UserRoundIcon className="h-4 w-4 text-ocean-profond" aria-hidden="true" />
            <h2 id="identite" className="text-xs font-bold uppercase tracking-wider text-encre">Identité</h2>
          </div>
          <dl className="space-y-2">
            {lignes.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-3 text-xs">
                <dt className="shrink-0 text-encre-douce">{k}</dt>
                <dd className="min-w-0 truncate text-right font-semibold text-encre">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-2xs text-encre-pale">Vous vous connectez avec votre numéro de téléphone{estEmailTechnique(me.email) ? "" : " ou votre e-mail"}, et votre mot de passe.</p>
        </section>

        <section className="rounded-xl border border-filet bg-surface p-4 shadow-xs" aria-labelledby="mdp">
          <div className="mb-3 flex items-center gap-2 border-b border-filet pb-2">
            <KeyRoundIcon className="h-4 w-4 text-ocean-profond" aria-hidden="true" />
            <h2 id="mdp" className="text-xs font-bold uppercase tracking-wider text-encre">Mot de passe</h2>
          </div>
          <FormulaireMotDePasse provisoire={me.doitChangerMotDePasse} />
          <p className="mt-3 text-2xs text-encre-pale">Mot de passe oublié ? La Direction peut le réinitialiser depuis Membres : vous recevrez un mot de passe provisoire à changer à la connexion suivante.</p>
        </section>
      </div>
    </div>
  );
}
