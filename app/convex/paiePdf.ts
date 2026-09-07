"use node";
// Actions Node : génération des PDF de bulletins (pdf-lib), envoi du courrier de paie avec pièce jointe,
// archivage des PDF des mois clôturés dans le stockage Convex.
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";

const MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const libellePeriode = (p: string) => `${MOIS[(+p.slice(5, 7) || 1) - 1]} ${p.slice(0, 4)}`;
// Les polices standard PDF n'encodent que Latin-1 : on remplace le reste (—, …, espaces fines…).
const clean = (s: string) => (s ?? "").normalize("NFC").replace(/[–—]/g, "-").replace(/…/g, "...").replace(/[   ]/g, " ").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
const fmt = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const hex = (h?: string) => { const m = /^#?([0-9a-f]{6})$/i.exec(h ?? ""); const n = parseInt(m ? m[1] : "0f2a44", 16); return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); };

interface BulletinPdfInput {
  bulletin: {
    nom: string; matricule: string; fonction?: string; cnps?: string; niu?: string; societe: string;
    brut: number; totalRetenues: number; net: number;
    lignesGain: { code: string; libelle: string; base: number; gain: number }[];
    cotisations: { code: string; libelle: string; base: number; taux: number; retenue: number; chargePatronale: number }[];
  };
  periode: string;
  entreprise: { nom: string; adresse?: string; couleurEntete?: string; filigrane?: string };
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

async function buildPdf(input: BulletinPdfInput): Promise<Uint8Array> {
  const { bulletin: b, periode, entreprise, lettre } = input;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const couleur = hex(entreprise.couleurEntete);
  const ink = rgb(0.086, 0.133, 0.18), soft = rgb(0.28, 0.35, 0.42), lineCol = rgb(0.84, 0.87, 0.83);
  const W = 595.28, H = 841.89, M = 42;

  const entete = (page: PDFPage, titre: string) => {
    page.drawText(clean(entreprise.nom), { x: M, y: H - 60, size: 15, font: bold, color: couleur });
    if (entreprise.adresse) page.drawText(clean(entreprise.adresse), { x: M, y: H - 74, size: 8.5, font, color: soft });
    const tw = bold.widthOfTextAtSize(clean(titre), 12);
    page.drawText(clean(titre), { x: W - M - tw, y: H - 60, size: 12, font: bold, color: ink });
    const pw = font.widthOfTextAtSize(clean(libellePeriode(periode)), 9);
    page.drawText(clean(libellePeriode(periode)), { x: W - M - pw, y: H - 74, size: 9, font, color: soft });
    page.drawLine({ start: { x: M, y: H - 84 }, end: { x: W - M, y: H - 84 }, thickness: 2, color: couleur });
    if (entreprise.filigrane) {
      const s = 54, txt = clean(entreprise.filigrane), w = bold.widthOfTextAtSize(txt, s);
      page.drawText(txt, { x: (W - w * 0.9) / 2, y: H / 2 - 60, size: s, font: bold, color: rgb(0.06, 0.16, 0.27), opacity: 0.06, rotate: { type: "degrees", angle: 24 } as any });
    }
  };

  if (lettre) {
    const page = doc.addPage([W, H]);
    entete(page, "COURRIER DE PAIE");
    let y = H - 120;
    for (const l of wrap(font, lettre, 11, W - 2 * M)) {
      if (l) page.drawText(l, { x: M, y, size: 11, font, color: ink });
      y -= 17;
    }
  }

  const page = doc.addPage([W, H]);
  entete(page, "BULLETIN DE PAIE");
  let y = H - 108;
  const t = (s: string, x: number, size = 9, f = font, color = ink) => page.drawText(clean(s), { x, y, size, font: f, color });
  const r = (s: string, xRight: number, size = 9, f = font, color = ink) => { const w = f.widthOfTextAtSize(clean(s), size); page.drawText(clean(s), { x: xRight - w, y, size, font: f, color }); };

  t(b.nom, M, 12, bold); r(`Matricule : ${b.matricule}`, W - M);
  y -= 14; t(`Fonction : ${b.fonction ?? "-"}`, M, 9, font, soft); r(`Société : ${b.societe}`, W - M, 9, font, soft);
  y -= 13; t(`N° CNPS : ${b.cnps ?? "-"}`, M, 9, font, soft); r(`NIU : ${b.niu ?? "-"}`, W - M, 9, font, soft);
  y -= 22;

  const bande = (labels: [string, number, boolean][]) => {
    page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: 15, color: rgb(0.93, 0.95, 0.92) });
    for (const [lab, x, droite] of labels) droite ? r(lab, x, 7.5, bold, soft) : t(lab, x, 7.5, bold, soft);
    y -= 17;
  };
  const ligne = () => { page.drawLine({ start: { x: M, y: y - 4 }, end: { x: W - M, y: y - 4 }, thickness: 0.5, color: lineCol }); y -= 14; };

  // Gains
  bande([["N°", M + 4, false], ["GAINS", M + 60, false], ["BASE", 400, true], ["MONTANT", W - M - 4, true]]);
  for (const g of b.lignesGain) { t(g.code, M + 4); t(g.libelle, M + 60); if (g.base) r(fmt(g.base), 400); r(fmt(g.gain), W - M - 4); ligne(); }
  t("Total brut", M + 60, 9, bold); r(fmt(b.brut), W - M - 4, 9, bold); ligne();
  y -= 8;

  // Cotisations et retenues
  bande([["N°", M + 4, false], ["COTISATIONS / RETENUES", M + 60, false], ["BASE", 330, true], ["TAUX", 375, true], ["RETENUE", 445, true], ["CH. PATRON.", W - M - 4, true]]);
  let patronal = 0;
  for (const c of b.cotisations) {
    t(c.code, M + 4); t(c.libelle, M + 60); r(fmt(c.base), 330); if (c.taux) r(`${c.taux}%`, 375);
    if (c.retenue) r(fmt(c.retenue), 445); if (c.chargePatronale) { r(fmt(c.chargePatronale), W - M - 4); patronal += c.chargePatronale; }
    ligne();
  }
  t("Total retenues", M + 60, 9, bold); r(fmt(b.totalRetenues), 445, 9, bold); r(fmt(patronal), W - M - 4, 9, bold); ligne();
  y -= 14;

  // Net à payer
  page.drawRectangle({ x: M, y: y - 8, width: W - 2 * M, height: 30, color: couleur });
  page.drawText("NET À PAYER", { x: M + 12, y: y + 2, size: 12, font: bold, color: rgb(1, 1, 1) });
  const netTxt = clean(`${fmt(b.net)} FCFA`), nw = bold.widthOfTextAtSize(netTxt, 13);
  page.drawText(netTxt, { x: W - M - 12 - nw, y: y + 2, size: 13, font: bold, color: rgb(1, 1, 1) });
  y -= 44;
  t("Conservez ce bulletin sans limitation de durée.", M, 8, font, soft);

  return await doc.save();
}

