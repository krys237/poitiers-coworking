/**
 * Fiche API — export financier — refonte (charte poitiers-ui-ux-system).
 *
 * La documentation vivante de l'API d'export du grand livre journalier, pour
 * l'intégrateur (comptabilité, BI) et pour le DG qui surveille son usage.
 * Deux couches obligatoires : le proxy Node.js (IP · clé · rate-limit) puis le
 * backend qui re-valide la clé. La clé elle-même n'est jamais affichée.
 *
 * Lecture : tuiles d'état (clé, appels 7 j, derniers statuts, point d'entrée),
 * puis quatre onglets — Utiliser (requêtes types à copier, paramètres,
 * réponse), Codes de réponse, Proxy & sécurité, Derniers appels (journal
 * filtré, lien vers le journal complet).
 */
import * as React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { CheckIcon, Code2Icon, CopyIcon, ScrollTextIcon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { BLOCS } from "../../convex/lib/tresorerie";
import { cn } from "@/lib/utils";
import { PageEnTete } from "@/components/app/en-tete";
import { GrilleTuiles, Tuile } from "@/components/app/tuile";
import { Statut } from "@/components/app/statut";
import { SqueletteTableau } from "@/components/app/chargement";
import { Auteur, CodeHttp, fmtDateHeure, relatif } from "@/components/app/journal";
import { Button } from "@/components/ui/button";
import { Flag } from "@/components/ui/flag";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// --- Vocabulaire ----------------------------------------------------------------

const SITE = (import.meta.env.VITE_CONVEX_SITE_URL as string) || "https://<deploiement>.convex.site";
const ENTITES = BLOCS.map((b) => ({ cle: b.cle, libelle: b.libelle }));

const CODES: { code: number; sens: string; remede: string; couche: "proxy" | "backend" | "les deux" }[] = [
  { code: 200, sens: "Succès : la journée demandée est renvoyée.", remede: "—", couche: "les deux" },
  { code: 400, sens: "Date invalide (format AAAA-MM-JJ) ou entité inconnue.", remede: "Corriger les paramètres `date` / `entity`.", couche: "backend" },
  { code: 401, sens: "Clé absente ou invalide.", remede: "Vérifier l'en-tête `X-Api-Key` (même valeur des deux côtés).", couche: "les deux" },
  { code: 403, sens: "Adresse IP non autorisée.", remede: "Ajouter l'IP appelante à `ALLOWED_IPS` du proxy.", couche: "proxy" },
  { code: 404, sens: "Aucune journée saisie à cette date.", remede: "Vérifier le récapitulatif financier : la journée existe-t-elle ?", couche: "backend" },
  { code: 429, sens: "Quota d'appels dépassé (fenêtre glissante de 60 s).", remede: "Respecter `Retry-After`, ou relever `RATE_LIMIT_RPM`.", couche: "proxy" },
  { code: 502, sens: "Backend injoignable depuis le proxy.", remede: "Vérifier `CONVEX_SITE_URL` et la connectivité sortante.", couche: "proxy" },
  { code: 503, sens: "Clé non configurée côté backend.", remede: "`npx convex env set FINANCIAL_API_KEY …` puis redéployer.", couche: "backend" },
];

const VARIABLES_PROXY = [
  { nom: "PROXY_PORT", role: "port d'écoute (3100 par défaut)" },
  { nom: "CONVEX_SITE_URL", role: "URL du backend (…convex.site) vers lequel relayer" },
  { nom: "FINANCIAL_API_KEY", role: "la clé, identique au secret Convex ; jamais dans le code" },
  { nom: "ALLOWED_IPS", role: "liste blanche des IP appelantes, séparées par des virgules" },
  { nom: "RATE_LIMIT_RPM", role: "appels autorisés par IP et par minute (fenêtre glissante)" },
];

/** Un extrait de code copiable ; le libellé dit à quoi il sert. */
function Extrait({ titre, code, note }: { titre: string; code: string; note?: string }) {
  const [copie, setCopie] = React.useState(false);
  const copier = async () => {
    try { await navigator.clipboard.writeText(code); setCopie(true); setTimeout(() => setCopie(false), 1500); }
    catch { toast.error("Impossible de copier : sélectionnez le texte à la main."); }
  };
  return (
    <div className="overflow-hidden rounded-lg border border-filet">
      <div className="flex items-center justify-between gap-2 border-b border-filet bg-fond px-3 py-1.5">
        <span className="text-xs font-semibold">{titre}</span>
        <Button variant="ghost" size="sm" className="h-7 text-2xs" onClick={copier} aria-label={`Copier : ${titre}`}>
          {copie ? <><CheckIcon /> Copié</> : <><CopyIcon /> Copier</>}
        </Button>
      </div>
      <pre className="overflow-x-auto bg-ocean-nuit px-3 py-2.5 font-mono text-xs leading-relaxed text-sky-100"><code>{code}</code></pre>
      {note && <div className="border-t border-filet px-3 py-1.5 text-2xs text-encre-pale">{note}</div>}
    </div>
  );
}

const Code = ({ children }: { children: React.ReactNode }) => <code className="rounded bg-filet-clair px-1 py-0.5 font-mono text-[11px]">{children}</code>;
/** Rend `ceci` en code dans une phrase. */
const enCode = (s: string) => s.split(/(`[^`]+`)/g).map((p, i) => (p.startsWith("`") ? <Code key={i}>{p.slice(1, -1)}</Code> : <React.Fragment key={i}>{p}</React.Fragment>));

// --- Page -------------------------------------------------------------------------

export function ApiReadme() {
  const etat = useQuery(api.journal.etatApi);
  const derniers = (etat?.derniers ?? []) as { _id: string; date: string; auteurNom?: string; cible?: string; detail?: string; statut?: number; ip?: string }[];
  const reussis = derniers.filter((d) => (d.statut ?? 0) < 300).length;
  const refuses = derniers.filter((d) => (d.statut ?? 0) >= 400 && (d.statut ?? 0) < 500).length;
  const erreurs = derniers.filter((d) => (d.statut ?? 0) >= 500).length;
  const site = etat?.siteUrl ?? SITE;
  const exemple = { date: "2026-09-07", entites: "poitiers,lilas" };

  return (
    <div className="space-y-4">
      <PageEnTete
        titre="Fiche API — export financier"
        description="Le grand livre journalier exposé aux systèmes tiers (comptabilité, BI) : GET /api/financial. Deux couches obligatoires — un proxy Node.js sur votre réseau (liste blanche IP, clé, quota) puis le backend qui re-valide la clé et journalise chaque appel. La clé n'est jamais affichée ici."
        statut={etat === undefined ? null : <Flag variant={etat.cleConfiguree ? "renseigne" : "a-renseigner"} size="sm" icon={<Code2Icon className="h-3 w-3" />}>{etat.cleConfiguree ? "Clé backend configurée" : "Clé backend absente — API en 503"}</Flag>}
        actions={<Button variant="outline" size="sm" asChild><Link to="/journal?action=api_financial"><ScrollTextIcon /> Journal des appels</Link></Button>}
      />

      <GrilleTuiles>
        <Tuile libelle="Clé backend" valeur={etat ? <Statut etat={etat.cleConfiguree ? "configure" : "absent"}>{etat.cleConfiguree ? "Configurée" : "Absente"}</Statut> : undefined} note={etat?.cleConfiguree ? "secret FINANCIAL_API_KEY présent sur le déploiement" : "définir FINANCIAL_API_KEY : tout appel répond 503"} compact vedette />
        <Tuile libelle="Appels sur 7 jours" valeur={etat?.appels7j} note="toutes réponses confondues" />
        <Tuile libelle="20 derniers appels" valeur={etat ? `${reussis} / ${derniers.length}` : undefined} note={derniers.length ? `réussis · ${refuses} refusé(s) · ${erreurs} erreur(s)` : "aucun appel journalisé"} />
        <Tuile libelle="Point d'entrée" valeur={<span className="font-mono text-sm">{site.replace(/^https?:\/\//, "")}</span>} note="version 2.0 · 8 entités · GET /health pour la disponibilité" compact />
      </GrilleTuiles>

      <Tabs defaultValue="utiliser">
        <TabsList>
          <TabsTrigger value="utiliser">Utiliser l'API</TabsTrigger>
          <TabsTrigger value="codes">Codes de réponse</TabsTrigger>
          <TabsTrigger value="proxy">Proxy & sécurité</TabsTrigger>
          <TabsTrigger value="appels">Derniers appels{derniers.length ? ` (${derniers.length})` : ""}</TabsTrigger>
        </TabsList>

        <TabsContent value="utiliser" className="space-y-4">
          <div className="grid gap-3 2xl:grid-cols-2">
            <Extrait titre="Via le proxy (recommandé)" code={`curl -H "X-Api-Key: <clé>" \\\n  "http://VOTRE-PROXY:3100/api/financial?date=${exemple.date}\\\n&entity=${exemple.entites}"`} note="Le proxy vérifie l'IP, la clé et le quota, puis relaie au backend." />
            <Extrait titre="Directement sur le backend (réseau privé seulement)" code={`curl -H "X-Api-Key: <clé>" \\\n  "${site}/api/financial?date=${exemple.date}"`} note="Sans proxy, ni liste blanche IP ni quota : à réserver aux tests." />
          </div>
          <Extrait titre="JavaScript (Node ≥ 18)" code={`const url = "${site}/api/financial"\n  + "?date=${exemple.date}&entity=poitiers";\nconst r = await fetch(url, {\n  headers: { "X-Api-Key": process.env.FINANCIAL_API_KEY },\n});\nif (!r.ok) throw new Error(\`API \${r.status}\`);\nconst j = await r.json(); // { date, periode, cloture, entites, soldesOuverture, soldes, recetteTotale }`} />

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-filet bg-surface p-4">
              <h2 className="mb-2 text-sm font-semibold">Paramètres</h2>
              <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-2 text-xs">
                <dt><Code>date</Code></dt><dd><b>Requis.</b> Journée demandée, <Code>AAAA-MM-JJ</Code>. Une journée doit avoir été saisie dans le récapitulatif financier.</dd>
                <dt><Code>entity</Code></dt><dd>Optionnel. Une ou plusieurs entités séparées par des virgules ; absent = toutes.</dd>
                <dt><Code>X-Api-Key</Code></dt><dd>En-tête obligatoire, la clé partagée. Comparée en temps constant des deux côtés.</dd>
              </dl>
              <h3 className="mb-1 mt-3 text-xs font-semibold text-encre-douce">Entités</h3>
              <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                {ENTITES.map((e) => <li key={e.cle} className="flex items-baseline gap-2"><Code>{e.cle}</Code><span className="truncate text-encre-douce">{e.libelle}</span></li>)}
              </ul>
            </section>
            <section className="rounded-xl border border-filet bg-surface p-4">
              <h2 className="mb-2 text-sm font-semibold">Réponse</h2>
              <dl className="grid grid-cols-[8.5rem_1fr] gap-x-3 gap-y-2 text-xs">
                <dt><Code>date</Code> · <Code>periode</Code></dt><dd>La journée et son mois <Code>AAAA-MM</Code>.</dd>
                <dt><Code>cloture</Code></dt><dd><Code>true</Code> si le mois est clôturé : la journée est alors immuable.</dd>
                <dt><Code>entites</Code></dt><dd>Par clé d'entité : <Code>libelle</Code>, <Code>lignes</Code> (montants par ligne), <Code>entrees</Code>, <Code>retraits</Code>, <Code>net</Code>.</dd>
                <dt><Code>soldesOuverture</Code> · <Code>soldes</Code></dt><dd>Soldes J-1 et J par canal (J-1 + entrées − retraits), limités aux entités demandées.</dd>
                <dt><Code>recetteTotale</Code></dt><dd>Somme des entrées (les retraits n'en font pas partie).</dd>
              </dl>
              <p className="mt-3 text-2xs text-encre-pale">Montants en FCFA entiers. En-têtes : <Code>Cache-Control: no-store</Code>, <Code>X-Content-Type-Options: nosniff</Code>.</p>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="codes">
          <Table classNameConteneur="rounded-xl">
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Code</TableHead>
                <TableHead>Signification</TableHead>
                <TableHead>Que faire</TableHead>
                <TableHead className="w-28">Renvoyé par</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CODES.map((c) => (
                <TableRow key={c.code}>
                  <TableCell><CodeHttp code={c.code} /></TableCell>
                  <TableCell className="text-xs">{c.sens}</TableCell>
                  <TableCell className="text-xs text-encre-douce">{enCode(c.remede)}</TableCell>
                  <TableCell><Flag variant="neutre" size="xs">{c.couche}</Flag></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="proxy" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-filet bg-surface p-4">
              <h2 className="mb-2 text-sm font-semibold">Deux couches, toutes deux obligatoires</h2>
              <ol className="space-y-2 text-xs">
                <li className="flex gap-2"><Flag variant="direct" size="xs" className="mt-0.5 shrink-0">1 · proxy</Flag><span>Node.js sans dépendance, sur votre réseau (<Code>app/api-proxy/</Code>) : liste blanche IP, clé comparée en temps constant, quota glissant 60 s par IP, en-têtes de sécurité, logs JSON, relais vers le backend.</span></li>
                <li className="flex gap-2"><Flag variant="finance" size="xs" className="mt-0.5 shrink-0">2 · backend</Flag><span>Convex (<Code>convex/http.ts</Code>) : re-validation de la clé, contrôle de la date et des entités, journalisation de chaque appel avec statut et IP.</span></li>
              </ol>
              <h3 className="mb-1 mt-3 text-xs font-semibold text-encre-douce">Fichiers du proxy</h3>
              <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 text-xs">
                <dt><Code>server.mjs</Code></dt><dd>le serveur ; <Code>node server.mjs</Code>, ou PM2 en production</dd>
                <dt><Code>lib.mjs</Code></dt><dd>logique pure, testée (<Code>npm run test:proxy</Code>)</dd>
                <dt><Code>.env.example</Code></dt><dd>modèle des variables ci-contre</dd>
                <dt><Code>README.md</Code></dt><dd>démarrage, PM2, HTTPS (Nginx / Caddy), rotation de clé</dd>
              </dl>
            </section>
            <section className="rounded-xl border border-filet bg-surface p-4">
              <h2 className="mb-2 text-sm font-semibold">Variables du proxy (<Code>.env</Code>)</h2>
              <dl className="grid grid-cols-[9.5rem_1fr] gap-x-3 gap-y-1.5 text-xs">
                {VARIABLES_PROXY.map((v) => <React.Fragment key={v.nom}><dt><Code>{v.nom}</Code></dt><dd className="text-encre-douce">{v.role}</dd></React.Fragment>)}
              </dl>
            </section>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <Extrait titre="Générer une clé (≥ 32 octets aléatoires)" code={`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`} />
            <Extrait titre="L'enregistrer des deux côtés" code={`npx convex env set FINANCIAL_API_KEY <clé>   # backend, depuis app/\n# puis la même valeur dans app/api-proxy/.env`} note="Rotation : générer une nouvelle clé, la poser côté backend puis côté proxy, prévenir l'intégrateur ; l'ancienne cesse aussitôt." />
          </div>
        </TabsContent>

        <TabsContent value="appels">
          {etat === undefined ? (
            <SqueletteTableau colonnes={5} lignes={5} />
          ) : (
            <Table classNameConteneur="rounded-xl" hauteurMax={`${44 * 10 + 40}px`}>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Quand</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Journée demandée</TableHead>
                  <TableHead>Détail</TableHead>
                  <TableHead>Appelant</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {derniers.map((d) => (
                  <TableRow key={d._id} className={cn((d.statut ?? 0) >= 500 && "bg-carmin/5")}>
                    <TableCell className="whitespace-nowrap"><div className="font-mono text-xs tabular-nums">{fmtDateHeure(d.date)}</div><div className="text-2xs text-encre-pale">{relatif(d.date)}</div></TableCell>
                    <TableCell><CodeHttp code={d.statut} /></TableCell>
                    <TableCell className="font-mono text-xs">{d.cible ?? "—"}</TableCell>
                    <TableCell className="text-xs text-encre-douce">{d.detail ?? "—"}</TableCell>
                    <TableCell className="text-xs"><Auteur nom={d.auteurNom} /></TableCell>
                    <TableCell className="font-mono text-2xs text-encre-douce">{d.ip ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {derniers.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-xs text-encre-pale">Aucun appel journalisé. Le premier appel (même refusé) apparaîtra ici.</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
