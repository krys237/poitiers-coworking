import { useEffect, useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { PeriodePicker } from "../components/PeriodePicker";
import { BulletinCard } from "../components/BulletinCard";
import { fcfa, libellePeriode, periodeCourante } from "../lib/format";

const STATUT: Record<string, { label: string; cls: string }> = {
  envoye: { label: "Envoyé", cls: "" },
  simule: { label: "Simulé", cls: "warn" },
  echec: { label: "Échec", cls: "lock" },
};

export function Courrier() {
  const [periode, setPeriode] = useState(periodeCourante());
  const apercu = useQuery(api.courrier.apercu, { periode });
  const mode = useQuery(api.courrier.mode);
  const envoyer = useAction(api.paiePdf.envoyerCourrier);
  const modifierEmploye = useMutation(api.employes.modifier);
  const modifierCourrier = useMutation(api.parametres.modifierCourrier);

  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [modele, setModele] = useState("");
  const [modeleSale, setModeleSale] = useState(false);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [resultat, setResultat] = useState<string | null>(null);

  useEffect(() => { if (apercu && !modeleSale) setModele(apercu.modele); }, [apercu?.modele]);
  // Par défaut : tout le monde est sélectionné quand la période change.
  useEffect(() => { if (apercu) setSelection(new Set(apercu.lignes.map((l: any) => String(l.bulletin.employeId)))); }, [periode, apercu?.lignes.length]);

  const lignes = apercu?.lignes ?? [];
  const selectionnees = lignes.filter((l: any) => selection.has(String(l.bulletin.employeId)));
  const sansEmail = selectionnees.filter((l: any) => !(emails[String(l.bulletin.employeId)] ?? l.bulletin.email)).length;

  const toggle = (id: string) => setSelection((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toutSelectionner = (on: boolean) => setSelection(on ? new Set(lignes.map((l: any) => String(l.bulletin.employeId))) : new Set());

  const sauverEmail = async (id: string, email: string) => {
    await modifierEmploye({ employeId: id as any, email: email.trim() });
  };

  const lancerEnvoi = async () => {
    if (!selectionnees.length) return;
    const libelle = mode?.reel ? "ENVOYER RÉELLEMENT" : "simuler l'envoi";
    if (!confirm(`${libelle} le courrier de ${libellePeriode(periode)} à ${selectionnees.length} destinataire(s) ?`)) return;
    setEnvoiEnCours(true); setResultat(null);
    try {
      const r = await envoyer({ periode, employeIds: selectionnees.map((l: any) => l.bulletin.employeId) });
      setResultat(`Mode ${r.mode} — ${r.envoyes} envoyé(s), ${r.simules} simulé(s), ${r.echecs} échec(s) sur ${r.total} · PDF générés : ${Math.round(r.pdfOctets / 1024)} Ko.`);
    } catch (e) { setResultat(`Erreur : ${(e as Error).message}`); }
    finally { setEnvoiEnCours(false); }
  };

  return (
    <>
      <div className="no-print">
        <h1>Courrier de paie</h1>
        <p className="sub">Une lettre d'accompagnement + le bulletin de chaque employé — à imprimer (une page par personne) ou à envoyer par e-mail avec le PDF (lettre + bulletin) en pièce jointe.</p>

        <div className="bar">
          <PeriodePicker value={periode} onChange={setPeriode} />
          <b>{libellePeriode(periode)}</b>
          {apercu?.cloture ? <span className="badge lock">Mois clôturé</span> : <span className="badge">Mois ouvert</span>}
          {mode && (mode.reel
            ? <span className="badge">Envoi réel (Resend)</span>
            : <span className="badge warn">Mode simulation — définir RESEND_API_KEY pour envoyer réellement</span>)}
        </div>
        {apercu?.erreur && <p className="err">{apercu.erreur}</p>}

        <div className="form" style={{ gridTemplateColumns: "1fr" }}>
          <label>
            Modèle de lettre — variables : <code>{"{nom}"}</code> <code>{"{periode}"}</code> <code>{"{net}"}</code> <code>{"{entreprise}"}</code>
            <textarea rows={8} value={modele} onChange={(e) => { setModele(e.target.value); setModeleSale(true); }}
              style={{ font: "inherit", padding: 8, border: "1px solid var(--line)", borderRadius: 6, width: "100%" }} />
          </label>
          <div className="bar" style={{ marginBottom: 0 }}>
            <button className="btn primary" disabled={!modeleSale} onClick={async () => { await modifierCourrier({ modeleCourrier: modele }); setModeleSale(false); }}>
              Enregistrer le modèle
            </button>
            <span style={{ color: "var(--ink-faint)", fontSize: 12 }}>Expéditeur : {apercu?.entreprise?.emailExpediteur ?? "onboarding@resend.dev (à configurer dans Paramètres)"}</span>
          </div>
        </div>

        <div className="bar">
          <label><input type="checkbox" checked={selection.size === lignes.length && lignes.length > 0} onChange={(e) => toutSelectionner(e.target.checked)} /> Tout sélectionner</label>
          <span className="grow" />
          <span>{selectionnees.length} destinataire(s){sansEmail ? ` · ${sansEmail} sans e-mail` : ""}</span>
          <button className="btn" onClick={() => { setPreview(true); setTimeout(() => window.print(), 300); }} disabled={!selectionnees.length}>Aperçu &amp; Imprimer / PDF</button>
          <button className="btn green" onClick={lancerEnvoi} disabled={!selectionnees.length || envoiEnCours}>
            {envoiEnCours ? "Envoi…" : `Envoyer par e-mail (${selectionnees.length})`}
          </button>
        </div>
        {resultat && <div className="note">{resultat}</div>}

        <div className="tbl-wrap">
          <table className="grid">
            <thead><tr><th></th><th>Employé</th><th>E-mail</th><th className="num">Net</th><th>Dernier envoi</th></tr></thead>
            <tbody>
              {lignes.map((l: any) => {
                const id = String(l.bulletin.employeId);
                const d = l.dernierEnvoi;
                return (
                  <tr key={id}>
                    <td><input type="checkbox" checked={selection.has(id)} onChange={() => toggle(id)} /></td>
                    <td><b>{l.bulletin.nom}</b><br /><small style={{ color: "var(--ink-faint)" }}>{l.bulletin.societe}</small></td>
                    <td>
                      <input type="email" placeholder="adresse e-mail de l'employé" style={{ width: 260, textAlign: "left" }}
                        value={emails[id] ?? l.bulletin.email ?? ""}
                        onChange={(e) => setEmails((m) => ({ ...m, [id]: e.target.value }))}
                        onBlur={(e) => { if (e.target.value !== (l.bulletin.email ?? "")) sauverEmail(id, e.target.value); }} />
                    </td>
                    <td className="num">{fcfa(l.bulletin.net)}</td>
                    <td>{d ? <><span className={`badge ${STATUT[d.statut].cls}`}>{STATUT[d.statut].label}</span> <small style={{ color: "var(--ink-faint)" }}>{new Date(d.envoyeLe).toLocaleString("fr-FR")}{d.erreur ? ` — ${d.erreur}` : ""}</small></> : <small style={{ color: "var(--ink-faint)" }}>—</small>}</td>
                  </tr>
                );
              })}
              {apercu && lignes.length === 0 && <tr><td colSpan={5}>Aucun employé actif.</td></tr>}
            </tbody>
          </table>
        </div>

        {lignes.length > 0 && (
          <p style={{ marginTop: 14 }}>
            <button className="btn" onClick={() => setPreview((p) => !p)}>{preview ? "Masquer l'aperçu" : "Afficher l'aperçu"}</button>
          </p>
        )}
      </div>

      {preview && selectionnees.map((l: any) => (
        <section className="courrier-page" key={String(l.bulletin.employeId)}>
          <div className="lettre">
            <div className="lettre-head">
              <div className="co" style={{ color: apercu?.entreprise?.couleurEntete ?? undefined }}>{apercu?.entreprise?.nom}</div>
              <div className="addr">{apercu?.entreprise?.adresse}</div>
            </div>
            <div className="lettre-corps">{l.lettre}</div>
          </div>
          <BulletinCard b={l.bulletin} periode={periode} entreprise={apercu?.entreprise} />
        </section>
      ))}
    </>
  );
}
