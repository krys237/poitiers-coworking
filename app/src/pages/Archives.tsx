import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { fcfa, libellePeriode } from "../lib/format";

export function Archives() {
  const mois = useQuery(api.archives.liste);
  const archiver = useAction(api.paiePdf.archiverPdfs);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const detail = useQuery(api.archives.bulletinsDuMois, ouvert ? { periode: ouvert } : "skip");

  const genererPdfs = async (periode: string) => {
    setEnCours(periode); setMsg(null);
    try {
      const r = await archiver({ periode });
      setMsg(`${libellePeriode(periode)} : ${r.generes} PDF généré(s), ${r.dejaPresents} déjà archivé(s) (${Math.round(r.octets / 1024)} Ko).`);
    } catch (e) { setMsg(`Erreur : ${(e as Error).message}`); }
    finally { setEnCours(null); }
  };

  return (
    <>
      <h1>Archives de paie</h1>
      <p className="sub">Mois clôturés : bulletins figés, envois, et PDF archivés dans le stockage.</p>
      {msg && <div className="note">{msg}</div>}

      <div className="tbl-wrap">
        <table className="grid">
          <thead><tr><th>Mois</th><th>Clôturé le</th><th>Par</th><th className="num">Bulletins</th><th className="num">Brut</th><th className="num">Net</th><th className="num">Envoyés</th><th className="num">PDF</th><th></th></tr></thead>
          <tbody>
            {(mois ?? []).map((m: any) => (
              <tr key={m.periode}>
                <td><b>{libellePeriode(m.periode)}</b></td>
                <td>{new Date(m.closedAt).toLocaleString("fr-FR")}</td>
                <td>{m.closedBy}</td>
                <td className="num">{m.nombre}</td>
                <td className="num">{fcfa(m.brut)}</td>
                <td className="num"><b>{fcfa(m.net)}</b></td>
                <td className="num">{m.envoyes} / {m.nombre}</td>
                <td className="num">{m.pdfs === m.nombre ? <span className="badge">{m.pdfs} / {m.nombre}</span> : <span className="badge warn">{m.pdfs} / {m.nombre}</span>}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn" onClick={() => setOuvert(ouvert === m.periode ? null : m.periode)}>{ouvert === m.periode ? "Masquer" : "Détail"}</button>{" "}
                  <Link className="btn" to={`/paie/bulletins?periode=${m.periode}`}>Voir les bulletins</Link>{" "}
                  <button className="btn primary" disabled={enCours === m.periode || m.pdfs === m.nombre} onClick={() => genererPdfs(m.periode)}>
                    {enCours === m.periode ? "Génération…" : m.pdfs === m.nombre ? "PDF archivés" : `Générer les PDF (${m.nombre - m.pdfs})`}
                  </button>
                </td>
              </tr>
            ))}
            {mois && mois.length === 0 && <tr><td colSpan={9}>Aucun mois clôturé. Clôturez un mois depuis l'écran Bulletins (« Générer et clôturer le mois »).</td></tr>}
          </tbody>
        </table>
      </div>

      {ouvert && (
        <>
          <h3 style={{ marginTop: 26 }}>Bulletins figés — {libellePeriode(ouvert)}</h3>
          <div className="tbl-wrap">
            <table className="grid">
              <thead><tr><th>Employé</th><th>Société</th><th className="num">Brut</th><th className="num">Net</th><th>Statut</th><th>PDF</th></tr></thead>
              <tbody>
                {(detail ?? []).map((b: any) => (
                  <tr key={String(b.bulletinId)}>
                    <td><b>{b.nom}</b><br /><small style={{ color: "var(--ink-faint)" }}>{b.matricule}</small></td>
                    <td>{b.societe}</td>
                    <td className="num">{fcfa(b.brut)}</td>
                    <td className="num"><b>{fcfa(b.net)}</b></td>
                    <td>{b.statut === "envoye" ? <span className="badge">Envoyé {b.envoyeLe ? new Date(b.envoyeLe).toLocaleDateString("fr-FR") : ""}</span> : <span className="badge warn">Généré</span>}</td>
                    <td>{b.pdfUrl ? <a className="btn" href={b.pdfUrl} target="_blank" rel="noreferrer">Télécharger</a> : <small style={{ color: "var(--ink-faint)" }}>non généré</small>}</td>
                  </tr>
                ))}
                {detail && detail.length === 0 && <tr><td colSpan={6}>Aucun bulletin.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
