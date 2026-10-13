/**
 * Changement de mot de passe par le membre : l'actuel, le nouveau, sa confirmation. Partagé par
 * « Mon compte » et par l'écran imposé à la première connexion (mot de passe provisoire).
 * Les règles (8 caractères, lettres et chiffres) sont celles du serveur : convex/lib/motDePasse.ts.
 */
import * as React from "react";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { EyeIcon, EyeOffIcon, KeyRoundIcon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { LONGUEUR_MIN, erreurNouveauMotDePasse } from "../../convex/lib/motDePasse";
import { messageErreur } from "@/lib/format";
import { Champ, GrilleFormulaire } from "@/components/app/champs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function FormulaireMotDePasse({ onChange, libelleValider = "Changer mon mot de passe", provisoire }: {
  /** Appelé après un changement réussi. */
  onChange?: () => void;
  libelleValider?: string;
  /** L'actuel est le mot de passe provisoire remis par la Direction : on le dit. */
  provisoire?: boolean;
}) {
  const changer = useAction(api.compte.changerMotDePasse);
  const [ancien, setAncien] = React.useState("");
  const [nouveau, setNouveau] = React.useState("");
  const [confirmation, setConfirmation] = React.useState("");
  const [voir, setVoir] = React.useState(false);
  const [enCours, setEnCours] = React.useState(false);

  const aideNouveau = nouveau ? erreurNouveauMotDePasse(nouveau, ancien || undefined) : null;
  const aideConfirmation = confirmation && confirmation !== nouveau ? "Les deux saisies ne correspondent pas." : null;
  const pret = !!ancien && !!nouveau && !aideNouveau && confirmation === nouveau;

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pret) return;
    setEnCours(true);
    try {
      await changer({ ancien, nouveau });
      toast.success("Mot de passe changé", { description: "Utilisez-le dès votre prochaine connexion." });
      setAncien(""); setNouveau(""); setConfirmation("");
      onChange?.();
    } catch (err) {
      toast.error("Le mot de passe n'a pas été changé", { description: messageErreur(err) });
    } finally { setEnCours(false); }
  };

  const type = voir ? "text" : "password";
  return (
    <form onSubmit={soumettre} className="space-y-3">
      <GrilleFormulaire className="mb-0">
        <div className="[grid-column:1/-1]">
          <Champ libelle={provisoire ? "Mot de passe provisoire (reçu de la Direction)" : "Mot de passe actuel"} requis>
            {(a) => <Input {...a} type={type} autoComplete="current-password" value={ancien} onChange={(e) => setAncien(e.target.value)} required />}
          </Champ>
        </div>
        <Champ libelle="Nouveau mot de passe" requis aide={aideNouveau ? undefined : `${LONGUEUR_MIN} caractères au moins, avec des lettres et des chiffres`} erreur={aideNouveau ?? undefined}>
          {(a) => <Input {...a} type={type} autoComplete="new-password" value={nouveau} onChange={(e) => setNouveau(e.target.value)} required minLength={LONGUEUR_MIN} />}
        </Champ>
        <Champ libelle="Confirmer le nouveau mot de passe" requis erreur={aideConfirmation ?? undefined}>
          {(a) => <Input {...a} type={type} autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required />}
        </Champ>
      </GrilleFormulaire>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setVoir((v) => !v)} aria-pressed={voir}>
          {voir ? <EyeOffIcon /> : <EyeIcon />} {voir ? "Masquer" : "Afficher"} les mots de passe
        </Button>
        <Button type="submit" disabled={!pret || enCours}><KeyRoundIcon /> {enCours ? "Enregistrement…" : libelleValider}</Button>
      </div>
    </form>
  );
}
