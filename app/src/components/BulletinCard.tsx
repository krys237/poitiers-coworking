/**
 * Bulletin de paie A4 — refonte validée le 21/09/2026 (maquette « Refonte du bulletin »).
 *
 * Reconstruit sur les briques de `documents/feuille.tsx` : même en-tête que la
 * liste des salaires et le courrier. Sept zones : en-tête, salarié, temps et
 * congés, rubriques (liste codée FIXE du format de référence, intercalaires
 * gains · cotisations et impôts · autres retenues), synthèse (Total 1 / Total 2,
 * net en bleu sceau), visa et reçu, pied de référence.
 *
 * Les formules et l'ordre des rubriques ne changent pas : ils viennent de
 * `convex/lib/paie.ts` et `calculBulletins.ts` (voir CLAUDE.md « Format de paie
 * de référence »). Ce composant ne calcule rien, il met en page ce qu'il reçoit.
 */
import { num } from "../lib/format";
import { Feuille, EnTeteDocument, TableauDocument, CasesDocument, CaseDocument } from "./documents/feuille";

type Ligne = { code?: string; libelle: string; base?: number; taux?: number; gain?: number; retenue?: number; chargePatronale?: number };

const fmtDate = (s?: string) => (s ? new Date(s.length === 10 ? s + "T00:00:00" : s).toLocaleDateString("fr-FR") : "—");
/** Un montant de cellule : vide si absent, « – » estompé si nul, sinon milliers séparés. */
const Cel = ({ v }: { v?: number | null }) => (v === undefined || v === null ? <td className="r" /> : v === 0 ? <td className="r zero">–</td> : <td className="r">{num(v)}</td>);
/** Taux : ceux qui viennent du barème sont écrits ; les barèmes par paliers (IRPP, TDL, RAV) n'ont pas de taux. */
const taux = (c: Ligne) => (c.taux ? `${c.taux.toLocaleString("fr-FR", { minimumFractionDigits: c.taux % 1 ? 2 : 0, maximumFractionDigits: 2 })} %` : ["44721", "44723", "44725"].includes(c.code ?? "") ? "barème" : "");
const jours = (n?: number) => (n === undefined || n === null ? "—" : `${n.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} j`);

