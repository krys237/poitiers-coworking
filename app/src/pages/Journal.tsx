import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

const couleur = (statut?: number) => (statut === undefined ? "" : statut < 300 ? "" : statut < 500 ? "warn" : "lock");

export function Journal() {
  const [action, setAction] = useState("");
  const actions = useQuery(api.journal.actions);
  const rows = useQuery(api.journal.liste, { action: action || undefined });
  return (
    <>
      <h1>Journal d'activité</h1>
      <p className="sub">Qui a fait quoi, quand : rôles et activations, clôtures de paie et financières, appels de l'API, contrôles du barème.</p>
      <div className="bar">
        <select value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">Toutes les actions</option>
          {(actions ?? []).map((a: any) => <option key={a.cle} value={a.cle}>{a.libelle}</option>)}
        </select>
        <span className="grow" /><span>{rows?.length ?? "…"} événement(s) (200 max)</span>
      </div>
      <div className="tbl-wrap"><table className="grid">
        <thead><tr><th>Date</th><th>Auteur</th><th>Action</th><th>Cible</th><th>Détail</th><th>Statut</th><th>IP</th></tr></thead>
        <tbody>
          {(rows ?? []).map((r: any) => (
            <tr key={r._id}>
              <td style={{ whiteSpace: "nowrap" }}>{new Date(r.date).toLocaleString("fr-FR")}</td>
              <td>{r.auteurNom ?? <small style={{ color: "var(--ink-faint)" }}>système / API</small>}</td>
              <td><span className="badge">{r.actionLibelle}</span></td>
              <td>{r.cible ?? "—"}</td><td>{r.detail ?? "—"}</td>
              <td>{r.statut !== undefined ? <span className={`badge ${couleur(r.statut)}`}>{r.statut}</span> : "—"}</td>
              <td>{r.ip ?? "—"}</td>
            </tr>))}
          {rows && rows.length === 0 && <tr><td colSpan={7}>Aucun événement.</td></tr>}
        </tbody>
      </table></div>
    </>
  );
}
