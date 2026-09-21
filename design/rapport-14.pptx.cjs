// Rapport de la semaine du 14 septembre 2026 — version PowerPoint.
// Usage : node design/rapport-14.pptx.cjs  →  rapport-de-la-semaine-du-14.pptx à la racine.
const pptxgen = require("pptxgenjs");
const path = require("path");

const NUIT = "03045E", PROFOND = "0077B6", CERULEEN = "00B4D8", CIEL = "90E0EF", BRUME = "CAF0F8", PAPIER = "F6F9FB", BANDE = "EAF3F8";
const ENCRE = "0B132B", DOUCE = "334155", PALE = "64748B", BLANC = "FFFFFF", OCRE = "8A5D12", OCRE_CLAIR = "FEF3C7";
const SANS = "Calibri", SERIF = "Cambria";
const PIED = "Semaine du 14 septembre 2026 · point arrêté le lundi 21";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 × 7.5
pres.author = "krys237";
pres.title = "Rapport de la semaine du 14 septembre 2026";

let n = 0;
function fond(slide, sombre = false) {
  slide.background = { color: sombre ? NUIT : BLANC };
  n += 1;
  slide.addText(PIED, { x: 0.5, y: 7.0, w: 9, h: 0.3, fontFace: SANS, fontSize: 9, color: sombre ? CIEL : PALE, isTextBox: true, margin: 0 });
  slide.addText(String(n), { x: 12.3, y: 7.0, w: 0.55, h: 0.3, fontFace: SANS, fontSize: 9, color: sombre ? CIEL : PALE, align: "right", isTextBox: true, margin: 0 });
}
function entete(slide, eyebrow, titre, sombre = false) {
  slide.addText(eyebrow, { x: 0.5, y: 0.4, w: 12, h: 0.3, fontFace: SANS, fontSize: 11, bold: true, charSpacing: 3, color: sombre ? CERULEEN : PROFOND, isTextBox: true, margin: 0 });
  slide.addText(titre, { x: 0.5, y: 0.7, w: 12.3, h: 0.8, fontFace: SERIF, fontSize: 30, bold: true, color: sombre ? BLANC : ENCRE, isTextBox: true, margin: 0 });
}
const puces = (items, o = {}) => items.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < items.length - 1, paraSpaceAfter: 6, ...o } }));

// 1. Titre
{
  const s = pres.addSlide(); fond(s, true);
  s.addShape(pres.ShapeType.ellipse, { x: 8.9, y: -1.2, w: 6, h: 6, fill: { color: PROFOND, transparency: 70 }, line: { color: PROFOND, transparency: 100 } });
  s.addShape(pres.ShapeType.ellipse, { x: 10.6, y: 2.6, w: 3.6, h: 3.6, fill: { color: CERULEEN, transparency: 75 }, line: { color: CERULEEN, transparency: 100 } });
  s.addText("POITIERS COWORKING · PLATEFORME UNIFIÉE DE GESTION & PAIE", { x: 0.6, y: 1.5, w: 9, h: 0.35, fontFace: SANS, fontSize: 12, bold: true, charSpacing: 3, color: CERULEEN, isTextBox: true, margin: 0 });
  s.addText("Rapport de la semaine du 14 septembre 2026", { x: 0.6, y: 1.95, w: 8.6, h: 1.6, fontFace: SERIF, fontSize: 40, bold: true, color: BLANC, isTextBox: true, margin: 0 });
  s.addText("De la refonte à la mise en service : authentification réelle, 21 écrans sur 22 refondus, un plan de trois semaines.", { x: 0.6, y: 3.7, w: 8, h: 1, fontFace: SANS, fontSize: 18, color: BRUME, isTextBox: true, margin: 0 });
  s.addText("Point arrêté le lundi 21 septembre au soir · rédigé par krys237", { x: 0.6, y: 5.6, w: 8, h: 0.4, fontFace: SANS, fontSize: 12, color: CIEL, isTextBox: true, margin: 0 });
}

