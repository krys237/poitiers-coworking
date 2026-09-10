import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { PeriodePicker } from "../components/PeriodePicker";
import { num, libellePeriode, periodeCourante, messageErreur } from "../lib/format";
import { nomFichierPdf } from "../../convex/lib/periode";

// Liste des salaires — « Récapitulatif général salaire et primes perçus » : le net dans la colonne de la société de l'employé.
const SOCIETES = ["SOFINA", "SGC", "SESAME"] as const;
const f0 = (n: number) => (n ? num(n) : "—");

export function ListeSalaires() {
  const [periode, setPeriode] = useState(periodeCourante());
  const paie = useQuery(api.payroll.bulletinsDuMois, { periode });
  const entreprise = useQuery(api.parametres.get);
  const generer = useMutation(api.payroll.genererEtCloturer);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmGen, setConfirmGen] = useState(false);

  const lignes = paie?.bulletins ?? [];
  const primesDe = (b: any) => (b.details?.primes ?? 0);
  const totalSociete = (s: string) => lignes.filter((b: any) => b.societe === s).reduce((t: number, b: any) => t + b.net, 0);
  const totalPrimes = lignes.reduce((t: number, b: any) => t + primesDe(b), 0);
  const totalGeneral = lignes.reduce((t: number, b: any) => t + b.net, 0);

  const imprimer = () => {
    const titre = document.title;
    document.title = nomFichierPdf(entreprise?.nom ?? "POITIERS COWORKING", "Liste des salaires", libellePeriode(periode));
    window.addEventListener("afterprint", () => { document.title = titre; }, { once: true });
    window.print();
  };
  const lancerGeneration = async () => {
    if (!confirmGen) { setConfirmGen(true); return; }
    try { const r = await generer({ periode }); setMsg(`${r.bulletins} bulletin(s) générés — ${libellePeriode(periode)} (mois clôturé).`); }
    catch (e) { setMsg(`Erreur : ${messageErreur(e)}`); }
    setConfirmGen(false);
  };

  return (
    <>
      <div className="no-print">
        <h1>Liste des salaires</h1>
        <p className="sub">Mêmes colonnes que la liste papier : SOFINA, SGC, SESAME, primes et total. Les bulletins sont générés à partir de ces montants.</p>
        <div className="bar">
          <PeriodePicker value={periode} onChange={setPeriode} />
          {paie?.cloture ? <span className="badge lock">Mois clôturé (bulletins figés)</span> : <span className="badge">Calcul direct</span>}
          <span className="grow" />
          {!paie?.cloture && lignes.length > 0 && (
            <button className={`btn ${confirmGen ? "primary" : "green"}`} onClick={lancerGeneration} onBlur={() => setConfirmGen(false)}>
              {confirmGen ? "Confirmer : générer et clôturer" : "Générer les bulletins"}
            </button>
          )}
          <button className="btn" onClick={imprimer} disabled={!lignes.length}>Imprimer</button>
          <Link className="btn" to="/employes">Employés</Link>
        </div>
        {msg && <div className="note">{msg}</div>}
        {paie?.erreur && <p className="err">{paie.erreur}</p>}
      </div>

      <h3 style={{ textAlign: "center", textTransform: "uppercase", margin: "6px 0 10px" }}>
        Récapitulatif général salaire et primes perçus de {entreprise?.nom ?? "POITIERS COWORKING"} – {libellePeriode(periode)}
      </h3>
      <div className="tbl-wrap">
        <table className="grid">
          <thead><tr><th>N°</th><th>Noms et prénoms</th>{SOCIETES.map((s) => <th key={s} className="num">{s}</th>)}<th className="num">Primes</th><th className="num">Total perçu</th><th className="no-print">Bulletin</th></tr></thead>
          <tbody>
            {lignes.map((b: any, i: number) => (
              <tr key={String(b.employeId)}>
                <td>{i + 1}</td><td><b>{b.nom}</b></td>
                {SOCIETES.map((s) => <td key={s} className="num">{b.societe === s ? num(b.net) : "—"}</td>)}
                <td className="num">{f0(primesDe(b))}</td>
                <td className="num"><b>{num(b.net)}</b></td>
                <td className="no-print"><Link to={`/paie/bulletins?periode=${periode}&employe=${encodeURIComponent(b.matricule)}`}>Voir</Link></td>
              </tr>
            ))}
            {paie && lignes.length === 0 && <tr><td colSpan={8}>Aucun employé dans la liste.</td></tr>}
          </tbody>
          {lignes.length > 0 && (
            <tfoot><tr style={{ fontWeight: 700, background: "var(--card-2)" }}>
              <td colSpan={2}>TOTAUX ({lignes.length} employés)</td>
              {SOCIETES.map((s) => <td key={s} className="num">{f0(totalSociete(s))}</td>)}
              <td className="num">{f0(totalPrimes)}</td><td className="num">{num(totalGeneral)}</td><td className="no-print"></td>
            </tr></tfoot>
          )}
        </table>
      </div>
    </>
  );
}
