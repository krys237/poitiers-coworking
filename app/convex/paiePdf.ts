"use node";
// Actions Node : génération des PDF de bulletins (pdf-lib) au format de référence (application PAIE du directeur),
// envoi du courrier de paie avec pièce jointe, archivage des PDF des mois clôturés dans le stockage Convex.
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { libellePeriode, nomFichierPdf } from "./lib/periode";

// Les polices standard PDF n'encodent que Latin-1 : on remplace le reste (—, …, espaces fines…).
const clean = (s: string) => (s ?? "").normalize("NFC").replace(/[–—]/g, "-").replace(/…/g, "...").replace(/[   ]/g, " ").replace(/[«»]/g, '"').replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
const fmt = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const f0 = (n: number | undefined) => (n ? fmt(n) : "-");
const pctTxt = (t: number) => (t ? `${t.toString().replace(".", ",")}%` : "");
const hex = (h?: string) => { const m = /^#?([0-9a-f]{6})$/i.exec(h ?? ""); const n = parseInt(m ? m[1] : "0f2a44", 16); return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); };

interface BulletinPdfInput {
  bulletin: {
    nom: string; matricule: string; fonction?: string; adresse?: string; cnps?: string; niu?: string; categorie?: string; echelon?: string;
    departement?: string; dateDebut?: string; societe: string;
    brut: number; totalRetenues: number; net: number;
    lignesGain: { code: string; libelle: string; base: number; gain: number }[];
    cotisations: { code: string; libelle: string; base: number; taux: number; retenue: number; chargePatronale: number }[];
    details?: Record<string, number>;
    periodeDu?: string; periodeAu?: string; datePaiement?: string; valide?: boolean; valideLe?: string;
  };
  periode: string;
  entreprise: { nom: string; adresse?: string; couleurEntete?: string; filigrane?: string; niu?: string; numeroCnps?: string; responsableRH?: string };
  lettre?: string; // si présente : page 1 = lettre, page 2 = bulletin
}

function wrap(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of clean(text).split("\n")) {
    if (!para.trim()) { out.push(""); continue; }
    let line = "";
    for (const word of para.split(/\s+/)) {
      const essai = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(essai, size) <= maxWidth) line = essai;
      else { if (line) out.push(line); line = word; }
    }
    if (line) out.push(line);
  }
  return out;
}

const W = 595.28, H = 841.89, M = 36;
const INK = rgb(0.06, 0.09, 0.16), SOFT = rgb(0.2, 0.25, 0.33), BORDER = rgb(0.58, 0.64, 0.72), WHITE = rgb(1, 1, 1);

