import { fcfa, type Bulletin, type Employe } from "@/lib/payroll";

function L({
  code,
  label,
  base,
  taux,
  gain,
  retenue,
  patron,
  strong,
}: {
  code?: string;
  label: string;
  base?: number;
  taux?: string;
  gain?: number;
  retenue?: number;
  patron?: number;
  strong?: boolean;
}) {
  return (
    <tr className={strong ? "font-bold" : ""}>
      <td className="border border-slate-400 px-1 text-center text-[10px]">
        {code ?? ""}
      </td>
      <td className="border border-slate-400 px-1">{label}</td>
      <td className="border border-slate-400 px-1 text-right tabular-nums">
        {base !== undefined ? fcfa(base) : ""}
      </td>
      <td className="border border-slate-400 px-1 text-right">{taux ?? ""}</td>
      <td className="border border-slate-400 px-1 text-right tabular-nums">
        {gain !== undefined ? fcfa(gain) : ""}
      </td>
      <td className="border border-slate-400 px-1 text-right tabular-nums">
        {retenue !== undefined ? fcfa(retenue) : ""}
      </td>
      <td className="border border-slate-400 px-1 text-right tabular-nums">
        {patron !== undefined ? fcfa(patron) : ""}
      </td>
    </tr>
  );
}

export function BulletinA4({ e, c }: { e: Employe; c: Bulletin }) {
  return (
    <article className="bulletin mx-auto max-w-[900px] bg-white p-4 text-[11px] text-slate-900 shadow-lg print:max-w-none print:p-0 print:shadow-none">
      <table className="w-full border-collapse">
        <tbody>
          <tr>
            <td className="border border-slate-400 bg-sky-600 px-2 py-1 font-bold text-white">
              BULLETIN DE PAIE
            </td>
            <td
              colSpan={3}
              className="border border-slate-400 bg-sky-600 px-2 py-1 text-center font-bold text-white"
            >
              Période du {e.periodeDu} au {e.periodeAu}
            </td>
            <td
              colSpan={2}
              className="border border-slate-400 bg-sky-600 px-2 py-1 text-center font-bold text-white"
            >
              Paiement le {e.datePaiement} par banque
            </td>
          </tr>
          <tr>
            <td
              rowSpan={4}
              className="border border-slate-400 px-2 py-1 align-top"
            >
              <div className="font-bold text-sky-700">TALENTO CONSULTING</div>
              <div>SIEGE : BP 15422 Douala</div>
              <div>TEL : 678 029 168</div>
              <div>talentoconsulting@gmail.com</div>
              <div>NIU : {e.niu || "—"}</div>
              <div>N°CNPS : {e.cnps || "—"}</div>
            </td>
            <td className="border border-slate-400 px-1 text-center text-[10px]">
              Matricule
              <div className="font-semibold">{e.matricule || "-"}</div>
            </td>
            <td className="border border-slate-400 px-1 text-center text-[10px]">
              Catégorie
              <div className="font-semibold">{e.categorie || "-"}</div>
            </td>
            <td className="border border-slate-400 px-1 text-center text-[10px]">
              Échelon
              <div className="font-semibold">{e.echelon || "-"}</div>
            </td>
            <td
              colSpan={2}
              className="border border-slate-400 px-1 text-center text-[10px]"
            >
              Numéro CNPS
              <div className="font-semibold">{e.cnps || "-"}</div>
            </td>
          </tr>
          <tr>
            <td className="border border-slate-400 px-1 text-center text-[10px]">
              Statut
              <div className="font-semibold">Employé</div>
            </td>
            <td
              colSpan={2}
              className="border border-slate-400 px-1 text-center text-[10px]"
            >
              Emploi occupé
              <div className="font-semibold">{e.fonction || "-"}</div>
            </td>
            <td
              colSpan={2}
              className="border border-slate-400 px-1 text-center text-[10px]"
            >
              Département
              <div className="font-semibold">{e.departement || "-"}</div>
            </td>
          </tr>
          <tr>
            <td
              colSpan={2}
              className="border border-slate-400 px-1 text-center text-[10px]"
            >
              Date d'embauche
              <div className="font-semibold">{e.dateEmbauche}</div>
            </td>
            <td className="border border-slate-400 px-1 text-center text-[10px]">
              Horaire
              <div className="font-semibold">40</div>
            </td>
            <td
              colSpan={2}
              className="border border-slate-400 px-1 text-center text-[10px]"
            >
              Adresse
              <div className="font-semibold">{e.adresse}</div>
            </td>
          </tr>
          <tr>
            <td
              colSpan={5}
              className="border border-slate-400 bg-sky-600 px-2 py-2 text-center text-base font-bold text-white"
            >
              {e.nom}
            </td>
          </tr>
        </tbody>
      </table>

      <table className="mt-1 w-full border-collapse">
        <tbody>
          <tr>
            <td className="border border-slate-400 px-1 text-center text-[10px]">
              Nombre de jours travaillés
              <div className="text-sm font-bold">{e.joursTravailles}</div>
            </td>
            <td className="border border-slate-400 px-1 text-center text-[10px]">
              Congés acquis
              <div className="text-sm font-bold">{e.congesJoursAcquis}</div>
            </td>
            <td className="border border-slate-400 px-1 text-center text-[10px]">
              Congés pris
              <div className="text-sm font-bold">{e.congesJoursPris}</div>
            </td>
            <td className="border border-slate-400 px-1 text-center text-[10px] text-sky-700">
              Reste à prendre
              <div className="text-sm font-bold">{c.congesRestants}</div>
            </td>
            <td className="border border-slate-400 px-1 text-center text-[10px]">
              Indemnité de congés
              <div className="text-sm font-bold">{fcfa(c.indemniteConges)}</div>
            </td>
            <td className="border border-slate-400 px-1 text-center text-[10px]">
              Salaire journalier
              <div className="text-sm font-bold">
                {fcfa(c.salaireJournalier)}
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <table className="mt-1 w-full border-collapse">
        <thead>
          <tr className="bg-slate-100 text-[10px]">
            <th className="border border-slate-400 px-1">N°</th>
            <th className="border border-slate-400 px-1">Désignation</th>
            <th className="border border-slate-400 px-1">Base</th>
            <th className="border border-slate-400 px-1">Taux</th>
            <th className="border border-slate-400 px-1">Gain</th>
            <th className="border border-slate-400 px-1">Retenue</th>
            <th className="border border-slate-400 px-1">Charg. patron.</th>
          </tr>
        </thead>
        <tbody>
          <L
            code="66111"
            label="Salaire du mois"
            base={c.salaireBase}
            gain={c.salaireBase}
          />
          <L
            code="66112"
            label="Forfait heures supplémentaires"
            gain={e.heuresSup}
          />
          <L code="66116" label="Ancienneté" gain={e.anciennete} />
          <L code="6613" label="Congés payés" gain={c.indemniteConges} />
          <L
            code="66121"
            label="Prime de transport"
            base={e.primeTransport}
            gain={e.primeTransport}
          />
          <L
            code="66122"
            label="Prime d'assiduité"
            base={e.primeAssiduite}
            gain={e.primeAssiduite}
          />
          <L
            code="6631"
            label="Indemnité de logement"
            base={e.indemniteLogement}
            gain={e.indemniteLogement}
          />
          <L code="66125" label="Primes fixes" gain={e.primesFixes} />
          <L label="TOTAL BRUT" base={c.total1} gain={c.total1} strong />
          <L
            code="43131"
            label="Retenue CNPS"
            base={c.baseCnps}
            taux="4,20%"
            retenue={c.cnpsSalarie}
          />
          <L
            code="66411"
            label="PF"
            base={c.baseCnps}
            taux="7,00%"
            patron={c.pf}
          />
          <L
            code="66412"
            label="PVID PAT"
            base={c.baseCnps}
            taux="4,20%"
            patron={c.pvidPatronal}
          />
          <L
            code="66413"
            label="ATMP"
            base={c.baseCnps}
            taux="1,75%"
            patron={c.atmp}
          />
          <L code="44721" label="IRPP" base={c.brutTaxable} retenue={c.irpp} />
          <L code="44722" label="CAC" base={c.irpp} taux="10%" retenue={c.cac} />
          <L code="44723" label="TDL" base={c.salaireBase} retenue={c.tdl} />
          <L
            code="44724"
            label="CFC SAL"
            base={c.brutTaxable}
            taux="1%"
            retenue={c.cfcSalarie}
          />
          <L
            code="64131"
            label="F.N.E."
            base={c.brutTaxable}
            taux="1,0%"
            patron={c.fne}
          />
          <L
            code="64132"
            label="CFC PAT"
            base={c.brutTaxable}
            taux="1,50%"
            patron={c.cfcPatronal}
          />
          <L code="44725" label="RAV" base={c.brutTaxable} retenue={c.rav} />
          <L label="Sanctions" retenue={e.sanctions} />
          <L label="Absences" retenue={e.absences} />
          <L label="Dettes de soins" retenue={e.dettesSoins} />
          <L label="Acompte" retenue={e.acompte} />
          <L
            label={`Mutuelle (${e.mutuellePct}%)`}
            base={c.total1}
            retenue={c.mutuelle}
          />
          <L
            label="TOTAL COTISATIONS & RETENUES"
            retenue={
              c.totalRetenues +
              e.sanctions +
              e.absences +
              e.dettesSoins +
              e.acompte +
              c.mutuelle
            }
            patron={c.chargesPatronales}
            strong
          />
        </tbody>
      </table>

      <table className="mt-1 w-full border-collapse text-[10px]">
        <tbody>
          <tr>
            <td className="border border-slate-400 px-1 text-center">
              Salaire brut
              <div className="text-sm font-bold">{fcfa(c.total1)}</div>
            </td>
            <td className="border border-slate-400 px-1 text-center">
              Charges salariales
              <div className="text-sm font-bold">{fcfa(c.totalRetenues)}</div>
            </td>
            <td className="border border-slate-400 px-1 text-center">
              Charges patronales
              <div className="text-sm font-bold">
                {fcfa(c.chargesPatronales)}
              </div>
            </td>
            <td className="border border-slate-400 px-1 text-center">
              Heures sup.
              <div className="text-sm font-bold">{fcfa(e.heuresSup)}</div>
            </td>
            <td className="border border-slate-400 bg-green-700 px-2 py-2 text-center text-white">
              NET A PAYER
              <div className="text-lg font-bold">{fcfa(c.netAPayer)}</div>
            </td>
          </tr>
          <tr>
            <td className="border border-slate-400 bg-green-100 px-1 text-center">
              Période : du {e.periodeDu} au {e.periodeAu}
            </td>
            <td colSpan={3} className="border border-slate-400 px-1 text-center">
              Payé par : <strong>SALAIRE {e.societe}</strong>
            </td>
            <td className="border border-slate-400 px-1 text-center">
              Signature employé
            </td>
          </tr>
        </tbody>
      </table>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="border border-slate-400 p-2">
          <div className="text-[10px] font-semibold uppercase">
            Visa du responsable RH
          </div>
          <div className="mt-1 text-[11px]">{e.responsableRH || "—"}</div>
          <div className="mt-1 h-10 font-[cursive] text-lg italic text-sky-800">
            {e.valide ? e.signatureRH || e.responsableRH : ""}
          </div>
          <div className="text-[9px] text-slate-600">
            Signature et cachet de l'employeur
          </div>
        </div>
        <div className="border border-slate-400 p-2">
          <div className="text-[10px] font-semibold uppercase">
            Validation du bulletin
          </div>
          {e.valide ? (
            <div className="mt-1 text-[11px] font-bold text-green-700">
              BULLETIN VALIDÉ le {e.valideLe}
            </div>
          ) : (
            <div className="mt-1 text-[11px] font-bold text-red-700">
              BULLETIN NON VALIDÉ – document provisoire
            </div>
          )}
          <div className="mt-3 text-[9px] text-slate-600">
            Signature de l'employé (précédée de la mention « reçu »)
          </div>
        </div>
      </div>
      <p className="mt-1 text-center text-[9px] font-semibold">
        Pour vous aider à faire valoir vos droits, conservez ce bulletin de paie
        sans limitation de durée.
      </p>
    </article>
  );
}
