import type { Bulletin, Employe } from "@/lib/payroll";

export type BulletinArchive = {
  employeId: string;
  nom: string;
  fonction: string;
  societe: Employe["societe"];
  periodeDu: string;
  periodeAu: string;
  datePaiement: string;
  netAPayer: number;
  valide: boolean;
  responsableRH: string;
  snapshot: Employe;
  calcul: Bulletin;
};

export type ArchiveMois = {
  cle: string; // "2026-01"
  mois: number;
  annee: number;
  libelle: string;
  genereLe: string;
  bulletins: BulletinArchive[];
};
