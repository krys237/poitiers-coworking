// Mode d'intervention à la Polyclinique : définir les droits Voir / Faire de chaque rôle.
// Usage : node design/mode-intervention.mjs  →  mode-intervention-droits.pdf à la racine.
// Les modules et les droits actuels viennent du code (design/recette/droits.mts → rbac.ts).
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, "..");
execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", path.join(ICI, "recette", "droits.mts")], { stdio: "inherit" });
const D = JSON.parse(readFileSync(path.join(ICI, "recette", "droits.json"), "utf-8"));
const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

const URL_APP = "https://poitiers-coworking.vercel.app/connexion";
const ROLES_GRILLE = ["employe", "chef", "comptable", "rh", "daf", "dg", "auditeur"]; // le super admin (technique) ne se règle pas
const modules = D.lignes.filter((l) => l.cle !== "/" && l.cle !== "/api-readme");
const case_ = (coche) => `<span class="case">${coche ? "✓" : ""}</span>`;

const comptes = D.comptes.map((c) => `<tr><td><b>${c.id}</b></td><td>${esc(c.libelle)}</td><td class="mono">${c.id}.test@poitiers.local</td><td class="mono">${esc(c.telephone)}</td></tr>`).join("");

const definitions = modules.map((m) => `<tr><td><b>${esc(m.libelle)}</b></td><td>${m.voir ? esc(m.voir) : "<i>—</i>"}</td><td>${m.faire ? esc(m.faire) : "<i>lecture seule</i>"}</td></tr>`).join("");

const grilles = ROLES_GRILLE.map((id) => {
  const c = D.comptes.find((x) => x.id === id);
  const lignes = modules.map((m) => {
    const d = c.droits[m.cle];
    return `<tr>
      <td><b>${esc(m.libelle)}</b></td>
      <td class="c">${m.voir === null ? "—" : d.voir ? "V" : "·"}</td>
      <td class="c">${m.faire === null ? "—" : d.faire ? "F" : "·"}</td>
      <td class="c">${m.voir === null ? "—" : case_(false)}</td>
      <td class="c">${m.faire === null ? "—" : case_(false)}</td>
      <td></td></tr>`;
  }).join("");
  return `<section class="grille">
    <h2>Grille — ${esc(c.libelle)} <span class="petit">(compte de test : ${id})</span></h2>
    <p class="aide">Colonnes « Actuel » : réglage en vigueur (V = voit, F = agit, · = rien). Colonnes « Souhaité » : cochez ce que le métier demande. Remarque : exception par personne, action à séparer, condition particulière.</p>
    <p class="aide">Personne interrogée : ______________________________ &nbsp; Date : ____ / ____ / 2026</p>
    <table class="g"><thead><tr><th>Module</th><th class="c">Actuel<br>Voir</th><th class="c">Actuel<br>Faire</th><th class="c">Souhaité<br>Voir</th><th class="c">Souhaité<br>Faire</th><th>Remarque</th></tr></thead><tbody>${lignes}</tbody></table>
  </section>`;
}).join("");