async function buildPdf(input: BulletinPdfInput): Promise<Uint8Array> {
  const { bulletin: b, periode, entreprise, lettre } = input;
  const d = b.details ?? {};
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const couleur = hex(entreprise.couleurEntete);

  const filigrane = (page: PDFPage) => {
    if (!entreprise.filigrane) return;
    const s = 60, txt = clean(entreprise.filigrane), w = bold.widthOfTextAtSize(txt, s);
    page.drawText(txt, { x: (W - w * 0.85) / 2, y: H / 2 - 40, size: s, font: bold, color: couleur, opacity: 0.06, rotate: { type: "degrees", angle: 30 } as any });
  };

  // ---------- Page lettre (optionnelle) ----------
  if (lettre) {
    const page = doc.addPage([W, H]);
    filigrane(page);
    page.drawText(clean(entreprise.nom), { x: M, y: H - 60, size: 15, font: bold, color: couleur });
    if (entreprise.adresse) page.drawText(clean(entreprise.adresse), { x: M, y: H - 74, size: 8.5, font, color: SOFT });
    const t = "COURRIER DE PAIE", tw = bold.widthOfTextAtSize(t, 12);
    page.drawText(t, { x: W - M - tw, y: H - 60, size: 12, font: bold, color: INK });
    const p = clean(libellePeriode(periode)), pw = font.widthOfTextAtSize(p, 9);
    page.drawText(p, { x: W - M - pw, y: H - 74, size: 9, font, color: SOFT });
    page.drawLine({ start: { x: M, y: H - 84 }, end: { x: W - M, y: H - 84 }, thickness: 2, color: couleur });
    let y = H - 120;
    for (const l of wrap(font, lettre, 11, W - 2 * M)) { if (l) page.drawText(l, { x: M, y, size: 11, font, color: INK }); y -= 17; }
  }

  // ---------- Page bulletin ----------
  const page = doc.addPage([W, H]);
  filigrane(page);
  let y = H - M; // bord supérieur courant (on descend)

  // Cellule bordée avec texte (align: l|c|r), fond optionnel, texte optionnellement en 2 lignes (label + valeur).
  const cell = (x: number, w: number, h: number, txt: string, o: { size?: number; f?: PDFFont; align?: "l" | "c" | "r"; fill?: ReturnType<typeof rgb>; color?: ReturnType<typeof rgb>; label?: string; valueSize?: number } = {}) => {
    if (o.fill) page.drawRectangle({ x, y: y - h, width: w, height: h, color: o.fill });
    page.drawRectangle({ x, y: y - h, width: w, height: h, borderColor: BORDER, borderWidth: 0.6 });
    const f = o.f ?? font, size = o.size ?? 8.5, color = o.color ?? INK;
    const draw = (s: string, ty: number, fs: number, ff: PDFFont) => {
      const c = clean(s); const tw = ff.widthOfTextAtSize(c, fs);
      const tx = o.align === "r" ? x + w - 3 - tw : o.align === "c" ? x + (w - tw) / 2 : x + 3;
      page.drawText(c, { x: tx, y: ty, size: fs, font: ff, color });
    };
    if (o.label !== undefined) { draw(o.label, y - 8, 7, font); draw(txt, y - h + 4, o.valueSize ?? 9, bold); }
    else draw(txt, y - h + (h - size) / 2 + 1, size, f);
  };
  const row = (h: number) => { y -= h; };
  const IW = W - 2 * M; // 523

  // En-tête période / paiement
  cell(M, 120, 16, "BULLETIN DE PAIE", { f: bold, size: 9, fill: couleur, color: WHITE });
  cell(M + 120, 220, 16, `Période du ${b.periodeDu ?? ""} au ${b.periodeAu ?? ""}`, { f: bold, size: 8.5, fill: couleur, color: WHITE, align: "c" });
  cell(M + 340, IW - 340, 16, `Paiement le ${b.datePaiement ?? ""} par banque`, { f: bold, size: 8.5, fill: couleur, color: WHITE, align: "c" });
  row(16);

  // Bloc employeur (gauche) + grille identité (droite)
  const EW = 160, GX = M + EW, GW = IW - EW;
  const top = y;
  const GH = 22, EH = 3 * GH + 16; // 3 lignes d'identité + bandeau nom
  page.drawRectangle({ x: M, y: y - EH, width: EW, height: EH, borderColor: BORDER, borderWidth: 0.6 });
  page.drawText(clean(entreprise.nom), { x: M + 4, y: y - 12, size: 9.5, font: bold, color: couleur });
  const adr = wrap(font, entreprise.adresse ?? "", 7, EW - 8);
  let ey = y - 22; for (const l of adr.slice(0, 2)) { page.drawText(l, { x: M + 4, y: ey, size: 7, font, color: INK }); ey -= 9; }
  page.drawText(clean(`NIU : ${entreprise.niu || "-"}`), { x: M + 4, y: ey, size: 7, font, color: INK }); ey -= 9;
  page.drawText(clean(`N°CNPS : ${entreprise.numeroCnps || "-"}`), { x: M + 4, y: ey, size: 7, font, color: INK });

  const g4 = GW / 5;
  cell(GX, g4, GH, b.matricule || "-", { label: "Matricule", align: "c" });
  cell(GX + g4, g4, GH, b.categorie || "-", { label: "Catégorie", align: "c" });
  cell(GX + 2 * g4, g4, GH, b.echelon || "-", { label: "Échelon", align: "c" });
  cell(GX + 3 * g4, 2 * g4, GH, b.cnps || "-", { label: "Numéro CNPS", align: "c" });
  row(GH);
  cell(GX, g4, GH, "Employé", { label: "Statut", align: "c" });
  cell(GX + g4, 2 * g4, GH, b.fonction || "-", { label: "Emploi occupé", align: "c" });
  cell(GX + 3 * g4, 2 * g4, GH, b.departement || "-", { label: "Département", align: "c" });
  row(GH);
  const emb = b.dateDebut ? b.dateDebut.split("-").reverse().join("/") : "-";
  cell(GX, 2 * g4, GH, emb, { label: "Date d'embauche", align: "c" });
  cell(GX + 2 * g4, g4, GH, "40", { label: "Horaire", align: "c" });
  cell(GX + 3 * g4, 2 * g4, GH, b.adresse || "-", { label: "Adresse", align: "c", valueSize: 7.5 });
  row(GH);
  cell(GX, GW, 16, b.nom, { f: bold, size: 11, fill: rgb(0.008, 0.52, 0.78), color: WHITE, align: "c" });
  row(16);
  y = top - EH; row(3);

  // Jours & congés
  const c6 = IW / 6;
  const infos: [string, string][] = [
    ["Nombre de jours travaillés", String(d.joursTravailles ?? "-")], ["Congés acquis", String(d.congesAcquis ?? "-")], ["Congés pris", String(d.congesPris ?? "-")],
    ["Reste à prendre", String(d.congesRestants ?? "-")], ["Indemnité de congés", f0(d.indemniteConges)], ["Salaire journalier", f0(d.salaireJournalier)],
  ];
  infos.forEach(([l, val], i) => cell(M + i * c6, c6, 20, val, { label: l, align: "c", valueSize: 10 }));
  row(20); row(3);

  // Lignes : N° | Désignation | Base | Taux | Gain | Retenue | Charg. patron.
  const cols = [34, 175, 72, 42, 68, 68, 64]; const xs: number[] = []; let cx = M; for (const w of cols) { xs.push(cx); cx += w; }
  const heads = ["N°", "Désignation", "Base", "Taux", "Gain", "Retenue", "Charg. patron."];
  heads.forEach((h, i) => cell(xs[i], cols[i], 13, h, { f: bold, size: 7, fill: rgb(0.95, 0.96, 0.98), align: i === 0 ? "c" : i === 1 ? "l" : "r" }));
  row(13);
  const RH = 11.5;
  const line = (code: string, lib: string, base: string, taux: string, gain: string, ret: string, pat: string, strong = false) => {
    const f = strong ? bold : font;
    cell(xs[0], cols[0], RH, code, { size: 7, align: "c", f }); cell(xs[1], cols[1], RH, lib, { size: 7.5, f });
    cell(xs[2], cols[2], RH, base, { size: 7.5, align: "r", f }); cell(xs[3], cols[3], RH, taux, { size: 7.5, align: "r", f });
    cell(xs[4], cols[4], RH, gain, { size: 7.5, align: "r", f }); cell(xs[5], cols[5], RH, ret, { size: 7.5, align: "r", f }); cell(xs[6], cols[6], RH, pat, { size: 7.5, align: "r", f });
    row(RH);
  };
  for (const g of b.lignesGain) line(g.code, g.libelle, g.base ? fmt(g.base) : "", "", f0(g.gain), "", "");
  line("", "TOTAL BRUT", fmt(b.brut), "", fmt(b.brut), "", "", true);
  let patronal = 0;
  for (const c of b.cotisations) {
    patronal += c.chargePatronale;
    line(c.code, c.libelle, c.base ? fmt(c.base) : "", pctTxt(c.taux), "", c.retenue ? fmt(c.retenue) : c.chargePatronale ? "" : "-", c.chargePatronale ? fmt(c.chargePatronale) : "");
  }
  line("", "TOTAL COTISATIONS & RETENUES", "", "", "", fmt(b.totalRetenues), fmt(patronal), true);
  row(3);

  // Synthèse
  const c5 = IW / 5;
  cell(M, c5, 22, f0(b.brut), { label: "Salaire brut", align: "c", valueSize: 10 });
  cell(M + c5, c5, 22, f0(d.chargesSalariales), { label: "Charges salariales", align: "c", valueSize: 10 });
  cell(M + 2 * c5, c5, 22, f0(d.chargesPatronales ?? patronal), { label: "Charges patronales", align: "c", valueSize: 10 });
  cell(M + 3 * c5, c5, 22, f0(d.heuresSup), { label: "Heures sup.", align: "c", valueSize: 10 });
  page.drawRectangle({ x: M + 4 * c5, y: y - 22, width: c5, height: 22, color: rgb(0.08, 0.5, 0.24) });
  page.drawRectangle({ x: M + 4 * c5, y: y - 22, width: c5, height: 22, borderColor: BORDER, borderWidth: 0.6 });
  { const t1 = "NET A PAYER", w1 = font.widthOfTextAtSize(t1, 7); page.drawText(t1, { x: M + 4 * c5 + (c5 - w1) / 2, y: y - 8, size: 7, font, color: WHITE });
    const t2 = f0(b.net), w2 = bold.widthOfTextAtSize(t2, 11); page.drawText(t2, { x: M + 4 * c5 + (c5 - w2) / 2, y: y - 19, size: 11, font: bold, color: WHITE }); }
  row(22);
  cell(M, c5, 14, `Période : du ${b.periodeDu ?? ""} au ${b.periodeAu ?? ""}`, { size: 6.5, align: "c", fill: rgb(0.86, 0.99, 0.91) });
  cell(M + c5, 3 * c5, 14, `Payé par : SALAIRE ${b.societe}`, { size: 8, align: "c", f: bold });
  cell(M + 4 * c5, c5, 14, "Signature employé", { size: 7, align: "c" });
  row(14); row(6);

  // Visa RH & validation
  const BW = (IW - 8) / 2, BH = 62;
  page.drawRectangle({ x: M, y: y - BH, width: BW, height: BH, borderColor: BORDER, borderWidth: 0.6 });
  page.drawRectangle({ x: M + BW + 8, y: y - BH, width: BW, height: BH, borderColor: BORDER, borderWidth: 0.6 });
  page.drawText("VISA DU RESPONSABLE RH", { x: M + 5, y: y - 11, size: 7, font: bold, color: INK });
  page.drawText(clean(entreprise.responsableRH || "-"), { x: M + 5, y: y - 23, size: 8, font, color: INK });
  if (b.valide && entreprise.responsableRH) page.drawText(clean(entreprise.responsableRH), { x: M + 5, y: y - 42, size: 12, font: await doc.embedFont(StandardFonts.TimesRomanBoldItalic), color: rgb(0.12, 0.25, 0.69) });
  page.drawText("Signature et cachet de l'employeur", { x: M + 5, y: y - BH + 5, size: 6.5, font, color: SOFT });
  const bx = M + BW + 8;
  page.drawText("VALIDATION DU BULLETIN", { x: bx + 5, y: y - 11, size: 7, font: bold, color: INK });
  const valideLe = b.valideLe ? new Date(b.valideLe).toLocaleDateString("fr-FR") : "";
  page.drawText(clean(b.valide ? `BULLETIN VALIDÉ le ${valideLe}` : "BULLETIN NON VALIDÉ - document provisoire"), { x: bx + 5, y: y - 24, size: 8, font: bold, color: b.valide ? rgb(0.08, 0.5, 0.24) : rgb(0.7, 0.11, 0.11) });
  page.drawText(clean("Signature de l'employé (précédée de la mention \"reçu\")"), { x: bx + 5, y: y - BH + 5, size: 6.5, font, color: SOFT });
  row(BH); row(8);
  const foot = "Pour vous aider à faire valoir vos droits, conservez ce bulletin de paie sans limitation de durée.";
  const fw = bold.widthOfTextAtSize(clean(foot), 7); page.drawText(clean(foot), { x: (W - fw) / 2, y: y - 6, size: 7, font: bold, color: INK });

  return await doc.save();
}