const nomFichier = (periode: string, nom: string) => `bulletin-${periode}-${clean(nom).replace(/[^A-Za-z0-9]+/g, "_")}.pdf`;

type ResultatEnvoi = { mode: "reel" | "simulation"; total: number; envoyes: number; simules: number; echecs: number; pdfOctets: number };

// Envoi du courrier de paie : e-mail HTML + PDF (lettre + bulletin) en pièce jointe, via Resend ou simulation.
export const envoyerCourrier = action({
  args: { periode: v.string(), employeIds: v.optional(v.array(v.id("employes"))) },
  handler: async (ctx, args): Promise<ResultatEnvoi> => {
    const key = process.env.RESEND_API_KEY;
    const modeEnvoi: "reel" | "simulation" = key ? "reel" : "simulation";
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
        if (key) {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: p.from, to: [p.email], subject: p.sujet, html: p.html,
              attachments: [{ filename: nomFichier(args.periode, p.nom), content: Buffer.from(pdf).toString("base64") }],
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

type ResultatArchive = { periode: string; generes: number; dejaPresents: number; octets: number };

// Génère et stocke le PDF de chaque bulletin figé d'un mois clôturé (idempotent : ignore ceux déjà archivés).
export const archiverPdfs = action({
  args: { periode: v.string() },
  handler: async (ctx, { periode }): Promise<ResultatArchive> => {
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
  },
});