// 2. En bref
{
  const s = pres.addSlide(); fond(s);
  entete(s, "EN BREF", "Trois chantiers menés de front, la semaine la plus dense du projet");
  const cartes = [
    ["01", "Authentification réelle et rôles", "Fin du mode « toute personne ayant le lien est directeur ». Chacun se connecte avec son e-mail ou son téléphone et ne voit que ses écrans."],
    ["02", "Refonte du front-end", "21 écrans sur 22 passés sur la nouvelle charte. Le bulletin de paie, dernier document, validé sur maquette puis livré à l'écran, à l'impression et en PDF."],
    ["03", "Pilotage", "Un plan sur trois semaines fixe la mise en service au vendredi 10 octobre, avec huit comptes de test et un journal des décisions."],
  ];
  cartes.forEach(([num, t, d], i) => {
    const x = 0.5 + i * 4.2;
    s.addShape(pres.ShapeType.roundRect, { x, y: 1.8, w: 3.9, h: 3.4, rectRadius: 0.12, fill: { color: PAPIER }, line: { color: "E2E8F0", width: 0.75 } });
    s.addShape(pres.ShapeType.ellipse, { x: x + 0.3, y: 2.1, w: 0.7, h: 0.7, fill: { color: PROFOND }, line: { color: PROFOND } });
    s.addText(num, { x: x + 0.3, y: 2.1, w: 0.7, h: 0.7, fontFace: SANS, fontSize: 14, bold: true, color: BLANC, align: "center", valign: "middle", isTextBox: true, margin: 0 });
    s.addText(t, { x: x + 0.3, y: 2.95, w: 3.3, h: 0.6, fontFace: SANS, fontSize: 17, bold: true, color: ENCRE, isTextBox: true, margin: 0 });
    s.addText(d, { x: x + 0.3, y: 3.55, w: 3.3, h: 1.5, fontFace: SANS, fontSize: 12.5, color: DOUCE, isTextBox: true, margin: 0, valign: "top" });
  });
  s.addShape(pres.ShapeType.roundRect, { x: 0.5, y: 5.5, w: 12.3, h: 1.15, rectRadius: 0.1, fill: { color: NUIT }, line: { color: NUIT } });
  s.addText("75 %", { x: 0.8, y: 5.55, w: 2.2, h: 1.05, fontFace: SERIF, fontSize: 40, bold: true, color: BLANC, valign: "middle", isTextBox: true, margin: 0 });
  s.addText("d'achèvement estimé. Ce qui reste est court mais conditionne la mise en service : la recette avec les utilisateurs, l'arbitrage des niveaux de rôles, la bascule en production.", { x: 3.0, y: 5.55, w: 9.6, h: 1.05, fontFace: SANS, fontSize: 14, color: BRUME, valign: "middle", isTextBox: true, margin: 0 });
}

// 3. Chiffres
{
  const s = pres.addSlide(); fond(s);
  entete(s, "CHIFFRES DE LA SEMAINE", "Ce que la semaine a produit, en nombres");
  const stats = [["56", "livraisons versionnées", "contre 5 la semaine du 7"], ["21 / 22", "écrans sur la charte", "le front passe de 40 % à 90 %"], ["124", "fichiers modifiés", "≈ 20 800 lignes ajoutées"], ["8", "comptes de test", "un par rôle, e-mail ou téléphone"], ["14", "décisions consignées", "journal des décisions créé"], ["8 / 8", "suites de tests au vert", "moteur de paie inchangé"]];
  stats.forEach(([v, l, d], i) => {
    const x = 0.5 + (i % 3) * 4.2, y = 1.85 + Math.floor(i / 3) * 2.45;
    s.addShape(pres.ShapeType.roundRect, { x, y, w: 3.9, h: 2.15, rectRadius: 0.12, fill: { color: i === 0 ? NUIT : PAPIER }, line: { color: i === 0 ? NUIT : "E2E8F0", width: 0.75 } });
    s.addText(v, { x: x + 0.3, y: y + 0.2, w: 3.3, h: 1, fontFace: SERIF, fontSize: 44, bold: true, color: i === 0 ? BLANC : PROFOND, isTextBox: true, margin: 0 });
    s.addText(l, { x: x + 0.3, y: y + 1.2, w: 3.3, h: 0.4, fontFace: SANS, fontSize: 14, bold: true, color: i === 0 ? BRUME : ENCRE, isTextBox: true, margin: 0 });
    s.addText(d, { x: x + 0.3, y: y + 1.6, w: 3.3, h: 0.4, fontFace: SANS, fontSize: 11.5, color: i === 0 ? CIEL : PALE, isTextBox: true, margin: 0 });
  });
}

