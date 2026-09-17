import { useState } from "react";
import {
  FileTextIcon,
  UsersIcon,
  DownloadIcon,
  PlusIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  TableVide,
} from "@/components/ui/table";

import { PageEnTete, Section, BarreOutils } from "@/components/app/en-tete";
import { Tuile, GrilleTuiles } from "@/components/app/tuile";
import { Statut } from "@/components/app/statut";
import { Montant, Nombre, Reference } from "@/components/app/montant";
import { Avis } from "@/components/app/avis";
import { SqueletteTableau, SqueletteTuiles } from "@/components/app/chargement";
import { EtatVide } from "@/components/app/etat-vide";
import { BoutonAction, BoutonConfirmation } from "@/components/app/bouton-action";
import { Champ, GrilleFormulaire, CelluleNombre, ChampNombre } from "@/components/app/champs";
import { SelecteurPeriode } from "@/components/app/selecteur-periode";
import { Barres } from "@/components/app/barres";
import {
  Feuille,
  EnTeteDocument,
  TableauDocument,
  TotalDocument,
  CasesDocument,
  CaseDocument,
  MentionDocument,
} from "@/components/documents/feuille";

/**
 * Charte « Registre » — page de reference.
 *
 * Elle n'est pas branchee sur Convex et ne fait partie d'aucun parcours : elle
 * sert a valider l'apparence avec le directeur, et de modele pour la migration
 * des 21 ecrans. Chaque bloc montre le composant dans ses ETATS REELS, y
 * compris le chargement et le vide — ce sont ceux qu'on oublie de dessiner.
 *
 * Route : /charte
 */

const COULEURS = [
  { nom: "papier", valeur: "#f2f4ee", role: "Fond de l'application" },
  { nom: "bande", valeur: "#e6ede2", role: "Ligne alternee des tableaux" },
  { nom: "encre", valeur: "#151c18", role: "Texte, barre laterale" },
  { nom: "sceau", valeur: "#0b4a37", role: "En-tetes, action engageante" },
  { nom: "carmin", valeur: "#9e2b20", role: "Debit, verrou, destructif" },
  { nom: "ocre", valeur: "#8a5d12", role: "En attente, vigilance" },
  { nom: "ardoise", valeur: "#2b6382", role: "Information, lien" },
];

const EMPLOYES = [
  { m: "SGC-014", nom: "ABENA Clarisse", fonction: "Comptable", soc: "SGC", jours: 30, base: 285000, primes: 45000, retenues: 62400, net: 267600 },
  { m: "SOF-027", nom: "MBALLA Jean-Pierre", fonction: "Technicien", soc: "SOFINA", jours: 28, base: 196000, primes: 20000, retenues: 31200, net: 184800 },
  { m: "SES-003", nom: "NGONO Marie-Louise", fonction: "Accueil", soc: "SESAME", jours: 30, base: 150000, primes: 15000, retenues: 0, net: 165000 },
  { m: "SGC-041", nom: "TCHAMBA Roger", fonction: "Chauffeur", soc: "SGC", jours: 26, base: 130000, primes: 12000, retenues: 18500, net: 123500 },
];

