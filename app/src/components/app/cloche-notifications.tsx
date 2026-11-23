// Cloche de notifications réactive dans l'en-tête (lot S2).
// - Convex est réactif : aucun polling, aucun setInterval.
// - Une seule capsule chiffrée (99+ si tronqué), aucune puce ronde de couleur (charte Ocean Breeze).
// - Clic sur une ligne : marque lue et navigue immédiatement vers `lien`.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { Bell, CheckCheck } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Importance } from "../../../convex/lib/notifications";
import { Button } from "@/components/ui/button";
import { Flag, type FlagVariant } from "@/components/ui/flag";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EtatVide } from "@/components/app/etat-vide";
import { cn } from "@/lib/utils";

function teinteBadge(importance: Importance | null): string {
  switch (importance) {
    case "urgent":
      return "bg-carmin text-white";
    case "a_traiter":
      return "bg-amber-600 text-white";
    default:
      return "bg-ocean-profond text-white";
  }
}

export function flagImportance(importance: Importance): { label: string; variant: FlagVariant } {
  switch (importance) {
    case "urgent":
      return { label: "Urgent", variant: "om" };
    case "a_traiter":
      return { label: "À traiter", variant: "a-renseigner" };
    default:
      return { label: "Info", variant: "finance" };
  }
}

export function tempsRelatif(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (diffSec < 60) return "à l'instant";
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  if (j < 30) return `il y a ${j} j`;
  return iso.slice(0, 10);
}

export function ClocheNotifications() {
  const [ouvert, setOuvert] = useState(false);
  const navigate = useNavigate();
  const nonLues = useQuery(api.notifications.nonLues);
  const historique = useQuery(api.notifications.historique, { limite: 15 });
  const marquerLue = useMutation(api.notifications.marquerLue);
  const marquerToutesLues = useMutation(api.notifications.marquerToutesLues);

  const total = nonLues?.total ?? 0;
  const tronque = nonLues?.tronque ?? false;
  const badgeTexte = tronque ? "99+" : String(total);

  // 15 plus récentes : non lues en tête, puis lues du jour (spec S2 §4).
  const aujourdHui = new Date().toISOString().slice(0, 10);
  const recentes = (() => {
    const nonLuesListe = nonLues?.lignes ?? [];
    const idsNonLues = new Set(nonLuesListe.map((n) => String(n._id)));
    const luesDuJour = (historique?.lignes ?? []).filter(
      (n) => n.lu && !idsNonLues.has(String(n._id)) && n.creeLe.slice(0, 10) === aujourdHui,
    );
    return [...nonLuesListe, ...luesDuJour].slice(0, 15);
  })();

  function ouvrirNotification(id: Id<"notifications">, lien: string, dejaLue: boolean) {
    setOuvert(false);
    if (!dejaLue) {
      void marquerLue({ notificationId: id });
    }
    navigate(lien);
  }

  return (
    <Popover open={ouvert} onOpenChange={setOuvert}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-encre-douce hover:bg-papier hover:text-encre"
          aria-label={total > 0 ? `${badgeTexte} notifications non lues` : "Notifications"}
        >
          <Bell className="h-4 w-4" />
          {nonLues && total > 0 && (
            <span
              className={cn(
                "absolute -right-0.5 -top-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full px-1 py-0.5 font-mono text-[10px] font-bold leading-none tabular-nums shadow-xs",
                teinteBadge(nonLues.importanceDominante),
              )}
            >
              {badgeTexte}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(380px,calc(100vw-1rem))] p-0 border-filet bg-surface shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-filet px-3.5 py-2.5">
          <span className="text-xs font-semibold text-encre">Notifications</span>
          {total > 0 && (
            <span className="font-mono text-[11px] font-semibold tabular-nums text-ocean-profond">
              {badgeTexte} non lue{total > 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="max-h-[380px] overflow-y-auto divide-y divide-filet-clair">
          {recentes.length === 0 ? (
            <div className="p-3">
              <EtatVide compact titre="Aucune notification" />
            </div>
          ) : (
            recentes.map((n) => {
              const imp = flagImportance(n.importance as Importance);
              return (
                <button
                  key={n._id}
                  type="button"
                  onClick={() => ouvrirNotification(n._id, n.lien, n.lu)}
                  className={cn(
                    "flex w-full flex-col gap-1 px-3.5 py-2.5 text-left transition-colors hover:bg-papier",
                    n.lu ? "opacity-65" : "bg-ocean-brume/20",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Flag variant={imp.variant} size="xs">
                      {imp.label}
                    </Flag>
                    <span className="font-mono text-[10px] tabular-nums text-encre-pale">
                      {tempsRelatif(n.creeLe)}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-encre leading-snug">
                    {n.titre}
                  </div>
                  {n.corps && (
                    <div className="truncate text-xs text-encre-douce">
                      {n.corps}
                    </div>
                  )}
                  {n.acteurNom && (
                    <div className="text-[11px] text-encre-pale">{n.acteurNom}</div>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-filet bg-papier/60 px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={total === 0}
            onClick={() => void marquerToutesLues({})}
            className="h-7 gap-1 px-2 text-xs text-encre-douce hover:text-encre"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Tout marquer comme lu
          </Button>
          <Button
            variant="link"
            size="sm"
            onClick={() => {
              setOuvert(false);
              navigate("/notifications");
            }}
            className="h-7 px-2 text-xs font-semibold text-ocean-profond"
          >
            Voir tout
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