// 4. Authentification
{
  const s = pres.addSlide(); fond(s);
  entete(s, "AUTHENTIFICATION", "Chacun se connecte avec son compte, et ne voit que ses écrans");
  s.addImage({ path: path.join(__dirname, "_login.png"), x: 6.9, y: 1.75, w: 5.95, h: 3.72, rounding: false, shadow: { type: "outer", color: "03045E", blur: 8, offset: 3, angle: 90, opacity: 0.25 } });
  s.addText("Nouvel écran de connexion : image de fond, deux modes au choix (e-mail ou téléphone), indicatif du pays pré-rempli.", { x: 6.9, y: 5.55, w: 5.95, h: 0.6, fontFace: SANS, fontSize: 11, italic: true, color: PALE, isTextBox: true, margin: 0 });
  s.addText(puces([
    "Chaque compte a un mot de passe ; la session est signée par le déploiement lui-même, sans fournisseur externe.",
    "Pas d'inscription ni de code par e-mail : les comptes sont créés par la Direction et le rôle est repris à la première connexion.",
    "Le mode développement est coupé sur le déploiement : connexion obligatoire partout, y compris sur le lien public.",
    "Toutes les fonctions du serveur exigent un niveau ; toutes les routes du front sont gardées.",
    "Consigne transverse : tout numéro de téléphone porte l'indicatif du pays.",
  ]), { x: 0.5, y: 1.8, w: 6.1, h: 4.6, fontFace: SANS, fontSize: 14, color: DOUCE, valign: "top", isTextBox: true, margin: 0 });
}

// 5. Rôles
{
  const s = pres.addSlide(); fond(s);
  entete(s, "RÔLES", "Matrice simplifiée, rôle technique isolé, comptes de test");
  const rows = [
    ["Rôle", "Niveau", "Ce que le rôle ouvre"],
    ["Employé", "1", "Tableau de bord, documents ouverts, interventions, comptes rendus"],
    ["Chef d'équipe", "2", "+ vue superviseur des comptes rendus"],
    ["Comptable", "3", "+ employés, commandes, caisse & primes médecins"],
    ["Gestionnaire RH", "4", "+ toute la paie et le barème"],
    ["Directeur Administratif (DAF)", "5", "+ grand livre financier, validations, documents confidentiels"],
    ["Directeur Général", "7", "+ membres et rôles, paramètres, journal, audit, nouvelle version du barème"],
    ["Super administrateur", "8", "Technique : données de démo, fiche API, état du déploiement"],
    ["Auditeur externe", "—", "Audit confidentiel et tableau de bord seulement"],
  ].map((r, i) => r.map((c, j) => ({ text: c, options: { bold: i === 0 || j === 0, fontFace: SANS, fontSize: 11.5, color: i === 0 ? BLANC : j === 1 ? PROFOND : ENCRE, fill: { color: i === 0 ? PROFOND : i % 2 ? BLANC : BANDE }, align: j === 1 ? "center" : "left", valign: "middle" } })));
  s.addTable(rows, { x: 0.5, y: 1.75, w: 8.3, colW: [2.6, 0.8, 4.9], border: { type: "solid", color: "E2E8F0", pt: 0.5 }, rowH: 0.42 });
  s.addShape(pres.ShapeType.roundRect, { x: 9.2, y: 1.75, w: 3.65, h: 4.9, rectRadius: 0.12, fill: { color: PAPIER }, line: { color: "E2E8F0", width: 0.75 } });
  s.addText("Ce qui a changé", { x: 9.45, y: 1.95, w: 3.2, h: 0.4, fontFace: SANS, fontSize: 14, bold: true, color: ENCRE, isTextBox: true, margin: 0 });
  s.addText(puces([
    "Le niveau 6 (DA2) est retiré : rien ne le distinguait du niveau 5.",
    "Nul ne peut attribuer un rôle au-dessus du sien : un DG ne fabrique pas de super administrateur.",
    "Le DG change un rôle directement dans la liste des membres ; la liste dit ce que chaque rôle ouvre.",
    "Matrice complète dans Paramètres → Rôles & accès, générée depuis le code.",
    "Écart trouvé et corrigé : le solde de trésorerie s'affichait à tout le monde.",
  ]), { x: 9.45, y: 2.4, w: 3.2, h: 4.1, fontFace: SANS, fontSize: 11.5, color: DOUCE, valign: "top", isTextBox: true, margin: 0 });
}

