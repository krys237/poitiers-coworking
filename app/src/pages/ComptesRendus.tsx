import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { dureeLisible, HEURE_OUVERTURE, HEURE_FERMETURE } from "../../convex/lib/fenetre";
import { messageErreur } from "../lib/format";

const fmtDate = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const STATUT: Record<string, { label: string; cls: string }> = { brouillon: { label: "Brouillon", cls: "warn" }, en_relecture: { label: "En relecture", cls: "warn" }, valide: { label: "Validé", cls: "" } };

export function ComptesRendus() {
  const espace = useQuery(api.comptesRendus.monEspace);
  const soumettre = useMutation(api.comptesRendus.soumettre);
  const changerStatut = useMutation(api.comptesRendus.changerStatut);
  const [contenu, setContenu] = useState("");
  const [date, setDate] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [tick, setTick] = useState(Date.now());
  const [jourSup, setJourSup] = useState("");
  const sup = useQuery(api.comptesRendus.vueSuperviseur, espace?.superviseur ? { date: jourSup || undefined } : "skip");

  useEffect(() => { const t = setInterval(() => setTick(Date.now()), 30000); return () => clearInterval(t); }, []);
  useEffect(() => { if (espace && !date) setDate(espace.fenetre.aujourdHui); if (espace?.aujourdHui && !contenu) setContenu(espace.aujourdHui.contenu); }, [espace?.fenetre.aujourdHui]);

  const fen = espace?.fenetre;
  const compteARebours = fen
    ? fen.ouverte
      ? `Fenêtre ouverte — se ferme à ${HEURE_FERMETURE}h00 (dans ${dureeLisible(new Date(fen.finA!).getTime() - tick)})`
      : `Fenêtre fermée — prochaine ouverture dans ${dureeLisible(new Date(fen.prochaine).getTime() - tick)}`
    : "…";

  const onSoumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await soumettre({ date: date || undefined, contenu });
      setMsg(r.horsFenetre
        ? `Compte rendu du ${r.date} enregistré à ${r.heure} — HORS FENÊTRE (0 point) : les superviseurs en seront informés.`
        : `Compte rendu du ${r.date} soumis à ${r.heure} dans la fenêtre : +${r.points} point de présence.`);
    } catch (err) { setMsg(`Erreur : ${messageErreur(err)}`); }
  };

  return (
    <>
      <h1>Comptes rendus journaliers</h1>
      <p className="sub">La soumission est ouverte chaque jour ouvrable de {HEURE_OUVERTURE}h00 à {HEURE_FERMETURE}h00 (heure de Douala). Hors fenêtre, le compte rendu est accepté mais signalé et ne rapporte aucun point.</p>

      <div className="cards">
        <div className="card"><div className="k">Mon score</div><div className="v">{espace ? espace.score : "…"} <small style={{ fontSize: 12, fontWeight: 400 }}>points de présence</small></div></div>
        <div className="card"><div className="k">Aujourd'hui</div><div className="v" style={{ fontSize: 18 }}>{espace ? (espace.aujourdHui ? <>Soumis à {espace.aujourdHui.heure}{espace.aujourdHui.horsFenetre && <span className="badge lock" style={{ marginLeft: 6 }}>hors fenêtre</span>}</> : <span className="badge warn">En attente</span>) : "…"}</div></div>
        <div className="card" style={{ gridColumn: "span 2" }}><div className="k">Fenêtre de soumission</div><div className="v" style={{ fontSize: 15 }}>{fen ? (fen.ouverte ? <span className="badge">Ouverte</span> : <span className="badge lock">Fermée</span>) : ""} {compteARebours}</div></div>
      </div>
      {msg && <div className="note">{msg}</div>}

      <form className="form" style={{ gridTemplateColumns: "1fr" }} onSubmit={onSoumettre}>
        <div className="bar" style={{ marginBottom: 0 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>Jour concerné <input type="date" value={date} max={fen?.aujourdHui} onChange={(e) => setDate(e.target.value)} /></label>
          {fen && date && date !== fen.aujourdHui && <span className="badge warn">Rattrapage d'un jour passé : comptera hors fenêtre</span>}
        </div>
        <label>Compte rendu
          <textarea rows={6} value={contenu} onChange={(e) => setContenu(e.target.value)} placeholder={`Décrivez les tâches effectuées aujourd'hui (${fen?.aujourdHui ?? ""})…`} style={{ font: "inherit", padding: 8, border: "1px solid var(--line)", borderRadius: 6, width: "100%" }} />
        </label>
        <div><button className="btn green" type="submit" disabled={!contenu.trim()}>{espace?.aujourdHui && date === fen?.aujourdHui ? "Mettre à jour mon compte rendu" : "Soumettre mon compte rendu"}</button>
          {fen && !fen.ouverte && <span style={{ marginLeft: 10, color: "var(--amber)", fontSize: 13 }}>Soumission hors fenêtre — les superviseurs en seront informés.</span>}</div>
      </form>

      <h3>Mon historique ({espace?.historique.length ?? 0})</h3>
      <div className="tbl-wrap"><table className="grid">
        <thead><tr><th>Jour</th><th>Soumis à</th><th className="num">Points</th><th>Statut</th><th>Contenu</th></tr></thead>
        <tbody>
          {(espace?.historique ?? []).map((c: any) => <tr key={String(c._id)}><td>{fmtDate(c.date)}</td><td>{c.heure}{c.horsFenetre && <span className="badge lock" style={{ marginLeft: 6 }}>hors fenêtre</span>}</td><td className="num">{c.points}</td><td><span className={`badge ${STATUT[c.statut].cls}`}>{STATUT[c.statut].label}</span></td><td style={{ maxWidth: 520 }}>{c.contenu}</td></tr>)}
          {espace && espace.historique.length === 0 && <tr><td colSpan={5}>Aucun compte rendu.</td></tr>}
        </tbody>
      </table></div>

      {espace?.superviseur && (
        <>
          <h2 style={{ marginTop: 32 }}>Vue superviseur</h2>
          <div className="bar"><label style={{ display: "flex", alignItems: "center", gap: 8 }}>Jour <input type="date" value={jourSup || (sup?.date ?? "")} max={fen?.aujourdHui} onChange={(e) => setJourSup(e.target.value)} /></label></div>
          <div className="cards">
            <div className="card"><div className="k">Taux de soumission</div><div className="v">{sup ? `${sup.soumis} / ${sup.membres}` : "…"} <small style={{ fontSize: 13, fontWeight: 400 }}>membres actifs · {sup?.taux ?? 0} %</small></div></div>
            <div className="card"><div className="k">Hors fenêtre</div><div className="v">{sup ? sup.lignes.filter((l: any) => l.horsFenetre).length : "…"}</div></div>
            <div className="card"><div className="k">En attente</div><div className="v">{sup ? sup.membres - sup.soumis : "…"}</div></div>
          </div>
          <h3>Statut par membre — {sup?.date ? fmtDate(sup.date) : ""}</h3>
          <div className="tbl-wrap"><table className="grid">
            <thead><tr><th>Membre</th><th>Rôle</th><th>Soumission</th><th className="num">Points du jour</th><th className="num">Score cumulé</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              {(sup?.lignes ?? []).map((l: any) => (
                <tr key={String(l.membreId)}>
                  <td><b>{l.nom}</b><br /><small style={{ color: "var(--ink-faint)" }}>{l.email}</small></td><td>{l.role}</td>
                  <td>{l.soumis ? <>Soumis à {l.heure}{l.horsFenetre && <span className="badge lock" style={{ marginLeft: 6 }}>hors fenêtre</span>}</> : <span className="badge warn">En attente</span>}</td>
                  <td className="num">{l.points}</td><td className="num"><b>{l.score}</b></td>
                  <td>{l.statut ? <span className={`badge ${STATUT[l.statut].cls}`}>{STATUT[l.statut].label}</span> : "—"}</td>
                  <td>{l.id && l.statut !== "valide" && <button className="btn green" onClick={() => changerStatut({ compteRenduId: l.id, statut: "valide" })}>Valider</button>}
                    {l.id && l.statut === "valide" && <button className="btn" onClick={() => changerStatut({ compteRenduId: l.id, statut: "en_relecture" })}>Rouvrir</button>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <h3>Contenus des comptes rendus ({sup?.contenus.length ?? 0})</h3>
          {(sup?.contenus ?? []).map((c: any) => <div key={String(c._id)} className="comment"><b>{c.auteur}</b> <small>{c.heure}{c.horsFenetre ? " (hors fenêtre)" : ""}</small> <span className={`badge ${STATUT[c.statut].cls}`}>{STATUT[c.statut].label}</span><div>{c.contenu}</div></div>)}
        </>
      )}
    </>
  );
}
