import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { profilDe, type Permission, type Role } from "@/types/roles";

const KEY = "paie-role-v1";

type Ctx = {
  role: Role;
  profil: ReturnType<typeof profilDe>;
  setRole: (r: Role) => void;
  peut: (p: Permission) => boolean;
};

const RoleContext = createContext<Ctx | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>("ADMIN");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY) as Role | null;
      if (raw === "ADMIN" || raw === "RH" || raw === "UTILISATEUR")
        setRoleState(raw);
    } catch {
      /* ignore */
    }
  }, []);

  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    try {
      localStorage.setItem(KEY, r);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<Ctx>(() => {
    const profil = profilDe(role);
    return {
      role,
      profil,
      setRole,
      peut: (p: Permission) => profil.permissions.includes(p),
    };
  }, [role, setRole]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole doit être utilisé dans RoleProvider");
  return ctx;
}
