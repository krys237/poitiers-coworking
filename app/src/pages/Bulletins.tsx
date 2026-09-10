import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { PeriodePicker } from "../components/PeriodePicker";
import { BulletinCard } from "../components/BulletinCard";
import { fcfa, num, libellePeriode, periodeCourante, messageErreur } from "../lib/format";
import { nomFichierPdf } from "../../convex/lib/periode";

// Bulletins du mois : page récapitulative puis un bulletin A4 par page ; nom de fichier PDF « Entreprise - Nom - période ».
export function Bulletins() {
  const [params] = useSearchParams();
  const [periode, setPeriode] = useState(params.get("periode") ?? periodeCourante());
  const [filtre, setFiltre] = useState<string | null>(params.get("employe"));
  const paie = useQuery(api.payroll.bulletinsDuMois, { periode });
  const entreprise = useQuery(api.parametres.get);
  const generer = useMutation(api.payroll.genererEtCloturer);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmGen, setConfirmGen] = useState(false);

  const tous = paie?.bulletins ?? [];
  const bulletins = filtre ? tous.filter((b: any) => b.matricule === filtre) : tous;
  const totalNet = bulletins.reduce((t: number, b: any) => t + b.net, 0);

  const imprimer = () => {
    const titre = document.title;
    const qui = filtre && bulletins.length === 1 ? bulletins[0].nom : "Bulletins";
    document.title = nomFichierPdf(entreprise?.nom ?? "POITIERS COWORKING", qui, libellePeriode(periode));
    window.addEventListener("afterprint", () => { document.title = titre; }, { once: true });
    window.print();
  };
  const lancerGeneration = async () => {
    if (!confirmGen) { setConfirmGen(true); return; }
    try { const r = await generer({ periode }); setMsg(`${r.bulletins} bulletin(s) générés et mois clôturé.`); }
    catch (e) { setMsg(`Erreur : ${messageErreur(e)}`); }
    setConfirmGen(false);
  };

  return (
    <>
      <div className="no-print">
        <Link to="/paie/saisie" style={{ fontSize: 13 }}>← Récapitulatif salaire</Link>
        <h1>Bulletins du mois</h1>
        <p className="sub">Tous les bulletins de {libellePeriode(periode)} au format A4, un bulletin par page à l'impression, précédés du récapitulatif de paie.</p>
        <div className="bar">
          <PeriodePicker value={periode} onChange={(p) => { setPeriode(p); setFiltre(null); }} />
          {paie?.cloture ? <span className="badge lock">Mois archivé (figé)</span> : <span className="badge">Calcul direct (mois non archivé)</span>}
          {filtre && <span className="badge warn">Filtre : {filtre} <button className="btn" style={{ padding: "0 6px", marginLeft: 6 }} onClick={() => setFiltre(null)}>×</button></span>}
          <span className="grow" />
          <span>{bulletins.length} bulletin(s) · Total net <b>{fcfa(totalNet)}</b></span>
          {paie && !paie.cloture && tous.length > 0 && (
            <button className={`btn ${confirmGen ? "primary" : "green"}`} onClick={lancerGeneration} onBlur={() => setConfirmGen(false)}>
              {confirmGen ? "Confirmer : générer et clôturer" : "Générer et clôturer le mois"}
            </button>
          )}
          <button className="btn primary" onClick={imprimer} disabled={!bulletins.length}>Imprimer / PDF</button>
        </div>
        {msg && <div className="note">{msg}</div>}
        {paie?.erreur && <p className="err">{paie.erreur}</p>}
      </div>

      {bulletins.length > 1 && (
        <section className="recap-page">
          <h2 style={{ textAlign: "center", textTransform: "uppercase", margin: "0 0 2px" }}>Récapitulatif de paie — {libellePeriode(periode)}</h2>
          <p style={{ textAlign: "center", fontSize: 12, color: "var(--ink-faint)", margin: "0 0 10px" }}>{bulletins.length} bulletin(s) — document récapitulatif joint aux bulletins</p>
          <table className="bp-t bp-lines">
            <thead><tr><th>N°</th><th style={{ textAlign: "left" }}>Nom et prénoms</th><th>Société</th><th>Brut</th><th>Retenues</th><th>Net à payer</th></tr></thead>
            <tbody>
              {bulletins.map((b: any, i: number) => (
                <tr key={String(b.employeId)}><td className="c">{i + 1}</td><td>{b.nom}</td><td className="c">{b.societe}</td><td className="r">{num(b.brut)}</td><td className="r">{num(b.totalRetenues)}</td><td className="r">{num(b.net)}</td></tr>
              ))}
              <tr className="strong"><td colSpan={3}>TOTAUX</td><td className="r">{num(bulletins.reduce((t: number, b: any) => t + b.brut, 0))}</td><td className="r">{num(bulletins.reduce((t: number, b: any) => t + b.totalRetenues, 0))}</td><td className="r">{num(totalNet)}</td></tr>
            </tbody>
          </table>
        </section>
      )}

      {bulletins.map((b: any) => <BulletinCard key={String(b.employeId)} b={b} entreprise={entreprise} />)}
    </>
  );
}
