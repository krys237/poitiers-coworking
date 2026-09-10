import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { PeriodePicker } from "../components/PeriodePicker";
import { fcfa, num, libellePeriode, periodeCourante, messageErreur } from "../lib/format";

// Récapitulatif salaire — colonnes et légende du modèle de référence ; chaque saisie recalcule aussitôt les bulletins.
type Champ = "joursTravailles" | "primesVariables" | "transport" | "primeAssiduite" | "indemniteLogement" | "heuresSup" | "anciennete" | "sanctions" | "absences" | "dettesSoins" | "acompte" | "mutuellePct";
const CHAMPS: Champ[] = ["joursTravailles", "primesVariables", "transport", "primeAssiduite", "indemniteLogement", "heuresSup", "anciennete", "sanctions", "absences", "dettesSoins", "acompte", "mutuellePct"];
const DEFAUT: Record<Champ, number> = { joursTravailles: 30, primesVariables: 0, transport: 0, primeAssiduite: 0, indemniteLogement: 0, heuresSup: 0, anciennete: 0, sanctions: 0, absences: 0, dettesSoins: 0, acompte: 0, mutuellePct: 0 };
const SOCIETES = ["SESAME", "SOFINA", "SGC"] as const;
const f0 = (n?: number) => (n ? num(n) : "-");