const nomFichier = (entreprise: string, nom: string, periode: string) => `${nomFichierPdf(entreprise, nom, libellePeriode(periode))}.pdf`;

type ResultatEnvoi = { mode: "reel" | "simulation"; total: number; envoyes: number; simules: number; echecs: number; pdfOctets: number };

// Envoi du courrier de paie : e-mail HTML + PDF (lettre + bulletin) en pièce jointe, via Resend ou simulation.
export const envoyerCourrier = action({
  args: { periode: v.string(), employeIds: v.optional(v.array(v.id("employes"))) },
  handler: async (ctx, args): Promise<ResultatEnvoi> => {
    const key = process.env.RESEND_API_KEY;
    const reglages: { envoiReelActive: boolean } = await ctx.runQuery(internal.parametres.reglagesInternes, {});
    const modeEnvoi: "reel" | "simulation" = key && reglages.envoiReelActive ? "reel" : "simulation";
    const lots: any[] = await ctx.runQuery(internal.courrier.payloads, args);
    let envoyes = 0, echecs = 0, simules = 0, pdfOctets = 0;

    for (const p of lots) {
      const base = { employeId: p.employeId as Id<"employes">, periode: args.periode, email: p.email as string };
      if (!p.email) {
        echecs++;
        await ctx.runMutation(internal.courrier.enregistrerEnvoi, { ...base, statut: "echec", mode: modeEnvoi, erreur: "Adresse e-mail manquante" });
        continue;
      }
      try {
        const pdf = await buildPdf({ bulletin: p.bulletin, periode: args.periode, entreprise: p.entreprise, lettre: p.lettre });
        pdfOctets += pdf.byteLength;
        if (key && modeEnvoi === "reel") {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: p.from, to: [p.email], subject: p.sujet, html: p.html,
              attachments: [{ filename: nomFichier(p.entreprise?.nom ?? "PAIE", p.nom, args.periode), content: Buffer.from(pdf).toString("base64") }],
            }),
          });
          if (!res.ok) throw new Error(`Resend ${res.status} : ${(await res.text()).slice(0, 300)}`);
          const json = (await res.json()) as { id?: string };
          await ctx.runMutation(internal.courrier.enregistrerEnvoi, { ...base, statut: "envoye", mode: "reel", messageId: json.id });
          envoyes++;
        } else {
          await ctx.runMutation(internal.courrier.enregistrerEnvoi, { ...base, statut: "simule", mode: "simulation" });
          simules++;
        }
      } catch (e) {
        echecs++;
        await ctx.runMutation(internal.courrier.enregistrerEnvoi, { ...base, statut: "echec", mode: modeEnvoi, erreur: (e as Error).message });
      }
    }
    return { mode: modeEnvoi, total: lots.length, envoyes, simules, echecs, pdfOctets };
  },
});