// 6. Refonte : lots
{
  const s = pres.addSlide(); fond(s);
  entete(s, "REFONTE DU FRONT-END", "21 écrans sur 22 livrés sur la charte « Ocean Breeze »");
  const lots = [
    ["Paie", "Récapitulatif salaires · Liste des salaires · Bulletins du mois · Courrier de paie · Planning des absences · Primes & retenues · Archives"],
    ["Exploitation", "Interventions · Commandes · Documents · Comptes rendus · Caisse & primes médecins · Récapitulatif financier"],
    ["Administration", "Employés · Membres & accès · Barème · Journal d'activité · Fiche API · Paramètres"],
    ["Contrôle", "Audit confidentiel (horizon 6 / 12 / 24 mois, comparaison N / N−1)"],
    ["Coquille", "Tableau de bord · barre latérale repliable · bannière d'accueil"],
  ];
  lots.forEach(([t, d], i) => {
    const y = 1.8 + i * 0.98;
    s.addShape(pres.ShapeType.roundRect, { x: 0.5, y, w: 12.3, h: 0.82, rectRadius: 0.1, fill: { color: i % 2 ? PAPIER : BANDE }, line: { color: i % 2 ? PAPIER : BANDE } });
    s.addText(t, { x: 0.8, y, w: 2.4, h: 0.82, fontFace: SANS, fontSize: 15, bold: true, color: PROFOND, valign: "middle", isTextBox: true, margin: 0 });
    s.addText(d, { x: 3.2, y, w: 9.4, h: 0.82, fontFace: SANS, fontSize: 12.5, color: ENCRE, valign: "middle", isTextBox: true, margin: 0 });
  });
  s.addText("Reste : les cinq écrans refondus en parallèle (tableau de bord, financier, commandes, documents, comptes rendus) à unifier sur les mêmes tuiles.", { x: 0.5, y: 6.75, w: 12.3, h: 0.3, fontFace: SANS, fontSize: 10.5, italic: true, color: PALE, isTextBox: true, margin: 0 });
}

// 7. Règles transverses
{
  const s = pres.addSlide(); fond(s);
  entete(s, "RÈGLES ADOPTÉES EN COURS DE ROUTE", "Trois règles qui s'appliquent à tous les écrans");
  const regles = [
    ["Formalisme des chiffres", "Milliers séparés, décimales à la virgule, unité séparée, zéro = champ vide avec le « 0 » en filigrane. Dans les tableaux comme dans les champs de saisie.", "1 250 000 FCFA · 4,2 %"],
    ["Saisie en série", "« L'utilisateur qui a n éléments à saisir ne clique pas n fois » : une ligne de saisie permanente et un bouton « Rendre les champs persistants » sur chaque écran de saisie.", "Entrée ajoute, le focus revient"],
    ["Tableaux d'ERP", "Défilement intégré au tableau et nombre de lignes visibles au choix, partout. La page ne défile pas : le tableau, si.", "5 · 10 · 15 · 20 · 30 · 50 lignes"],
  ];
  regles.forEach(([t, d, ex], i) => {
    const x = 0.5 + i * 4.2;
    s.addShape(pres.ShapeType.roundRect, { x, y: 1.8, w: 3.9, h: 4.6, rectRadius: 0.12, fill: { color: PAPIER }, line: { color: "E2E8F0", width: 0.75 } });
    s.addText(t, { x: x + 0.3, y: 2.05, w: 3.3, h: 0.6, fontFace: SANS, fontSize: 18, bold: true, color: ENCRE, isTextBox: true, margin: 0 });
    s.addText(d, { x: x + 0.3, y: 2.75, w: 3.3, h: 2.4, fontFace: SANS, fontSize: 13, color: DOUCE, valign: "top", isTextBox: true, margin: 0 });
    s.addShape(pres.ShapeType.roundRect, { x: x + 0.3, y: 5.5, w: 3.3, h: 0.6, rectRadius: 0.08, fill: { color: NUIT }, line: { color: NUIT } });
    s.addText(ex, { x: x + 0.3, y: 5.5, w: 3.3, h: 0.6, fontFace: "Courier New", fontSize: 12, bold: true, color: BLANC, align: "center", valign: "middle", isTextBox: true, margin: 0 });
  });
}

