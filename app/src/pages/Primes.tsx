import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { PeriodePicker } from "../components/PeriodePicker";
import { fcfa, libellePeriode, periodeCourante } from "../lib/format";

const SUGGESTIONS = {
  prime: ["Prime de rendement", "Prime d'assiduité", "Prime de caisse", "Prime de responsabilité", "Indemnité de logement", "Indemnité de représentation", "Indemnité de déplacement", "Gratification"],
  charge: ["Retenue sur avance", "Retenue matériel", "Remboursement prêt", "Cotisation syndicale", "Pénalité de retard"],
};
const fmtDate = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("fr-FR");
const aujourdHui = () => new Date().toISOString().slice(0, 10);

export function Primes() {
  const [periode, setPeriode] = useState(periodeCourante());
  const reg = useQuery(api.primes.liste, { periode });
  const ajouter = useMutation(api.primes.ajouter);
  const supprimer = useMutation(api.primes.supprimer);

  const [f, setF] = useState({ employeId: "", type: "prime" as "prime" | "charge", libelle: "", montant: "", date: aujourdHui() });
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const cloture = reg?.cloture ?? false;
  const lignes = reg?.lignes ?? [];

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const montant = parseInt(f.montant.replace(/[^\d]/g, ""), 10);
    if (!f.employeId || !f.libelle.trim() || !(montant > 0)) return;
    try {
      await ajouter({ employeId: f.employeId as any, periode, libelle: f.libelle, montant, type: f.type, date: f.date });
      setMsg(`${f.type === "prime" ? "Prime" : "Charge"} « ${f.libelle.trim()} » de ${fcfa(montant)} enregistrée — bulletin recalculé.`);
      setF({ ...f, libelle: "", montant: "" });
    } catch (err) { setMsg(`Erreur : ${(err as Error).message}`); }
  };

  const onSupprimer = async (id: string) => {
    if (confirmId !== id) { setConfirmId(id); return; }
    try { await supprimer({ ligneId: id as any }); setMsg("Ligne supprimée — bulletin recalculé."); }
    catch (err) { setMsg(`Erreur : ${(err as Error).message}`); }
    setConfirmId(null);
  };

  return (
    <>
      <h1>Primes et charges</h1>
      <p className="sub">Montant, date et mois pour chaque prime ou retenue : les totaux du mois alimentent automatiquement les bulletins (en plus des primes variables de la saisie mensuelle).</p>

      <div className="bar">
        <PeriodePicker value={periode} onChange={setPeriode} />
        <b>{libellePeriode(periode)}</b>
        {cloture ? <span className="badge lock">Mois clôturé — lecture seule</span> : <span className="badge">Mois ouvert</span>}
      </div>
      {msg && <div className="note">{msg}</div>}

      <div className="cards">
        <div className="card"><div className="k">Total primes</div><div className="v" style={{ color: "var(--green)" }}>{reg ? fcfa(reg.totaux.primes) : "…"}</div></div>
        <div className="card"><div className="k">Total charges / retenues</div><div className="v" style={{ color: "var(--red)" }}>{reg ? `-${fcfa(reg.totaux.charges)}` : "…"}</div></div>
        <div className="card"><div className="k">Effet net sur la paie</div><div className="v">{reg ? fcfa(reg.totaux.primes - reg.totaux.charges) : "…"}</div></div>
        <div className="card"><div className="k">Employés concernés</div><div className="v">{reg ? reg.totaux.employes : "…"}</div></div>
      </div>

      {!cloture && (
        <form className="form" onSubmit={onSubmit}>
          <label>Employé
            <select value={f.employeId} onChange={(e) => setF({ ...f, employeId: e.target.value })} required>
              <option value="">— Choisir —</option>
              {(reg?.employesActifs ?? []).map((e: any) => <option key={String(e.employeId)} value={String(e.employeId)}>{e.nom}</option>)}
            </select>
          </label>
          <label>Type
            <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as "prime" | "charge", libelle: "" })}>
              <option value="prime">Prime (ajoutée au brut)</option>
              <option value="charge">Charge / retenue (déduite du net)</option>
            </select>
          </label>
          <label>Libellé
            <input list={`sugg-${f.type}`} value={f.libelle} onChange={(e) => setF({ ...f, libelle: e.target.value })} placeholder={f.type === "prime" ? "Prime de rendement" : "Retenue sur avance"} required />
            <datalist id={`sugg-${f.type}`}>{SUGGESTIONS[f.type].map((s) => <option key={s} value={s} />)}</datalist>
          </label>
          <label>Montant (FCFA)<input value={f.montant} onChange={(e) => setF({ ...f, montant: e.target.value })} inputMode="numeric" placeholder="15000" required /></label>
          <label>Date<input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required /></label>
          <label>&nbsp;<button className="btn green" type="submit" disabled={!f.employeId || !f.libelle.trim() || !f.montant}>Ajouter la ligne</button></label>
        </form>
      )}

      <div className="tbl-wrap">
        <table className="grid">
          <thead><tr><th>Date</th><th>Employé</th><th>Type</th><th>Libellé</th><th className="num">Montant</th><th></th></tr></thead>
          <tbody>
            {lignes.map((l: any) => (
              <tr key={String(l._id)}>
                <td>{fmtDate(l.date)}</td>
                <td><b>{l.nom}</b></td>
                <td><span className={`badge ${l.type === "charge" ? "lock" : ""}`}>{l.type === "prime" ? "Prime" : "Charge"}</span></td>
                <td>{l.libelle}</td>
                <td className="num" style={{ color: l.type === "charge" ? "var(--red)" : "var(--green)", fontWeight: 600 }}>{l.type === "charge" ? "-" : "+"}{fcfa(l.montant)}</td>
                <td>{!cloture && (
                  <button className={`btn ${confirmId === String(l._id) ? "primary" : ""}`} onClick={() => onSupprimer(String(l._id))} onBlur={() => setConfirmId(null)}>
                    {confirmId === String(l._id) ? "Confirmer la suppression" : "Supprimer"}
                  </button>
                )}</td>
              </tr>
            ))}
            {reg && lignes.length === 0 && <tr><td colSpan={6}>Aucune ligne sur ce mois.</td></tr>}
          </tbody>
        </table>
      </div>

      {reg && reg.parEmploye.length > 0 && (
        <>
          <h3 style={{ marginTop: 26 }}>Récapitulatif par employé</h3>
          <div className="tbl-wrap">
            <table className="grid">
              <thead><tr><th>Employé</th><th className="num">Primes</th><th className="num">Charges</th><th className="num">Effet net</th></tr></thead>
              <tbody>
                {reg.parEmploye.map((r: any) => (
                  <tr key={r.employeId}>
                    <td><b>{r.nom}</b></td>
                    <td className="num">{fcfa(r.primes)}</td>
                    <td className="num">-{fcfa(r.charges)}</td>
                    <td className="num"><b>{fcfa(r.primes - r.charges)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
