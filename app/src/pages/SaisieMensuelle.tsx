import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { PeriodePicker } from "../components/PeriodePicker";
import { fcfa, libellePeriode, periodeCourante } from "../lib/format";

const CHAMPS = [
  ["joursTravailles", "Jours"], ["absencesJours", "Absences"], ["sanctions", "Sanctions"],
  ["primesVariables", "Primes"], ["transport", "Transport"], ["heuresSup", "H. sup"],
  ["anciennete", "Ancienneté"], ["mutuellePct", "Mutuelle %"], ["dettesSoins", "Dettes soins"], ["acompte", "Acompte"],
] as const;
type Champ = typeof CHAMPS[number][0];

const DEFAUT: Record<Champ, number> = {
  joursTravailles: 30, absencesJours: 0, sanctions: 0, primesVariables: 0, transport: 0,
  heuresSup: 0, anciennete: 0, mutuellePct: 0, dettesSoins: 0, acompte: 0,
};

export function SaisieMensuelle() {
  const [periode, setPeriode] = useState(periodeCourante());
  const paie = useQuery(api.payroll.bulletinsDuMois, { periode });
  const saisies = useQuery(api.payroll.saisiesDuMois, { periode });
  const saisir = useMutation(api.payroll.saisirMois);
  const [draft, setDraft] = useState<Record<string, Partial<Record<Champ, number>>>>({});

  const valeurDe = (employeId: string, c: Champ): number =>
    draft[employeId]?.[c] ?? (saisies?.[employeId] as any)?.[c] ?? DEFAUT[c];

  const enregistrer = async (employeId: string) => {
    const valeurs = Object.fromEntries(CHAMPS.map(([c]) => [c, valeurDe(employeId, c)])) as Record<Champ, number>;
    await saisir({ employeId: employeId as any, periode, valeurs });
    setDraft((d) => { const n = { ...d }; delete n[employeId]; return n; });
  };

  const cloture = paie?.cloture ?? false;

  return (
    <>
      <h1>Saisie mensuelle</h1>
      <p className="sub">Absences, primes, heures sup : chaque bulletin se recalcule aussitôt.</p>
      <div className="bar">
        <PeriodePicker value={periode} onChange={setPeriode} />
        <b>{libellePeriode(periode)}</b>
        {cloture ? <span className="badge lock">Mois clôturé — lecture seule</span> : <span className="badge">Ouvert — recalcul en direct</span>}
      </div>
      {paie && "erreur" in paie && paie.erreur && <p className="err">{paie.erreur}</p>}

      <div className="tbl-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Employé</th>
              {CHAMPS.map(([c, l]) => <th key={c} className="num">{l}</th>)}
              <th className="num">Brut</th><th className="num">Retenues</th><th className="num">Net</th><th></th>
            </tr>
          </thead>
          <tbody>
            {(paie?.bulletins ?? []).map((b: any) => {
              const id = String(b.employeId);
              const modifie = !!draft[id];
              return (
                <tr key={id}>
                  <td><b>{b.nom}</b><br /><small style={{ color: "var(--ink-faint)" }}>{b.societe}</small></td>
                  {CHAMPS.map(([c]) => (
                    <td key={c} className="num">
                      <input type="number" disabled={cloture} value={valeurDe(id, c)}
                        onChange={(e) => setDraft((d) => ({ ...d, [id]: { ...d[id], [c]: Number(e.target.value) || 0 } }))} />
                    </td>
                  ))}
                  <td className="num">{fcfa(b.brut)}</td>
                  <td className="num">-{fcfa(b.totalRetenues)}</td>
                  <td className="num"><b>{fcfa(b.net)}</b></td>
                  <td>{!cloture && <button className="btn primary" disabled={!modifie} onClick={() => enregistrer(id)}>Enregistrer</button>}</td>
                </tr>
              );
            })}
            {paie && paie.bulletins.length === 0 && <tr><td colSpan={CHAMPS.length + 5}>Aucun employé actif.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
