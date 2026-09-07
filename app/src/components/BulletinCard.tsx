import { fcfa, num, libellePeriode } from "../lib/format";

// Bulletin A4 réutilisable (écran Bulletins et Courrier de paie). `b` = forme unifiée BulletinPeriode.
export function BulletinCard({ b, periode, entreprise }: { b: any; periode: string; entreprise: any }) {
  return (
    <article className="bulletin">
      {entreprise?.filigrane && <div className="wm">{entreprise.filigrane}</div>}
      <div className="head">
        <div>
          <div className="co" style={{ color: entreprise?.couleurEntete ?? undefined }}>{entreprise?.nom ?? "ENTREPRISE"}</div>
          <div className="addr">{entreprise?.adresse}</div>
        </div>
        <div className="title">BULLETIN DE PAIE<br /><small>{libellePeriode(periode)}</small></div>
      </div>
      <div className="meta">
        <div><b>{b.nom}</b></div><div>Matricule : {b.matricule ?? "—"}</div>
        <div>Fonction : {b.fonction ?? "—"}</div><div>Société : {b.societe}</div>
        <div>N° CNPS : {b.cnps ?? "—"}</div><div>NIU : {b.niu ?? "—"}</div>
      </div>

      <table>
        <thead><tr><th>N°</th><th>Gains</th><th className="num">Base</th><th className="num">Montant</th></tr></thead>
        <tbody>
          {b.lignesGain.map((l: any, i: number) => (            <tr key={l.code + i}><td>{l.code}</td><td>{l.libelle}</td><td className="num">{l.base ? num(l.base) : ""}</td><td className="num">{num(l.gain)}</td></tr>
          ))}
          <tr><td></td><td><b>Total brut</b></td><td></td><td className="num"><b>{num(b.brut)}</b></td></tr>
        </tbody>
      </table>

      <table>
        <thead><tr><th>N°</th><th>Cotisations</th><th className="num">Base</th><th className="num">Taux</th><th className="num">Retenue</th><th className="num">Ch. patron.</th></tr></thead>
        <tbody>
          {b.cotisations.map((c: any, i: number) => (
            <tr key={c.code + i}>
              <td>{c.code}</td><td>{c.libelle}</td><td className="num">{num(c.base)}</td>
              <td className="num">{c.taux ? `${c.taux}%` : ""}</td>
              <td className="num">{c.retenue ? num(c.retenue) : ""}</td>
              <td className="num">{c.chargePatronale ? num(c.chargePatronale) : ""}</td>
            </tr>
          ))}
          <tr><td></td><td><b>Total retenues</b></td><td></td><td></td><td className="num"><b>{num(b.totalRetenues)}</b></td>
            <td className="num"><b>{num(b.cotisations.reduce((t: number, c: any) => t + c.chargePatronale, 0))}</b></td></tr>
        </tbody>
      </table>

      <div className="net"><span>NET À PAYER</span><span>{fcfa(b.net)}</span></div>
      <div className="foot">Conservez ce bulletin sans limitation de durée. — {entreprise?.nom}</div>
    </article>
  );
}
