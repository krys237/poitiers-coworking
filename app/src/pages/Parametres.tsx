import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { messageErreur } from "../lib/format";

export function Parametres() {
  const p = useQuery(api.parametres.get);
  const save = useMutation(api.parametres.enregistrer);
  const [f, setF] = useState({ nom: "", adresse: "", logoUrl: "", filigrane: "", couleurEntete: "#0f2a44", emailExpediteur: "", congesParMois: "1.5", niu: "", numeroCnps: "", responsableRH: "", jourPaiement: "5" });
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (p) setF({
      nom: p.nom, adresse: p.adresse, logoUrl: p.logoUrl ?? "", filigrane: p.filigrane ?? "", couleurEntete: p.couleurEntete ?? "#0f2a44",
      emailExpediteur: p.emailExpediteur ?? "", congesParMois: String(p.congesParMois ?? 1.5),
      niu: p.niu ?? "", numeroCnps: p.numeroCnps ?? "", responsableRH: p.responsableRH ?? "", jourPaiement: String(p.jourPaiement ?? 5),
    });
  }, [p]);

  return (
    <>
      <h1>Paramètres de l'entreprise</h1>
      <p className="sub">En-tête, filigrane et identifiants des documents générés, expéditeur des courriers de paie, règles de congés et de paiement.</p>
      <form className="form" onSubmit={async (e) => {
        e.preventDefault();
        try {
          await save({
            nom: f.nom, adresse: f.adresse, couleurEntete: f.couleurEntete,
            logoUrl: f.logoUrl || undefined, filigrane: f.filigrane || undefined, emailExpediteur: f.emailExpediteur || undefined,
            modeleCourrier: p?.modeleCourrier, congesParMois: Number(f.congesParMois) || 1.5,
            niu: f.niu || undefined, numeroCnps: f.numeroCnps || undefined, responsableRH: f.responsableRH || undefined,
            jourPaiement: Math.min(28, Math.max(1, Number(f.jourPaiement) || 5)),
          });
          setMsg("Paramètres enregistrés.");
        } catch (err) { setMsg(`Erreur : ${messageErreur(err)}`); }
      }}>
        <label>Nom<input value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} required /></label>
        <label>Adresse<input value={f.adresse} onChange={(e) => setF({ ...f, adresse: e.target.value })} required /></label>
        <label>NIU (entreprise)<input value={f.niu} onChange={(e) => setF({ ...f, niu: e.target.value })} placeholder="M0…" /></label>
        <label>N° CNPS employeur<input value={f.numeroCnps} onChange={(e) => setF({ ...f, numeroCnps: e.target.value })} /></label>
        <label>Responsable RH (visa des bulletins)<input value={f.responsableRH} onChange={(e) => setF({ ...f, responsableRH: e.target.value })} placeholder="Nom du signataire" /></label>
        <label>Jour de paiement (mois suivant)<input type="number" min={1} max={28} value={f.jourPaiement} onChange={(e) => setF({ ...f, jourPaiement: e.target.value })} /></label>
        <label>Logo (URL)<input value={f.logoUrl} onChange={(e) => setF({ ...f, logoUrl: e.target.value })} /></label>
        <label>Filigrane PDF<input value={f.filigrane} onChange={(e) => setF({ ...f, filigrane: e.target.value })} /></label>
        <label>Couleur d'en-tête<input type="color" value={f.couleurEntete} onChange={(e) => setF({ ...f, couleurEntete: e.target.value })} /></label>
        <label>E-mail expéditeur (courrier de paie)<input type="email" placeholder="paie@votre-domaine.com" value={f.emailExpediteur} onChange={(e) => setF({ ...f, emailExpediteur: e.target.value })} /></label>
        <label>Congés acquis par mois de service (jours)<input type="number" step="0.5" min="0" value={f.congesParMois} onChange={(e) => setF({ ...f, congesParMois: e.target.value })} /></label>
        <label>&nbsp;<button className="btn primary" type="submit">Enregistrer</button></label>
      </form>
      {msg && <div className="note">{msg}</div>}
      <div className="note" style={{ borderColor: "#2660a4", background: "#e2ecf7" }}>
        <b>Envoi d'e-mails.</b> Définir <code>RESEND_API_KEY</code> sur le déploiement Convex (<code>npx convex env set RESEND_API_KEY re_…</code>) pour activer l'envoi réel.
        L'expéditeur doit appartenir à un domaine vérifié chez Resend ; sans domaine, <code>onboarding@resend.dev</code> ne peut écrire qu'à l'adresse de votre compte Resend.
      </div>
    </>
  );
}
