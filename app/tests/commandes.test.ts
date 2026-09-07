// `npm run test:commandes` — totaux, comparaison entre commandes successives, CSV.
import { totalCommande, comparer, parseCsvLignes, exportCsvLignes, reference } from "../convex/lib/commandes.ts";

let echecs = 0;
const check = (nom: string, cond: boolean, detail?: unknown) => { if (cond) console.log(`  ok  ${nom}`); else { console.error(`  KO  ${nom}`, detail ?? ""); echecs++; } };

const avant = [
  { produit: "Doliprane", dci: "Paracetamol", quantite: 5, prixUnitaire: 1000 },
  { produit: "Voltarene", dci: "Diclofenac", quantite: 3, prixUnitaire: 6300 },
  { produit: "Amoxicilline", dci: "Amoxicilline", quantite: 10, prixUnitaire: 2500 },
];
const apres = [
  { produit: "doliprane ", dci: "Paracetamol", quantite: 8, prixUnitaire: 1000 },   // quantité modifiée (clé insensible casse/espaces)
  { produit: "Voltarene", dci: "Diclofenac", quantite: 3, prixUnitaire: 6300 },     // inchangé
  { produit: "Omeprazole", dci: "Omeprazole", quantite: 10, prixUnitaire: 2000 },   // ajouté
];

check("total avant = 5000+18900+25000", totalCommande(avant) === 48900, totalCommande(avant));
const c = comparer(avant, apres);
check("1 ajouté (Omeprazole)", c.ajoutes.length === 1 && c.ajoutes[0].produit === "Omeprazole");
check("1 retiré (Amoxicilline)", c.retires.length === 1 && c.retires[0].produit === "Amoxicilline");
check("1 modifié (Doliprane 5→8)", c.modifies.length === 1 && c.modifies[0].avant.quantite === 5 && c.modifies[0].apres.quantite === 8);
check("1 inchangé", c.inchanges === 1);
check("variation = 46900 − 48900 = −2000", c.totalApres === 46900 && c.variation === -2000, c);
check("variation % = −4.1", c.variationPct === -4.1, c.variationPct);

const csv = "Nom du produit;DCI;Quantité;Prix unitaire\nDoliprane;Paracetamol;5;1 000\n\"Sérum, physio\";;12;850,50\n";
const p = parseCsvLignes(csv);
check("CSV : 2 lignes, en-tête ignoré", p.length === 2);
check("CSV : nombres FR (1 000 ; 850,50)", p[0].prixUnitaire === 1000 && p[1].prixUnitaire === 850.5, p);
check("CSV : guillemets et DCI vide", p[1].produit === "Sérum, physio" && p[1].dci === undefined);
const sansEntete = parseCsvLignes("Gants;;100;50\nMasques;;200;25");
check("CSV sans en-tête", sansEntete.length === 2 && sansEntete[1].quantite === 200);
const exp = exportCsvLignes(avant);
check("export : en-tête + 3 lignes + total ligne", exp.split("\n").length === 4 && exp.includes("Doliprane;Paracetamol;5;1000;5000"));
check("référence CMD-2026-007", reference("CMD", 2026, 7) === "CMD-2026-007");

if (echecs) { console.error(`\n${echecs} test(s) en échec`); process.exit(1); } else console.log("\nTous les tests passent.");
