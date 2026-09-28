// Rapport du 21 septembre 2026 — version PowerPoint (même charte que le rapport du 14).
// Usage : node design/rapport-21.pptx.cjs  →  rapport-du-21.pptx à la racine.
const pptxgen = require("pptxgenjs");
const path = require("path");

const NUIT = "03045E", PROFOND = "0077B6", CERULEEN = "00B4D8", CIEL = "90E0EF", BRUME = "CAF0F8", PAPIER = "F6F9FB", BANDE = "EAF3F8";
const ENCRE = "0B132B", DOUCE = "334155", PALE = "64748B", BLANC = "FFFFFF", OCRE = "8A5D12", OCRE_CLAIR = "FEF3C7", VERT = "15803D", VERT_CLAIR = "DCFCE7";
const SANS = "Calibri", SERIF = "Cambria";
const PIED = "Rapport du 21 septembre 2026 · point arrêté le lundi 28 au soir";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 × 7.5
pres.author = "krys237";
pres.title = "Rapport du 21 septembre 2026";

let n = 0;
function fond(slide, sombre = false) {
  slide.background = { color: sombre ? NUIT : BLANC };
  n += 1;
  slide.addText(PIED, { x: 0.5, y: 7.0, w: 9, h: 0.3, fontFace: SANS, fontSize: 9, color: sombre ? CIEL : PALE, isTextBox: true, margin: 0 });
  slide.addText(String(n), { x: 12.3, y: 7.0, w: 0.55, h: 0.3, fontFace: SANS, fontSize: 9, color: sombre ? CIEL : PALE, align: "right", isTextBox: true, margin: 0 });
}
function entete(slide, eyebrow, titre, sombre = false) {
  slide.addText(eyebrow, { x: 0.5, y: 0.4, w: 12, h: 0.3, fontFace: SANS, fontSize: 11, bold: true, charSpacing: 3, color: sombre ? CERULEEN : PROFOND, isTextBox: true, margin: 0 });
  slide.addText(titre, { x: 0.5, y: 0.7, w: 12.3, h: 0.8, fontFace: SERIF, fontSize: 28, bold: true, color: sombre ? BLANC : ENCRE, isTextBox: true, margin: 0 });
}
const puces = (items, o = {}) => items.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < items.length - 1, paraSpaceAfter: 6, ...o } }));
// Un objet neuf à chaque image : pptxgenjs modifie en place les options d'ombre (le 2e usage corrompait le fichier).
const ombre = () => ({ type: "outer", color: "03045E", blur: 8, offset: 3, angle: 90, opacity: 0.25 });
const tableau = (lignes, colonneForte) => lignes.map((r, i) => r.map((c, j) => ({
  text: c,
  options: {
    bold: i === 0 || j === 0, fontFace: SANS, fontSize: 11, valign: "middle",
    color: i === 0 ? BLANC : j === colonneForte ? ENCRE : DOUCE,
    fill: { color: i === 0 ? PROFOND : i % 2 ? BLANC : BANDE },
  },
})));

// 1. Titre
{
  const s = pres.addSlide(); fond(s, true);
  s.addShape(pres.ShapeType.ellipse, { x: 8.9, y: -1.2, w: 6, h: 6, fill: { color: PROFOND, transparency: 70 }, line: { color: PROFOND, transparency: 100 } });
  s.addShape(pres.ShapeType.ellipse, { x: 10.6, y: 2.6, w: 3.6, h: 3.6, fill: { color: CERULEEN, transparency: 75 }, line: { color: CERULEEN, transparency: 100 } });
  s.addText("POITIERS COWORKING · PLATEFORME UNIFIÉE DE GESTION & PAIE", { x: 0.6, y: 1.5, w: 9, h: 0.35, fontFace: SANS, fontSize: 12, bold: true, charSpacing: 3, color: CERULEEN, isTextBox: true, margin: 0 });
  s.addText("Rapport du 21 septembre 2026", { x: 0.6, y: 1.95, w: 8.6, h: 1.2, fontFace: SERIF, fontSize: 42, bold: true, color: BLANC, isTextBox: true, margin: 0 });
  s.addText("Sprint S1 bouclé, demandes de M. GAMBOU réglées, droits choisis par le directeur, bulletin prêt pour la validation papier.", { x: 0.6, y: 3.35, w: 8, h: 1.2, fontFace: SANS, fontSize: 18, color: BRUME, isTextBox: true, margin: 0 });
  s.addText("Semaine du 21 septembre, prolongée au lundi 28 au soir · rédigé par krys237", { x: 0.6, y: 5.6, w: 8.5, h: 0.4, fontFace: SANS, fontSize: 12, color: CIEL, isTextBox: true, margin: 0 });
}