export function Charte() {
  const [periode, setPeriode] = useState("2026-09");
  const [jours, setJours] = useState<Record<string, number>>({});
  const [acompte, setAcompte] = useState(0);
  const [lectureSeule, setLectureSeule] = useState(false);

  const totaux = EMPLOYES.reduce(
    (t, e) => ({
      base: t.base + e.base,
      primes: t.primes + e.primes,
      retenues: t.retenues + e.retenues,
      net: t.net + e.net,
    }),
    { base: 0, primes: 0, retenues: 0, net: 0 }
  );

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 md:px-8">
      <PageEnTete
        titre="Charte Registre"
        description="Reference visuelle de la plateforme. Chaque composant est montre dans ses etats reels, chargement et vide compris. Cette page ne lit aucune donnee."
        statut={<Badge variant="info">Document de travail</Badge>}
        actions={
          <>
            <Button variant="outline">
              <DownloadIcon /> Exporter
            </Button>
            <Button>
              <PlusIcon /> Action principale
            </Button>
          </>
        }
      />

      {/* ------------------------------------------------------------------ */}
      <Section
        titre="Le parti pris"
        description="Pourquoi cette charte ressemble a ce qu'elle ressemble."
      >
        <div className="grid gap-3 border border-filet bg-surface p-5 md:grid-cols-3">
          <div>
            <p className="mb-1 font-semibold">Le metier donne la forme</p>
            <p className="text-sm text-encre-douce">
              Grand livre, bulletins, barremes, cloture de mois. Le vocabulaire
              visuel vient du registre comptable : papier de listing, filets,
              tampons, totaux arretes.
            </p>
          </div>
          <div>
            <p className="mb-1 font-semibold">Le tableau est le heros</p>
            <p className="text-sm text-encre-douce">
              32 tableaux, jusqu'a 18 colonnes. C'est la que passent les heures.
              Tout le reste de l'interface se tait pour le laisser lire.
            </p>
          </div>
          <div>
            <p className="mb-1 font-semibold">Un seul geste appuye</p>
            <p className="text-sm text-encre-douce">
              Le filet double sous les totaux — la convention du total arrete.
              C'est la seule licence decorative, et elle vient du metier.
            </p>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section titre="Couleurs" description="Sept valeurs nommees. Aucune autre.">
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
          {COULEURS.map((c) => (
            <div key={c.nom} className="border border-filet bg-surface">
              <div className="h-14" style={{ background: c.valeur }} />
              <div className="px-2.5 py-2">
                <div className="font-mono text-xs font-semibold">{c.nom}</div>
                <div className="font-mono text-2xs text-encre-pale">{c.valeur}</div>
                <div className="mt-1 text-2xs leading-snug text-encre-douce">{c.role}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section
        titre="Typographie"
        description="IBM Plex Sans pour le texte, IBM Plex Mono pour les references. Dessinee pour les documents techniques et administratifs, et pourvue de vrais chiffres tabulaires — ce qui est la condition pour aligner une colonne de montants."
      >
        <div className="space-y-3 border border-filet bg-surface p-5">
          <p className="text-2xl font-semibold leading-tight">
            Recapitulatif general des salaires
          </p>
          <p className="text-lg text-encre-douce">
            Periode de paie : septembre 2026 — 42 employes
          </p>
          <p className="max-w-[72ch] text-base">
            Le corps de texte se lit sur moins de 80 caracteres. Les lignes plus
            longues obligent l'oeil a chercher le debut de la suivante, ce qui
            coute a chaque retour a la ligne.
          </p>
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t border-filet-clair pt-3">
            <span className="text-3xl font-semibold tabular-nums">1 284 300</span>
            <span className="text-3xl font-semibold tabular-nums">1 111 111</span>
            <span className="text-sm text-encre-douce">
              Chiffres tabulaires : les deux nombres occupent exactement la meme
              largeur, donc les colonnes s'alignent.
            </span>
          </div>
          <p className="font-mono text-sm">
            SGC-014 · CMR-2026-00418 · code 66111
          </p>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section
        titre="Tableau"
        description="Le composant central. Bandes alternees, en-tete collant, colonnes numeriques alignees, filet double sous les totaux."
      >
        <BarreOutils>
          <SelecteurPeriode valeur={periode} onChange={setPeriode} />
          <Statut etat={lectureSeule ? "cloture" : "ouvert"} />
          <BarreOutils.Espace />
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={lectureSeule} onCheckedChange={setLectureSeule} />
            Simuler un mois cloture
          </label>
        </BarreOutils>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Matricule</TableHead>
              <TableHead>Nom et prenom</TableHead>
              <TableHead>Societe</TableHead>
              <TableHead numerique>Jours</TableHead>
              <TableHead numerique>Salaire de base</TableHead>
              <TableHead numerique>Primes</TableHead>
              <TableHead numerique>Retenues</TableHead>
              <TableHead numerique>Net a payer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {EMPLOYES.map((e) => (
              <TableRow key={e.m}>
                <TableCell>
                  <Reference>{e.m}</Reference>
                </TableCell>
                <TableCell>
                  <span className="font-medium">{e.nom}</span>
                  <span className="block text-2xs text-encre-pale">{e.fonction}</span>
                </TableCell>
                <TableCell>
                  <Badge variant="info">{e.soc}</Badge>
                </TableCell>
                <TableCell numerique>
                  <CelluleNombre
                    libelle={`Jours travailles — ${e.nom}`}
                    valeur={jours[e.m] ?? e.jours}
                    onChange={(v) => setJours((j) => ({ ...j, [e.m]: v }))}
                    modifie={jours[e.m] !== undefined && jours[e.m] !== e.jours}
                    lectureSeule={lectureSeule}
                    largeur={56}
                    min={0}
                    max={31}
                  />
                </TableCell>
                <TableCell numerique>
                  <Montant valeur={e.base} devise={false} />
                </TableCell>
                <TableCell numerique>
                  <Montant valeur={e.primes} devise={false} />
                </TableCell>
                <TableCell numerique>
                  <Montant valeur={-e.retenues} devise={false} signe />
                </TableCell>
                <TableCell numerique>
                  <Montant valeur={e.net} devise={false} gras />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3}>TOTAUX ({EMPLOYES.length} employes)</TableCell>
              <TableCell numerique>
                <Nombre valeur={EMPLOYES.reduce((t, e) => t + e.jours, 0)} />
              </TableCell>
              <TableCell numerique>
                <Montant valeur={totaux.base} devise={false} />
              </TableCell>
              <TableCell numerique>
                <Montant valeur={totaux.primes} devise={false} />
              </TableCell>
              <TableCell numerique>
                <Montant valeur={-totaux.retenues} devise={false} signe />
              </TableCell>
              <TableCell numerique>
                <Montant valeur={totaux.net} devise={false} gras />
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>

        <p className="mt-2 text-xs text-encre-douce">
          La cellule « Jours » est editable : modifiez-en une, le liseré ocre
          marque ce qui n'est pas encore enregistre. Basculez « mois cloture » —
          les champs deviennent du texte au lieu de cases grisees.
        </p>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section titre="Chiffres cles">
        <GrilleTuiles>
          <Tuile libelle="Effectif actif" valeur={<Nombre valeur={42} />} note="dont 6 en periode d'essai" />
          <Tuile libelle="Masse brute du mois" valeur={<Montant valeur={12840300} />} ton="info" />
          <Tuile libelle="Net a payer" valeur={<Montant valeur={10284600} />} ton="succes" note="Paiement le 05/10/2026" />
          <Tuile libelle="Recette du jour" valeur={<Statut etat="non_saisi" />} ton="attente" compact />
          <Tuile libelle="Chargement" valeur={undefined} />
        </GrilleTuiles>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section titre="Statuts" description="Un statut se nomme par son sens, jamais par sa couleur. Chacun porte une icone : la couleur seule ne suffit pas a l'impression en noir et blanc.">
        <div className="flex flex-wrap gap-2 border border-filet bg-surface p-5">
          <Statut etat="ouvert" />
          <Statut etat="cloture" />
          <Statut etat="en_attente" />
          <Statut etat="validee" />
          <Statut etat="rejetee" />
          <Statut etat="livree" />
          <Statut etat="en_cours" />
          <Statut etat="hors_fenetre" />
          <Statut etat="configure" />
          <Statut etat="absent" />
          <Statut etat="actif" />
          <Statut etat="inactif" />
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section titre="Actions">
        <div className="space-y-4 border border-filet bg-surface p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Button>Enregistrer les modifications</Button>
            <Button variant="outline">Exporter en CSV</Button>
            <Button variant="secondary">Filtrer</Button>
            <Button variant="ghost">Annuler</Button>
            <Button variant="destructive">Supprimer</Button>
            <Button disabled>Indisponible</Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-filet-clair pt-4">
            <BoutonAction
              onAction={() => new Promise((r) => setTimeout(r, 1200))}
              succes="Bulletins generes."
            >
              Action avec attente
            </BoutonAction>

            <BoutonConfirmation
              libelle="Generer les bulletins et cloturer"
              titre="Cloturer septembre 2026 ?"
              consequence="Les 42 bulletins du mois seront figes sur le bareme en vigueur aujourd'hui. Les montants ne pourront plus etre modifies, meme si le bareme change ensuite. Cette operation ne peut pas etre annulee."
              motCle="CLOTURER"
              confirmer="Cloturer le mois"
              onConfirmer={() => new Promise((r) => setTimeout(r, 900))}
              succes="42 bulletins generes — mois cloture."
            />
          </div>
          <p className="text-xs text-encre-douce">
            La cloture d'un mois est irreversible. Elle se confirme par une boite
            qui enonce la consequence et exige de recopier un mot — au lieu du
            double-clic sur le meme bouton utilise aujourd'hui.
          </p>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section titre="Saisie">
        <GrilleFormulaire>
          <Champ libelle="Nom et prenom" requis>
            {(a) => <Input {...a} defaultValue="ABENA Clarisse" />}
          </Champ>
          <Champ libelle="Matricule" aide="Format SOC-000">
            {(a) => <Input {...a} defaultValue="SGC-014" className="font-mono" />}
          </Champ>
          <ChampNombre
            libelle="Acompte"
            unite="FCFA"
            valeur={acompte}
            onChange={setAcompte}
            aide="Deduit du net a payer"
          />
          <Champ libelle="Numero CNPS" erreur="Ce numero est deja attribue a un autre employe.">
            {(a) => <Input {...a} defaultValue="1234567890" className="font-mono" />}
          </Champ>
        </GrilleFormulaire>

        <Champ libelle="Observations" aide="Visible sur le bulletin de paie">
          {(a) => <Textarea {...a} rows={3} placeholder="Aucune observation." />}
        </Champ>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section titre="Avis">
        <Avis ton="info" titre="Premiere utilisation" action={<Button size="sm">Initialiser</Button>}>
          Aucun employe n'est enregistre. Chargez les donnees de demonstration
          pour parcourir la plateforme.
        </Avis>
        <Avis ton="attention" titre="Bareme non verifie depuis 34 jours">
          Le controle automatique du bareme officiel n'a pas abouti. Les bulletins
          restent calcules sur la derniere version connue.
        </Avis>
        <Avis ton="erreur" titre="L'operation n'a pas abouti">
          Le mois de septembre 2026 est deja cloture : ses bulletins ne peuvent
          plus etre regeneres.
        </Avis>
        <Avis ton="succes" titre="42 bulletins generes">
          Le mois d'aout 2026 est cloture et archive.
        </Avis>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section
        titre="Chargement et vide"
        description="Les deux etats qu'on oublie de dessiner — et qui sont pourtant les premiers vus."
      >
        <Tabs defaultValue="chargement">
          <TabsList>
            <TabsTrigger value="chargement">Chargement</TabsTrigger>
            <TabsTrigger value="vide">Aucune donnee</TabsTrigger>
            <TabsTrigger value="tableau-vide">Tableau vide</TabsTrigger>
          </TabsList>
          <TabsContent value="chargement" className="space-y-4 pt-3">
            <SqueletteTuiles nombre={4} />
            <SqueletteTableau lignes={5} colonnes={6} />
          </TabsContent>
          <TabsContent value="vide" className="pt-3">
            <EtatVide
              icone={UsersIcon}
              titre="Aucun employe enregistre"
              action={<Button><PlusIcon /> Importer un fichier CSV</Button>}
            >
              Les employes alimentent la paie, le planning et les bulletins.
              Importez la liste existante ou creez les fiches une a une.
            </EtatVide>
          </TabsContent>
          <TabsContent value="tableau-vide" className="pt-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Objet</TableHead>
                  <TableHead numerique>Montant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableVide colonnes={3}>
                  Aucune commande sur cette periode.
                </TableVide>
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section titre="Graphique">
        <Barres
          titre="Chiffre d'affaires des six derniers mois, en FCFA"
          cleActive="Sep"
          donnees={[
            { libelle: "Avr", valeur: 8420000 },
            { libelle: "Mai", valeur: 9180000 },
            { libelle: "Juin", valeur: 7640000 },
            { libelle: "Juil", valeur: 10250000 },
            { libelle: "Aout", valeur: 9870000 },
            { cle: "Sep", libelle: "Sep", valeur: 12840300 },
          ]}
        />
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section
        titre="Document imprimable"
        description="Feuille A4 reelle. Les mesures sont en millimetres : ce bloc sort tel quel sur le papier que signe le directeur. Utilisez l'apercu avant impression du navigateur pour verifier."
      >
        <Feuille provisoire>
          <EnTeteDocument
            raisonSociale="POITIERS COWORKING"
            coordonnees={
              <>
                BP 1234, Yaounde — Cameroun
                <br />
                NIU M0123456789A · CNPS 0987654
              </>
            }
            nature="Bulletin de paie"
            periode="Periode du 01/09/2026 au 30/09/2026 · Paiement le 05/10/2026"
          />

          <TableauDocument>
            <tbody>
              <tr>
                <td className="w-1/3">
                  <b>ABENA Clarisse</b>
                  <br />
                  Comptable — categorie VI, echelon B
                  <br />
                  Matricule SGC-014
                </td>
                <td className="c">
                  Jours travailles
                  <br />
                  <b>30</b>
                </td>
                <td className="c">
                  Conges pris
                  <br />
                  <b>0</b>
                </td>
                <td className="c">
                  Solde de conges
                  <br />
                  <b>13,5 j</b>
                </td>
              </tr>
            </tbody>
          </TableauDocument>

          <div className="mt-2">
            <TableauDocument>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Libelle</th>
                  <th className="r">Base</th>
                  <th className="r">Taux</th>
                  <th className="r">Gain</th>
                  <th className="r">Retenue</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>66111</td>
                  <td>Salaire de base</td>
                  <td className="r">285 000</td>
                  <td className="r">—</td>
                  <td className="r">285 000</td>
                  <td className="r">—</td>
                </tr>
                <tr>
                  <td>66121</td>
                  <td>Prime de transport (exoneree)</td>
                  <td className="r">—</td>
                  <td className="r">—</td>
                  <td className="r">25 000</td>
                  <td className="r">—</td>
                </tr>
                <tr>
                  <td>66122</td>
                  <td>Prime d'assiduite</td>
                  <td className="r">—</td>
                  <td className="r">—</td>
                  <td className="r">20 000</td>
                  <td className="r">—</td>
                </tr>
                <tr>
                  <td>43131</td>
                  <td>CNPS — pension vieillesse</td>
                  <td className="r">285 000</td>
                  <td className="r">4,2 %</td>
                  <td className="r">—</td>
                  <td className="r">11 970</td>
                </tr>
                <tr>
                  <td>44721</td>
                  <td>IRPP</td>
                  <td className="r">273 030</td>
                  <td className="r">—</td>
                  <td className="r">—</td>
                  <td className="r">42 180</td>
                </tr>
                <tr>
                  <td>44722</td>
                  <td>CAC sur IRPP</td>
                  <td className="r">42 180</td>
                  <td className="r">10 %</td>
                  <td className="r">—</td>
                  <td className="r">4 218</td>
                </tr>
                <tr className="appuyee">
                  <td colSpan={4}>TOTAUX</td>
                  <td className="r">330 000</td>
                  <td className="r">58 368</td>
                </tr>
              </tbody>
            </TableauDocument>
          </div>

          <TotalDocument
            intitule="NET A PAYER"
            montant="271 632 FCFA"
            enLettres="deux cent soixante et onze mille six cent trente-deux francs CFA"
          />

          <CasesDocument>
            <CaseDocument intitule="Paye par">
              SALAIRE SGC — virement bancaire
            </CaseDocument>
            <CaseDocument intitule="Visa du responsable RH">
              <span className="text-[8pt] text-encre-pale">
                Signature et cachet
              </span>
            </CaseDocument>
          </CasesDocument>

          <MentionDocument valide={false} />
        </Feuille>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section titre="Pour l'agent qui reprend">
        <Avis ton="info" titre="Feuille de route" action={
          <Button variant="outline" asChild>
            <a href="https://github.com" onClick={(e) => e.preventDefault()}>
              <FileTextIcon /> REFONTE-UX.md
            </a>
          </Button>
        }>
          Le decoupage en taches, les criteres de verification et l'ordre de
          migration des 21 ecrans sont dans <b>REFONTE-UX.md</b> a la racine de{" "}
          <code className="font-mono">app/</code>.
        </Avis>
      </Section>
    </div>
  );
}
