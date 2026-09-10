import { ShieldCheck, UserCog, User } from "lucide-react";
import { toast } from "sonner";
import { useRole } from "@/lib/role-store";
import { PROFILS, type Role } from "@/types/roles";
import { Badge } from "@/components/ui/badge";

const ICONES: Record<Role, typeof User> = {
  ADMIN: ShieldCheck,
  RH: UserCog,
  UTILISATEUR: User,
};

export function RoleSwitcher() {
  const { role, profil, setRole } = useRole();

  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-3 sm:items-end print:hidden">
      <div className="flex flex-wrap items-center gap-1">
        {PROFILS.map((p) => {
          const Icone = ICONES[p.role];
          const actif = p.role === role;
          return (
            <button
              key={p.role}
              type="button"
              onClick={() => {
                setRole(p.role);
                toast.success(`Profil ${p.libelle} activé`, {
                  description: p.description,
                });
              }}
              aria-pressed={actif}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                actif
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              <Icone className="h-3.5 w-3.5" />
              {p.libelle}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Badge variant="secondary">{profil.utilisateur}</Badge>
        <span className="hidden sm:inline">{profil.description}</span>
      </div>
    </div>
  );
}
