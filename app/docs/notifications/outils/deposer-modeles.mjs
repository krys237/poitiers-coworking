#!/usr/bin/env node
// Dépôt des modèles WhatsApp de POITIERS COWORKING sur le hub de notifications.
//
// Outil d'exploitation, lancé à la main par le propriétaire. Sans dépendance (fetch natif,
// Node 18+). Il ne touche à rien dans l'application : il parle seulement au hub.
//
//   export NOTIFICATION_HUB_URL="https://notifications.edoctor-tim.com/api/v1"
//   export NOTIFICATION_HUB_API_KEY="nhk_..."
//
//   node deposer-modeles.mjs --verifier   accès, scopes, échéance de la clé, modèles en place
//   node deposer-modeles.mjs --simuler    affiche les charges JSON, n'envoie RIEN
//   node deposer-modeles.mjs --deposer    dépose les modèles encore absents
//   node deposer-modeles.mjs --suivre     état de chaque demande
//
// À lire avant de déposer : un modèle approuvé par Meta n'est PAS modifiable. Lance
// --simuler, relis les huit textes, et seulement ensuite --deposer.

const URL_HUB = process.env.NOTIFICATION_HUB_URL;
const CLE = process.env.NOTIFICATION_HUB_API_KEY;

// ---------------------------------------------------------------------------------------
// Les huit modèles. Les textes sont ceux de S3-HUB-WHATSAPP.md §4.
//
// Règles Meta respectées, à revérifier si tu modifies un texte :
//  - une variable n'est jamais au début ni à la fin du corps, et jamais collée à une autre ;
//  - un exemple réaliste par variable, sans #, $ ni % ;
//  - corps de 1024 caractères maximum ;
//  - ton strictement informatif : une incitation commerciale ferait reclasser en MARKETING,
//    qui exige un consentement enregistré par destinataire.
//
// Ni pied de page ni bouton : chacun ajoute une règle que Meta peut refuser, et pour un
// premier dépôt on réduit la surface. On pourra en ajouter plus tard, sous un autre nom.
// Aucun montant, aucune donnée de santé : rien qui n'ait à sortir de la plateforme.
// ---------------------------------------------------------------------------------------
const MODELES = [
  {
    name: "poitiers_bon_a_valider",
    lot: "S3",
    usage: "Un bon de commande passe en attente de validation",
    body: {
      text: "Bonjour, le bon de commande *{{1}}* a été soumis par {{2}} et attend votre validation dans la plateforme.",
      examples: ["CMD-2026-012", "AMEFFO Lucie"],
    },
  },
  {
    name: "poitiers_bon_arbitre",
    lot: "S3",
    usage: "Un bon de commande est validé ou rejeté",
    body: {
      text: "Bonjour, le bon de commande *{{1}}* a été {{2}}. Motif indiqué : {{3}}. Le détail est dans la plateforme.",
      examples: ["CMD-2026-012", "validé", "Aucun motif précisé"],
    },
  },
  {
    name: "poitiers_litige_commande",
    lot: "S3",
    usage: "Un litige est signalé à la réception d'une commande",
    body: {
      text: "Bonjour, un litige a été signalé sur le bon de commande *{{1}}*. Motif : {{2}}. Merci de le traiter dans la plateforme.",
      examples: ["CMD-2026-012", "Quantité manquante"],
    },
  },
  {
    name: "poitiers_intervention_a_arbitrer",
    lot: "S3",
    usage: "Une demande d'intervention est déposée",
    body: {
      text: "Bonjour, la demande d'intervention *{{1}}* a été déposée pour : {{2}}. Elle attend un arbitrage dans la plateforme.",
      examples: ["INT-2026-034", "Climatisation du laboratoire"],
    },
  },
  {
    name: "poitiers_intervention_suite",
    lot: "S3",
    usage: "Le demandeur apprend la décision prise sur son intervention",
    body: {
      text: "Bonjour, votre demande d'intervention *{{1}}* a été {{2}}. Vous pouvez en consulter le détail dans la plateforme.",
      examples: ["INT-2026-034", "validée"],
    },
  },
  {
    name: "poitiers_document_partage",
    lot: "S3",
    usage: "Un document est partagé nominativement",
    body: {
      text: "Bonjour, le document *{{1}}* vous a été partagé par {{2}}. Il est consultable dans la plateforme.",
      examples: ["Procédure de réception des commandes", "NGONO Paul"],
    },
  },
  {
    name: "poitiers_rappel_compte_rendu",
    lot: "S5",
    usage: "Rappel : le compte rendu du jour n'est pas déposé",
    body: {
      text: "Bonjour, votre compte rendu du {{1}} n'a pas encore été déposé. Le créneau se ferme à {{2}}. Merci de le renseigner dans la plateforme.",
      examples: ["12/11/2026", "20h00"],
    },
  },
  {
    name: "poitiers_dossier_en_attente",
    lot: "S5",
    usage: "Relance : un dossier attend une décision depuis trop longtemps",
    body: {
      text: "Bonjour, le dossier *{{1}}* attend une décision depuis {{2}}. Merci de le traiter dans la plateforme.",
      examples: ["CMD-2026-012", "24 heures"],
    },
  },
];

