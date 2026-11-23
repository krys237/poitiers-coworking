// API d'export financière (couche 2 — backend). Patron Hercules v2 : la clé est RE-VALIDÉE ici même si un proxy
// la vérifie déjà en amont ; comparaison en temps constant ; validation stricte des paramètres ; journalisation.
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { comparaisonConstante, dateValide, parseEntites, reponseApi, ENTITES } from "./lib/apiSecurite";
import { verifierSignatureWebhookHub } from "./lib/transport";

const http = httpRouter();

// Routes de Convex Auth (vérification des jetons, callbacks OAuth). Sans cet appel,
// l'application reste silencieusement déconnectée quoi qu'il arrive côté client.
auth.addHttpRoutes(http);
const HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY" };
const json = (statut: number, corps: unknown) => new Response(JSON.stringify(corps), { status: statut, headers: HEADERS });

http.route({
  path: "/health", method: "GET",
  handler: httpAction(async () => json(200, { status: "ok", service: "POITIERS COWORKING — API", version: "2.0", entites: ENTITES })),
});

http.route({
  path: "/api/financial", method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    const entity = url.searchParams.get("entity");
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || undefined;
    const log = (statut: number, detail?: string) => ctx.runMutation(internal.journal.ecrire, {
      action: "api_financial", cible: date ?? undefined, statut, ip,
      detail: [entity ? `entity=${entity}` : "toutes entités", detail].filter(Boolean).join(" · "),
    });

    const attendue = process.env.FINANCIAL_API_KEY;
    if (!attendue) { await log(503, "clé non configurée"); return json(503, { erreur: "FINANCIAL_API_KEY non configurée côté backend" }); }
    const cle = req.headers.get("x-api-key") ?? "";
    if (!cle || !comparaisonConstante(cle, attendue)) { await log(401, "clé invalide"); return json(401, { erreur: "Clé API manquante ou invalide" }); }
    if (!dateValide(date)) { await log(400, "date invalide"); return json(400, { erreur: "Paramètre date requis au format YYYY-MM-DD" }); }
    const ent = parseEntites(entity);
    if (!ent.ok) { await log(400, "entité inconnue"); return json(400, { erreur: ent.erreur }); }

    const j = await ctx.runQuery(internal.financier.journeePourApi, { date });
    if (!j) { await log(404, "aucune journée"); return json(404, { erreur: `Aucune journée saisie le ${date}` }); }
    await log(200);
    return json(200, reponseApi(j, ent.entites));
  }),
});

// Webhook de retour de statut du hub WhatsApp (lot S3 §8).
// Ordre imposé par la sécurité : corps brut → signature HMAC-SHA256 temps constant + fenêtre 5 min → 200 rapide.
http.route({
  path: "/hooks/whatsapp",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const corpsBrut = await req.text();
    const secret = process.env.NOTIFICATION_HUB_CALLBACK_SECRET ?? "";
    const verif = await verifierSignatureWebhookHub(
      corpsBrut,
      req.headers.get("X-Hub-Timestamp"),
      req.headers.get("X-Hub-Signature-256"),
      secret,
    );
    if (!verif.ok) {
      return json(401, { erreur: "Signature webhook invalide ou expirée." });
    }

    let payload: any;
    try {
      payload = JSON.parse(corpsBrut);
    } catch {
      return json(400, { erreur: "Corps JSON invalide." });
    }

    const typeEvenement = payload?.type ?? req.headers.get("X-Hub-Event") ?? "";
    if (typeEvenement === "ping") {
      return json(200, { ok: true, pong: true });
    }

    const data = payload?.data;
    if (data && typeof data.status === "string") {
      await ctx.runMutation(internal.envois.appliquerWebhookStatut, {
        messageId: typeof data.message_id === "string" ? data.message_id : undefined,
        cleIdempotence: typeof data.idempotency_key === "string" ? data.idempotency_key : undefined,
        hubStatus: data.status,
        codeEchec: typeof data.failure?.code === "string" ? data.failure.code : undefined,
        erreur: typeof data.failure?.detail === "string" ? data.failure.detail : undefined,
      });
    }

    return json(200, { ok: true });
  }),
});

export default http;

