import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { fcfa, libellePeriode, periodeCourante, messageErreur } from "../lib/format";

export function Dashboard() {
  const periode = periodeCourante();
  const me = useQuery(api.users.me);
  const niveau = me?.niveau ?? 0;
  const estAuditeur = me?.role === "auditeur_externe";
  const employes = useQuery(api.employes.liste, me && niveau >= 3 ? {} : "skip");
  const paie = useQuery(api.payroll.bulletinsDuMois, me && niveau >= 4 ? { periode } : "skip");
  const fin = useQuery(api.financier.kpi, me ? {} : "skip");
  const cr = useQuery(api.comptesRendus.monEspace, me && !estAuditeur ? {} : "skip");
  const st = useQuery(api.stats.kpi, me && niveau >= 3 ? { periode } : "skip");
  const bar = useQuery(api.bareme.dernierControle, me && niveau >= 4 ? {} : "skip");
  const apiEtat = useQuery(api.journal.etatApi, me && niveau >= 7 ? {} : "skip");
  const audit = useQuery(api.audit.resume, me && (estAuditeur || me?.role === "dg") ? { periode } : "skip");
  const demo = useQuery(api.seed.etatDemo, me ? {} : "skip");
  const demo4 = useQuery(api.seed.etatDemo4, me ? {} : "skip");
  const seed = useMutation(api.seed.initialiser);
  const seedPhase2 = useAction(api.seed.phase2);
  const seedPhase3 = useMutation(api.seed.phase3);
  const seedPhase4 = useMutation(api.seed.phase4);
  const [msg, setMsg] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const totalNet = paie?.bulletins.reduce((t: number, b: any) => t + b.net, 0) ?? 0;
  const totalBrut = paie?.bulletins.reduce((t: number, b: any) => t + b.brut, 0) ?? 0;
  const lancer = async (nom: string, fn: () => Promise<any>, fmt: (r: any) => string) => {
    setEnCours(true); try { setMsg(`${nom} : ${fmt(await fn())}`); } catch (e) { setMsg(`Erreur : ${messageErreur(e)}`); } finally { setEnCours(false); }
  };

  return (
    <>
      <h1>Tableau de bord</h1>
      <p className="sub">{libellePeriode(periode)} — vue d'ensemble</p>

      {(me === null || (employes && employes.length === 0)) && (
        <div className="note"><b>Première utilisation.</b> Initialisez les données de démonstration (membre DG, entreprise, barème, 8 employés).{" "}
          <button className="btn green" onClick={async () => { const r = await seed(); setMsg(`Initialisé : ${JSON.stringify(r)}`); }}>Initialiser les données de démo</button></div>
      )}
      {me && niveau >= 7 && fin && !fin.derniere && (
        <div className="note"><b>Phase 2.</b> Aucune journée financière : chargez la démo (3 journées + 3 documents).{" "}
          <button className="btn green" disabled={enCours} onClick={() => lancer("Phase 2", () => seedPhase2(), (r) => `${r.journees} journée(s), ${r.documents} document(s), ${r.ignores} déjà présent(s).`)}>{enCours ? "Chargement…" : "Initialiser la démo Phase 2"}</button></div>
      )}
      {me && niveau >= 7 && demo && !demo.phase3 && (
        <div className="note"><b>Phase 3.</b> Chargez la démo activité : 3 membres, commandes, interventions, comptes rendus, caisse et primes.{" "}
          <button className="btn green" disabled={enCours} onClick={() => lancer("Phase 3", () => seedPhase3(), (r) => `${r.membres} membre(s), ${r.commandes} commande(s), ${r.interventions} intervention(s), ${r.comptesRendus} compte(s) rendu(s), ${r.caisse} ligne(s) de caisse, ${r.primes} prime(s), ${r.ignores} déjà présent(s).`)}>{enCours ? "Chargement…" : "Initialiser la démo Phase 3"}</button></div>
      )}
      {me && niveau >= 7 && demo4 && !demo4.phase4 && (
        <div className="note"><b>Phase 4.</b> Chargez la démo contrôle : un auditeur externe, des lignes d'audit sur deux mois, deux rapports et le journal.{" "}
          <button className="btn green" disabled={enCours} onClick={() => lancer("Phase 4", () => seedPhase4(), (r) => `${r.auditeur} auditeur, ${r.lignes} ligne(s) d'audit, ${r.rapports} rapport(s), ${r.ignores} déjà présent(s).`)}>{enCours ? "Chargement…" : "Initialiser la démo Phase 4"}</button></div>
      )}
      {msg && <div className="note">{msg}</div>}

      {audit && (
        <>
          <h3 style={{ margin: "6px 0 8px" }}>Audit confidentiel</h3>
          <div className="cards">
            <div className="card"><div className="k">Total d'audit du mois</div><div className="v">{fcfa(audit.total)}</div></div>
            <div className="card"><div className="k">Mois précédent</div><div className="v">{fcfa(audit.totalPrecedent)}</div></div>
            <div className="card"><div className="k">Rapports rédigés</div><div className="v">{audit.categories.filter((c: any) => c.rapport).length} / {audit.categories.length}</div></div>
          </div>
        </>
      )}

      {!estAuditeur && (
        <>
          <h3 style={{ margin: "6px 0 8px" }}>Activité</h3>
          <div className="cards">
            <div className="card"><div className="k">Points de présence</div><div className="v">{cr ? cr.score : "…"}</div></div>
            <div className="card"><div className="k">Compte rendu aujourd'hui</div><div className="v" style={{ fontSize: 17 }}>{cr ? (cr.aujourdHui ? <>Soumis à {cr.aujourdHui.heure}{cr.aujourdHui.horsFenetre && <span className="badge lock" style={{ marginLeft: 6 }}>hors fenêtre</span>}</> : <span className="badge warn">En attente</span>) : "…"}</div></div>
            {niveau >= 3 && <div className="card"><div className="k">Chiffre d'affaires du mois</div><div className="v">{st ? fcfa(st.chiffreAffaires) : "…"}</div></div>}
            {niveau >= 3 && <div className="card"><div className="k">Primes médecins du mois</div><div className="v">{st ? fcfa(st.primes) : "…"}</div></div>}
          </div>
        </>
      )}

      {niveau >= 4 && (
        <>
          <h3 style={{ margin: "18px 0 8px" }}>Paie</h3>
          <div className="cards">
            <div className="card"><div className="k">Effectif actif</div><div className="v">{employes ? employes.filter((e: any) => e.actif).length : "…"}</div></div>
            <div className="card"><div className="k">Masse brute du mois</div><div className="v">{paie ? fcfa(totalBrut) : "…"}</div></div>
            <div className="card"><div className="k">Net à payer du mois</div><div className="v">{paie ? fcfa(totalNet) : "…"}</div></div>
            <div className="card"><div className="k">État du mois</div><div className="v">{paie ? (paie.cloture ? <span className="badge lock">Clôturé</span> : <span className="badge">Ouvert — live</span>) : "…"}</div></div>
          </div>
          {paie && "erreur" in paie && paie.erreur && <p className="err">{paie.erreur}</p>}
        </>
      )}

      {niveau >= 5 && (
        <>
          <h3 style={{ margin: "18px 0 8px" }}>Trésorerie</h3>
          <div className="cards">
            <div className="card"><div className="k">Recette du jour</div><div className="v">{fin === undefined ? "…" : fin?.recetteDuJour != null ? fcfa(fin.recetteDuJour) : <span className="badge warn">Non saisie</span>}</div></div>
            <div className="card"><div className="k">Dernière journée saisie</div><div className="v" style={{ fontSize: 16 }}>{fin?.derniere ? `${new Date(fin.derniere.date + "T00:00:00").toLocaleDateString("fr-FR")} · ${fcfa(fin.derniere.recetteTotale)}` : "—"}</div></div>
            <div className="card"><div className="k">Solde F3 Poitiers</div><div className="v">{fin?.derniere ? fcfa(fin.derniere.f3Poitiers) : "—"}</div></div>
          </div>
        </>
      )}

      {niveau >= 4 && (
        <>
          <h3 style={{ margin: "18px 0 8px" }}>Contrôle</h3>
          <div className="cards">
            <div className="card"><div className="k">Barème applicable</div><div className="v" style={{ fontSize: 15 }}>{bar === undefined ? "…" : bar?.actif ? `depuis le ${new Date(bar.actif.effectiveFrom + "T00:00:00").toLocaleDateString("fr-FR")}` : <span className="badge lock">aucun</span>}</div></div>
            <div className="card"><div className="k">Dernier contrôle du barème</div><div className="v" style={{ fontSize: 15 }}>{bar?.dernier ? new Date(bar.dernier.date).toLocaleString("fr-FR") : "—"}</div></div>
            {niveau >= 7 && <div className="card"><div className="k">Appels API (7 jours)</div><div className="v">{apiEtat ? apiEtat.appels7j : "…"}</div></div>}
            {niveau >= 7 && <div className="card"><div className="k">Clé API backend</div><div className="v" style={{ fontSize: 15 }}>{apiEtat ? (apiEtat.cleConfiguree ? <span className="badge">configurée</span> : <span className="badge lock">absente</span>) : "…"}</div></div>}
          </div>
        </>
      )}
    </>
  );
}
