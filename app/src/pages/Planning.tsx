import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { PeriodePicker } from "../components/PeriodePicker";
import { libellePeriode, periodeCourante } from "../lib/format";

const TYPES = [
  ["conge_paye", "Congé payé"], ["absence", "Absence non justifiée"], ["maladie", "Maladie"], ["autre", "Autre"],
] as const;
type TypeAbs = typeof TYPES[number][0];
const PAYE_DEF: Record<TypeAbs, boolean> = { conge_paye: true, absence: false, maladie: true, autre: false };
const LIB: Record<string, string> = Object.fromEntries(TYPES);
const fmtDate = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("fr-FR");

export function Planning() {
  const [periode, setPeriode] = useState(periodeCourante());
  const vue = useQuery(api.planning.vueMensuelle, { periode });
  const ajouter = useMutation(api.planning.ajouterAbsence);
  const supprimer = useMutation(api.planning.supprimerAbsence);
  const synchroniser = useMutation(api.planning.synchroniserPaie);

  const [f, setF] = useState({ employeId: "", type: "conge_paye" as TypeAbs, dateDebut: "", dateFin: "", paye: true, motif: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const lignes = vue?.lignes ?? [];
  const tot = (k: string) => lignes.reduce((t: number, l: any) => t + (l[k] ?? 0), 0);
  const nonSync = lignes.filter((l: any) => !l.paieSynchronisee).length;
  const evenements = lignes.flatMap((l: any) => l.evenements.map((ev: any) => ({ ...ev, nom: l.nom })))
    .sort((a: any, b: any) => a.dateDebut.localeCompare(b.dateDebut));

  const onType = (type: TypeAbs) => setF({ ...f, type, paye: PAYE_DEF[type] });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.employeId || !f.dateDebut || !f.dateFin) return;
    try {
      const r = await ajouter({ employeId: f.employeId as any, type: f.type, dateDebut: f.dateDebut, dateFin: f.dateFin, paye: f.paye, motif: f.motif || undefined });
      setMsg(`Absence enregistrée (${r.jours} jour(s)). Paie recalée pour : ${r.periodes.length ? r.periodes.join(", ") : "aucun mois ouvert"}.`);
      setF({ ...f, dateDebut: "", dateFin: "", motif: "" });
    } catch (err) { setMsg(`Erreur : ${(err as Error).message}`); }
  };

  const onSupprimer = async (id: string) => {
    if (confirmId !== id) { setConfirmId(id); return; }
    const r = await supprimer({ absenceId: id as any });
    setConfirmId(null);
    setMsg(`Absence supprimée. Paie recalée pour : ${r.periodes.length ? r.periodes.join(", ") : "aucun mois ouvert"}.`);
  };

  return (
    <>
      <h1>Planning des absences</h1>
      <p className="sub">Congés, absences et jours travaillés par employé. Chaque saisie recale automatiquement la paie du mois (mois clôturés exclus).</p>

      <div className="bar">
        <PeriodePicker value={periode} onChange={setPeriode} />
        <b>{libellePeriode(periode)}</b>
        {vue?.cloture ? <span className="badge lock">Mois clôturé — paie figée</span> : <span className="badge">Mois ouvert</span>}
        <span style={{ color: "var(--ink-faint)", fontSize: 12 }}>Acquisition : {vue?.congesParMois ?? "…"} j / mois de service</span>
        <span className="grow" />
        {nonSync > 0 && !vue?.cloture && <span className="badge warn">{nonSync} saisie(s) de paie à recaler</span>}
        <button className="btn primary" disabled={!lignes.length || vue?.cloture} onClick={async () => { const r = await synchroniser({ periode }); setMsg(`Paie recalée pour ${r.employes} employé(s) — ${libellePeriode(periode)}.`); }}>
          Synchroniser la paie du mois
        </button>
      </div>
      {msg && <div className="note">{msg}</div>}

      <div className="cards">
        <div className="card"><div className="k">Absences non payées (j)</div><div className="v">{vue ? tot("absencesNonPayees") : "…"}</div></div>
        <div className="card"><div className="k">Absences payées / maladie (j)</div><div className="v">{vue ? tot("absencesPayees") : "…"}</div></div>
        <div className="card"><div className="k">Congés pris ce mois (j)</div><div className="v">{vue ? tot("congesPrisMois") : "…"}</div></div>
        <div className="card"><div className="k">Employés absents ce mois</div><div className="v">{vue ? lignes.filter((l: any) => l.evenements.length).length : "…"}</div></div>
      </div>

      <form className="form" onSubmit={onSubmit}>
        <label>Employé
          <select value={f.employeId} onChange={(e) => setF({ ...f, employeId: e.target.value })} required>
            <option value="">— Choisir —</option>
            {lignes.map((l: any) => <option key={String(l.employeId)} value={String(l.employeId)}>{l.nom}</option>)}
          </select>
        </label>
        <label>Type
          <select value={f.type} onChange={(e) => onType(e.target.value as TypeAbs)}>
            {TYPES.map(([k, lab]) => <option key={k} value={k}>{lab}</option>)}
          </select>
        </label>
        <label>Du<input type="date" value={f.dateDebut} onChange={(e) => setF({ ...f, dateDebut: e.target.value })} required /></label>
        <label>Au (inclus)<input type="date" value={f.dateFin} onChange={(e) => setF({ ...f, dateFin: e.target.value })} required /></label>
        <label>Rémunérée
          <select value={f.paye ? "1" : "0"} onChange={(e) => setF({ ...f, paye: e.target.value === "1" })}>
            <option value="1">Oui — n'entame pas les jours travaillés</option>
            <option value="0">Non — déduite des jours travaillés</option>
          </select>
        </label>
        <label>Motif<input value={f.motif} onChange={(e) => setF({ ...f, motif: e.target.value })} placeholder="optionnel" /></label>
        <label>&nbsp;<button className="btn green" type="submit" disabled={!f.employeId || !f.dateDebut || !f.dateFin}>Ajouter l'absence</button></label>
      </form>

      <div className="tbl-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Employé</th><th className="num">Jours cal.</th><th className="num">Abs. non payées</th><th className="num">Abs. payées</th>
              <th className="num">Congés pris (mois)</th><th className="num">Acquis (cumul)</th><th className="num">Pris (cumul)</th>
              <th className="num">Solde congés</th><th className="num">Jours travaillés</th><th>Paie (saisie)</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l: any) => (
              <tr key={String(l.employeId)}>
                <td><b>{l.nom}</b><br /><small style={{ color: "var(--ink-faint)" }}>{l.societe}{l.dateDebut ? ` · depuis ${fmtDate(l.dateDebut)}` : " · date d'embauche non renseignée"}</small></td>
                <td className="num">{l.joursCalendaires}</td>
                <td className="num">{l.absencesNonPayees ? <b style={{ color: "var(--red)" }}>{l.absencesNonPayees}</b> : 0}</td>
                <td className="num">{l.absencesPayees}</td>
                <td className="num">{l.congesPrisMois}</td>
                <td className="num">{l.congesAcquisCumul}</td>
                <td className="num">{l.congesPrisCumul}</td>
                <td className="num"><b style={{ color: l.soldeConges < 0 ? "var(--red)" : "var(--green)" }}>{l.soldeConges}</b></td>
                <td className="num"><b>{l.joursTravailles}</b> / {l.joursBase}</td>
                <td>{l.paie
                  ? <span className={`badge ${l.paieSynchronisee ? "" : "warn"}`}>{l.paie.joursTravailles} j · {l.paie.absencesJours} abs{l.paieSynchronisee ? "" : " — à recaler"}</span>
                  : <small style={{ color: "var(--ink-faint)" }}>aucune saisie</small>}</td>
              </tr>
            ))}
            {vue && lignes.length === 0 && <tr><td colSpan={10}>Aucun employé actif.</td></tr>}
          </tbody>
        </table>
      </div>

      <h3 style={{ marginTop: 26 }}>Événements du mois ({evenements.length})</h3>
      <div className="tbl-wrap">
        <table className="grid">
          <thead><tr><th>Employé</th><th>Type</th><th>Du</th><th>Au</th><th className="num">Jours</th><th>Rémunérée</th><th>Motif</th><th></th></tr></thead>
          <tbody>
            {evenements.map((ev: any) => (
              <tr key={String(ev._id)}>
                <td><b>{ev.nom}</b></td>
                <td><span className={`badge ${ev.type === "absence" ? "lock" : ev.type === "conge_paye" ? "" : "warn"}`}>{LIB[ev.type]}</span></td>
                <td>{fmtDate(ev.dateDebut)}</td><td>{fmtDate(ev.dateFin)}</td>
                <td className="num">{ev.jours}</td>
                <td>{ev.paye ? "Oui" : "Non"}</td>
                <td>{ev.motif ?? "—"}</td>
                <td>
                  <button className={`btn ${confirmId === String(ev._id) ? "primary" : ""}`} onClick={() => onSupprimer(String(ev._id))} onBlur={() => setConfirmId(null)}>
                    {confirmId === String(ev._id) ? "Confirmer la suppression" : "Supprimer"}
                  </button>
                </td>
              </tr>
            ))}
            {vue && evenements.length === 0 && <tr><td colSpan={8}>Aucune absence enregistrée sur ce mois.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
