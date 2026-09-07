import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { PeriodePicker } from "../components/PeriodePicker";
import { BulletinCard } from "../components/BulletinCard";
import { fcfa, libellePeriode, periodeCourante } from "../lib/format";

export function Bulletins() {
  const [params] = useSearchParams();
  const [periode, setPeriode] = useState(params.get("periode") ?? periodeCourante());
  const paie = useQuery(api.payroll.bulletinsDuMois, { periode });
  const entreprise = useQuery(api.parametres.get);
  const generer = useMutation(api.payroll.genererEtCloturer);
  const [msg, setMsg] = useState<string | null>(null);

  const bulletins = paie?.bulletins ?? [];
  const totalNet = bulletins.reduce((t: number, b: any) => t + b.net, 0);

  return (
    <>
      <div className="no-print">
        <h1>Bulletins de paie</h1>
        <p className="sub">Format A4, un bulletin par page à l'impression.</p>
        <div className="bar">
          <PeriodePicker value={periode} onChange={setPeriode} />
          <b>{libellePeriode(periode)}</b>
          {paie?.cloture ? <span className="badge lock">Clôturé (figé)</span> : <span className="badge">Ouvert — calcul direct</span>}
          <span className="grow" />
          <span>{bulletins.length} bulletin(s) · Total net <b>{fcfa(totalNet)}</b></span>
          {paie && !paie.cloture && bulletins.length > 0 && (
            <button className="btn green" onClick={async () => {
              if (!confirm(`Générer et clôturer ${libellePeriode(periode)} ? Les bulletins seront figés.`)) return;
              const r = await generer({ periode }); setMsg(`${r.bulletins} bulletin(s) générés et mois clôturé.`);
            }}>Générer et clôturer le mois</button>
          )}
          <button className="btn primary" onClick={() => window.print()} disabled={!bulletins.length}>Imprimer / PDF</button>
        </div>
        {msg && <div className="note">{msg}</div>}
        {paie?.erreur && <p className="err">{paie.erreur}</p>}
      </div>

      {bulletins.map((b: any) => <BulletinCard key={String(b.employeId)} b={b} periode={periode} entreprise={entreprise} />)}
    </>
  );
}
