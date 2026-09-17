import { useEffect, useMemo, useRef, useState } from "react";
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
  const [caisseActive, setCaisseActive] = useState<string>("poitiers");
  const [voirSoldesDetails, setVoirSoldesDetails] = useState(false);
  const [voirHisto, setVoirHisto] = useState(false);
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

  // Caisse active et navigation
  const blocIndex = BLOCS.findIndex((b) => b.cle === caisseActive);
  const blocActif = BLOCS[blocIndex >= 0 ? blocIndex : 0];
  const blocPrecedent = blocIndex > 0 ? BLOCS[blocIndex - 1] : null;
  const blocSuivant = blocIndex < BLOCS.length - 1 ? BLOCS[blocIndex + 1] : null;

  // Calcul de la ventilation par canal (Collection Summary)
  const canaux = useMemo(() => {
    const c = { especes: 0, om: 0, momo: 0, banque: 0, autres: 0, retraits: 0 };
    for (const b of BLOCS) {
      for (const l of b.lignes) {
        const v = draft[b.cle]?.[l.cle] ?? 0;
        if (l.sens === "retrait") {
          c.retraits += v;
        } else {
          if (l.cle === "especes") c.especes += v;
          else if (l.cle === "om") c.om += v;
          else if (l.cle === "momo") c.momo += v;
          else if (["cheque", "visa", "depot"].includes(l.cle)) c.banque += v;
          else c.autres += v;
        }
      }
    }
    return c;
  }, [draft]);

  const totalMobile = (soldes.poitiers_om ?? 0) + (soldes.poitiers_momo ?? 0) + (soldes.lilas_om ?? 0) + (soldes.lilas_momo ?? 0);

  // Historique pour sparkline (du plus ancien au plus récent)
  const chronoHisto = useMemo(() => {
    return [...(histo ?? [])].reverse();
  }, [histo]);
  const maxRecetteHisto = Math.max(...chronoHisto.map((h: any) => h.recetteTotale), 1);

  // Totaux de la caisse active
  const sousTotalActif = blocActif.lignes.filter((l) => l.sens === "entree").reduce((t, l) => t + (draft[blocActif.cle]?.[l.cle] ?? 0), 0);
  const sousTotalRetraitsActif = blocActif.lignes.filter((l) => l.sens === "retrait").reduce((t, l) => t + (draft[blocActif.cle]?.[l.cle] ?? 0), 0);
  const soldesDuBloc = SOLDES.filter((s) => s.bloc === blocActif.cle);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1>Récapitulatif financier</h1>
          <p className="sub">Cockpit de trésorerie journalier multi-entités et grand livre réactif</p>
        </div>
      </div>

      {/* Barre d'action et sélecteur de date */}
      <div className="cockpit-top-bar">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ padding: "6px 10px", fontWeight: 600 }} />
          <b style={{ textTransform: "capitalize", fontSize: 14 }}>{fmtDate(date)}</b>
        </div>

        {j?.cloture ? (
          <span className="badge lock">Mois clôturé — immuable</span>
        ) : j?.verrou.actif ? (
          j.verrou.mien ? (
            <span className="badge">✓ Verrou actif (vous éditez)</span>
          ) : (
            <span className="badge lock">Verrouillé par {j.verrou.parNom}</span>
          )
        ) : (
          <span className="badge warn">Lecture seule</span>
        )}

        {j && !j.existe && <span className="badge warn">Journée non encore saisie</span>}

        <span className="grow" />

        {j && !j.cloture && !j.verrou.mien && (
          <button className="btn primary" disabled={j.verrou.actif} onClick={verrouiller}>
            Prendre le verrou
          </button>
        )}
        {peutEditer && (
          <button className="btn" onClick={() => setEditJ0((v) => !v)}>
            {editJ0 ? "Masquer Soldes J0" : "Soldes d'ouverture J0"}
          </button>
        )}
        {peutEditer && (
          <button className="btn" onClick={async () => { await libererVerrou({ date }); setMsg("Verrou libéré."); }}>
            Libérer
          </button>
        )}
        {peutEditer && (
          <button className="btn green" disabled={!dirty && !editJ0} onClick={sauver} style={{ fontWeight: 700 }}>
            Enregistrer {dirty && "•"}
          </button>
        )}
      </div>

      {msg && <div className="note">{msg}</div>}

      {/* Bandeau de 4 KPI cartes synthétiques */}
      <div className="cockpit-kpis">
        <div className="cockpit-kpi highlight">
          <div className="k">
            <span>Recette du jour</span>
            <span className="pill-badge" style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}>Entrées</span>
          </div>
          <div className="v">{fcfa(recette)}</div>
          <div className="subtext">Toutes caisses confondues</div>
        </div>

        <div className="cockpit-kpi">
          <div className="k">
            <span>Solde F3 Poitiers</span>
            <span className="badge">Espèces</span>
          </div>
          <div className="v" style={{ color: (soldes.poitiers_f3 ?? 0) < 0 ? "var(--red)" : undefined }}>
            {fcfa(soldes.poitiers_f3 ?? 0)}
          </div>
          <div className="subtext">Caisse physique principale</div>
        </div>

        <div className="cockpit-kpi">
          <div className="k">
            <span>Total Mobile Money</span>
            <span className="badge">OM + MOMO</span>
          </div>
          <div className="v">{fcfa(totalMobile)}</div>
          <div className="subtext">Poitiers &amp; Les Lilas consolidés</div>
        </div>

        <div className="cockpit-kpi">
          <div className="k">
            <span>Solde Carte Visa</span>
            <span className="badge">TPE / Banque</span>
          </div>
          <div className="v" style={{ color: (soldes.carte_visa ?? 0) < 0 ? "var(--red)" : undefined }}>
            {fcfa(soldes.carte_visa ?? 0)}
          </div>
          <div className="subtext">Compte Carte Visa</div>
        </div>
      </div>

      {/* Mode édition des Soldes d'ouverture J0 */}
      {editJ0 && (
        <div className="form" style={{ marginBottom: 20 }}>
          <div style={{ gridColumn: "1 / -1", fontWeight: 700, color: "var(--navy)" }}>
            Soldes d'ouverture (J0) — saisie manuelle des 9 soldes de départ
          </div>
          {SOLDES_PRINCIPAUX.map((s) => (
            <label key={s.cle}>
              {s.libelle}
              <input
                inputMode="numeric"
                value={j0[s.cle] ?? 0}
                onChange={(e) => {
                  setJ0({ ...j0, [s.cle]: parseInt(e.target.value.replace(/[^\d-]/g, ""), 10) || 0 });
                  setDirty(true);
                }}
              />
            </label>
          ))}
        </div>
      )}

      {/* DISPOSITION OPTION 1 : COCKPIT BICOLONNE */}
      <div className="cockpit-grid">
        {/* =========================================================
            COLONNE GAUCHE (390px) : Synthèse Visuelle At-a-Glance
            ========================================================= */}
        <div>
          {/* Carte Trésorerie & Visa (Inspirée de l'Image 1) */}
          <div className="virtual-card">
            <div className="chip-row">
              <span className="brand-title">POITIERS TRÉSORERIE</span>
              <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: 1 }}>VISA</span>
            </div>
            <div style={{ fontSize: 11, color: "#dcfce7", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Solde Carte Visa
            </div>
            <div className="card-val">{fcfa(soldes.carte_visa ?? 0)}</div>
            <div className="card-footer">
              <div>
                <span style={{ display: "block", fontSize: 10, color: "#bbf7d0" }}>Caisse F3 Poitiers</span>
                <b>{fcfa(soldes.poitiers_f3 ?? 0)}</b>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ display: "block", fontSize: 10, color: "#bbf7d0" }}>Date active</span>
                <b>{new Date(date + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</b>
              </div>
            </div>
          </div>

          {/* Collection Summary (Inspirée de l'Image 3) */}
          <div className="collection-box">
            <div className="head">
              <b>Encaissements du jour</b>
              <span className="badge" style={{ fontWeight: 700 }}>
                {fcfa(recette)}
              </span>
            </div>

            {/* Espèces */}
            <div className="collection-item">
              <div className="collection-label-row">
                <span className="channel-name">
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#157a44" }} />
                  Espèces (Caisse F3)
                </span>
                <span className="channel-val">{fcfa(canaux.especes)}</span>
              </div>
              <div className="collection-bar-track">
                <div
                  className="collection-bar-fill"
                  style={{
                    width: `${recette > 0 ? (canaux.especes / recette) * 100 : 0}%`,
                    background: "#157a44",
                  }}
                />
              </div>
            </div>

            {/* Orange Money */}
            <div className="collection-item">
              <div className="collection-label-row">
                <span className="channel-name">
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ea580c" }} />
                  Orange Money (OM)
                </span>
                <span className="channel-val">{fcfa(canaux.om)}</span>
              </div>
              <div className="collection-bar-track">
                <div
                  className="collection-bar-fill"
                  style={{
                    width: `${recette > 0 ? (canaux.om / recette) * 100 : 0}%`,
                    background: "#ea580c",
                  }}
                />
              </div>
            </div>

            {/* MTN Mobile Money */}
            <div className="collection-item">
              <div className="collection-label-row">
                <span className="channel-name">
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#d97706" }} />
                  MTN Mobile Money (MOMO)
                </span>
                <span className="channel-val">{fcfa(canaux.momo)}</span>
              </div>
              <div className="collection-bar-track">
                <div
                  className="collection-bar-fill"
                  style={{
                    width: `${recette > 0 ? (canaux.momo / recette) * 100 : 0}%`,
                    background: "#d97706",
                  }}
                />
              </div>
            </div>

            {/* Carte & Chèques */}
            <div className="collection-item">
              <div className="collection-label-row">
                <span className="channel-name">
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563eb" }} />
                  Chèques &amp; Carte Visa
                </span>
                <span className="channel-val">{fcfa(canaux.banque)}</span>
              </div>
              <div className="collection-bar-track">
                <div
                  className="collection-bar-fill"
                  style={{
                    width: `${recette > 0 ? (canaux.banque / recette) * 100 : 0}%`,
                    background: "#2563eb",
                  }}
                />
              </div>
            </div>

            {/* Autres prestations */}
            {canaux.autres > 0 && (
              <div className="collection-item">
                <div className="collection-label-row">
                  <span className="channel-name">
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#7c3aed" }} />
                    Autres (TDM, Partage...)
                  </span>
                  <span className="channel-val">{fcfa(canaux.autres)}</span>
                </div>
                <div className="collection-bar-track">
                  <div
                    className="collection-bar-fill"
                    style={{
                      width: `${recette > 0 ? (canaux.autres / recette) * 100 : 0}%`,
                      background: "#7c3aed",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Retraits du jour */}
            <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--line-soft)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
              <span style={{ color: "var(--red)", fontWeight: 600 }}>Total retraits du jour</span>
              <b style={{ color: "var(--red)" }}>{fcfa(canaux.retraits)}</b>
            </div>
          </div>

          {/* Évolution des recettes (Sparkline / Graphique tendance) */}
          {chronoHisto.length > 1 && (
            <div className="collection-box">
              <div className="head" style={{ marginBottom: 8 }}>
                <b>Tendance des 14 derniers jours</b>
                <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                  Pic : {fcfa(maxRecetteHisto)}
                </span>
              </div>
              <div style={{ height: 60, width: "100%", marginTop: 4 }}>
                <svg viewBox="0 0 320 60" style={{ width: "100%", height: "100%", overflow: "visible" }}>
                  <defs>
                    <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#157a44" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#157a44" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {(() => {
                    const step = 320 / (chronoHisto.length - 1);
                    const pts = chronoHisto.map((h: any, i: number) => {
                      const x = i * step;
                      const y = 52 - (h.recetteTotale / maxRecetteHisto) * 44;
                      return { x, y, date: h.date, recette: h.recetteTotale };
                    });
                    const ptsStr = pts.map((p) => `${p.x},${p.y}`).join(" ");
                    const fillStr = `0,56 ${ptsStr} 320,56`;
                    return (
                      <>
                        <polygon points={fillStr} fill="url(#sparkGrad)" />
                        <polyline points={ptsStr} fill="none" stroke="#157a44" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        {pts.map((p) => (
                          <circle
                            key={p.date}
                            cx={p.x}
                            cy={p.y}
                            r={p.date === date ? 4.5 : 2.5}
                            fill={p.date === date ? "#0f2a44" : "#157a44"}
                            stroke="#fff"
                            strokeWidth={1.5}
                            style={{ cursor: "pointer" }}
                            onClick={() => setDate(p.date)}
                          />
                        ))}
                      </>
                    );
                  })()}
                </svg>
              </div>
            </div>
          )}

          {/* Soldes consolidés (Mini widget) */}
          <div className="balances-box">
            <div className="head" style={{ cursor: "pointer" }} onClick={() => setVoirSoldesDetails((v) => !v)}>
              <span>Tous les soldes ({SOLDES_PRINCIPAUX.length})</span>
              <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>{voirSoldesDetails ? "Masquer ▴" : "Afficher ▾"}</span>
            </div>
            {voirSoldesDetails && (
              <div style={{ marginTop: 6 }}>
                {SOLDES_PRINCIPAUX.map((s) => (
                  <div className="balance-row" key={s.cle} title={formule(s)}>
                    <span className="b-name">{s.libelle}</span>
                    <span className="b-val" style={{ color: (soldes[s.cle] ?? 0) < 0 ? "var(--red)" : undefined }}>
                      {fcfa(soldes[s.cle] ?? 0)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes & observations du jour */}
          <div className="collection-box">
            <div className="head" style={{ marginBottom: 6 }}>
              <b>Notes du jour</b>
              {dirty && <span className="badge warn">Modifié</span>}
            </div>
            <textarea
              rows={3}
              disabled={!peutEditer}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setDirty(true);
              }}
              placeholder="Événements, incidents, justificatifs manquants..."
              style={{ width: "100%", font: "inherit", padding: 8, border: "1px solid var(--line)", borderRadius: 6, resize: "vertical" }}
            />
          </div>
        </div>

        {/* =========================================================
            COLONNE DROITE : Poste de Saisie Fluide & Segmenté
            ========================================================= */}
        <div>
          {/* Sélecteur de caisse horizontal (Onglets clairs) */}
          <div className="caisse-nav-wrap">
            <div className="caisse-nav-scroll">
              {BLOCS.map((b) => {
                const estActif = b.cle === caisseActive;
                const totalCaisse = b.lignes.filter((l) => l.sens === "entree").reduce((t, l) => t + (draft[b.cle]?.[l.cle] ?? 0), 0);
                return (
                  <button
                    key={b.cle}
                    className={`caisse-nav-btn ${estActif ? "active" : ""}`}
                    onClick={() => setCaisseActive(b.cle)}
                  >
                    <span>{b.libelle}</span>
                    <span className="pill-badge">
                      {totalCaisse > 0 ? fcfa(totalCaisse) : "—"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Station de saisie de la caisse active */}
          <div className="caisse-station-card">
            <div className="caisse-station-head">
              <div>
                <b style={{ fontSize: 16, color: "var(--navy)" }}>{blocActif.libelle}</b>
                <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>
                  {blocActif.lignes.length} ligne(s) de mouvement
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 11, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Entrées : <strong style={{ color: "var(--green)" }}>{fcfa(sousTotalActif)}</strong>
                  {sousTotalRetraitsActif > 0 && <> · Retraits : <strong style={{ color: "var(--red)" }}>{fcfa(sousTotalRetraitsActif)}</strong></>}
                </span>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--navy)" }}>
                  Flux net : {fcfa(sousTotalActif - sousTotalRetraitsActif)}
                </div>
              </div>
            </div>

            <div className="caisse-station-rows">
              {blocActif.lignes.map((l) => {
                const cle = CLE_PIECE(blocActif.cle, l.cle);
                const piece = j?.pieces[cle];
                const estRetrait = l.sens === "retrait";
                return (
                  <div key={l.cle} className="caisse-input-row">
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{l.libelle}</div>
                      <span className={`badge ${estRetrait ? "lock" : ""}`} style={{ fontSize: 10, marginTop: 2 }}>
                        {estRetrait ? "Retrait (débit)" : "Entrée (crédit)"}
                      </span>
                    </div>

                    <div className="caisse-input-field">
                      <input
                        inputMode="numeric"
                        disabled={!peutEditer}
                        value={draft[blocActif.cle]?.[l.cle] ?? 0}
                        onChange={(e) => setMontant(blocActif.cle, l.cle, e.target.value)}
                        style={{ color: estRetrait ? "var(--red)" : undefined }}
                      />
                      <span className="affix">F</span>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      {piece ? (
                        <a className="btn" href={piece} target="_blank" rel="noreferrer" style={{ fontSize: 11, padding: "5px 8px" }}>
                          📎 Justif. ✓
                        </a>
                      ) : (
                        <button
                          className="btn"
                          disabled={!peutEditer}
                          style={{ fontSize: 11, padding: "5px 8px" }}
                          onClick={() => {
                            setUploadCle(cle);
                            fileRef.current?.click();
                          }}
                        >
                          + Justif
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Récapitulatif dynamique des soldes de cette caisse */}
              {soldesDuBloc.length > 0 && (
                <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--line-soft)" }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, color: "var(--navy)", marginBottom: 6 }}>
                    Soldes recalculés pour {blocActif.libelle}
                  </div>
                  {soldesDuBloc.map((s) => (
                    <div key={s.cle} className="caisse-live-solde">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <b>{s.libelle} : {fcfa(soldes[s.cle] ?? 0)}</b>
                        <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                          Ouverture J-1 : {fcfa(ouverture[s.cle] ?? 0)}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 2 }}>
                        = {formule(s)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pied de la station avec navigation vers les autres caisses */}
            <div className="caisse-station-foot">
              <div>
                {blocPrecedent ? (
                  <button className="btn" onClick={() => setCaisseActive(blocPrecedent.cle)} style={{ fontSize: 12 }}>
                    ← {blocPrecedent.libelle}
                  </button>
                ) : (
                  <span />
                )}
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                {peutEditer && (
                  <button className="btn green" disabled={!dirty} onClick={sauver} style={{ fontWeight: 600 }}>
                    Enregistrer
                  </button>
                )}
                {blocSuivant && (
                  <button className="btn primary" onClick={() => setCaisseActive(blocSuivant.cle)} style={{ fontSize: 12 }}>
                    {blocSuivant.libelle} →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <input ref={fileRef} type="file" hidden onChange={(e) => e.target.files?.[0] && envoyerPiece(e.target.files[0])} />

      {/* Clôture mensuelle & Historique des 14 jours */}
      <div className="card" style={{ marginTop: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <b>Historique et Clôture</b>
            <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>
              Consultez les journées précédentes ou clôturez le mois en cours ({libellePeriode(j?.periode ?? "")})
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={() => setVoirHisto((v) => !v)}>
              {voirHisto ? "Masquer l'historique ▴" : "Afficher les 14 dernières journées ▾"}
            </button>
            {j && !j.cloture && peutEditer && (
              <button
                className={`btn ${confirmCloture ? "primary" : ""}`}
                onClick={cloturerLeMois}
                onBlur={() => setConfirmCloture(false)}
              >
                {confirmCloture ? `Confirmer la clôture de ${libellePeriode(j.periode)}` : `Clôturer ${libellePeriode(j.periode)}`}
              </button>
            )}
          </div>
        </div>

        {voirHisto && (
          <div className="tbl-wrap" style={{ marginTop: 16 }}>
            <table className="grid">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="num">Recette</th>
                  <th className="num">F3 Poitiers</th>
                  <th className="num">OM Poitiers</th>
                  <th className="num">MOMO Poitiers</th>
                  <th className="num">F3 Lilas</th>
                  <th className="num">Carte Visa</th>
                  <th>État</th>
                </tr>
              </thead>
              <tbody>
                {(histo ?? []).map((h: any) => (
                  <tr
                    key={h.date}
                    style={{ cursor: "pointer", background: h.date === date ? "var(--card-2)" : undefined }}
                    onClick={() => setDate(h.date)}
                  >
                    <td>{new Date(h.date + "T00:00:00").toLocaleDateString("fr-FR")}</td>
                    <td className="num"><b>{fcfa(h.recetteTotale)}</b></td>
                    <td className="num">{fcfa(h.soldes.poitiers_f3 ?? 0)}</td>
                    <td className="num">{fcfa(h.soldes.poitiers_om ?? 0)}</td>
                    <td className="num">{fcfa(h.soldes.poitiers_momo ?? 0)}</td>
                    <td className="num">{fcfa(h.soldes.lilas_f3 ?? 0)}</td>
                    <td className="num">{fcfa(h.soldes.carte_visa ?? 0)}</td>
                    <td>{h.cloture ? <span className="badge lock">Clôturée</span> : <span className="badge">Ouverte</span>}</td>
                  </tr>
                ))}
                {histo && histo.length === 0 && (
                  <tr><td colSpan={8}>Aucune journée saisie avant cette date.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