// 8. Bulletin
{
  const s = pres.addSlide(); fond(s);
  entete(s, "BULLETIN DE PAIE", "Redessiné, validé sur maquette, livré partout");
  s.addImage({ path: path.join(__dirname, "_bulletin.png"), x: 9.15, y: 1.65, w: 3.6, h: 5.15, shadow: { type: "outer", color: "03045E", blur: 8, offset: 3, angle: 90, opacity: 0.25 } });
  s.addText(puces([
    "Sept zones : en-tête commun aux documents, salarié en bandeau, temps et congés, rubriques avec intercalaires (gains · cotisations et impôts · autres retenues), synthèse Total 1 / Total 2, visa et reçu, pied de référence.",
    "Net à payer en bleu sceau, taux du barème écrits, « barème » pour IRPP / TDL / RAV, zéros estompés.",
    "Filigrane PROVISOIRE tant que le mois est ouvert, mention « validé » à la clôture.",
    "Formules et liste codée des rubriques inchangées : seule la mise en page change.",
    "Page Bulletins du mois refaite : récapitulatif = sommaire, aperçu A4, « Imprimer seul », clôture confirmée par mot-clé.",
    "Corrigé au passage : les PDF archivés recevaient une version appauvrie du bulletin.",
  ]), { x: 0.5, y: 1.8, w: 8.3, h: 4.9, fontFace: SANS, fontSize: 13, color: DOUCE, valign: "top", isTextBox: true, margin: 0 });
}

// 9. Paramètres
{
  const s = pres.addSlide(); fond(s);
  entete(s, "PARAMÈTRES", "Tout ce qui se règle une fois, et que personne ne voit à l'écran");
  const sections = [
    ["Entreprise & documents", "Identité, apparence, aperçu de l'en-tête imprimé"],
    ["Paie & congés", "Visa RH, jour de paiement, congés acquis, jours de base, plafond de saisie, PDF à la clôture"],
    ["Courrier & e-mail", "Expéditeur, modèle de lettre, interrupteur d'envoi réel"],
    ["Fonctionnement", "Fenêtre des comptes rendus, verrou financier, IA documents — jusqu'ici des constantes enfouies dans le code"],
    ["Rôles & accès", "La matrice droits × rôles, dérivée du code"],
    ["Déploiement", "Réservé au super administrateur : quelles clés sont configurées, jamais leur valeur"],
  ];
  sections.forEach(([t, d], i) => {
    const x = 0.5 + (i % 2) * 6.25, y = 1.8 + Math.floor(i / 2) * 1.55;
    s.addShape(pres.ShapeType.roundRect, { x, y, w: 6.05, h: 1.35, rectRadius: 0.1, fill: { color: i === 5 ? NUIT : PAPIER }, line: { color: i === 5 ? NUIT : "E2E8F0", width: 0.75 } });
    s.addText(t, { x: x + 0.3, y: y + 0.15, w: 5.5, h: 0.4, fontFace: SANS, fontSize: 15, bold: true, color: i === 5 ? BLANC : PROFOND, isTextBox: true, margin: 0 });
    s.addText(d, { x: x + 0.3, y: y + 0.55, w: 5.5, h: 0.7, fontFace: SANS, fontSize: 12, color: i === 5 ? BRUME : DOUCE, valign: "top", isTextBox: true, margin: 0 });
  });
  s.addText("Un seul bouton « Enregistrer » pour la page ; chaque modification est journalisée avec son auteur.", { x: 0.5, y: 6.5, w: 12.3, h: 0.35, fontFace: SANS, fontSize: 11.5, italic: true, color: PALE, isTextBox: true, margin: 0 });
}