const page = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Mode d'intervention — droits par niveau d'accès</title>
<style>
  @page { size: A4; margin: 14mm 13mm 16mm; }
  :root { --sceau:#0077b6; --nuit:#03045e; --encre:#0b132b; --douce:#334155; --pale:#64748b; --filet:#8a968d; --bande:#eaf3f8; --ocre:#8a5d12; --ocre-f:#fef3c7; }
  body { margin:0; font-family:"Segoe UI",system-ui,sans-serif; font-size:10pt; line-height:1.45; color:var(--encre); }
  header { display:flex; justify-content:space-between; gap:10mm; padding-bottom:3mm; margin-bottom:4mm; border-bottom:2.5pt solid var(--sceau); }
  header .raison { font-size:13pt; font-weight:700; color:var(--sceau); }
  header .coord { font-size:8pt; color:var(--pale); }
  header .nature { text-align:right; font-size:12pt; font-weight:700; }
  header .nature span { display:block; font-size:8.5pt; font-weight:400; color:var(--pale); }
  h1 { font-size:15pt; color:var(--nuit); margin:0 0 2mm; }
  h2 { font-size:11pt; margin:5mm 0 2mm; color:var(--nuit); text-transform:uppercase; letter-spacing:.04em; border-left:3pt solid var(--sceau); padding-left:2.5mm; break-after:avoid; }
  h3 { font-size:10pt; margin:3.5mm 0 1.5mm; color:var(--sceau); break-after:avoid; }
  p { margin:0 0 2mm; } ul, ol { margin:0 0 2.5mm; padding-left:5mm; } li { margin-bottom:1mm; }
  table { width:100%; border-collapse:collapse; font-size:8.8pt; margin:1.5mm 0 3mm; }
  th, td { border:.5pt solid var(--filet); padding:1.3mm 1.8mm; vertical-align:top; text-align:left; }
  thead th { background:var(--bande); font-size:8pt; }
  tr { break-inside:avoid; }
  .mono { font-family:Consolas,monospace; font-size:8.3pt; }
  .encadre { border:.8pt solid var(--sceau); background:#f3f9fd; border-radius:2mm; padding:2.5mm 3.5mm; margin:2mm 0 3mm; }
  .alerte { border:.8pt solid #e7c46a; background:var(--ocre-f); color:var(--ocre); border-radius:2mm; padding:2mm 3.5mm; margin:2mm 0 3mm; }
  .question { font-weight:600; color:var(--nuit); }
  .deux { display:grid; grid-template-columns:1fr 1fr; gap:5mm; }
  .grille { break-before:page; }
  .grille h2 { margin-top:0; }
  .petit { font-size:8.5pt; text-transform:none; letter-spacing:0; color:var(--pale); font-weight:400; }
  .aide { font-size:8.5pt; color:var(--douce); }
  table.g td, table.g th { padding:1.1mm 1.6mm; }
  table.g td:last-child { width:58mm; }
  .c { text-align:center; width:12mm; }
  .case { display:inline-block; width:3.6mm; height:3.6mm; border:.8pt solid var(--encre); border-radius:.6mm; line-height:3.4mm; font-size:8pt; }
  .saut { break-before:page; }
</style></head><body>
<header>
  <div><div class="raison">POITIERS COWORKING</div><div class="coord">Plateforme unifiée de gestion & paie · Polyclinique de Poitiers</div></div>
  <div class="nature">MODE D'INTERVENTION<span>Définir les actions par niveau d'accès</span><span>Version du ${new Date().toLocaleDateString("fr-FR", { dateStyle: "long" })}</span></div>
</header>

<h1>Définir, avec chaque métier, qui voit et qui fait quoi</h1>
<p>Objectif : sortir de la Polyclinique avec, pour chaque rôle, la liste des modules qu'il <b>voit</b> et de ceux où il <b>agit</b>
(saisir, valider, clôturer, envoyer) — avant de lancer la campagne du cahier de recette. Ces décisions deviendront les droits par
défaut de l'application.</p>

<div class="encadre"><b>Le principe à garder en tête :</b> on part du <b>travail réel</b> de chaque personne, jamais des niveaux.
Les niveaux (1 à 7) ne donnent plus que des réglages de départ ; le directeur peut tout ajuster, module par module, d'un clic.
Et <b>retirer un droit fait disparaître les actions qui en dépendent</b> pour le rôle ou la personne concernés.</div>

<h2>1. Avant la séance</h2>
<ul>
  <li><b>Application en ligne</b> : <span class="mono">${URL_APP}</span> — fonctionne sur tout poste ou téléphone de la clinique.</li>
  <li><b>Support</b> : Paramètres → <b>Rôles & accès</b>, ouvert avec le compte DG. Chaque module y dit ce que « Voir » et « Faire » recouvrent (définitions en annexe A).</li>
  <li><b>Grilles papier</b> : une par rôle (annexe B), pré-cochées avec les réglages actuels. Imprimer en un exemplaire par personne interrogée.</li>
  <li><b>Comptes de test</b> pour montrer à chacun « son » écran (mot de passe commun <span class="mono">Poitiers2026</span>) :</li>
</ul>
<table><thead><tr><th>Compte</th><th>Rôle</th><th>E-mail</th><th>Téléphone</th></tr></thead><tbody>${comptes}</tbody></table>
<p class="aide">Connexion par téléphone : l'indicatif +237 est déjà affiché, ne taper que le numéro.</p>

<h2>2. Déroulé conseillé</h2>
<ol>
  <li><b>Entretiens individuels</b>, 15 à 20 minutes chacun, <b>séparément</b> : comptable, gestionnaire RH, DAF, chef d'équipe, un employé.
      En groupe, chacun s'aligne sur le plus gradé ; seul, il décrit ce qu'il fait vraiment.</li>
  <li>Pendant l'entretien, connectez-vous avec <b>son</b> compte de test : il voit son menu et dit tout de suite ce qui manque ou ce qui est de trop.</li>
  <li><b>Synthèse avec le Directeur Général</b> en fin de séance : il arbitre les désaccords et <b>coche lui-même</b> la matrice dans Paramètres.</li>
</ol>

<h2>3. Pendant chaque entretien</h2>
<h3>Commencer par le métier, pas par l'outil</h3>
<p class="question">« Racontez-moi votre journée type, puis votre fin de mois : qu'est-ce que vous saisissez, vérifiez, validez, envoyez ? »</p>
<p>Notez chaque tâche avec son <b>verbe</b> (saisir, contrôler, valider, clôturer, envoyer, consulter), puis rattachez-la à un module.</p>

<h3>Pour chaque module, trois questions</h3>
<ol>
  <li class="question">Avez-vous besoin de voir ces informations pour travailler ?</li>
  <li class="question">Devez-vous agir (saisir, valider, clôturer, envoyer), ou seulement consulter ?</li>
  <li class="question">Quelqu'un d'autre fait-il aussi cette tâche ? <span style="font-weight:400">→ si oui, c'est peut-être une <b>exception par personne</b> plutôt qu'une règle pour tout le rôle.</span></li>
</ol>

<h3>Les points sensibles — ceux qui font les vrais arbitrages</h3>
<table><thead><tr><th>Sujet</th><th>Questions à poser</th></tr></thead><tbody>
  <tr><td><b>Salaires</b></td><td>Qui voit la paie de tout le monde ? Qui saisit le mois ? Qui <b>clôture</b> (irréversible) ? Qui envoie le courrier de paie ?</td></tr>
  <tr><td><b>Trésorerie</b></td><td>Qui voit les soldes ? Qui saisit la journée du grand livre ? Qui clôture le mois financier ?</td></tr>
  <tr><td><b>Commandes</b></td><td>Qui commande ? Qui <b>valide</b> ou rejette ?</td></tr>
  <tr><td><b>Caisse & primes médecins</b></td><td>Qui saisit ? Qui peut corriger <b>après le délai d'une heure</b> ?</td></tr>
  <tr><td><b>Interventions</b></td><td>Qui déclare ? Qui valide, clôture, rejette ?</td></tr>
  <tr><td><b>Documents</b></td><td>Qui dépose ? Qui lit les documents confidentiels ?</td></tr>
  <tr><td><b>Employés</b></td><td>Qui consulte les fiches ? Qui les crée et les modifie (salaire de référence) ?</td></tr>
  <tr><td><b>Membres & Paramètres</b></td><td>Qui crée les comptes et attribue les rôles ? Le DG seul ?</td></tr>
  <tr><td><b>Audit</b></td><td>L'auditeur externe consulte sans agir ailleurs : est-ce bien le périmètre voulu ?</td></tr>
</tbody></table>

<div class="alerte"><b>Règle à vérifier à chaque fois : celui qui saisit n'est pas celui qui valide.</b> C'est déjà le cas pour les
commandes (le comptable crée, le DAF valide). Demandez si la même séparation est voulue pour la clôture de la paie et du mois financier.</div>

<h3>À noter à part — ce qui ne rentre pas dans la grille</h3>
<ul>
  <li>Une case « Faire » qui mélange deux actions à séparer (ex. « déclarer » et « valider ») : un module peut être découpé en deux lignes.</li>
  <li>Un cas propre à une personne (remplaçant, intérim, cumul de fonctions) : <b>exception par personne</b>, pas de nouveau rôle.</li>
  <li>Une condition (« seulement en fin de mois », « seulement sa société ») : à décrire en clair, je dirai si c'est réalisable.</li>
</ul>

<h2 class="saut">4. En fin de séance, avec le Directeur Général</h2>
<ol>
  <li>Ouvrir Paramètres → Rôles & accès avec le compte DG ; cliquer <b>V</b> (voir) ou <b>F</b> (faire) selon les grilles, puis <b>Enregistrer</b>.
      Une case modifiée est entourée en ocre jusqu'à l'enregistrement ; chaque changement est journalisé.</li>
  <li>Poser les cas individuels dans <b>Exceptions par personne</b> (sous la matrice) : choisir le membre, puis pour chaque module
      « Comme son rôle / Aucun accès / Voir / Voir + faire », et « Enregistrer les droits de … ».</li>
  <li>Vérifier sur le compte de test du rôle modifié que le menu suit (déconnexion / reconnexion).</li>
  <li>Garde-fous à connaître : le DG garde toujours Paramètres et Membres ; le compte technique (super administrateur) n'apparaît pas dans la matrice.</li>
</ol>

<h2>5. Me transmettre les décisions</h2>
<table><thead><tr><th>Moyen</th><th>Ce que je fais</th></tr></thead><tbody>
  <tr><td><b>1. Le DG coche la matrice dans l'application</b> (recommandé)</td><td>Je lis les réglages directement en base, sans recopie ; le journal dit qui a changé quoi et quand.</td></tr>
  <tr><td><b>2. Photo des grilles papier</b> corrigées au stylo</td><td>À coller dans la conversation ; je saisis les écarts.</td></tr>
  <tr><td><b>3. Message écrit</b></td><td>Forme : « comptable → Commandes : voir seulement ; RH → Caisse : aucun ».</td></tr>
</tbody></table>
<p>Joindre dans tous les cas les <b>notes « hors grille »</b> (section 3) : ce sont souvent les plus utiles.</p>
<div class="encadre"><b>Ensuite, de mon côté :</b> les arbitrages deviennent les <b>droits par défaut dans le code</b> (la mise en production
les reprend d'office) ; ils sont consignés dans le journal des décisions ; la section « Droits par compte » du cahier de recette est
régénérée ; puis le masquage des actions est fait écran par écran sur la grille validée.</div>

<h2 class="saut">Annexe A — Ce que recouvrent « Voir » et « Faire », module par module</h2>
<p class="aide">« Faire » entraîne toujours « Voir ». Un module en « lecture seule » n'a pas de case « Faire ».</p>
<table><thead><tr><th>Module</th><th>Voir</th><th>Faire</th></tr></thead><tbody>${definitions}</tbody></table>
<p class="aide">Hors matrice : le tableau de bord est ouvert à tout membre et se compose de ses modules ; la fiche API reste technique.</p>

${grilles}
</body></html>`;

const html = path.join(ICI, "mode-intervention.html");
writeFileSync(html, page);
const pdf = path.join(RACINE, "mode-intervention-droits.pdf");
execFileSync(process.execPath, [path.join(ICI, "print-file.mjs"), html, pdf], { stdio: "inherit", env: { ...process.env, PIED: "POITIERS COWORKING · Mode d'intervention — droits par niveau d'accès" } });
console.log(pdf);