// Aperçu PDF d'un bulletin (mois ouvert ou clôturé) : généré à la demande, stocké, URL renvoyée.
export const apercuPdf = action({
  args: { periode: v.string(), employeId: v.id("employes") },
  handler: async (ctx, { periode, employeId }): Promise<{ url: string | null; nomFichier: string; octets: number }> => {
    const lots: any[] = await ctx.runQuery(internal.courrier.payloads, { periode, employeIds: [employeId] });
    if (!lots.length) throw new Error("Bulletin introuvable pour cette période.");
    const p = lots[0];
    const pdf = await buildPdf({ bulletin: p.bulletin, periode, entreprise: p.entreprise });
    const pdfId = await ctx.storage.store(new Blob([new Uint8Array(pdf)], { type: "application/pdf" }));
    const url = await ctx.storage.getUrl(pdfId);
    return { url, nomFichier: nomFichier(p.entreprise?.nom ?? "PAIE", p.nom, periode), octets: pdf.byteLength };
  },
});

type ResultatArchive = { periode: string; generes: number; dejaPresents: number; octets: number };

// Génère et stocke le PDF de chaque bulletin figé d'un mois clôturé (idempotent : ignore ceux déjà archivés).
// Corps partagé : appelé par l'action publique (niveau 4) et par la version interne planifiée à la clôture.
async function archiver(ctx: any, periode: string): Promise<ResultatArchive> {
  const lots: any[] = await ctx.runQuery(internal.archives.snapshotsPourPdf, { periode });
  let generes = 0, dejaPresents = 0, octets = 0;
  for (const s of lots) {
    if (s.pdfId) { dejaPresents++; continue; }
    const pdf = await buildPdf({ bulletin: s.bulletin, periode, entreprise: s.entreprise });
    const pdfId = await ctx.storage.store(new Blob([new Uint8Array(pdf)], { type: "application/pdf" }));
    await ctx.runMutation(internal.archives.enregistrerPdf, { bulletinId: s.bulletinId as Id<"bulletins">, pdfId });
    generes++; octets += pdf.byteLength;
  }
  return { periode, generes, dejaPresents, octets };
}

export const archiverPdfs = action({
  args: { periode: v.string() },
  handler: async (ctx, { periode }): Promise<ResultatArchive> => {
    await ctx.runQuery(internal.users.verifierNiveau, { min: 4 });
    return await archiver(ctx, periode);
  },
});

// Planifiée par `payroll.cloturer` quand le réglage « PDF à la clôture » est actif (pas d'identité : interne).
export const archiverPdfsPlanifie = internalAction({
  args: { periode: v.string() },
  handler: async (ctx, { periode }): Promise<ResultatArchive> => archiver(ctx, periode),
});
