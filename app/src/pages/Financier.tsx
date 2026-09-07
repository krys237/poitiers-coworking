import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { BLOCS, SOLDES, SOLDES_PRINCIPAUX, calculerSoldes, recetteTotale, formule, CLE_PIECE } from "../../convex/lib/tresorerie";
import { fcfa, libellePeriode, messageErreur } from "../lib/format";

type Mouv = Record<string, Record<string, number>>;
const aujourdHui = () => new Date().toISOString().slice(0, 10);
const fmtDate = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export function Financier() {
  const [date, setDate] = useState(aujourdHui());
  const j = useQuery(api.financier.journee, { date });
  const histo = useQuery(api.financier.historique, { date });
  const enregistrer = useMutation(api.financier.enregistrer);
  const prendreVerrou = useMutation(api.financier.prendreVerrou);
  const libererVerrou = useMutation(api.financier.libererVerrou);
  const cloturer = useMutation(api.financier.cloturerMois);
  const genererUploadUrl = useMutation(api.financier.genererUploadUrl);
  const attacherPiece = useMutation(api.financier.attacherPiece);

  const [draft, setDraft] = useState<Mouv>({});
  const [notes, setNotes] = useState("");
  const [dirty, setDirty] = useState(false);
  const [editJ0, setEditJ0] = useState(false);
  const [j0, setJ0] = useState<Record<string, number>>({});
  const [ouverts, setOuverts] = useState<Set<string>>(new Set(["poitiers"]));
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmCloture, setConfirmCloture] = useState(false);
  const [uploadCle, setUploadCle] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Synchronise le brouillon avec le serveur tant que rien n'a été modifié localement.
  useEffect(() => {
    if (!j || dirty) return;
    setDraft(j.mouvements); setNotes(j.notes); setJ0(j.soldesOuverture); setEditJ0(false);
  }, [j?.date, j?.existe, j?.recetteTotale, dirty]);
  useEffect(() => { setDirty(false); setMsg(null); setConfirmCloture(false); }, [date]);

  const peutEditer = !!j && !j.cloture && j.verrou.mien;
  const ouverture = editJ0 ? j0 : (j?.soldesOuverture ?? {});
  const soldes = calculerSoldes(ouverture, draft);
  const recette = recetteTotale(draft);

  const setMontant = (bloc: string, ligne: string, val: string) => {
    const n = parseInt(val.replace(/[^\d-]/g, ""), 10);
    setDraft((d) => ({ ...d, [bloc]: { ...(d[bloc] ?? {}), [ligne]: Number.isFinite(n) ? n : 0 } }));
    setDirty(true);
  };

  const sauver = async () => {
    try {
      const r = await enregistrer({ date, mouvements: draft, notes, soldesOuverture: editJ0 ? j0 : undefined });
      setDirty(false); setEditJ0(false);
      setMsg(`Journée enregistrée — recette ${fcfa(r.recetteTotale)} · F3 Poitiers ${fcfa(r.soldes.poitiers_f3 ?? 0)}.`);
    } catch (e) { setMsg(`Erreur : ${messageErreur(e)}`); }
  };

  const verrouiller = async () => {
    try { await prendreVerrou({ date }); setMsg("Verrou pris : vous éditez ce tableau."); }
    catch (e) { setMsg(`Erreur : ${messageErreur(e)}`); }
  };

  const cloturerLeMois = async () => {
    if (!confirmCloture) { setConfirmCloture(true); return; }
    try { const r = await cloturer({ periode: j!.periode }); setConfirmCloture(false); setMsg(`${libellePeriode(r.periode)} clôturé : ${r.journees} journée(s) figée(s).`); }
    catch (e) { setMsg(`Erreur : ${messageErreur(e)}`); }
  };

  const envoyerPiece = async (file: File) => {
    if (!uploadCle) return;
    try {
      const url = await genererUploadUrl();
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
      const { storageId } = await res.json();
      await attacherPiece({ date, cle: uploadCle, storageId });
      setMsg(`Justificatif attaché (${file.name}).`);
    } catch (e) { setMsg(`Erreur : ${messageErreur(e)}`); }
    finally { setUploadCle(null); if (fileRef.current) fileRef.current.value = ""; }
  };

  return (
    <>
      <h1>Tableau financier</h1>
      <p className="sub">Grand livre journalier multi-entités : les soldes se reportent de la dernière journée saisie (J-1) et se recalculent en direct.</p>

      <div className="bar">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <b style={{ textTransform: "capitalize" }}>{fmtDate(date)}</b>
        {j?.cloture ? <span className="badge lock">Mois clôturé — immuable</span>
          : j?.verrou.actif ? (j.verrou.mien ? <span className="badge">Vous éditez ce tableau. Verrou actif.</span> : <span className="badge lock">Verrouillé par {j.verrou.parNom}</span>)
          : <span className="badge warn">Lecture — prenez le verrou pour éditer</span>}
        {j && !j.existe && <span className="badge warn">Journée non encore saisie</span>}
        {j?.ouvertureDepuis && !j.soldesOuvertureManuels && <small style={{ color: "var(--ink-faint)" }}>Ouverture reportée du {new Date(j.ouvertureDepuis + "T00:00:00").toLocaleDateString("fr-FR")}</small>}
        {j?.soldesOuvertureManuels && <small style={{ color: "var(--ink-faint)" }}>Soldes d'ouverture saisis (J0)</small>}
        <span className="grow" />
        {j && !j.cloture && !j.verrou.mien && <button className="btn primary" disabled={j.verrou.actif} onClick={verrouiller}>Prendre le verrou</button>}
        {peutEditer && <button className="btn" onClick={() => setEditJ0((v) => !v)}>{editJ0 ? "Masquer Soldes J0" : "Soldes J0"}</button>}
        {peutEditer && <button className="btn" onClick={async () => { await libererVerrou({ date }); setMsg("Verrou libéré."); }}>Libérer</button>}
        {peutEditer && <button className="btn green" disabled={!dirty && !editJ0} onClick={sauver}>Enregistrer</button>}
      </div>
      {msg && <div className="note">{msg}</div>}

      <div className="cards">
        {SOLDES_PRINCIPAUX.map((s) => (
          <div className="card" key={s.cle} title={formule(s)}>
            <div className="k">{s.libelle}</div>
            <div className="v" style={{ fontSize: 18, color: (soldes[s.cle] ?? 0) < 0 ? "var(--red)" : undefined }}>{fcfa(soldes[s.cle] ?? 0)}</div>
            <small style={{ color: "var(--ink-faint)" }}>= {formule(s)}</small>
          </div>
        ))}
      </div>

      {editJ0 && (
        <div className="form">
          <div style={{ gridColumn: "1 / -1", fontWeight: 600 }}>Soldes d'ouverture (J0) — saisie manuelle des 9 soldes pour cette date</div>
          {SOLDES_PRINCIPAUX.map((s) => (
            <label key={s.cle}>{s.libelle}
              <input inputMode="numeric" value={j0[s.cle] ?? 0} onChange={(e) => { setJ0({ ...j0, [s.cle]: parseInt(e.target.value.replace(/[^\d-]/g, ""), 10) || 0 }); setDirty(true); }} />
            </label>
          ))}
        </div>
      )}

      {BLOCS.map((b) => {
        const ouvert = ouverts.has(b.cle);
        const soldesDuBloc = SOLDES.filter((s) => s.bloc === b.cle);
        const sousTotal = b.lignes.filter((l) => l.sens === "entree").reduce((t, l) => t + (draft[b.cle]?.[l.cle] ?? 0), 0);
        return (
          <div key={b.cle} className="card" style={{ marginBottom: 10, padding: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", cursor: "pointer" }}
              onClick={() => setOuverts((o) => { const n = new Set(o); n.has(b.cle) ? n.delete(b.cle) : n.add(b.cle); return n; })}>
              <b>{ouvert ? "▾" : "▸"} {b.libelle}</b>
              <span className="grow" />
              <small style={{ color: "var(--ink-faint)" }}>Entrées du jour : <b>{fcfa(sousTotal)}</b></small>
            </div>
            {ouvert && (
              <div style={{ padding: "0 16px 14px", borderTop: "1px solid var(--line-soft)" }}>
                <table className="grid" style={{ marginTop: 10 }}>
                  <tbody>
                    {b.lignes.map((l) => {
                      const cle = CLE_PIECE(b.cle, l.cle);
                      const piece = j?.pieces[cle];
                      return (
                        <tr key={l.cle}>
                          <td style={{ width: 260 }}>{l.libelle}{l.sens === "retrait" && <small style={{ color: "var(--red)" }}> (retrait)</small>}</td>
                          <td className="num">
                            <input style={{ width: 140 }} inputMode="numeric" disabled={!peutEditer} value={draft[b.cle]?.[l.cle] ?? 0} onChange={(e) => setMontant(b.cle, l.cle, e.target.value)} />
                          </td>
                          <td>
                            {piece ? <a className="btn" href={piece} target="_blank" rel="noreferrer">Justif. ✓</a>
                              : <button className="btn" disabled={!peutEditer} onClick={() => { setUploadCle(cle); fileRef.current?.click(); }}>Justif.</button>}
                          </td>
                        </tr>
                      );
                    })}
                    {soldesDuBloc.map((s) => (
                      <tr key={s.cle}>
                        <td><b>{s.libelle}</b><br /><small style={{ color: "var(--ink-faint)" }}>= {formule(s)}</small></td>
                        <td className="num"><b>{fcfa(soldes[s.cle] ?? 0)}</b></td><td></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
      <input ref={fileRef} type="file" hidden onChange={(e) => e.target.files?.[0] && envoyerPiece(e.target.files[0])} />

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div><div className="k">RÉCAPITULATIF DU JOUR — recette totale (toutes entrées, retraits exclus)</div><div className="v">{fcfa(recette)}</div></div>
          {j && !j.cloture && peutEditer && (
            <button className={`btn ${confirmCloture ? "primary" : ""}`} onClick={cloturerLeMois} onBlur={() => setConfirmCloture(false)}>
              {confirmCloture ? `Confirmer la clôture de ${libellePeriode(j.periode)}` : `Clôturer ${libellePeriode(j.periode)}`}
            </button>
          )}
        </div>
        <label style={{ display: "block", marginTop: 10, fontSize: 12, color: "var(--ink-soft)" }}>Notes &amp; observations
          <textarea rows={3} disabled={!peutEditer} value={notes} onChange={(e) => { setNotes(e.target.value); setDirty(true); }}
            placeholder="Observations, incidents, notes du jour..." style={{ width: "100%", font: "inherit", padding: 8, border: "1px solid var(--line)", borderRadius: 6, marginTop: 4 }} />
        </label>
      </div>

      <h3 style={{ marginTop: 26 }}>Historique des 14 dernières journées</h3>
      <div className="tbl-wrap">
        <table className="grid">
          <thead><tr><th>Date</th><th className="num">Recette</th><th className="num">F3 Poitiers</th><th className="num">OM Poitiers</th><th className="num">MOMO Poitiers</th><th className="num">F3 Lilas</th><th className="num">Carte Visa</th><th>État</th></tr></thead>
          <tbody>
            {(histo ?? []).map((h: any) => (
              <tr key={h.date} style={{ cursor: "pointer", background: h.date === date ? "var(--card-2)" : undefined }} onClick={() => setDate(h.date)}>
                <td>{new Date(h.date + "T00:00:00").toLocaleDateString("fr-FR")}</td>
                <td className="num"><b>{fcfa(h.recetteTotale)}</b></td>
                <td className="num">{fcfa(h.soldes.poitiers_f3 ?? 0)}</td><td className="num">{fcfa(h.soldes.poitiers_om ?? 0)}</td>
                <td className="num">{fcfa(h.soldes.poitiers_momo ?? 0)}</td><td className="num">{fcfa(h.soldes.lilas_f3 ?? 0)}</td><td className="num">{fcfa(h.soldes.carte_visa ?? 0)}</td>
                <td>{h.cloture ? <span className="badge lock">Clôturée</span> : <span className="badge">Ouverte</span>}</td>
              </tr>
            ))}
            {histo && histo.length === 0 && <tr><td colSpan={8}>Aucune journée saisie avant cette date.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