export function BulletinCard({ b, entreprise, page }: { b: any; entreprise: any; page?: string }) {
  const d = b.details ?? {};
  const gains: Ligne[] = b.lignesGain ?? [];
  const cotis: Ligne[] = b.cotisations ?? [];
  // Cotisations et impôts = lignes codées ; autres retenues = lignes sans code (sanctions, absences, dettes, acompte, mutuelle, RETENUE libres).
  const codees = cotis.filter((c) => c.code && c.code !== "RETENUE" && c.code !== "MUT");
  const autres = cotis.filter((c) => !c.code || c.code === "RETENUE" || c.code === "MUT");
  const totalRetenues = cotis.reduce((t, c) => t + (c.retenue ?? 0), 0);
  const totalPatronal = cotis.reduce((t, c) => t + (c.chargePatronale ?? 0), 0);
  const joursBase = d.joursBase ?? 30;

  const Groupe = ({ titre }: { titre: string }) => <tr className="groupe"><td colSpan={7}>{titre}</td></tr>;
  const Rangee = ({ l, code }: { l: Ligne; code?: string }) => {
    const nulle = !(l.base || l.gain || l.retenue || l.chargePatronale);
    return (
      <tr className={nulle ? "nulle" : undefined}>
        <td className="code">{code ?? l.code ?? ""}</td>
        <td>{l.libelle}</td>
        <Cel v={l.base} />
        <td className="r">{taux(l)}</td>
        <Cel v={l.gain} />
        <Cel v={l.retenue} />
        <Cel v={l.chargePatronale} />
      </tr>
    );
  };

  return (
    <Feuille provisoire={!b.valide} className="doc-bulletin">
      <EnTeteDocument
        raisonSociale={entreprise?.nom ?? "ENTREPRISE"}
        coordonnees={<>{entreprise?.adresse}<br />NIU {entreprise?.niu || "—"} · N° CNPS {entreprise?.numeroCnps || "—"}</>}
        nature={<>BULLETIN DE PAIE<span className="periode">Période du {b.periodeDu} au {b.periodeAu}</span><span className="paiement">Paiement le {b.datePaiement} par banque</span></>}
      />

      <div className="doc-zone">
        <div className="doc-bandeau doc-bandeau-nom"><span className="nom">{b.nom}</span><span className="matricule">{b.matricule} · {b.societe}</span></div>
        <TableauDocument className="doc-identite">
          <tbody>
            <tr>
              <td><span className="cle">Emploi occupé</span><span className="val">{b.fonction || "—"}</span></td>
              <td><span className="cle">Département</span><span className="val">{b.departement || "—"}</span></td>
              <td><span className="cle">Catégorie · Échelon</span><span className="val">{b.categorie || "—"} · {b.echelon || "—"}</span></td>
              <td><span className="cle">N° CNPS salarié</span><span className="val">{b.cnps || "—"}</span></td>
            </tr>
            <tr>
              <td><span className="cle">Date d'embauche</span><span className="val">{fmtDate(b.dateDebut)}</span></td>
              <td><span className="cle">Statut · Horaire</span><span className="val">Employé · 40 h</span></td>
              <td><span className="cle">Payé par</span><span className="val">SALAIRE {b.societe}</span></td>
              <td><span className="cle">Adresse</span><span className="val">{b.adresse || "—"}</span></td>
            </tr>
          </tbody>
        </TableauDocument>
      </div>

      <div className="doc-zone">
        <TableauDocument className="doc-temps">
          <tbody><tr>
            <td><span className="cle">Jours travaillés</span><span className="val">{d.joursTravailles ?? "—"} / {joursBase}</span></td>
            <td><span className="cle">Salaire journalier</span><span className="val">{d.salaireJournalier ? num(d.salaireJournalier) : "—"}</span></td>
            <td><span className="cle">Congés acquis</span><span className="val">{jours(d.congesAcquis)}</span></td>
            <td><span className="cle">Congés pris</span><span className="val">{jours(d.congesPris)}</span></td>
            <td className="reste"><span className="cle">Reste à prendre</span><span className="val">{jours(d.congesRestants)}</span></td>
            <td><span className="cle">Indemnité de congés</span><span className={`val${d.indemniteConges ? "" : " zero"}`}>{d.indemniteConges ? num(d.indemniteConges) : "0"}</span></td>
          </tr></tbody>
        </TableauDocument>
      </div>

      <div className="doc-zone">
        <TableauDocument className="doc-rubriques">
          <thead><tr><th className="c">N°</th><th>Désignation</th><th className="r">Base (FCFA)</th><th className="r">Taux</th><th className="r">Gain</th><th className="r">Retenue</th><th className="r">Charge patronale</th></tr></thead>
          <tbody>
            <Groupe titre="Gains" />
            {gains.map((l, i) => <Rangee key={"g" + i} l={l} />)}
            <tr className="appuyee"><td /><td>TOTAL BRUT (Total 1)</td><td className="r">{num(b.brut)}</td><td /><td className="r">{num(b.brut)}</td><td /><td /></tr>
            <Groupe titre="Cotisations et impôts" />
            {codees.map((l, i) => <Rangee key={"c" + i} l={l} />)}
            {autres.length > 0 && <Groupe titre="Autres retenues" />}
            {autres.map((l, i) => <Rangee key={"a" + i} l={l} code="" />)}
            <tr className="appuyee"><td /><td>TOTAL COTISATIONS ET RETENUES</td><td /><td /><td /><td className="r">{num(totalRetenues)}</td><td className="r">{num(totalPatronal)}</td></tr>
          </tbody>
        </TableauDocument>
      </div>

      <div className="doc-zone doc-synthese">
        <div><span className="cle">Salaire brut (Total 1)</span><span className="val">{num(b.brut)}</span></div>
        <div><span className="cle">Charges salariales</span><span className="val">{num(d.chargesSalariales ?? totalRetenues)}</span></div>
        <div><span className="cle">Charges patronales</span><span className="val">{num(d.chargesPatronales ?? totalPatronal)}</span></div>
        <div><span className="cle">Heures sup.</span><span className={`val${d.heuresSup ? "" : " zero"}`}>{d.heuresSup ? num(d.heuresSup) : "0"}</span></div>
        <div className="net"><span className="cle">Net à payer (Total 2)</span><span className="val">{num(b.net)}</span><span className="paye">FCFA · Payé par SALAIRE {b.societe} · le {b.datePaiement}</span></div>
      </div>

      <div className="doc-zone">
        <CasesDocument>
          <CaseDocument intitule="Visa du responsable RH">
            <div>{entreprise?.responsableRH || "—"}</div>
            <div className="signature">{b.valide ? entreprise?.responsableRH || "" : ""}</div>
            <div className="petit">Signature et cachet de l'employeur</div>
          </CaseDocument>
          <CaseDocument intitule="Reçu par le salarié">
            <div className="petit">Signature précédée de la mention « reçu »</div>
            <div className="signature" />
            <div className="petit">Pour faire valoir vos droits, conservez ce bulletin sans limitation de durée.</div>
          </CaseDocument>
        </CasesDocument>
        <p className="doc-mention" data-etat={b.valide ? "valide" : "provisoire"}>
          {b.valide ? `BULLETIN VALIDÉ le ${fmtDate(b.valideLe)} — mois clôturé, document définitif` : "BULLETIN NON VALIDÉ — document provisoire, le mois est encore ouvert"}
        </p>
      </div>

      <div className="doc-zone doc-pied">
        <span className="legal">{entreprise?.nom ?? ""} · bulletin établi selon le barème CNPS / CGI applicable à la période</span>
        <span className="ref">{b.periodeDu?.slice(6)}-{b.periodeDu?.slice(3, 5)} · {b.matricule}{page ? ` · ${page}` : ""}</span>
      </div>
    </Feuille>
  );
}
