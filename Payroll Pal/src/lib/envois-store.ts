import { useCallback, useEffect, useState } from "react";

export type StatutEnvoi = "envoye" | "echec" | "en_attente";

export type Envoi = {
  id: string;
  employeId: string;
  employe: string;
  email: string;
  periode: string;
  date: string; // ISO
  statut: StatutEnvoi;
  detail: string;
};

const CLE = "paie-envois-v1";
const EVT = "paie-envois-maj";

export const LIBELLE_STATUT: Record<StatutEnvoi, string> = {
  envoye: "Envoyé",
  echec: "Échec",
  en_attente: "En attente",
};

export function lireEnvois(): Envoi[] {
  if (typeof window === "undefined") return [];
  try {
    const brut = window.localStorage.getItem(CLE);
    return brut ? (JSON.parse(brut) as Envoi[]) : [];
  } catch {
    return [];
  }
}

export function enregistrerEnvoi(envoi: Omit<Envoi, "id" | "date">) {
  if (typeof window === "undefined") return;
  const liste = lireEnvois();
  liste.unshift({
    ...envoi,
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    date: new Date().toISOString(),
  });
  window.localStorage.setItem(CLE, JSON.stringify(liste.slice(0, 500)));
  window.dispatchEvent(new Event(EVT));
}

export function viderEnvois() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CLE);
  window.dispatchEvent(new Event(EVT));
}

export function useEnvois() {
  const [envois, setEnvois] = useState<Envoi[]>([]);
  const [pret, setPret] = useState(false);

  const rafraichir = useCallback(() => setEnvois(lireEnvois()), []);

  useEffect(() => {
    rafraichir();
    setPret(true);
    window.addEventListener(EVT, rafraichir);
    window.addEventListener("storage", rafraichir);
    return () => {
      window.removeEventListener(EVT, rafraichir);
      window.removeEventListener("storage", rafraichir);
    };
  }, [rafraichir]);

  return { envois, pret, rafraichir };
}
