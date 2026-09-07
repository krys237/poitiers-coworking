import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { PeriodePicker } from "../components/PeriodePicker";
import { Barres } from "../components/Barres";
import { fcfa, libellePeriode, periodeCourante, messageErreur } from "../lib/format";
import { parseCsvAudit, exportCsvAudit } from "../../convex/lib/audit";

type Onglet = "resume" | "salaires" | "graphes" | string;
const FORM_VIDE = { ligneId: "", designation: "", dateDebut: "", dateFin: "", montant: "", notes: "" };
const fmtDate = (s?: string) => (s ? new Date(s + "T00:00:00").toLocaleDateString("fr-FR") : "—");
const pct = (p: number | null) => (p === null ? "—" : `${p > 0 ? "+" : ""}${p.toLocaleString("fr-FR")} %`);

function telecharger(nom: string, contenu: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([contenu], { type: "text/csv;charset=utf-8" })); a.download = nom; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function Audit() {
  const [periode, setPeriode] = useState(periodeCourante());
  const [onglet, setOnglet] = useState<Onglet>("resume");
  const categories = useQuery(api.audit.categories);
  const resume = useQuery(api.audit.resume, { periode });
  const estCat = !["resume", "salaires", "graphes"].includes(onglet);
  const lignes = useQuery(api.audit.lignes, estCat ? { periode, categorie: onglet } : "skip");
  const rapport = useQuery(api.audit.rapport, estCat ? { periode, categorie: onglet } : "skip");
  const salaires = useQuery(api.audit.totalSalaires, onglet === "salaires" ? { periode } : "skip");
  const graphes = useQuery(api.audit.graphes, onglet === "graphes" ? { periode } : "skip");
  const enregistrer = useMutation(api.audit.enregistrerLigne);
  const supprimer = useMutation(api.audit.supprimerLigne);
  const importer = useMutation(api.audit.importerLignes);
  const enregistrerRapport = useMutation(api.audit.enregistrerRapport);

  const [f, setF] = useState(FORM_VIDE);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [texte, setTexte] = useState(""); const [texteSale, setTexteSale] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { if (!texteSale) setTexte(rapport?.contenu ?? ""); }, [rapport?.contenu, onglet, periode]);
  useEffect(() => { setF(FORM_VIDE); setConfirmId(null); setTexteSale(false); }, [onglet, periode]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const montant = parseInt(f.montant.replace(/[^\d-]/g, ""), 10);
    if (!f.designation.trim() || !Number.isFinite(montant)) return;
    try {
      await enregistrer({ ligneId: f.ligneId ? (f.ligneId as any) : undefined, periode, categorie: onglet, designation: f.designation, dateDebut: f.dateDebut || undefined, dateFin: f.dateFin || undefined, montant, notes: f.notes || undefined });
      setMsg(f.ligneId ? "Ligne modifiée." : "Ligne ajoutée."); setF(FORM_VIDE);
    } catch (err) { setMsg(`Erreur : ${messageErreur(err)}`); }
  };
  const onSupprimer = async (id: string) => {
    if (confirmId !== id) { setConfirmId(id); return; }
    try { await supprimer({ ligneId: id as any }); setMsg("Ligne supprimée."); } catch (err) { setMsg(`Erreur : ${messageErreur(err)}`); }
    setConfirmId(null);
  };
  const onImport = async (file: File) => {
    const l = parseCsvAudit(await file.text());
    if (!l.length) { setMsg("Aucune ligne valide (colonnes : Nom / Désignation;Date début;Date fin;Montant;Notes)."); return; }
    try { const r = await importer({ periode, categorie: onglet, lignes: l }); setMsg(`${r.importees} ligne(s) importée(s).`); } catch (err) { setMsg(`Erreur : ${messageErreur(err)}`); }
  };

  return (
    <>
      <h1>Audit confidentiel</h1>
      <p className="sub">Suivi confidentiel des primes et éléments administratifs — <b>auditeur externe &amp; Directeur Général uniquement</b>.</p>
      <div className="bar">
        <PeriodePicker value={periode} onChange={setPeriode} />
        <b>{libellePeriode(periode)}</b>
        <span className="badge lock">Confidentiel</span>
      </div>
      {msg && <div className="note">{msg}</div>}

      <div className="tabs" style={{ marginBottom: 14 }}>
        <button className={`tab ${onglet === "resume" ? "active" : ""}`} onClick={() => setOnglet("resume")}>Synthèse</button>
        {(categories ?? []).map((c: any) => <button key={c.cle} className={`tab ${onglet === c.cle ? "active" : ""}`} onClick={() => setOnglet(c.cle)}>{c.libelle}</button>)}
        <button className={`tab ${onglet === "salaires" ? "active" : ""}`} onClick={() => setOnglet("salaires")}>Total salaires reçus</button>
        <button className={`tab ${onglet === "graphes" ? "active" : ""}`} onClick={() => setOnglet("graphes")}>Graphes comparatifs</button>
      </div>

      {onglet === "resume" && resume && (
        <>
          <div className="cards">
            <div className="card"><div className="k">Total du mois</div><div className="v">{fcfa(resume.total)}</div></div>
            <div className="card"><div className="k">Mois précédent ({libellePeriode(resume.precedent)})</div><div className="v">{fcfa(resume.totalPrecedent)}</div></div>
            <div className="card"><div className="k">Variation</div><div className="v" style={{ color: resume.total - resume.totalPrecedent < 0 ? "var(--red)" : "var(--green)" }}>{fcfa(resume.total - resume.totalPrecedent)}</div></div>
            <div className="card"><div className="k">Rapports rédigés</div><div className="v">{resume.categories.filter((c: any) => c.rapport).length} / {resume.categories.length}</div></div>
          </div>
          <div className="tbl-wrap"><table className="grid">
            <thead><tr><th>Catégorie</th><th className="num">Total</th><th className="num">Mois précédent</th><th className="num">Variation</th><th>Rapport</th><th></th></tr></thead>
            <tbody>{resume.categories.map((c: any) => (
              <tr key={c.cle}>
                <td><b>{c.libelle}</b></td><td className="num">{fcfa(c.total)}</td><td className="num">{fcfa(c.precedent)}</td>
                <td className="num" style={{ color: c.delta < 0 ? "var(--red)" : c.delta > 0 ? "var(--green)" : undefined }}>{c.delta ? fcfa(c.delta) : "—"} <small>{pct(c.pct)}</small></td>
                <td>{c.rapport ? <span className="badge">rédigé</span> : <small style={{ color: "var(--ink-faint)" }}>—</small>}</td>
                <td><button className="btn" onClick={() => setOnglet(c.cle)}>Ouvrir</button></td>
              </tr>))}</tbody>
          </table></div>
        </>
      )}

      {estCat && (
        <>
          <h3 style={{ margin: "4px 0 10px" }}>{lignes?.libelle ?? onglet} — {libellePeriode(periode)}</h3>
          <form className="form" onSubmit={onSubmit}>
            <label>Nom / Désignation<input value={f.designation} onChange={(e) => setF({ ...f, designation: e.target.value })} required /></label>
            <label>Date début<input type="date" value={f.dateDebut} onChange={(e) => setF({ ...f, dateDebut: e.target.value })} /></label>
            <label>Date fin<input type="date" value={f.dateFin} onChange={(e) => setF({ ...f, dateFin: e.target.value })} /></label>
            <label>Montant (FCFA)<input value={f.montant} onChange={(e) => setF({ ...f, montant: e.target.value })} inputMode="numeric" required /></label>
            <label>Notes<input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Remarques…" /></label>
            <label>&nbsp;<span style={{ display: "flex", gap: 6 }}>
              <button className="btn green" type="submit">{f.ligneId ? "Enregistrer" : "Ajouter"}</button>
              {f.ligneId && <button className="btn" type="button" onClick={() => setF(FORM_VIDE)}>Annuler</button>}
            </span></label>
          </form>
          <div className="bar">
            <span className="grow" />
            <label className="btn">Importer CSV<input type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} /></label>
            <button className="btn" disabled={!lignes?.lignes.length} onClick={() => telecharger(`audit-${onglet}-${periode}.csv`, exportCsvAudit(lignes!.lignes))}>Exporter CSV</button>
          </div>
          <div className="tbl-wrap"><table className="grid">
            <thead><tr><th>Nom / Désignation</th><th>Date début</th><th>Date fin</th><th className="num">Montant (FCFA)</th><th>Notes</th><th></th></tr></thead>
            <tbody>
              {(lignes?.lignes ?? []).map((l: any) => (
                <tr key={String(l.ligneId)}>
                  <td><b>{l.designation}</b></td><td>{fmtDate(l.dateDebut)}</td><td>{fmtDate(l.dateFin)}</td>
                  <td className="num">{fcfa(l.montant)}</td><td>{l.notes ?? "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn" onClick={() => setF({ ligneId: String(l.ligneId), designation: l.designation, dateDebut: l.dateDebut ?? "", dateFin: l.dateFin ?? "", montant: String(l.montant), notes: l.notes ?? "" })}>Modifier</button>{" "}
                    <button className={`btn ${confirmId === String(l.ligneId) ? "primary" : ""}`} onClick={() => onSupprimer(String(l.ligneId))} onBlur={() => setConfirmId(null)}>{confirmId === String(l.ligneId) ? "Confirmer" : "Supprimer"}</button>
                  </td>
                </tr>))}
              {lignes && lignes.lignes.length === 0 && <tr><td colSpan={6}>Aucune ligne. Saisissez directement ou importez un CSV.</td></tr>}
              {lignes && lignes.lignes.length > 0 && <tr><td><b>TOTAL GÉNÉRAL</b></td><td></td><td></td><td className="num"><b>{fcfa(lignes.total)}</b></td><td></td><td></td></tr>}
            </tbody>
          </table></div>

          <div className="panel">
            <h3 style={{ margin: "0 0 8px" }}>Rapport d'audit — {lignes?.libelle ?? onglet}</h3>
            <textarea rows={7} value={texte} onChange={(e) => { setTexte(e.target.value); setTexteSale(true); }} placeholder="Rédigez votre rapport d'audit ici. Observations, recommandations, anomalies détectées…" style={{ width: "100%", padding: 8, border: "1px solid var(--line)", borderRadius: 6 }} />
            <div className="bar" style={{ marginTop: 8, marginBottom: 0 }}>
              <button className="btn primary" disabled={!texteSale} onClick={async () => { try { await enregistrerRapport({ periode, categorie: onglet, contenu: texte }); setTexteSale(false); setMsg("Rapport enregistré."); } catch (err) { setMsg(`Erreur : ${messageErreur(err)}`); } }}>Enregistrer le rapport</button>
              <small style={{ color: "var(--ink-faint)" }}>{rapport ? `Dernière version : ${rapport.majLe ? new Date(rapport.majLe).toLocaleString("fr-FR") : "—"} · ${rapport.auteur}` : "Aucun rapport pour ce mois."}</small>
            </div>
          </div>
        </>
      )}

      {onglet === "salaires" && (
        <div className="tbl-wrap"><table className="grid">
          <thead><tr><th>Mois</th><th>État</th><th className="num">Bulletins</th><th className="num">Brut</th><th className="num">Retenues</th><th className="num">Net</th><th className="num">Variation (net)</th></tr></thead>
          <tbody>{(salaires ?? []).map((m: any) => (
            <tr key={m.periode}>
              <td><b>{libellePeriode(m.periode)}</b></td>
              <td>{m.cloture ? <span className="badge lock">clôturé</span> : <span className="badge">ouvert (calcul)</span>}</td>
              <td className="num">{m.nombre}</td><td className="num">{fcfa(m.brut)}</td><td className="num">{fcfa(m.retenues)}</td><td className="num"><b>{fcfa(m.net)}</b></td>
              <td className="num" style={{ color: m.delta < 0 ? "var(--red)" : m.delta > 0 ? "var(--green)" : undefined }}>{m.pct === null ? "—" : `${fcfa(m.delta)} (${pct(m.pct)})`}</td>
            </tr>))}</tbody>
        </table></div>
      )}

      {onglet === "graphes" && graphes && (
        <>
          <h3 style={{ margin: "4px 0 8px" }}>Montants d'audit par catégorie — {libellePeriode(periode)}</h3>
          {graphes.parCategorie.length ? <Barres data={graphes.parCategorie} format={fcfa} /> : <p className="sub">Aucune ligne d'audit ce mois.</p>}
          <h3 style={{ margin: "18px 0 8px" }}>Net salaires par mois (6 mois)</h3>
          <Barres data={graphes.salaires.map((s: any) => ({ ...s, label: libellePeriode(s.label) }))} format={fcfa} couleur="var(--navy)" />
        </>
      )}
    </>
  );
}