export function SaisieMensuelle() {
  const [periode, setPeriode] = useState(periodeCourante());
  const paie = useQuery(api.payroll.bulletinsDuMois, { periode });
  const saisies = useQuery(api.payroll.saisiesDuMois, { periode });
  const bareme = useQuery(api.bareme.pourPeriode, { periode });
  const saisir = useMutation(api.payroll.saisirMois);
  const generer = useMutation(api.payroll.genererEtCloturer);
  const [draft, setDraft] = useState<Record<string, Partial<Record<Champ, number>>>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmGen, setConfirmGen] = useState(false);

  const cloture = paie?.cloture ?? false;
  const bulletins = paie?.bulletins ?? [];
  const val = (id: string, c: Champ): number => draft[id]?.[c] ?? (saisies?.[id] as any)?.[c] ?? DEFAUT[c];
  const set = (id: string, c: Champ, v: string) => setDraft((d) => ({ ...d, [id]: { ...d[id], [c]: Number(v) || 0 } }));

  const enregistrer = async (id: string) => {
    try {
      const valeurs: any = Object.fromEntries(CHAMPS.map((c) => [c, val(id, c)]));
      valeurs.absencesJours = (saisies?.[id] as any)?.absencesJours ?? 0;
      await saisir({ employeId: id as any, periode, valeurs });
      setDraft((d) => { const n = { ...d }; delete n[id]; return n; });
    } catch (e) { setMsg(`Erreur : ${messageErreur(e)}`); }
  };

  const lancerGeneration = async () => {
    if (!confirmGen) { setConfirmGen(true); return; }
    try { const r = await generer({ periode }); setMsg(`${r.bulletins} bulletin(s) générés et mois clôturé — ${libellePeriode(periode)}.`); }
    catch (e) { setMsg(`Erreur : ${messageErreur(e)}`); }
    setConfirmGen(false);
  };

  const inp = (id: string, c: Champ, w = 78) => (
    <input type="number" disabled={cloture} value={val(id, c)} onChange={(e) => set(id, c, e.target.value)} style={{ width: w }} />
  );
  const tot = (k: string) => bulletins.reduce((t: number, b: any) => t + ((b.details ?? {})[k] ?? 0), 0);
  const totNet = (s: string) => bulletins.filter((b: any) => b.societe === s).reduce((t: number, b: any) => t + b.net, 0);

  return (
    <>
      <div className="no-print">
        <div className="feat-label">Ressources humaines</div>
        <h1>Récapitulatif salaires</h1>
        <p className="sub">Période de paie : <b>{libellePeriode(periode)}</b> — tout est calculé automatiquement et lié aux bulletins de paie.</p>
        <div className="bar">
          <PeriodePicker value={periode} onChange={setPeriode} />
          {cloture ? <span className="badge lock">Mois clôturé — lecture seule</span> : <span className="badge">Ouvert — recalcul en direct</span>}
          {!cloture && bulletins.length > 0 && (
            <button className={`btn ${confirmGen ? "primary" : "green"}`} onClick={lancerGeneration} onBlur={() => setConfirmGen(false)}>
              {confirmGen ? "Confirmer : générer et clôturer le mois" : "Générer les bulletins du mois"}
            </button>
          )}
          <span className="grow" />
          <Link className="btn" to="/employes">Employés</Link>
          <Link className="btn" to="/paie/liste">Liste des salaires</Link>
          <Link className="btn" to={`/paie/bulletins?periode=${periode}`}>Bulletins du mois</Link>
          <Link className="btn" to="/paie/planning">Planning</Link>
          <Link className="btn" to="/paie/primes">Primes &amp; charges</Link>
          <Link className="btn" to="/paie/courrier">Courrier de paie</Link>
        </div>
        {msg && <div className="note">{msg}</div>}
        {paie?.erreur && <p className="err">{paie.erreur}</p>}

        {bareme && (
          <div className="panel" style={{ marginTop: 0, marginBottom: 16 }}>
            <div className="bar" style={{ marginBottom: 6 }}>
              <b>Taux du mois — {libellePeriode(periode)}</b>
              <small style={{ color: "var(--ink-faint)" }}>Lus dans le barème applicable ({bareme.source}, effectif depuis le {new Date(bareme.effectiveFrom + "T00:00:00").toLocaleDateString("fr-FR")}). Ils alimentent tous les bulletins de la période.</small>
              <span className="grow" /><Link className="btn" to="/bareme">Barème</Link>
            </div>
            <div className="meta-grid">
              <div><b>Plafond CNPS</b> {fcfa(bareme.plafondCnps)}</div><div><b>CNPS salarié (PVID)</b> {bareme.tauxPvidSal} %</div><div><b>CFC salarié</b> {bareme.tauxCfcSal} %</div>
              <div><b>Abattement IRPP annuel</b> {fcfa(bareme.abattementIrppAnnuel ?? 500000)}</div><div><b>CAC (sur IRPP)</b> {bareme.tauxCac} %</div>
              <div><b>Prestations familiales</b> {bareme.tauxPf} %</div><div><b>PVID patronal</b> {bareme.tauxPvidPat} %</div><div><b>Accidents du travail</b> {bareme.tauxAtmp} %</div>
              <div><b>FNE</b> {bareme.tauxFne} %</div><div><b>CFC patronal</b> {bareme.tauxCfcPat} %</div>
              <div><b>TDL</b> {(bareme.tdlActif ?? true) ? "appliquée" : "non appliquée"}</div><div><b>RAV</b> {(bareme.ravActif ?? true) ? "appliquée" : "non appliquée"}</div>
            </div>
          </div>
        )}
      </div>

      <div className="tbl-wrap">
        <table className="grid recap">
          <thead>
            <tr><th colSpan={18} style={{ textAlign: "center", fontSize: 13 }}>RÉCAPITULATIF SALAIRE — {libellePeriode(periode).toUpperCase()}</th></tr>
            <tr>
              <th>Noms et prénoms</th><th className="num">Salaire journalier</th><th className="num">Nbre de jours travaillés</th><th className="num">Salaire de base</th>
              <th className="num">Primes fixes / congé</th><th className="num">Heures sup / ancienneté</th><th className="num">Total 1</th>
              <th className="num">Sanctions</th><th className="num">Absence</th><th className="num">Dettes de soins</th><th className="num">Acompte / dette / impôts &amp; CNPS</th>
              <th className="num">Mutuelle %</th><th className="num">Mutuelle</th><th className="num">Total 2</th>
              <th className="num">Salaire SESAME</th><th className="num">Salaire SOFINA</th><th className="num">Salaire SGC</th><th>Bulletin</th>
            </tr>
          </thead>
          <tbody>
            {bulletins.map((b: any) => {
              const id = String(b.employeId); const d = b.details ?? {}; const modifie = !!draft[id];
              return (
                <tr key={id}>
                  <td style={{ minWidth: 170 }}><b>{b.nom}</b><br /><small style={{ color: "var(--ink-faint)" }}>{b.fonction ?? "—"} · {b.societe}</small>
                    {!cloture && <div><button className="btn" style={{ padding: "2px 8px", fontSize: 12, marginTop: 4 }} disabled={!modifie} onClick={() => enregistrer(id)}>Enregistrer</button></div>}</td>
                  <td className="num"><small style={{ color: "var(--ink-faint)" }}>Brut {num(b.salaireBrut ?? 0)}</small><br /><b>{f0(d.salaireJournalier)}</b></td>
                  <td className="num">{inp(id, "joursTravailles", 64)}</td>
                  <td className="num">{f0(d.salaireBase)}</td>
                  <td className="num">
                    <div className="stack"><label>Primes fixes {inp(id, "primesVariables")}</label><label>Transport {inp(id, "transport")}</label><label>Assiduité {inp(id, "primeAssiduite")}</label><label>Logement {inp(id, "indemniteLogement")}</label></div>
                    <small style={{ color: "var(--ink-faint)" }}>Congés pris {d.congesPris ?? 0} j · Ind. congés : {f0(d.indemniteConges)}</small>
                  </td>
                  <td className="num"><div className="stack"><label>H. sup {inp(id, "heuresSup")}</label><label>Ancienneté {inp(id, "anciennete")}</label></div></td>
                  <td className="num" style={{ background: "var(--green-tint)" }}><b>{f0(d.total1 ?? b.brut)}</b></td>
                  <td className="num">{inp(id, "sanctions")}</td>
                  <td className="num">{inp(id, "absences")}</td>
                  <td className="num">{inp(id, "dettesSoins")}</td>
                  <td className="num">{inp(id, "acompte")}<br /><small style={{ color: "var(--ink-faint)" }}>+ retenues {f0(d.chargesSalariales)}</small><br /><b>{f0(d.acompteImpotsCnps)}</b></td>
                  <td className="num">{inp(id, "mutuellePct", 60)}</td>
                  <td className="num">{f0(d.mutuelle)}</td>
                  <td className="num" style={{ background: "var(--green-tint)" }}><b>{f0(d.total2 ?? b.net)}</b></td>
                  {SOCIETES.map((s) => <td key={s} className="num">{b.societe === s ? <b>{f0(b.net)}</b> : "—"}</td>)}
                  <td><Link className="btn" style={{ padding: "3px 8px", fontSize: 12 }} to={`/paie/bulletins?periode=${periode}&employe=${encodeURIComponent(b.matricule)}`}>Ouvrir</Link></td>
                </tr>
              );
            })}
            {paie && bulletins.length === 0 && <tr><td colSpan={18}>Aucun employé actif.</td></tr>}
          </tbody>
          {bulletins.length > 0 && (
            <tfoot>
              <tr style={{ fontWeight: 700, background: "var(--card-2)" }}>
                <td>TOTAL ({bulletins.length})</td><td></td><td></td><td className="num">{f0(tot("salaireBase"))}</td><td className="num">{f0(tot("primes") + tot("indemniteConges"))}</td>
                <td className="num">{f0(tot("heuresSup") + tot("anciennete"))}</td><td className="num">{f0(tot("total1"))}</td><td></td><td></td><td></td><td className="num">{f0(tot("acompteImpotsCnps"))}</td><td></td>
                <td className="num">{f0(tot("mutuelle"))}</td><td className="num">{f0(tot("total2"))}</td>
                {SOCIETES.map((s) => <td key={s} className="num">{f0(totNet(s))}</td>)}<td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="legende no-print">
        <p><b>SALAIRE NET</b> = SALAIRE DE BASE + PRIME + CONGÉS + HEURES SUP + ANCIENNETÉ – SANCTION – ABSENCE – DETTE DE SOINS – ACOMPTE – IMPÔTS &amp; CNPS – MUTUELLE</p>
        <p><b>TOTAL 1</b> = SALAIRE DE BASE + PRIME + CONGÉS + HEURES SUP + ANCIENNETÉ &nbsp;·&nbsp; <b>TOTAL 2 (salaire net)</b> = TOTAL 1 – SANCTION – ABSENCE – DETTE DE SOINS – ACOMPTE / IMPÔTS &amp; CNPS – MUTUELLE</p>
        <p><b>SALAIRE SESAME</b> : salaires des employés et techniciens externes non déclarés à la CNPS et primes non déclarées &nbsp;·&nbsp; <b>SALAIRE SOFINA</b> : salaires des nouveaux employés &nbsp;·&nbsp; <b>SALAIRE SGC</b> : salaires des employés déclarés à la CNPS</p>
        <p>Salaire journalier = salaire brut mensuel ÷ 30 · Salaire de base = journalier × jours travaillés · Indemnité de congés = journalier × congés pris · La prime de transport est exonérée de cotisations.</p>
      </div>
    </>
  );
}
