import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { PeriodePicker } from "../components/PeriodePicker";
import { fcfa, libellePeriode, periodeCourante, messageErreur } from "../lib/format";

const TAUX: [string, string][] = [
  ["plafondCnps", "Plafond CNPS (FCFA)"], ["tauxPvidSal", "PVID salarié (%)"], ["tauxPvidPat", "PVID patronal (%)"], ["tauxPf", "Prestations familiales (%)"],
  ["tauxAtmp", "ATMP (%)"], ["tauxCfcSal", "CFC salarié (%)"], ["tauxCfcPat", "CFC patronal (%)"], ["tauxFne", "FNE (%)"], ["abattementIrppPct", "Abattement IRPP (%)"], ["tauxCac", "CAC sur IRPP (%)"],
];

export function Bareme() {
  const [periode, setPeriode] = useState(periodeCourante());
  const me = useQuery(api.users.me);
  const applicable = useQuery(api.bareme.pourPeriode, { periode });
  const versions = useQuery(api.bareme.liste);
  const controle = useQuery(api.bareme.dernierControle);
  const verifier = useMutation(api.bareme.verifierMaintenant);
  const upsert = useMutation(api.bareme.upsert);
  const [ouvert, setOuvert] = useState(false);
  const [f, setF] = useState<any>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { if (applicable && !f) setF({ effectiveFrom: "", source: "", ...Object.fromEntries(TAUX.map(([k]) => [k, String((applicable as any)[k])])), irppBrackets: applicable.irppBrackets.map((b: any) => ({ jusqua: b.jusqua === null ? "" : String(b.jusqua), taux: String(b.taux) })) }); }, [applicable]);

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const valeurs: any = Object.fromEntries(TAUX.map(([k]) => [k, Number(String(f[k]).replace(",", "."))]));
      valeurs.irppBrackets = f.irppBrackets.map((b: any) => ({ jusqua: b.jusqua === "" ? null : Number(b.jusqua), taux: Number(String(b.taux).replace(",", ".")) }));
      await upsert({ effectiveFrom: f.effectiveFrom, source: f.source || "Saisie manuelle", valeurs });
      setMsg(`Nouvelle version enregistrée, effective à partir du ${f.effectiveFrom}.`); setOuvert(false);
    } catch (err) { setMsg(`Erreur : ${messageErreur(err)}`); }
  };

  return (
    <>
      <h1>Barème CNPS / CGI</h1>
      <p className="sub">Versions datées du barème : chaque bulletin utilise la version applicable à sa période. Un mois clôturé n'est jamais recalculé.</p>
      <div className="bar">
        <PeriodePicker value={periode} onChange={setPeriode} /><b>{libellePeriode(periode)}</b>
        <span className="grow" />
        <button className="btn" onClick={async () => { try { await verifier(); setMsg("Contrôle planifié — le résultat apparaît ci-dessous et dans le journal."); } catch (err) { setMsg(`Erreur : ${messageErreur(err)}`); } }}>Vérifier maintenant</button>
        {me && me.niveau >= 7 && <button className="btn primary" onClick={() => setOuvert((o) => !o)}>{ouvert ? "Fermer" : "Nouvelle version"}</button>}
      </div>
      {msg && <div className="note">{msg}</div>}

      <div className="cards">
        <div className="card"><div className="k">Version applicable à {libellePeriode(periode)}</div><div className="v" style={{ fontSize: 17 }}>{applicable === undefined ? "…" : applicable ? `effective depuis le ${new Date(applicable.effectiveFrom + "T00:00:00").toLocaleDateString("fr-FR")}` : <span className="badge lock">aucune</span>}</div></div>
        <div className="card"><div className="k">Source officielle</div><div className="v" style={{ fontSize: 15 }}>{controle ? (controle.sourceConfiguree ? <span className="badge">configurée</span> : <span className="badge warn">non configurée (BAREME_SOURCE_URL)</span>) : "…"}</div></div>
        <div className="card"><div className="k">Dernier contrôle</div><div className="v" style={{ fontSize: 15 }}>{controle?.dernier ? new Date(controle.dernier.date).toLocaleString("fr-FR") : "—"}</div></div>
      </div>
      {controle?.dernier && <div className="note" style={{ marginTop: 0 }}><b>Résultat :</b> {controle.dernier.detail}</div>}

      {applicable && (
        <div className="panel">
          <h3 style={{ margin: "0 0 8px" }}>Taux en vigueur — {applicable.source}</h3>
          <div className="meta-grid">
            {TAUX.map(([k, l]) => <div key={k}><b>{l}</b> {k === "plafondCnps" ? fcfa((applicable as any)[k]) : `${(applicable as any)[k]} %`}</div>)}
          </div>
          <div className="feat-label">Tranches IRPP (base imposable mensuelle)</div>
          <div className="tbl-wrap"><table className="grid"><thead><tr><th>Jusqu'à</th><th className="num">Taux</th></tr></thead>
            <tbody>{applicable.irppBrackets.map((b: any, i: number) => <tr key={i}><td>{b.jusqua === null ? "au-delà" : fcfa(b.jusqua)}</td><td className="num">{b.taux} %</td></tr>)}</tbody></table></div>
        </div>
      )}

      {ouvert && f && (
        <form className="panel" onSubmit={soumettre}>
          <h3 style={{ margin: "0 0 8px" }}>Nouvelle version (pré-remplie avec la version applicable)</h3>
          <div className="form" style={{ marginBottom: 10 }}>
            <label>Effective à partir du<input type="date" value={f.effectiveFrom} onChange={(e) => setF({ ...f, effectiveFrom: e.target.value })} required /></label>
            <label>Source<input value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} placeholder="Loi de finances 2027, circulaire CNPS…" /></label>
            {TAUX.map(([k, l]) => <label key={k}>{l}<input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} inputMode="decimal" required /></label>)}
          </div>
          <div className="feat-label">Tranches IRPP — laisser « jusqu'à » vide pour la dernière (ouverte)</div>
          {f.irppBrackets.map((b: any, i: number) => (
            <div key={i} className="bar" style={{ marginBottom: 6 }}>
              <input placeholder="jusqu'à (FCFA)" value={b.jusqua} onChange={(e) => { const t = [...f.irppBrackets]; t[i] = { ...t[i], jusqua: e.target.value }; setF({ ...f, irppBrackets: t }); }} inputMode="numeric" />
              <input placeholder="taux %" value={b.taux} onChange={(e) => { const t = [...f.irppBrackets]; t[i] = { ...t[i], taux: e.target.value }; setF({ ...f, irppBrackets: t }); }} inputMode="decimal" style={{ width: 90 }} />
              <button type="button" className="btn" onClick={() => setF({ ...f, irppBrackets: f.irppBrackets.filter((_: any, j: number) => j !== i) })}>Retirer</button>
            </div>))}
          <div className="bar">
            <button type="button" className="btn" onClick={() => setF({ ...f, irppBrackets: [...f.irppBrackets, { jusqua: "", taux: "" }] })}>Ajouter une tranche</button>
            <span className="grow" /><button className="btn green" type="submit">Enregistrer la version</button>
          </div>
        </form>
      )}

      <h3 style={{ margin: "22px 0 8px" }}>Versions ({versions?.length ?? "…"})</h3>
      <div className="tbl-wrap"><table className="grid">
        <thead><tr><th>Effective depuis</th><th>Source</th><th className="num">Plafond CNPS</th><th className="num">PVID sal.</th><th className="num">CAC</th><th>Dernier contrôle</th><th>Statut</th></tr></thead>
        <tbody>{(versions ?? []).map((b: any) => (
          <tr key={b._id}><td><b>{new Date(b.effectiveFrom + "T00:00:00").toLocaleDateString("fr-FR")}</b></td><td>{b.source}</td><td className="num">{fcfa(b.plafondCnps)}</td><td className="num">{b.tauxPvidSal} %</td><td className="num">{b.tauxCac} %</td>
            <td>{b.controleLe ? new Date(b.controleLe).toLocaleString("fr-FR") : "—"}</td><td><span className={`badge ${b.statut === "actif" ? "" : "warn"}`}>{b.statut}</span></td></tr>))}</tbody>
      </table></div>
    </>
  );
}
