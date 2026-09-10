import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  calculer,
  nouvelEmploye,
  type Employe,
  type Taux,
} from "./payroll";
import { EMPLOYES_POITIERS } from "./employes-poitiers";
import { tauxOfficiels } from "./taux-officiels";
import type { ArchiveMois } from "@/types/archive";

const KEY = "paie-employes-v2";
const KEY_ARCHIVES = "paie-archives-v1";
const KEY_TAUX = "paie-taux-v1";

type Ctx = {
  employes: Employe[];
  archives: ArchiveMois[];
  taux: Record<string, Taux>;
  tauxDe: (cle: string) => Taux;
  majTaux: (cle: string, patch: Partial<Taux>) => void;
  reinitialiserTaux: (cle: string) => void;
  maj: (id: string, patch: Partial<Employe>) => void;
  ajouter: (e: Employe) => void;
  supprimer: (id: string) => void;
  reinitialiser: () => void;
  remplacerTous: (list: Employe[]) => void;
  viderEffectif: () => void;
  archiver: (
    entree: Omit<ArchiveMois, "bulletins" | "genereLe">,
    employes: Employe[],
  ) => void;
  supprimerArchive: (cle: string) => void;
  validerArchive: (cle: string, responsable: string) => number;
};

const PaieContext = createContext<Ctx | null>(null);

/** Complète les employés stockés avant l'ajout de nouveaux champs. */
const migrer = (list: Employe[]): Employe[] =>
  list.map((e) => ({ ...nouvelEmploye(e.nom, e.salaireBrut), ...e }));


export function PaieProvider({ children }: { children: ReactNode }) {
  const [employes, setEmployes] = useState<Employe[]>(EMPLOYES_POITIERS);
  const [archives, setArchives] = useState<ArchiveMois[]>([]);
  const [taux, setTaux] = useState<Record<string, Taux>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setEmployes(migrer(JSON.parse(raw) as Employe[]));
      const rawA = localStorage.getItem(KEY_ARCHIVES);
      if (rawA) setArchives(JSON.parse(rawA) as ArchiveMois[]);
      const rawT = localStorage.getItem(KEY_TAUX);
      if (rawT) setTaux(JSON.parse(rawT) as Record<string, Taux>);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(employes));
    } catch {
      /* ignore */
    }
  }, [employes]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY_ARCHIVES, JSON.stringify(archives));
    } catch {
      /* ignore */
    }
  }, [archives]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY_TAUX, JSON.stringify(taux));
    } catch {
      /* ignore */
    }
  }, [taux]);

  // Base = barème officiel du mois, puis surcharges éventuelles de l'utilisateur
  const tauxDe = useCallback(
    (cle: string): Taux => ({ ...tauxOfficiels(cle), ...(taux[cle] ?? {}) }),
    [taux],
  );

  const majTaux = useCallback((cle: string, patch: Partial<Taux>) => {
    setTaux((t) => ({
      ...t,
      [cle]: { ...tauxOfficiels(cle), ...(t[cle] ?? {}), ...patch },
    }));
  }, []);


  const reinitialiserTaux = useCallback((cle: string) => {
    setTaux((t) => {
      const copie = { ...t };
      delete copie[cle];
      return copie;
    });
  }, []);


  const maj = useCallback((id: string, patch: Partial<Employe>) => {
    setEmployes((list) =>
      list.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );
  }, []);

  const ajouter = useCallback(
    (e: Employe) => setEmployes((list) => [...list, e]),
    [],
  );
  const supprimer = useCallback(
    (id: string) => setEmployes((list) => list.filter((e) => e.id !== id)),
    [],
  );
  const reinitialiser = useCallback(() => setEmployes(EMPLOYES_POITIERS), []);
  const remplacerTous = useCallback(
    (list: Employe[]) => setEmployes(list),
    [],
  );
  const viderEffectif = useCallback(() => setEmployes([]), []);

  const archiver = useCallback<Ctx["archiver"]>(
    (entree, liste) => {
      const t = tauxDe(entree.cle);
      const bulletins = liste.map((e) => {
        const calcul = calculer(e, t);
        return {
          employeId: e.id,
          nom: e.nom,
          fonction: e.fonction,
          societe: e.societe,
          periodeDu: e.periodeDu,
          periodeAu: e.periodeAu,
          datePaiement: e.datePaiement,
          netAPayer: calcul.netAPayer,
          valide: e.valide,
          responsableRH: e.responsableRH,
          snapshot: { ...e },
          calcul,
        };
      });
      setArchives((list) => [
        {
          ...entree,
          genereLe: new Date().toLocaleString("fr-FR"),
          bulletins,
        },
        ...list.filter((a) => a.cle !== entree.cle),
      ]);
    },
    [tauxDe],
  );

  const supprimerArchive = useCallback(
    (cle: string) => setArchives((list) => list.filter((a) => a.cle !== cle)),
    [],
  );

  /** Valide d'un coup tous les bulletins non validés d'un mois archivé. */
  const validerArchive = useCallback((cle: string, responsable: string) => {
    const date = new Date().toLocaleDateString("fr-FR");
    let nb = 0;
    const ids = new Set<string>();
    setArchives((list) =>
      list.map((a) => {
        if (a.cle !== cle) return a;
        return {
          ...a,
          bulletins: a.bulletins.map((b) => {
            if (b.valide) return b;
            nb += 1;
            ids.add(b.employeId);
            return {
              ...b,
              valide: true,
              responsableRH: responsable,
              snapshot: {
                ...b.snapshot,
                valide: true,
                valideLe: date,
                responsableRH: responsable,
              },
            };
          }),
        };
      }),
    );
    setEmployes((list) =>
      list.map((e) =>
        ids.has(e.id)
          ? { ...e, valide: true, valideLe: date, responsableRH: responsable }
          : e,
      ),
    );
    return nb;
  }, []);

  return (
    <PaieContext.Provider
      value={{
        employes,
        archives,
        taux,
        tauxDe,
        majTaux,
        reinitialiserTaux,
        validerArchive,
        maj,
        ajouter,
        supprimer,
        reinitialiser,
        remplacerTous,
        viderEffectif,

        archiver,
        supprimerArchive,
      }}
    >
      {children}
    </PaieContext.Provider>
  );
}

export function usePaie() {
  const ctx = useContext(PaieContext);
  if (!ctx) throw new Error("usePaie doit être utilisé dans PaieProvider");
  return ctx;
}
