import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function Parametres() {
  const p = useQuery(api.parametres.get);
  const save = useMutation(api.parametres.enregistrer);
  const [f, setF] = useState({ nom: "", adresse: "", logoUrl: "", filigrane: "", couleurEntete: "#0f2a44", emailExpediteur: "", congesParMois: "1.5" });
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (p) setF({ nom: p.nom, adresse: p.adresse, logoUrl: p.logoUrl ?? "", filigrane: p.filigrane ?? "", couleurEntete: p.couleurEntete ?? "#0f2a44", emailExpediteur: p.emailExpediteur ?? "", congesParMois: String(p.congesParMois ?? 1.5) });
  }, [p]);

  return (
    <>
      <h1>Paramètres de l'entreprise</h1>
      <p className="sub">En-tête et filigrane des documents générés, expéditeur des courriers de paie, règles de congés.</p>
      <form className="form" onSubmit={async (e) => {
        e.preventDefault();
        await save({ nom: f.nom, adresse: f.adresse, couleurEntete: f.couleurEntete,
          logoUrl: f.logoUrl || undefined, filigrane: f.filigrane || undefined, emailExpediteur: f.emailExpediteur || undefined,
          modeleCourrier: p?.modeleCourrier, congesParMois: Number(f.congesParMois) || 1.5 });
        setOk(true);
      }}>
        <label>Nom<input value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} required /></label>
        <label>Adresse<input value={f.adresse} onChange={(e) => setF({ ...f, adresse: e.target.value })} required /></label>
        <label>Logo (URL)<input value={f.logoUrl} onChange={(e) => setF({ ...f, logoUrl: e.target.value })} /></label>
        <label>Filigrane PDF<input value={f.filigrane} onChange={(e) => setF({ ...f, filigrane: e.target.value })} /></label>
        <label>Couleur d'en-tête<input type="color" value={f.couleurEntete} onChange={(e) => setF({ ...f, couleurEntete: e.target.value })} /></label>
        <label>E-mail expéditeur (courrier de paie)<input type="email" placeholder="paie@votre-domaine.com" value={f.emailExpediteur} onChange={(e) => setF({ ...f, emailExpediteur: e.target.value })} /></label>
        <label>Congés acquis par mois de service (jours)<input type="number" step="0.5" min="0" value={f.congesParMois} onChange={(e) => setF({ ...f, congesParMois: e.target.value })} /></label>
        <label>&nbsp;<button className="btn primary" type="submit">Enregistrer</button></label>
      </form>
      {ok && <div className="note">Paramètres enregistrés.</div>}
      <div className="note" style={{ borderColor: "#2660a4", background: "#e2ecf7" }}>
        <b>Envoi d'e-mails.</b> Définir <code>RESEND_API_KEY</code> sur le déploiement Convex (<code>npx convex env set RESEND_API_KEY re_…</code>) pour activer l'envoi réel.
        L'expéditeur doit appartenir à un domaine vérifié chez Resend ; sans domaine, <code>onboarding@resend.dev</code> ne peut écrire qu'à l'adresse de votre compte Resend.
      </div>
    </>
  );
}