// 10. Pilotage : plan 3 semaines
{
  const s = pres.addSlide(); fond(s);
  entete(s, "PILOTAGE", "Trois semaines jusqu'à la mise en service du 10 octobre");
  const etapes = [["S1 · 22 → 26 sept.", "Le bulletin fait foi", "Bulletin validé sur papier ; accès sécurisés ; comptes vérifiés"], ["S2 · 29 sept. → 3 oct.", "La clinique teste", "Cahier de recette final ; campagne par rôle ; niveaux tranchés"], ["S3 · 6 → 10 oct.", "Prêt à mettre en service", "Production, e-mail réel, sauvegardes, mobile, passation"]];
  s.addShape(pres.ShapeType.line, { x: 1.1, y: 2.65, w: 11.1, h: 0, line: { color: CIEL, width: 3 } });
  etapes.forEach(([q, t, d], i) => {
    const x = 0.5 + i * 4.2;
    s.addShape(pres.ShapeType.ellipse, { x: x + 1.6, y: 2.35, w: 0.6, h: 0.6, fill: { color: i === 2 ? NUIT : PROFOND }, line: { color: BLANC, width: 2 } });
    s.addText(q, { x, y: 1.8, w: 3.9, h: 0.4, fontFace: SANS, fontSize: 12, bold: true, color: PROFOND, align: "center", isTextBox: true, margin: 0 });
    s.addText(t, { x, y: 3.1, w: 3.9, h: 0.5, fontFace: SERIF, fontSize: 18, bold: true, color: ENCRE, align: "center", isTextBox: true, margin: 0 });
    s.addText(d, { x: x + 0.2, y: 3.6, w: 3.5, h: 0.9, fontFace: SANS, fontSize: 12, color: DOUCE, align: "center", valign: "top", isTextBox: true, margin: 0 });
  });
  const bas = [["Journal des décisions", "14 décisions datées, chacune avec l'endroit du code qui l'applique (DECISIONS.md)."], ["Comptes de test", "Huit comptes, un par rôle, e-mail et téléphone, fiche PDF pour les testeurs."], ["Sept décisions attendues", "Mot de passe super admin, relecture papier, attendus de recette, effectif réel, niveaux, domaine, compte e-mail — chacune avec sa date butoir."]];
  bas.forEach(([t, d], i) => {
    const x = 0.5 + i * 4.2;
    s.addShape(pres.ShapeType.roundRect, { x, y: 4.75, w: 3.9, h: 1.9, rectRadius: 0.1, fill: { color: PAPIER }, line: { color: "E2E8F0", width: 0.75 } });
    s.addText(t, { x: x + 0.25, y: 4.9, w: 3.4, h: 0.4, fontFace: SANS, fontSize: 13.5, bold: true, color: ENCRE, isTextBox: true, margin: 0 });
    s.addText(d, { x: x + 0.25, y: 5.3, w: 3.4, h: 1.25, fontFace: SANS, fontSize: 11.5, color: DOUCE, valign: "top", isTextBox: true, margin: 0 });
  });
}

// 11. État d'avancement (graphique natif)
{
  const s = pres.addSlide(); fond(s);
  entete(s, "ÉTAT D'AVANCEMENT", "Par chantier, au 21 septembre");
  const labels = ["Architecture et données", "Backend métier", "Moteur de paie", "Authentification et rôles", "Front-end", "Documents imprimés", "Tests automatisés", "Documentation et recette", "Sécurité et production"];
  const values = [90, 90, 95, 85, 90, 80, 85, 70, 45];
  s.addChart(pres.ChartType.bar, [{ name: "Avancement (%)", labels, values }], {
    x: 0.5, y: 1.7, w: 8.2, h: 5.1, barDir: "bar", chartColors: [PROFOND],
    showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 11, dataLabelColor: ENCRE, dataLabelFormatCode: "0\" %\"",
    valAxisMinVal: 0, valAxisMaxVal: 100, valAxisLabelColor: PALE, valAxisLabelFontSize: 10, valGridLine: { color: "E2E8F0", size: 0.5 },
    catAxisLabelColor: ENCRE, catAxisLabelFontSize: 11, catGridLine: { style: "none" }, catAxisOrientation: "maxMin", showLegend: false, showTitle: false,
  });
  s.addShape(pres.ShapeType.roundRect, { x: 9.1, y: 1.7, w: 3.75, h: 5.1, rectRadius: 0.12, fill: { color: NUIT }, line: { color: NUIT } });
  s.addText("Le fait marquant", { x: 9.4, y: 1.95, w: 3.2, h: 0.4, fontFace: SANS, fontSize: 13, bold: true, color: CERULEEN, isTextBox: true, margin: 0 });
  s.addText("Front-end : de 40 % à 90 % en une semaine.", { x: 9.4, y: 2.4, w: 3.2, h: 1.2, fontFace: SERIF, fontSize: 20, bold: true, color: BLANC, isTextBox: true, margin: 0 });
  s.addText("La plateforme est utilisable de bout en bout par un utilisateur connecté avec son propre rôle. Ce qui reste — recette, arbitrages, production — est court mais conditionne la mise en service.", { x: 9.4, y: 3.7, w: 3.2, h: 2.8, fontFace: SANS, fontSize: 12.5, color: BRUME, valign: "top", isTextBox: true, margin: 0 });
}

