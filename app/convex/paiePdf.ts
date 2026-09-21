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
const INK = rgb(0.06, 0.09, 0.16), SOFT = rgb(0.2, 0.25, 0.33), WHITE = rgb(1, 1, 1);
// Charte des documents (documents.css) : sceau #0077b6, nuit #03045e, bande #eaf3f8, filet #8a968d, carmin #9e2b20.
const SCEAU = rgb(0, 0.467, 0.714), SCEAU_CLAIR = rgb(0.792, 0.941, 0.973), NUIT = rgb(0.012, 0.016, 0.369), BANDE = rgb(0.918, 0.953, 0.973);
const DOCFILET = rgb(0.541, 0.588, 0.553), GRIS = rgb(0.357, 0.408, 0.376), ZERO = rgb(0.604, 0.647, 0.694), APPUYE = rgb(0.957, 0.969, 0.949);
const CARMIN = rgb(0.62, 0.169, 0.125), CARMIN_CLAIR = rgb(0.996, 0.886, 0.886);

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

  // ---------- Page bulletin (refonte validée le 21/09/2026 : même feuille que BulletinCard.tsx) ----------
  const mono = await doc.embedFont(StandardFonts.Courier);
  const monoBold = await doc.embedFont(StandardFonts.CourierBold);
  const page = doc.addPage([W, H]);
  // Filigrane : PROVISOIRE tant que le mois est ouvert ; sinon celui de l'entreprise s'il existe.
  if (!b.valide) {
    const s = 56, txt = "PROVISOIRE", w = bold.widthOfTextAtSize(txt, s);
    page.drawText(txt, { x: (W - w * 0.9) / 2, y: H / 2 - 60, size: s, font: bold, color: CARMIN, opacity: 0.07, rotate: { type: "degrees", angle: 24 } as any });
  } else filigrane(page);

  const IW = W - 2 * M;
  let y = H - M; // bord supérieur courant (on descend)
  const row = (h: number) => { y -= h; };
  const txt = (s: string, x: number, ty: number, size: number, f: PDFFont, color = INK, align: "l" | "c" | "r" = "l", w = 0) => {
    const c = clean(s); const tw = f.widthOfTextAtSize(c, size);
    page.drawText(c, { x: align === "r" ? x + w - tw : align === "c" ? x + (w - tw) / 2 : x, y: ty, size, font: f, color });
  };
  const box = (x: number, top: number, w: number, h: number, fill?: ReturnType<typeof rgb>) => {
    if (fill) page.drawRectangle({ x, y: top - h, width: w, height: h, color: fill });
    page.drawRectangle({ x, y: top - h, width: w, height: h, borderColor: DOCFILET, borderWidth: 0.5 });
  };
  // Case « intitulé en capitales fines + valeur » (identité, temps, synthèse).
  const caseKV = (x: number, w: number, h: number, cle: string, val: string, o: { align?: "l" | "c"; f?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; fill?: ReturnType<typeof rgb>; cleColor?: ReturnType<typeof rgb> } = {}) => {
    box(x, y, w, h, o.fill);
    const pad = 5, al = o.align ?? "l";
    txt(cle.toUpperCase(), x + pad, y - 9, 6.5, font, o.cleColor ?? GRIS, al, w - 2 * pad);
    txt(val, x + pad, y - h + 6, o.size ?? 8.5, o.f ?? bold, o.color ?? INK, al, w - 2 * pad);
  };

  // 1. En-tête de document : émetteur à gauche, acte à droite, filet épais sceau.
  txt(entreprise.nom, M, y - 13, 13, bold, SCEAU);
  const coord = [entreprise.adresse ?? "", `NIU ${entreprise.niu || "-"} · N° CNPS ${entreprise.numeroCnps || "-"}`];
  coord.forEach((l, i) => txt(l, M, y - 25 - i * 10, 8, font, GRIS));
  txt("BULLETIN DE PAIE", M, y - 13, 12, bold, INK, "r", IW);
  txt(`Période du ${b.periodeDu ?? ""} au ${b.periodeAu ?? ""}`, M, y - 25, 8.5, font, GRIS, "r", IW);
  txt(`Paiement le ${b.datePaiement ?? ""} par banque`, M, y - 36, 8.5, bold, INK, "r", IW);
  row(44);
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 2.5, color: SCEAU });
  row(8);

  // 2. Salarié : nom en bandeau, huit cases d'identité.
  page.drawRectangle({ x: M, y: y - 18, width: IW, height: 18, color: SCEAU });
  txt(b.nom, M + 6, y - 12.5, 11, bold, WHITE);
  txt(`${b.matricule} · ${b.societe}`, M, y - 12.5, 8.5, monoBold, WHITE, "r", IW - 6);
  row(18);
  const c4 = IW / 4, IH = 24;
  const emb = b.dateDebut ? b.dateDebut.split("-").reverse().join("/") : "-";
  caseKV(M, c4, IH, "Emploi occupé", b.fonction || "-");
  caseKV(M + c4, c4, IH, "Département", b.departement || "-");
  caseKV(M + 2 * c4, c4, IH, "Catégorie · Échelon", `${b.categorie || "-"} · ${b.echelon || "-"}`);
  caseKV(M + 3 * c4, c4, IH, "N° CNPS salarié", b.cnps || "-");
  row(IH);
  caseKV(M, c4, IH, "Date d'embauche", emb);
  caseKV(M + c4, c4, IH, "Statut · Horaire", "Employé · 40 h");
  caseKV(M + 2 * c4, c4, IH, "Payé par", `SALAIRE ${b.societe}`);
  caseKV(M + 3 * c4, c4, IH, "Adresse", b.adresse || "-", { size: 7.5 });
  row(IH); row(7);

  // 3. Temps et congés.
  const c6 = IW / 6, TH = 26;
  const j = (n?: number) => (n === undefined || n === null ? "-" : `${String(n).replace(".", ",")} j`);
  const joursBase = d.joursBase ?? 30;
  const temps: [string, string, ReturnType<typeof rgb>?][] = [
    ["Jours travaillés", `${d.joursTravailles ?? "-"} / ${joursBase}`], ["Salaire journalier", d.salaireJournalier ? fmt(d.salaireJournalier) : "-"],
    ["Congés acquis", j(d.congesAcquis)], ["Congés pris", j(d.congesPris)], ["Reste à prendre", j(d.congesRestants), SCEAU],
    ["Indemnité de congés", d.indemniteConges ? fmt(d.indemniteConges) : "0", d.indemniteConges ? undefined : ZERO],
  ];
  temps.forEach(([cle, val, color], i) => caseKV(M + i * c6, c6, TH, cle, val, { align: "c", f: monoBold, size: 10.5, color }));
  row(TH); row(7);

  // 4. Rubriques : liste codée fixe, intercalaires, montants nuls estompés.
  const cols = [34, 171, 66, 40, 66, 66, 80]; const xs: number[] = []; let cx = M; for (const w of cols) { xs.push(cx); cx += w; }
  const heads = ["N°", "Désignation", "Base (FCFA)", "Taux", "Gain", "Retenue", "Charge patronale"];
  heads.forEach((h, i) => { box(xs[i], y, cols[i], 13, BANDE); txt(h, xs[i] + 4, y - 9, 7, bold, INK, i === 0 ? "c" : i === 1 ? "l" : "r", cols[i] - 8); });
  row(13);
  const groupe = (t: string) => { box(M, y, IW, 10, BANDE); txt(t.toUpperCase(), M + 4, y - 7.5, 6.5, bold, SOFT); row(10); };
  const RH = 12;
  const montant = (v: number | undefined | null, i: number, f: PDFFont) => {
    if (v === undefined || v === null) return;
    txt(v === 0 ? "-" : fmt(v), xs[i] + 4, y - 8.5, 8, f, v === 0 ? ZERO : INK, "r", cols[i] - 8);
  };
  const ligne = (code: string, lib: string, base: number | null, taux: string, gain: number | null, ret: number | null, pat: number | null, strong = false) => {
    cols.forEach((w, i) => box(xs[i], y, w, RH, strong ? APPUYE : undefined));
    const f = strong ? bold : font;
    txt(code, xs[0] + 4, y - 8.5, 7, mono, GRIS, "c", cols[0] - 8);
    txt(lib, xs[1] + 4, y - 8.5, 8, f, INK);
    montant(base, 2, strong ? monoBold : mono);
    txt(taux, xs[3] + 4, y - 8.5, 7.5, mono, INK, "r", cols[3] - 8);
    montant(gain, 4, strong ? monoBold : mono);
    montant(ret, 5, strong ? monoBold : mono);
    montant(pat, 6, strong ? monoBold : mono);
    row(RH);
  };
  const tauxDe = (c: { code: string; taux: number }) => (c.taux ? `${String(c.taux).replace(".", ",")} %` : ["44721", "44723", "44725"].includes(c.code) ? "barème" : "");
  groupe("Gains");
  for (const g of b.lignesGain) ligne(g.code, g.libelle, g.base || null, "", g.gain, null, null);
  ligne("", "TOTAL BRUT (Total 1)", b.brut, "", b.brut, null, null, true);
  const codees = b.cotisations.filter((c) => c.code && c.code !== "RETENUE" && c.code !== "MUT");
  const autres = b.cotisations.filter((c) => !c.code || c.code === "RETENUE" || c.code === "MUT");
  groupe("Cotisations et impôts");
  let patronal = 0, retenues = 0;
  for (const c of b.cotisations) { patronal += c.chargePatronale; retenues += c.retenue; }
  for (const c of codees) ligne(c.code, c.libelle, c.base || null, tauxDe(c), null, c.retenue, c.chargePatronale);
  if (autres.length) groupe("Autres retenues");
  for (const c of autres) ligne("", c.libelle, c.base || null, tauxDe(c), null, c.retenue, null);
  ligne("", "TOTAL COTISATIONS ET RETENUES", null, "", null, retenues, patronal, true);
  row(7);

  // 5. Synthèse : quatre montants et le net à payer en bleu sceau.
  const SH = 36, cs = IW / 5.5, netW = IW - 4 * cs;
  caseKV(M, cs, SH, "Salaire brut (Total 1)", fmt(b.brut), { f: monoBold, size: 10.5 });
  caseKV(M + cs, cs, SH, "Charges salariales", fmt(d.chargesSalariales ?? retenues), { f: monoBold, size: 10.5 });
  caseKV(M + 2 * cs, cs, SH, "Charges patronales", fmt(d.chargesPatronales ?? patronal), { f: monoBold, size: 10.5 });
  caseKV(M + 3 * cs, cs, SH, "Heures sup.", d.heuresSup ? fmt(d.heuresSup) : "0", { f: monoBold, size: 10.5, color: d.heuresSup ? INK : ZERO });
  box(M + 4 * cs, y, netW, SH, SCEAU);
  txt("NET À PAYER (TOTAL 2)", M + 4 * cs + 5, y - 9, 6.5, font, SCEAU_CLAIR);
  txt(fmt(b.net), M + 4 * cs + 5, y - 24, 15, monoBold, WHITE);
  txt(`FCFA · payé par SALAIRE ${b.societe} le ${b.datePaiement ?? ""}`, M + 4 * cs + 5, y - SH + 5, 6, font, SCEAU_CLAIR);
  row(SH); row(7);

  // 6. Visa et reçu, puis la mention d'état.
  const BW = (IW - 8) / 2, BH = 58, bx = M + BW + 8;
  box(M, y, BW, BH); box(bx, y, BW, BH);
  txt("VISA DU RESPONSABLE RH", M + 6, y - 10, 7, bold, GRIS);
  txt(entreprise.responsableRH || "-", M + 6, y - 22, 8.5, font, INK);
  if (b.valide && entreprise.responsableRH) page.drawText(clean(entreprise.responsableRH), { x: M + 6, y: y - 40, size: 12, font: await doc.embedFont(StandardFonts.TimesRomanBoldItalic), color: NUIT });
  txt("Signature et cachet de l'employeur", M + 6, y - BH + 6, 7, font, GRIS);
  txt("REÇU PAR LE SALARIÉ", bx + 6, y - 10, 7, bold, GRIS);
  txt("Signature précédée de la mention \"reçu\"", bx + 6, y - 22, 7, font, GRIS);
  txt("Pour faire valoir vos droits, conservez ce bulletin sans limitation de durée.", bx + 6, y - BH + 6, 7, font, GRIS);
  row(BH); row(7);
  const valideLe = b.valideLe ? new Date(b.valideLe).toLocaleDateString("fr-FR") : "";
  const mention = b.valide ? `BULLETIN VALIDÉ le ${valideLe} - mois clôturé, document définitif` : "BULLETIN NON VALIDÉ - document provisoire, le mois est encore ouvert";
  page.drawRectangle({ x: M, y: y - 16, width: IW, height: 16, color: b.valide ? SCEAU_CLAIR : CARMIN_CLAIR, borderColor: b.valide ? SCEAU : CARMIN, borderWidth: 0.5 });
  txt(mention, M, y - 11, 8.5, bold, b.valide ? SCEAU : CARMIN, "c", IW);
  row(16); row(7);

  // 7. Pied : référence du barème, période, matricule, page.
  txt(`${entreprise.nom} · bulletin établi selon le barème CNPS / CGI applicable à la période`, M, y - 7, 6.5, bold, GRIS);
  txt(`${periode} · ${b.matricule} · page 1/1`, M, y - 7, 6.5, mono, GRIS, "r", IW);

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