const LANGUE = "fr";
const CATEGORIE = "UTILITY";

// ---------------------------------------------------------------------------------------

const charge = (m) => ({ name: m.name, language: LANGUE, category: CATEGORIE, body: m.body });

/** Contrôle de cohérence local, avant tout appel réseau. */
function verifierTextes() {
  const soucis = [];
  for (const m of MODELES) {
    const t = m.body.text;
    const vars = [...t.matchAll(/\{\{(\d+)\}\}/g)].map((x) => +x[1]);
    const attendus = vars.length ? Math.max(...vars) : 0;
    if (t.length > 1024) soucis.push(`${m.name} : corps de ${t.length} caractères (1024 maximum)`);
    if (m.body.examples.length !== attendus) {
      soucis.push(`${m.name} : ${attendus} variable(s) mais ${m.body.examples.length} exemple(s)`);
    }
    for (let i = 1; i <= attendus; i++) {
      if (!vars.includes(i)) soucis.push(`${m.name} : la variable {{${i}}} manque (la numérotation doit être continue)`);
    }
    if (/^\s*\{\{/.test(t)) soucis.push(`${m.name} : une variable ouvre le texte — Meta le refuse`);
    if (/\{\{\d+\}\}\s*$/.test(t)) soucis.push(`${m.name} : une variable termine le texte — Meta le refuse`);
    if (/\}\}\s*\{\{/.test(t)) soucis.push(`${m.name} : deux variables collées — Meta le refuse`);
    for (const ex of m.body.examples) {
      if (/[#$%]/.test(ex)) soucis.push(`${m.name} : l'exemple « ${ex} » contient #, $ ou % — interdit`);
      if (!String(ex).trim()) soucis.push(`${m.name} : un exemple est vide`);
    }
  }
  return soucis;
}

function exigerConfig() {
  if (!URL_HUB || !CLE) {
    console.error("NOTIFICATION_HUB_URL et NOTIFICATION_HUB_API_KEY doivent être définis.");
    console.error("Voir DEMARCHES-EXTERNES.md §1.3.");
    process.exit(2);
  }
}

async function appeler(chemin, options = {}) {
  const r = await fetch(`${URL_HUB.replace(/\/$/, "")}${chemin}`, {
    ...options,
    headers: { Authorization: `Bearer ${CLE}`, "Content-Type": "application/json", ...(options.headers ?? {}) },
    signal: AbortSignal.timeout(15_000),
  });
  const brut = await r.text();
  let corps = null;
  try { corps = brut ? JSON.parse(brut) : null; } catch { /* réponse non JSON */ }
  return { statut: r.status, corps, brut };
}

// --- modes -----------------------------------------------------------------------------

async function verifier() {
  exigerConfig();
  const moi = await appeler("/me/");
  if (moi.statut !== 200) {
    // Jamais de relance automatique sur un 401 : 20 échecs en 5 minutes font bannir l'IP.
    console.error(`Accès refusé (${moi.statut}) : ${moi.corps?.error?.code ?? moi.brut.slice(0, 200)}`);
    console.error("Ne relance pas en boucle. Vérifie la clé auprès de l'administrateur du hub.");
    process.exit(1);
  }
  const { application: app, credential: cred } = moi.corps;
  console.log(`Application : ${app.name} (${app.client_id}) — ${app.status}`);
  console.log(`Clé         : ${cred.key_prefix} · scopes ${cred.scopes.join(", ")}`);
  console.log(`Expire le   : ${cred.expires_at}`);
  if (!cred.scopes.includes("templates:write")) {
    console.log("\n⚠ Le scope templates:write manque : tu ne peux pas déposer de modèle.");
    console.log("  Demande-le à l'administrateur du hub (voir DEMARCHES-EXTERNES.md §1.1).");
  }
  const dispo = await appeler("/templates/");
  const noms = (dispo.corps ?? []).map((t) => t.name);
  console.log(`\nModèles déjà envoyables (${noms.length}) :`);
  for (const m of MODELES) {
    console.log(`  ${noms.includes(m.name) ? "✓" : "·"} ${m.name}  [${m.lot}]`);
  }
  const manquants = MODELES.filter((m) => !noms.includes(m.name));
  console.log(manquants.length ? `\n${manquants.length} modèle(s) à déposer.` : "\nTous les modèles sont en place.");
}

function simuler() {
  const soucis = verifierTextes();
  for (const m of MODELES) {
    console.log(`\n── ${m.name}  [${m.lot}] ${"─".repeat(Math.max(0, 50 - m.name.length))}`);
    console.log(`   ${m.usage}`);
    console.log(JSON.stringify(charge(m), null, 2));
  }
  console.log(`\n${MODELES.length} modèles. Rien n'a été envoyé.`);
  if (soucis.length) {
    console.log("\n⚠ Problèmes à corriger AVANT de déposer :");
    for (const s of soucis) console.log(`  - ${s}`);
    process.exit(1);
  }
  console.log("Contrôle local des règles Meta : aucun problème détecté.");
  console.log("\nRelis les huit textes ci-dessus. Un modèle approuvé n'est plus modifiable.");
}

async function deposer() {
  exigerConfig();
  const soucis = verifierTextes();
  if (soucis.length) {
    console.error("Dépôt annulé — le contrôle local a échoué. Lance --simuler.");
    process.exit(1);
  }
  const dispo = await appeler("/templates/");
  const deja = new Set((dispo.corps ?? []).map((t) => t.name));

  for (const m of MODELES) {
    if (deja.has(m.name)) { console.log(`· ${m.name} — déjà envoyable, ignoré`); continue; }
    const r = await appeler("/template-requests/", { method: "POST", body: JSON.stringify(charge(m)) });
    if (r.statut === 201 || r.statut === 200) {
      console.log(`✓ ${m.name} — déposé (${r.corps?.status ?? "?"}) id ${r.corps?.id ?? "?"}`);
    } else if (r.statut === 409) {
      console.log(`· ${m.name} — nom déjà utilisé (demande antérieure ?), voir --suivre`);
    } else {
      const e = r.corps?.error ?? {};
      console.log(`✗ ${m.name} — ${r.statut} ${e.code ?? ""}`);
      for (const d of e.details ?? []) console.log(`    ${typeof d === "string" ? d : JSON.stringify(d)}`);
      if (e.request_id) console.log(`    request_id : ${e.request_id}`);
    }
    await new Promise((r) => setTimeout(r, 400)); // courtoisie : on n'inonde pas le hub
  }
  console.log("\nSuis l'avancement avec --suivre. La revue Meta prend jusqu'à 24 h par modèle.");
}

async function suivre() {
  exigerConfig();
  const r = await appeler("/template-requests/");
  const demandes = Array.isArray(r.corps) ? r.corps : (r.corps?.results ?? []);
  if (!demandes.length) { console.log("Aucune demande de modèle."); return; }
  const SENS = {
    pending_review: "en attente de l'administrateur du hub",
    rejected_by_operator: "refusée par l'administrateur — corrige et redépose",
    submitting: "en cours d'envoi à Meta",
    submitted: "en revue chez Meta (jusqu'à 24 h)",
    submission_failed: "refusée par l'API Meta à l'envoi",
    approved: "APPROUVÉE — le modèle est envoyable",
    category_changed: "approuvée dans une autre catégorie — voir l'administrateur",
    rejected: "refusée par Meta — corrige et redépose",
  };
  for (const d of demandes) {
    console.log(`${d.status === "approved" ? "✓" : d.status.startsWith("rejected") ? "✗" : "·"} ${d.name}`);
    console.log(`    ${d.status} — ${SENS[d.status] ?? "statut inconnu"}`);
    if (d.rejection_reason) console.log(`    motif : ${d.rejection_reason}`);
  }
  const ok = demandes.filter((d) => d.status === "approved").length;
  console.log(`\n${ok}/${MODELES.length} approuvés.`);
  if (ok >= 6) console.log("S3 peut démarrer dès que ses six modèles sont approuvés.");
}

// --- point d'entrée --------------------------------------------------------------------

const mode = process.argv[2];
const modes = { "--verifier": verifier, "--simuler": simuler, "--deposer": deposer, "--suivre": suivre };

if (!modes[mode]) {
  console.log("Usage : node deposer-modeles.mjs --verifier | --simuler | --deposer | --suivre");
  console.log("Commence toujours par --simuler, puis --verifier, puis --deposer.");
  process.exit(mode ? 2 : 0);
}
try {
  await modes[mode]();
} catch (e) {
  console.error(`Échec : ${e.message}`);
  process.exit(1);
}