// 12. Vigilance
{
  const s = pres.addSlide(); fond(s);
  entete(s, "POINTS DE VIGILANCE", "Ce qui attend une décision ou une action hors développement");
  const rows = [
    ["Sujet", "Situation", "Action attendue"],
    ["Niveaux des rôles", "Matrice actuelle en service ; comptable, DAF et RH pas encore entendus", "Entretiens avant le 2 octobre, report dans le code"],
    ["Mot de passe du super administrateur", "Compte de test avec le mot de passe commun", "À changer par le propriétaire avant toute diffusion du lien"],
    ["Validation papier du bulletin", "Maquette validée, papier pas encore signé", "Impression et relecture par le directeur (semaine du 22)"],
    ["Envoi d'e-mails", "Simulation ; clé et domaine absents", "Compte Resend et domaine vérifié (butoir 3 octobre)"],
    ["Barème officiel", "Contrôle quotidien sans source branchée", "Choisir la source à surveiller"],
    ["Données réelles", "Recette sur données de démonstration", "Effectif et soldes J0 (butoir 26 septembre)"],
  ].map((r, i) => r.map((c, j) => ({ text: c, options: { bold: i === 0 || j === 0, fontFace: SANS, fontSize: 11.5, color: i === 0 ? BLANC : j === 2 ? OCRE : ENCRE, fill: { color: i === 0 ? PROFOND : j === 2 && i > 0 ? OCRE_CLAIR : i % 2 ? BLANC : BANDE }, valign: "middle" } })));
  s.addTable(rows, { x: 0.5, y: 1.75, w: 12.3, colW: [3.2, 4.6, 4.5], border: { type: "solid", color: "E2E8F0", pt: 0.5 }, rowH: 0.62 });
}

// 13. Programme
{
  const s = pres.addSlide(); fond(s, true);
  entete(s, "PROGRAMME DE LA SEMAINE DU 21 SEPTEMBRE", "S1 du plan : « le bulletin fait foi »", true);
  const items = ["Faire valider le bulletin de paie sur papier par le directeur ; corriger les écarts.", "Changer le mot de passe du super administrateur ; vérifier chaque compte de test un par un.", "Écrire le cahier de recette final, un scénario par écran et par rôle, à partir des attendus du propriétaire.", "Recueillir le fichier de l'effectif réel et les soldes d'ouverture du grand livre.", "Unifier les tuiles des cinq écrans refondus en parallèle."];
  items.forEach((t, i) => {
    const y = 1.9 + i * 0.95;
    s.addShape(pres.ShapeType.ellipse, { x: 0.6, y: y + 0.05, w: 0.6, h: 0.6, fill: { color: CERULEEN }, line: { color: CERULEEN } });
    s.addText(String(i + 1), { x: 0.6, y: y + 0.05, w: 0.6, h: 0.6, fontFace: SANS, fontSize: 16, bold: true, color: NUIT, align: "center", valign: "middle", isTextBox: true, margin: 0 });
    s.addText(t, { x: 1.45, y, w: 10.8, h: 0.7, fontFace: SANS, fontSize: 16, color: BLANC, valign: "middle", isTextBox: true, margin: 0 });
  });
  s.addText("Mise en service visée : vendredi 10 octobre 2026.", { x: 0.6, y: 6.55, w: 11, h: 0.4, fontFace: SERIF, fontSize: 15, bold: true, color: CIEL, isTextBox: true, margin: 0 });
}

pres.writeFile({ fileName: path.join(__dirname, "..", "rapport-de-la-semaine-du-14.pptx") }).then((f) => console.log("écrit", f));
