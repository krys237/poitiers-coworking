import { num } from "../lib/format";

// Bulletin A4 au format de référence (application PAIE du directeur) : tableau bordé,
// en-tête période / paiement, bloc employeur, identité, jours & congés, lignes codées, synthèse, visa et validation.
const f0 = (n: number | undefined) => (n ? num(n) : "-");
const pctTxt = (t: number) => (t ? `${t.toLocaleString("fr-FR", { minimumFractionDigits: t % 1 ? 2 : 0 })}%` : "");

export function BulletinCard({ b, entreprise }: { b: any; entreprise: any }) {
  const d = b.details ?? {};
  const couleur = entreprise?.couleurEntete ?? "#0f2a44";
  const totalRetenuesLignes = b.cotisations.reduce((t: number, c: any) => t + c.retenue, 0);
  const totalPatronal = b.cotisations.reduce((t: number, c: any) => t + c.chargePatronale, 0);
  return (
    <article className="bulletin bp">
      {entreprise?.filigrane && <div className="wm" style={{ color: couleur }}>{entreprise.filigrane}</div>}

      <table className="bp-t">
        <tbody>
          <tr>
            <td className="bp-head" style={{ background: couleur, width: "22%" }}>BULLETIN DE PAIE</td>
            <td className="bp-head c" style={{ background: couleur }} colSpan={3}>Période du {b.periodeDu} au {b.periodeAu}</td>
            <td className="bp-head c" style={{ background: couleur }} colSpan={2}>Paiement le {b.datePaiement} par banque</td>
          </tr>
          <tr>
            <td rowSpan={4} className="bp-emp">
              {entreprise?.logoUrl && <img src={entreprise.logoUrl} alt="" style={{ height: 34, marginBottom: 4, objectFit: "contain" }} />}
              <div style={{ fontWeight: 800, color: couleur }}>{entreprise?.nom ?? "ENTREPRISE"}</div>
              <div>{entreprise?.adresse}</div>
              <div>NIU : {entreprise?.niu || "—"}</div>
              <div>N°CNPS : {entreprise?.numeroCnps || "—"}</div>
            </td>
            <td className="bp-k">Matricule<b>{b.matricule || "-"}</b></td>
            <td className="bp-k">Catégorie<b>{b.categorie || "-"}</b></td>
            <td className="bp-k">Échelon<b>{b.echelon || "-"}</b></td>
            <td className="bp-k" colSpan={2}>Numéro CNPS<b>{b.cnps || "-"}</b></td>
          </tr>
          <tr>
            <td className="bp-k">Statut<b>Employé</b></td>
            <td className="bp-k" colSpan={2}>Emploi occupé<b>{b.fonction || "-"}</b></td>
            <td className="bp-k" colSpan={2}>Département<b>{b.departement || "-"}</b></td>
          </tr>
          <tr>
            <td className="bp-k" colSpan={2}>Date d'embauche<b>{b.dateDebut ? new Date(b.dateDebut + "T00:00:00").toLocaleDateString("fr-FR") : "-"}</b></td>
            <td className="bp-k">Horaire<b>40</b></td>
            <td className="bp-k" colSpan={2}>Adresse<b>{b.adresse || "-"}</b></td>
          </tr>
          <tr><td colSpan={5} className="bp-nom">{b.nom}</td></tr>
        </tbody>
      </table>

      <table className="bp-t">
        <tbody><tr>
          <td className="bp-k big">Nombre de jours travaillés<b>{d.joursTravailles ?? "-"}</b></td>
          <td className="bp-k big">Congés acquis<b>{d.congesAcquis ?? "-"}</b></td>
          <td className="bp-k big">Congés pris<b>{d.congesPris ?? "-"}</b></td>
          <td className="bp-k big" style={{ color: "#0369a1" }}>Reste à prendre<b>{d.congesRestants ?? "-"}</b></td>
          <td className="bp-k big">Indemnité de congés<b>{f0(d.indemniteConges)}</b></td>
          <td className="bp-k big">Salaire journalier<b>{f0(d.salaireJournalier)}</b></td>
        </tr></tbody>
      </table>

      <table className="bp-t bp-lines">
        <thead><tr><th>N°</th><th style={{ textAlign: "left" }}>Désignation</th><th>Base</th><th>Taux</th><th>Gain</th><th>Retenue</th><th>Charg. patron.</th></tr></thead>
        <tbody>
          {b.lignesGain.map((l: any, i: number) => (
            <tr key={"g" + i}><td className="c">{l.code}</td><td>{l.libelle}</td><td className="r">{l.base ? num(l.base) : ""}</td><td></td><td className="r">{f0(l.gain)}</td><td></td><td></td></tr>
          ))}
          <tr className="strong"><td></td><td>TOTAL BRUT</td><td className="r">{f0(b.brut)}</td><td></td><td className="r">{f0(b.brut)}</td><td></td><td></td></tr>
          {b.cotisations.map((c: any, i: number) => (
            <tr key={"c" + i}>
              <td className="c">{c.code}</td><td>{c.libelle}</td>
              <td className="r">{c.base ? num(c.base) : ""}</td><td className="r">{pctTxt(c.taux)}</td><td></td>
              <td className="r">{c.retenue ? num(c.retenue) : c.chargePatronale ? "" : "-"}</td>
              <td className="r">{c.chargePatronale ? num(c.chargePatronale) : ""}</td>
            </tr>
          ))}
          <tr className="strong"><td></td><td>TOTAL COTISATIONS &amp; RETENUES</td><td></td><td></td><td></td><td className="r">{f0(totalRetenuesLignes)}</td><td className="r">{f0(totalPatronal)}</td></tr>
        </tbody>
      </table>

      <table className="bp-t">
        <tbody>
          <tr>
            <td className="bp-k big">Salaire brut<b>{f0(b.brut)}</b></td>
            <td className="bp-k big">Charges salariales<b>{f0(d.chargesSalariales)}</b></td>
            <td className="bp-k big">Charges patronales<b>{f0(d.chargesPatronales ?? totalPatronal)}</b></td>
            <td className="bp-k big">Heures sup.<b>{f0(d.heuresSup)}</b></td>
            <td className="bp-net">NET A PAYER<b>{f0(b.net)}</b></td>
          </tr>
          <tr>
            <td className="bp-k" style={{ background: "#dcfce7" }}>Période : du {b.periodeDu} au {b.periodeAu}</td>
            <td className="bp-k" colSpan={3}>Payé par : <b style={{ display: "inline" }}>SALAIRE {b.societe}</b></td>
            <td className="bp-k">Signature employé</td>
          </tr>
        </tbody>
      </table>

      <div className="bp-boxes">
        <div className="bp-box">
          <div className="bp-box-t">Visa du responsable RH</div>
          <div>{entreprise?.responsableRH || "—"}</div>
          <div className="bp-sign">{b.valide ? (entreprise?.responsableRH || "") : ""}</div>
          <div className="bp-small">Signature et cachet de l'employeur</div>
        </div>
        <div className="bp-box">
          <div className="bp-box-t">Validation du bulletin</div>
          {b.valide
            ? <div style={{ color: "#15803d", fontWeight: 700 }}>BULLETIN VALIDÉ le {b.valideLe ? new Date(b.valideLe).toLocaleDateString("fr-FR") : ""}</div>
            : <div style={{ color: "#b91c1c", fontWeight: 700 }}>BULLETIN NON VALIDÉ – document provisoire</div>}
          <div className="bp-small" style={{ marginTop: 14 }}>Signature de l'employé (précédée de la mention « reçu »)</div>
        </div>
      </div>
      <p className="bp-foot">Pour vous aider à faire valoir vos droits, conservez ce bulletin de paie sans limitation de durée.</p>
    </article>
  );
}