// 2. En bref
{
  const s = pres.addSlide(); fond(s);
  entete(s, "EN BREF", "Trois changements de fond cette semaine");
  const cartes = [
    ["01", "Demandes de M. GAMBOU réglées", "Bulletin consultable par l'employé, PDF en un clic, verrou d'une heure sur la caisse, destinataires choisis, courrier par WhatsApp, usage sur téléphone."],
    ["02", "Droits choisis par le directeur", "Fini la hiérarchie rigide : d'un clic, le directeur décide qui voit et qui fait quoi, module par module, et peut faire une exception pour une personne."],
    ["03", "Bulletin prêt pour le papier", "Une seule feuille A4, titre « BULLETIN DU MOIS », jeu d'impression du directeur prêt : 3 bulletins, la liste, un courrier."],
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
  s.addText("82 %", { x: 0.8, y: 5.55, w: 2.2, h: 1.05, fontFace: SERIF, fontSize: 40, bold: true, color: BLANC, valign: "middle", isTextBox: true, margin: 0 });
  s.addText("d'achèvement estimé (78 % le 21). 34 tâches S1 sur 37 faites ou dépassées ; les trois restantes attendent le directeur ou les données réelles. Mise en service visée : vendredi 10 octobre.", { x: 3.0, y: 5.55, w: 9.6, h: 1.05, fontFace: SANS, fontSize: 14, color: BRUME, valign: "middle", isTextBox: true, margin: 0 });
}

// 3. Chiffres
{
  const s = pres.addSlide(); fond(s);
  entete(s, "CHIFFRES DE LA PÉRIODE", "Du 21 au soir au 28 septembre");
  const stats = [["34 / 37", "tâches S1 du Jira", "faites ou dépassées"], ["8 / 8", "demandes de M. GAMBOU", "envoi WhatsApp réel à confirmer"], ["23", "modules réglables", "Voir / Faire, par rôle ou par personne"], ["10", "suites de tests au vert", "dont 218 contrôles des droits"], ["8 / 8", "comptes de test vérifiés", "un par rôle, menu conforme"], ["30", "décisions consignées", "journal des décisions"]];
  stats.forEach(([v, l, d], i) => {
    const x = 0.5 + (i % 3) * 4.2, y = 1.85 + Math.floor(i / 3) * 2.45;
    s.addShape(pres.ShapeType.roundRect, { x, y, w: 3.9, h: 2.15, rectRadius: 0.12, fill: { color: i === 0 ? NUIT : PAPIER }, line: { color: i === 0 ? NUIT : "E2E8F0", width: 0.75 } });
    s.addText(v, { x: x + 0.3, y: y + 0.2, w: 3.3, h: 1, fontFace: SERIF, fontSize: 44, bold: true, color: i === 0 ? BLANC : PROFOND, isTextBox: true, margin: 0 });
    s.addText(l, { x: x + 0.3, y: y + 1.2, w: 3.3, h: 0.4, fontFace: SANS, fontSize: 14, bold: true, color: i === 0 ? BRUME : ENCRE, isTextBox: true, margin: 0 });
    s.addText(d, { x: x + 0.3, y: y + 1.6, w: 3.3, h: 0.4, fontFace: SANS, fontSize: 11.5, color: i === 0 ? CIEL : PALE, isTextBox: true, margin: 0 });
  });
}

// 4. Sprint S1 : prévu et réalisé
{
  const s = pres.addSlide(); fond(s);
  entete(s, "SPRINT S1 DU JIRA", "Les 8 tâches restantes au 23/09 : où en sont-elles ?");
  const etat = { fait: [VERT, VERT_CLAIR], attente: [OCRE, OCRE_CLAIR], neutre: [PROFOND, BANDE] };
  const lignes = [
    ["Remettre au directeur le jeu d'impression", "Fait", "PDF de 6 pages prêt, à imprimer et remettre", "fait"],
    ["Vérifier chaque compte de test", "Fait", "Les 8 comptes : bon rôle, bon menu", "fait"],
    ["Rapport de la semaine du 21", "Fait", "Le présent rapport", "fait"],
    ["Changer le mot de passe du super admin", "Reporté", "À la mise en production (mode test)", "neutre"],
    ["Fournir les attendus de la recette", "Réorienté", "Les cahiers sont réécrits par le développement (S2)", "neutre"],
    ["Corrections de la validation papier", "Anticipées", "Une feuille, « BULLETIN DU MOIS » ; la suite après relecture", "neutre"],
    ["Validation papier du bulletin", "En attente", "Relecture et signature du directeur", "attente"],
    ["Données de recette réelles", "En attente", "Effectif et soldes J0 du propriétaire", "attente"],
  ];
  const rows = [["Tâche", "Statut", "Précision"], ...lignes.map(([t, st, p]) => [t, st, p])].map((r, i) => r.map((c, j) => {
    const [fg, bg] = i ? etat[lignes[i - 1][3]] : [BLANC, PROFOND];
    return { text: c, options: { bold: i === 0 || j < 2, fontFace: SANS, fontSize: 12, valign: "middle", color: i === 0 ? BLANC : j === 1 ? fg : ENCRE, fill: { color: i === 0 ? PROFOND : j === 1 ? bg : i % 2 ? BLANC : BANDE }, align: j === 1 ? "center" : "left" } };
  }));
  s.addTable(rows, { x: 0.5, y: 1.7, w: 12.3, colW: [4.6, 1.6, 6.1], border: { type: "solid", color: "E2E8F0", pt: 0.5 }, rowH: 0.52 });
  s.addText("Les 29 autres tâches S1 étaient livrées au 23/09 (bulletin refondu, Paramètres, rôles, connexion, comptes de test, aperçus, pilotage).", { x: 0.5, y: 6.55, w: 12.3, h: 0.35, fontFace: SANS, fontSize: 11, italic: true, color: PALE, isTextBox: true, margin: 0 });
}

// 5. Demandes de M. GAMBOU
{
  const s = pres.addSlide(); fond(s);
  entete(s, "DEMANDES DE M. GAMBOU", "Toutes réglées");
  const rows = tableau([
    ["Demande", "Réponse livrée"],
    ["Employé : voir son bulletin", "Écran « Mes bulletins » : mois clôturés, PDF, pensé pour le téléphone"],
    ["Comptable : qui reçoit un document", "« Seulement des personnes choisies » : elles seules et le déposant le voient"],
    ["Comptable : plus de modification après 1 h (caisse, primes médecins)", "Ligne verrouillée 1 h après saisie ; ensuite, l'administrateur seul, journalisé"],
    ["Administrateur : PDF dans « Bulletin du mois »", "« PDF du mois » (un par page) et « PDF » par salarié"],
    ["Administrateur : courrier par WhatsApp", "E-mail, WhatsApp ou les deux, via UltraMsg ; journal par canal"],
    ["Administrateur et auditeur : connexion hors Polyclinique", "Déjà possible : aucune restriction de lieu"],
    ["Auditeur : accès sauf documents", "Consulte tout sans agir, sauf Paramètres, Journal, Archives, documents"],
    ["Usage sur téléphone", "Écran de l'employé conçu pour le téléphone ; reste de l'ERP en S2–S3"],
  ], 0);
  s.addTable(rows, { x: 0.5, y: 1.65, w: 12.3, colW: [4.9, 7.4], border: { type: "solid", color: "E2E8F0", pt: 0.5 }, rowH: 0.5 });
  s.addShape(pres.ShapeType.roundRect, { x: 0.5, y: 6.3, w: 12.3, h: 0.55, rectRadius: 0.08, fill: { color: OCRE_CLAIR }, line: { color: OCRE_CLAIR } });
  s.addText("En attente : premier envoi WhatsApp réel — l'instance UltraMsg est en veille (« standby »). D'ici là, l'envoi est simulé et l'écran le dit.", { x: 0.7, y: 6.3, w: 12, h: 0.55, fontFace: SANS, fontSize: 12, color: OCRE, valign: "middle", isTextBox: true, margin: 0 });
}

// 6. Droits choisis par le directeur
{
  const s = pres.addSlide(); fond(s);
  entete(s, "RÔLES & ACCÈS", "Le directeur décide qui voit et qui fait quoi, d'un clic");
  s.addImage({ path: path.join(__dirname, "_matrice.png"), x: 0.5, y: 1.65, w: 7.6, h: 7.6 * 1285 / 2240, shadow: ombre() });
  s.addText(puces([
    "Deux cases par module et par rôle : Voir (consulter) et Faire (saisir, valider, envoyer).",
    "Exceptions par personne : accorder ou retirer un droit à un membre précis.",
    "Droits de départ = l'ancien fonctionnement, plus : comptable → grand livre ; auditeur → consulte sans agir.",
    "Contrôle par le serveur : décocher bloque réellement l'action.",
    "Garde-fou : le directeur garde Paramètres et Membres.",
    "Règle posée : retirer un droit fait disparaître les actions qui en dépendent (mise en conformité des écrans en S2).",
  ]), { x: 8.4, y: 1.7, w: 4.45, h: 5.1, fontFace: SANS, fontSize: 12.5, color: DOUCE, valign: "top", isTextBox: true, margin: 0 });
}

// 7. Mes bulletins (téléphone)
{
  const s = pres.addSlide(); fond(s);
  entete(s, "MES BULLETINS", "L'employé consulte et télécharge ses bulletins, sur son téléphone");
  s.addImage({ path: path.join(__dirname, "_mes-bulletins.png"), x: 9.4, y: 1.55, w: 2.45, h: 2.45 * 1688 / 780, shadow: ombre() });
  s.addText(puces([
    "Une carte par mois clôturé : net à payer, brut, retenues.",
    "Aperçu du bulletin réduit à la largeur de l'écran, et « Télécharger le PDF » en un geste.",
    "Seuls les mois clôturés apparaissent : un bulletin provisoire peut encore changer.",
    "Le compte est relié à la fiche employé dans Membres (à défaut, par l'e-mail).",
    "Le serveur ne sert à un membre que SON bulletin.",
    "Module « Mes bulletins » ouvert à tout membre par défaut, réglable dans la matrice.",
  ]), { x: 0.5, y: 1.8, w: 8.5, h: 4.8, fontFace: SANS, fontSize: 14, color: DOUCE, valign: "top", isTextBox: true, margin: 0 });
}

// 8. Bulletin & documents
{
  const s = pres.addSlide(); fond(s);
  entete(s, "BULLETIN DU MOIS", "Une feuille A4, prêt pour la validation papier");
  s.addImage({ path: path.join(__dirname, "_bulletin-mois.png"), x: 9.05, y: 1.55, w: 3.75, h: 3.75 * 1287 / 909, shadow: ombre() });
  s.addText(puces([
    "À l'impression, le bulletin débordait d'un tiers de page : il tient désormais sur une feuille, sans changer l'écran.",
    "« BULLETIN DU MOIS » remplace « Bulletin de paie » à l'écran, à l'impression et dans le PDF.",
    "Jeu d'impression du directeur : 3 bulletins (cas de référence, IRPP élevé, retenues diverses), la liste des salaires et un courrier, sortis par l'application.",
    "PDF à la demande dans Bulletins du mois : le mois entier ou un salarié.",
    "À corriger dans Paramètres avant la remise : nom de l'entreprise (« P POITIERS… »), NIU et N° CNPS vides.",
  ]), { x: 0.5, y: 1.8, w: 8.2, h: 4.9, fontFace: SANS, fontSize: 13.5, color: DOUCE, valign: "top", isTextBox: true, margin: 0 });
}

// 9. État d'avancement (graphique natif, avant / après)
{
  const s = pres.addSlide(); fond(s);
  entete(s, "ÉTAT D'AVANCEMENT", "Par chantier, le 21 et le 28 septembre");
  const labels = ["Socle & données", "Paie automatisée", "Exploitation", "Finances", "Accès, rôles & sécurité", "Documents imprimables", "Paramètres", "Recette & qualité", "Mise en production", "Pilotage & doc."];
  s.addChart(pres.ChartType.bar, [
    { name: "21/09", labels, values: [90, 95, 95, 90, 90, 85, 100, 25, 30, 80] },
    { name: "28/09", labels, values: [90, 95, 95, 90, 95, 90, 100, 30, 35, 85] },
  ], {
    x: 0.5, y: 1.65, w: 8.4, h: 5.2, barDir: "bar", barGrouping: "clustered", chartColors: [CIEL, PROFOND],
    showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 9, dataLabelColor: ENCRE, dataLabelFormatCode: "0\" %\"",
    valAxisMinVal: 0, valAxisMaxVal: 100, valAxisLabelColor: PALE, valAxisLabelFontSize: 10, valGridLine: { color: "E2E8F0", size: 0.5 },
    catAxisLabelColor: ENCRE, catAxisLabelFontSize: 10.5, catGridLine: { style: "none" }, catAxisOrientation: "maxMin",
    showLegend: true, legendPos: "b", legendFontSize: 10, showTitle: false,
  });
  s.addShape(pres.ShapeType.roundRect, { x: 9.2, y: 1.65, w: 3.65, h: 5.2, rectRadius: 0.12, fill: { color: NUIT }, line: { color: NUIT } });
  s.addText("Ce qui reste", { x: 9.45, y: 1.9, w: 3.2, h: 0.4, fontFace: SANS, fontSize: 13, bold: true, color: CERULEEN, isTextBox: true, margin: 0 });
  s.addText("La recette et la mise en production.", { x: 9.45, y: 2.35, w: 3.2, h: 1.1, fontFace: SERIF, fontSize: 20, bold: true, color: BLANC, isTextBox: true, margin: 0 });
  s.addText("Les fonctions demandées sont livrées. Reste à les faire éprouver par la clinique (cahiers réécrits, campagne par rôle), à brancher l'e-mail et WhatsApp réels et à basculer en production.", { x: 9.45, y: 3.55, w: 3.2, h: 3.1, fontFace: SANS, fontSize: 12.5, color: BRUME, valign: "top", isTextBox: true, margin: 0 });
}

// 10. Vigilance
{
  const s = pres.addSlide(); fond(s);
  entete(s, "POINTS DE VIGILANCE", "Ce qui attend une décision ou une action hors développement");
  const rows = [
    ["Sujet", "Situation", "Action attendue"],
    ["Validation papier du bulletin", "Jeu d'impression prêt", "Relecture et signature du directeur ; corrections en S2"],
    ["Données de l'entreprise", "Nom mal saisi, NIU et N° CNPS vides", "À corriger dans Paramètres avant la remise"],
    ["WhatsApp", "Instance UltraMsg en veille", "La relier au téléphone, puis premier envoi réel"],
    ["E-mail réel", "Simulation, pas de domaine", "Acheter le domaine, le vérifier chez Resend (butoir 3/10)"],
    ["Données réelles", "Recette sur données de démonstration", "Fichier de l'effectif et soldes J0"],
    ["Calendrier", "Ajouts pris sur la fenêtre de recette", "Recette ramenée à 3 jours (5 → 7/10) ; le 10/10 est tendu"],
  ].map((r, i) => r.map((c, j) => ({ text: c, options: { bold: i === 0 || j === 0, fontFace: SANS, fontSize: 11.5, color: i === 0 ? BLANC : j === 2 ? OCRE : ENCRE, fill: { color: i === 0 ? PROFOND : j === 2 && i > 0 ? OCRE_CLAIR : i % 2 ? BLANC : BANDE }, valign: "middle" } })));
  s.addTable(rows, { x: 0.5, y: 1.75, w: 12.3, colW: [3.0, 4.2, 5.1], border: { type: "solid", color: "E2E8F0", pt: 0.5 }, rowH: 0.62 });
}

// 11. Programme
{
  const s = pres.addSlide(); fond(s, true);
  entete(s, "PROGRAMME DE LA SEMAINE DU 29 SEPTEMBRE", "S2 du plan : « la clinique teste »", true);
  const items = [
    "Réécrire les cahiers de recette : un scénario par écran et par rôle, dont « un droit retiré, ses actions disparaissent ».",
    "Mettre les écrans en conformité : boutons d'action masqués sans le droit « Faire ».",
    "Campagne de tests avec les huit comptes, deux lots de corrections.",
    "ERP au moins lisible sur téléphone, en commençant par les écrans de l'employé.",
    "Premier envoi WhatsApp réel ; domaine et Resend pour l'e-mail.",
    "Politique de mot de passe, unification des tuiles des cinq écrans refondus en parallèle.",
  ];
  items.forEach((t, i) => {
    const y = 1.8 + i * 0.8;
    s.addShape(pres.ShapeType.ellipse, { x: 0.6, y: y + 0.05, w: 0.55, h: 0.55, fill: { color: CERULEEN }, line: { color: CERULEEN } });
    s.addText(String(i + 1), { x: 0.6, y: y + 0.05, w: 0.55, h: 0.55, fontFace: SANS, fontSize: 15, bold: true, color: NUIT, align: "center", valign: "middle", isTextBox: true, margin: 0 });
    s.addText(t, { x: 1.4, y, w: 11, h: 0.65, fontFace: SANS, fontSize: 15, color: BLANC, valign: "middle", isTextBox: true, margin: 0 });
  });
  s.addText("Mise en service visée : vendredi 10 octobre 2026.", { x: 0.6, y: 6.55, w: 11, h: 0.4, fontFace: SERIF, fontSize: 15, bold: true, color: CIEL, isTextBox: true, margin: 0 });
}

pres.writeFile({ fileName: path.join(__dirname, "..", "rapport-du-21.pptx") }).then((f) => console.log("écrit", f));
