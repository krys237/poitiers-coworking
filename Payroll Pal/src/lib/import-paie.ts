import * as XLSX from "xlsx";
import { nouvelEmploye, genererId, type Employe, type Societe } from "./payroll";

export type LigneImport = Partial<Employe> & { nom: string };

const NUM_FIELDS = [
  "salaireBrut",
  "joursTravailles",
  "primesFixes",
  "primeTransport",
  "primeAssiduite",
  "indemniteLogement",
  "heuresSup",
  "anciennete",
  "congesJoursAcquis",
  "congesJoursPris",
  "sanctions",
  "absences",
  "dettesSoins",
  "acompte",
  "mutuellePct",
] as const;

/** Correspondance entête de colonne -> champ employé */
const ALIAS: Record<string, keyof Employe> = {
  nom: "nom",
  noms: "nom",
  "nom et prenom": "nom",
  "noms et prenoms": "nom",
  employe: "nom",
  fonction: "fonction",
  poste: "fonction",
  emploi: "fonction",
  adresse: "adresse",
  niu: "niu",
  cnps: "cnps",
  "n cnps": "cnps",
  "numero cnps": "cnps",
  matricule: "matricule",
  categorie: "categorie",
  echelon: "echelon",
  departement: "departement",
  section: "section",
  "date embauche": "dateEmbauche",
  "date d embauche": "dateEmbauche",
  "salaire brut": "salaireBrut",
  brut: "salaireBrut",
  salaire: "salaireBrut",
  "jours travailles": "joursTravailles",
  jours: "joursTravailles",
  "primes fixes": "primesFixes",
  primes: "primesFixes",
  "prime transport": "primeTransport",
  transport: "primeTransport",
  "prime assiduite": "primeAssiduite",
  "indemnite logement": "indemniteLogement",
  logement: "indemniteLogement",
  "heures sup": "heuresSup",
  "heures supplementaires": "heuresSup",
  anciennete: "anciennete",
  "conges acquis": "congesJoursAcquis",
  "conges pris": "congesJoursPris",
  sanctions: "sanctions",
  sanction: "sanctions",
  absences: "absences",
  absence: "absences",
  "dettes de soins": "dettesSoins",
  "dettes soins": "dettesSoins",
  acompte: "acompte",
  "mutuelle %": "mutuellePct",
  mutuelle: "mutuellePct",
  societe: "societe",
  entreprise: "societe",
};

const normaliser = (s: string) =>
  s
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9%]+/g, " ")
    .trim();

const nombre = (v: unknown) => {
  if (typeof v === "number") return v;
  const n = Number(
    String(v ?? "")
      .replace(/\s|\u00a0/g, "")
      .replace(/[^\d.,-]/g, "")
      .replace(",", "."),
  );
  return Number.isFinite(n) ? n : 0;
};

export const MODELE_CSV = [
  "Nom;Fonction;Adresse;NIU;CNPS;Matricule;Departement;Salaire brut;Jours travailles;Prime transport;Primes fixes;Heures sup;Anciennete;Conges acquis;Conges pris;Sanctions;Absences;Dettes de soins;Acompte;Mutuelle %;Societe",
  "TARGNE JEAN BEAU;Agent commercial;Douala;M07251785833C;351-1213677-6;EMP-001;Commercial;150000;30;15000;0;0;0;9;0;0;0;0;0;1;SGC",
].join("\n");

export async function lireFichierPaie(file: File): Promise<LigneImport[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", raw: false });
  const nomFeuille = wb.SheetNames[0];
  if (!nomFeuille) throw new Error("Le fichier ne contient aucune feuille.");
  const feuille = wb.Sheets[nomFeuille];
  if (!feuille) throw new Error("Feuille illisible.");
  const brut = XLSX.utils.sheet_to_json<Record<string, unknown>>(feuille, {
    defval: "",
  });
  if (brut.length === 0)
    throw new Error("Aucune ligne trouvée dans le fichier.");

  const lignes: LigneImport[] = [];
  for (const row of brut) {
    const ligne: Record<string, unknown> = {};
    for (const [entete, valeur] of Object.entries(row)) {
      const champ = ALIAS[normaliser(entete)];
      if (!champ) continue;
      if ((NUM_FIELDS as readonly string[]).includes(champ)) {
        ligne[champ] = nombre(valeur);
      } else if (champ === "societe") {
        const s = String(valeur).trim().toUpperCase();
        if (s === "SESAME" || s === "SOFINA" || s === "SGC")
          ligne['societe'] = s as Societe;
      } else {
        ligne[champ] = String(valeur).trim();
      }
    }
    const nom = String(ligne['nom'] ?? "").trim();
    if (nom.length < 2) continue;
    lignes.push({ ...(ligne as Partial<Employe>), nom: nom.toUpperCase() });
  }

  if (lignes.length === 0)
    throw new Error(
      "Aucun employé reconnu : vérifiez la colonne « Nom » et le format du fichier.",
    );
  return lignes;
}

/** Fusionne les lignes importées avec les employés existants (rapprochement par matricule puis nom). */
export function fusionner(existants: Employe[], lignes: LigneImport[]) {
  const resultat = [...existants];
  let misAJour = 0;
  let crees = 0;

  for (const l of lignes) {
    const idx = resultat.findIndex(
      (e) =>
        (l.matricule && e.matricule && e.matricule === l.matricule) ||
        e.nom.toUpperCase() === l.nom.toUpperCase(),
    );
    if (idx >= 0) {
      const actuel = resultat[idx] as Employe;
      resultat[idx] = { ...actuel, ...l, id: actuel.id };
      misAJour++;
    } else {
      resultat.push({
        ...nouvelEmploye(l.nom, l.salaireBrut ?? 0, l.fonction ?? ""),
        ...l,
        id: genererId(),
      } as Employe);
      crees++;
    }
  }
  return { resultat, misAJour, crees };
}
