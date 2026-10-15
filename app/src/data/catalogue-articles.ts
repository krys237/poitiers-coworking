/**
 * Catalogue officiel des articles de la Polyclinique de Poitiers
 * Données réelles extraites de MAGASIN.xlsx, Médicament.docx et DOC OXY.xlsx.
 */

export interface ArticleCatalogue {
  designation: string;
  categorie: 'medicale' | 'reactifs_labo' | 'fourniture';
  classe?: string;
  prixUnitaire?: number;
}

export const CATALOGUE_ARTICLES: ArticleCatalogue[] = [
  {
    "designation": "Agrafeuse Métal Grande Capacité 24/6",
    "categorie": "fourniture",
    "classe": "Petit Matériel Bureau",
    "prixUnitaire": 4500
  },
  {
    "designation": "Bloc-notes A5 Spirale (Lot de 10)",
    "categorie": "fourniture",
    "classe": "Papeterie Bureau",
    "prixUnitaire": 5000
  },
  {
    "designation": "Boîte Agrafes 24/6 (Paquet de 1000)",
    "categorie": "fourniture",
    "classe": "Petit Matériel Bureau",
    "prixUnitaire": 600
  },
  {
    "designation": "Boîte Trombones Métalliques 33mm",
    "categorie": "fourniture",
    "classe": "Petit Matériel Bureau",
    "prixUnitaire": 800
  },
  {
    "designation": "Cahier Registre 300 pages Manuscrit",
    "categorie": "fourniture",
    "classe": "Registres Médicaux",
    "prixUnitaire": 3500
  },
  {
    "designation": "Cahier Registre Grand Format 500 pages Piqué",
    "categorie": "fourniture",
    "classe": "Registres Médicaux",
    "prixUnitaire": 5500
  },
  {
    "designation": "Cartouche Encre Canon PG-445 Noir",
    "categorie": "fourniture",
    "classe": "Consommables Impression",
    "prixUnitaire": 14500
  },
  {
    "designation": "Chemises Cartonnées Couleurs Assorties (Paquet de 100)",
    "categorie": "fourniture",
    "classe": "Classement & Archivage",
    "prixUnitaire": 6500
  },
  {
    "designation": "Classeurs à levier Dos 80mm A4 Plastifié",
    "categorie": "fourniture",
    "classe": "Classement & Archivage",
    "prixUnitaire": 1800
  },
  {
    "designation": "Désinfectant Surfaces & Sols Anios 5L",
    "categorie": "fourniture",
    "classe": "Hygiène & Entretien",
    "prixUnitaire": 22000
  },
  {
    "designation": "Eau de Javel Concentrée 12° Bidon 5L",
    "categorie": "fourniture",
    "classe": "Hygiène & Entretien",
    "prixUnitaire": 4500
  },
  {
    "designation": "Gel Hydroalcoolique 500ml avec Pompe",
    "categorie": "fourniture",
    "classe": "Hygiène & Entretien",
    "prixUnitaire": 2200
  },
  {
    "designation": "PAPIER ECHO",
    "categorie": "fourniture",
    "classe": "ACCESSOIRES",
    "prixUnitaire": 0
  },
  {
    "designation": "Papier Essuie-mains Rouleau Bobine Dévidage Central",
    "categorie": "fourniture",
    "classe": "Hygiène & Entretien",
    "prixUnitaire": 3200
  },
  {
    "designation": "Ramette Papier A4 80g Blanc (Unité)",
    "categorie": "fourniture",
    "classe": "Papeterie Bureau",
    "prixUnitaire": 3800
  },
  {
    "designation": "Ramette Papier A4 80g Double A (Carton 5 ramettes)",
    "categorie": "fourniture",
    "classe": "Papeterie Bureau",
    "prixUnitaire": 18500
  },
  {
    "designation": "Sacs Poubelle Déchets Médicaux Jaunes 50L (Rouleau 25)",
    "categorie": "fourniture",
    "classe": "Gestion Déchets DASRI",
    "prixUnitaire": 6500
  },
  {
    "designation": "Sacs Poubelle Noirs Renforcés 100L (Rouleau 20)",
    "categorie": "fourniture",
    "classe": "Gestion Déchets",
    "prixUnitaire": 4500
  },
  {
    "designation": "Savon Liquide Mains Antiseptique Bidon 5L",
    "categorie": "fourniture",
    "classe": "Hygiène & Entretien",
    "prixUnitaire": 8500
  },
  {
    "designation": "Sous-chemises Bulle A4 (Paquet de 250)",
    "categorie": "fourniture",
    "classe": "Classement & Archivage",
    "prixUnitaire": 8000
  },
  {
    "designation": "Stylos Bille Schneider Bleu (Boîte de 50)",
    "categorie": "fourniture",
    "classe": "Écriture",
    "prixUnitaire": 7500
  },
  {
    "designation": "Stylos Bille Schneider Noir (Boîte de 50)",
    "categorie": "fourniture",
    "classe": "Écriture",
    "prixUnitaire": 7500
  },
  {
    "designation": "Stylos Bille Schneider Rouge (Boîte de 50)",
    "categorie": "fourniture",
    "classe": "Écriture",
    "prixUnitaire": 7500
  },
  {
    "designation": "Toner Imprimante HP LaserJet 05A Noir",
    "categorie": "fourniture",
    "classe": "Consommables Impression",
    "prixUnitaire": 35000
  },
  {
    "designation": "Toner Imprimante HP LaserJet 85A Noir",
    "categorie": "fourniture",
    "classe": "Consommables Impression",
    "prixUnitaire": 28000
  },
  {
    "designation": "8GT",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "8GT (γGT)",
    "categorie": "medicale",
    "classe": "Enzyme hépatique",
    "prixUnitaire": 0
  },
  {
    "designation": "ABAISSE LANGUE",
    "categorie": "medicale",
    "classe": "Dispositif médical",
    "prixUnitaire": 0
  },
  {
    "designation": "ABX CLEANER",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "ABX DILUANT ( CLEANER)",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "ABX DILUANT / CLEANER / MINOCLAR",
    "categorie": "medicale",
    "classe": "Réactifs automate",
    "prixUnitaire": 0
  },
  {
    "designation": "ABX MINOCLAR",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "AC ANTI HBC",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "Ac anti-HBc",
    "categorie": "medicale",
    "classe": "Anticorps (hépatite B)",
    "prixUnitaire": 0
  },
  {
    "designation": "AC CCD",
    "categorie": "medicale",
    "classe": "Auto-anticorps (anti-CCP, polyarthrite rhumatoïde)",
    "prixUnitaire": 0
  },
  {
    "designation": "AC HBC",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "AC HBC / Ac anti-HBc",
    "categorie": "medicale",
    "classe": "Anticorps (hépatite B)",
    "prixUnitaire": 0
  },
  {
    "designation": "AC HCV",
    "categorie": "medicale",
    "classe": "Anticorps (hépatite C)",
    "prixUnitaire": 0
  },
  {
    "designation": "AC HCV (HEP C)",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "AC VHD",
    "categorie": "medicale",
    "classe": "Anticorps (hépatite D)",
    "prixUnitaire": 0
  },
  {
    "designation": "ACFOL 5MG (acide folique) COMP B/25",
    "categorie": "medicale",
    "classe": "ANTIANEMIQUES",
    "prixUnitaire": 1720
  },
  {
    "designation": "ACIDE FUSIDIQUE",
    "categorie": "medicale",
    "classe": "Antibiotique (stéroïdien)",
    "prixUnitaire": 0
  },
  {
    "designation": "ACIDE NALIDIQUE",
    "categorie": "medicale",
    "classe": "Quinolone (1ère génération)",
    "prixUnitaire": 0
  },
  {
    "designation": "ACIDE NALODIQUE",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "ACIDE URIQUE",
    "categorie": "medicale",
    "classe": "Paramètre biochimique",
    "prixUnitaire": 0
  },
  {
    "designation": "ACTIVATEUR",
    "categorie": "medicale",
    "classe": "Réactif de laboratoire (activateur de coagulation ou enzymatique)",
    "prixUnitaire": 0
  },
  {
    "designation": "ACTRAPID INJ",
    "categorie": "medicale",
    "classe": "INSULINE",
    "prixUnitaire": 0
  },
  {
    "designation": "ACUPAN 20MG/2ML INJ IM/IV A/2ML",
    "categorie": "medicale",
    "classe": "ANTALGIQUES",
    "prixUnitaire": 243
  },
  {
    "designation": "ADRENALINE INJ AMP/1ML",
    "categorie": "medicale",
    "classe": "CARDIOTONIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "AgHBe",
    "categorie": "medicale",
    "classe": "Antigène (hépatite B)",
    "prixUnitaire": 0
  },
  {
    "designation": "AgHBs",
    "categorie": "medicale",
    "classe": "Marqueur sérologique (antigène hépatite B)",
    "prixUnitaire": 0
  },
  {
    "designation": "AgHBs / HEP B",
    "categorie": "medicale",
    "classe": "Antigène (hépatite B)",
    "prixUnitaire": 0
  },
  {
    "designation": "AgHP TEST",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "AgHP TEST / HP TEST",
    "categorie": "medicale",
    "classe": "Test diagnostic (Helicobacter pylori)",
    "prixUnitaire": 0
  },
  {
    "designation": "AIGUILLE A PONCTION LOMBAIRE 20",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "AIGUILLE A PONCTION LOMBAIRE 22",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "AIGUILLE A PONCTION LOMBAIRE 25",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "AIGUILLE DE PRELEVEMENT",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "AIGUILLE DE PRÉLÈVEMENT",
    "categorie": "medicale",
    "classe": "Dispositif médical",
    "prixUnitaire": 0
  },
  {
    "designation": "ALAT",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "ALAT (GPT)",
    "categorie": "medicale",
    "classe": "Enzyme hépatique (transaminase)",
    "prixUnitaire": 0
  },
  {
    "designation": "ALBUMINE",
    "categorie": "medicale",
    "classe": "Protéine plasmatique / test biologique",
    "prixUnitaire": 0
  },
  {
    "designation": "ALCOOL",
    "categorie": "medicale",
    "classe": "Antiseptique / désinfectant",
    "prixUnitaire": 0
  },
  {
    "designation": "ALLERGIFLASH COLLYRE",
    "categorie": "medicale",
    "classe": "ANTIHISTAMINIQUES",
    "prixUnitaire": 10
  },
  {
    "designation": "ALPHA-FP",
    "categorie": "medicale",
    "classe": "Marqueur tumoral (alpha-foetoprotéine)",
    "prixUnitaire": 0
  },
  {
    "designation": "AMIKACIN",
    "categorie": "medicale",
    "classe": "Aminoside (aminoglycoside)",
    "prixUnitaire": 0
  },
  {
    "designation": "AMOXICILLINE",
    "categorie": "medicale",
    "classe": "Bêta-lactamine (pénicilline A)",
    "prixUnitaire": 0
  },
  {
    "designation": "AMPHOTERICINE (ANPHOTERICINE)",
    "categorie": "medicale",
    "classe": "Antifongique (polyène)",
    "prixUnitaire": 0
  },
  {
    "designation": "AMPHOTERICINE B",
    "categorie": "medicale",
    "classe": "Antifongique (polyène)",
    "prixUnitaire": 0
  },
  {
    "designation": "AMPHOTERICYNE B",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "AMPI 1G INJ AMP/7ML IM/IV",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "AMPICILLINE",
    "categorie": "medicale",
    "classe": "Bêta-lactamine (pénicilline A)",
    "prixUnitaire": 0
  },
  {
    "designation": "ANALGIN",
    "categorie": "medicale",
    "classe": "ANTALGIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "ANGINOVAG AEROSOL FL/ 10ml",
    "categorie": "medicale",
    "classe": "ANTISEPTIQUE+INFLAMMATOIRE+ANTALGIQUES",
    "prixUnitaire": 2400
  },
  {
    "designation": "ANPHOTERICINE",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "ANSE",
    "categorie": "medicale",
    "classe": "Matériel de laboratoire (anse de culture microbiologique)",
    "prixUnitaire": 0
  },
  {
    "designation": "ANTALGEX GELU B/20",
    "categorie": "medicale",
    "classe": "ANTALGIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "ANTI GLOBULENO",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "ANTI-GLOBULINE",
    "categorie": "medicale",
    "classe": "Réactif immunologique",
    "prixUnitaire": 0
  },
  {
    "designation": "ANTI-HUMAN IgG",
    "categorie": "medicale",
    "classe": "Réactif immunologique",
    "prixUnitaire": 0
  },
  {
    "designation": "APDROPS COLL F/3ML",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES",
    "prixUnitaire": 1963
  },
  {
    "designation": "APL JAUNE 22",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "APL JAUNE 25",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "APOTEL MAX INJ 100ML",
    "categorie": "medicale",
    "classe": "ANTALGIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "APTT (CK)",
    "categorie": "medicale",
    "classe": "Test de coagulation (TCA)",
    "prixUnitaire": 0
  },
  {
    "designation": "AQUALARM 0.5%",
    "categorie": "medicale",
    "classe": "LUBRIFIANT OCCULAIRE",
    "prixUnitaire": 3000
  },
  {
    "designation": "ARTEFAN 80/480 MG CP B/12",
    "categorie": "medicale",
    "classe": "ANTIPALUDIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "ARTELAC COLLYRE",
    "categorie": "medicale",
    "classe": "LUBRIFIANT OCCULAIRE",
    "prixUnitaire": 2218
  },
  {
    "designation": "ARTEMETHER 80 MG INJ",
    "categorie": "medicale",
    "classe": "ANTIPALUDIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "ARTESUNATE 60MG INJ B/1",
    "categorie": "medicale",
    "classe": "ANTIPALUDIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "ARVALARM",
    "categorie": "medicale",
    "classe": "LUBRIFIANT OCCULAIRE",
    "prixUnitaire": 2729
  },
  {
    "designation": "ASAT",
    "categorie": "medicale",
    "classe": "Enzyme hépatique (transaminase)",
    "prixUnitaire": 0
  },
  {
    "designation": "ASLO",
    "categorie": "medicale",
    "classe": "Anticorps (anti-streptolysine O)",
    "prixUnitaire": 0
  },
  {
    "designation": "ASPIRINE CARDIO 100mg/CP",
    "categorie": "medicale",
    "classe": "ANTIAGREGANT PLAQUETAIRE",
    "prixUnitaire": 1390
  },
  {
    "designation": "ASTREONAM",
    "categorie": "medicale",
    "classe": "Monobactame (bêta-lactamine)",
    "prixUnitaire": 0
  },
  {
    "designation": "ASTREONAME 30",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "ATROPINE NJ CSM",
    "categorie": "medicale",
    "classe": "ANTISECRETOIRES",
    "prixUnitaire": 0
  },
  {
    "designation": "AUGMENTIN",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "AUGMENTIN (amoxicilline + acide clavulanique)",
    "categorie": "medicale",
    "classe": "Bêta-lactamine + inhibiteur de bêta-lactamase",
    "prixUnitaire": 0
  },
  {
    "designation": "AVAS 10mg/CP",
    "categorie": "medicale",
    "classe": "HYPOLIPEMIANT",
    "prixUnitaire": 4395
  },
  {
    "designation": "AZITHROMYCINE",
    "categorie": "medicale",
    "classe": "Macrolide",
    "prixUnitaire": 0
  },
  {
    "designation": "AZITROMYCINE CP",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "BAC DE COLORATION",
    "categorie": "medicale",
    "classe": "Matériel",
    "prixUnitaire": 0
  },
  {
    "designation": "BACITRACIN",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "BACITRACINE",
    "categorie": "medicale",
    "classe": "Antibiotique polypeptidique",
    "prixUnitaire": 0
  },
  {
    "designation": "BACTRIM",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "BACTRIM (sulfaméthoxazole + triméthoprime)",
    "categorie": "medicale",
    "classe": "Sulfamides + antifolique",
    "prixUnitaire": 0
  },
  {
    "designation": "BANDE CREPE VELPO GM",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "BANDE CREPE VELPO PM",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "BANDELETTE ONE TOUCH GLY",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "BANDELETTES URINAIRES (3P, 11P, 14P)",
    "categorie": "medicale",
    "classe": "Test urinaire",
    "prixUnitaire": 0
  },
  {
    "designation": "BANDELETTES URINAIRES 11P",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "BANDELETTES URINAIRES 14P",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "BANDELETTES URINAIRES 3P",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "BANEOCIN PMD 20G",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "BEA",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "BECBENSEN",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "BECBENSEN*",
    "categorie": "medicale",
    "classe": "À vérifier (probablement réactif spécifique)",
    "prixUnitaire": 0
  },
  {
    "designation": "BENZATHINE 2,4 INJ",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "BETADINE 10% JAUNE DER FL/125ML",
    "categorie": "medicale",
    "classe": "ANTISEPTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "BETADINE 10% JAUNE DER FL/500ML",
    "categorie": "medicale",
    "classe": "ANTISEPTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "BETADINE ROUGE 125ML",
    "categorie": "medicale",
    "classe": "ANTISEPTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "BETADINE SCRUB F/500ML ROUGE",
    "categorie": "medicale",
    "classe": "ANTISEPTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "BHCG",
    "categorie": "medicale",
    "classe": "Hormone (grossesse)",
    "prixUnitaire": 0
  },
  {
    "designation": "BICARBONATE",
    "categorie": "medicale",
    "classe": "ANTISEPTIQUES",
    "prixUnitaire": 800
  },
  {
    "designation": "BILIRUBINE",
    "categorie": "medicale",
    "classe": "Pigment biliaire",
    "prixUnitaire": 0
  },
  {
    "designation": "BILLES (coagulation, direct)",
    "categorie": "medicale",
    "classe": "Réactif / support",
    "prixUnitaire": 0
  },
  {
    "designation": "BILLES DIRECT",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "BILLES POUR COAGULATION",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "BIOCK",
    "categorie": "medicale",
    "classe": "Réactif / kit",
    "prixUnitaire": 0
  },
  {
    "designation": "BOCAL D'ASPIRATION",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "BOITE DE PETRIS B55",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "BOITE DE PETRIS B90 1 COMPARTIMENT",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "BOITE DE PETRIS B90 3COMPARTIMENTS",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "BOITE DE RANGEMENT LAMES",
    "categorie": "medicale",
    "classe": "Stockage",
    "prixUnitaire": 0
  },
  {
    "designation": "BOITE DE RANGEMENT POUR LAME POUR TRANSPORT",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "BOITES DE PETRI (B55, B90…)",
    "categorie": "medicale",
    "classe": "Matériel de culture microbiologique",
    "prixUnitaire": 0
  },
  {
    "designation": "BOUCHONS (échantillons, tubes)",
    "categorie": "medicale",
    "classe": "Consommable",
    "prixUnitaire": 0
  },
  {
    "designation": "BOUCHONS POUR ECHANTILLONS FRAIS",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "BOUCHONS POUR TUBE 5ML",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "BRUSTAN CP TAB/20",
    "categorie": "medicale",
    "classe": "ANTALGIQUE & ANTIPYRETIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "BULLETIN EXAMEN",
    "categorie": "medicale",
    "classe": "Document",
    "prixUnitaire": 0
  },
  {
    "designation": "BULLETIN EXAMEN DOUBLE F",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "BULLETIN EXAMEN SIMPLE",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "BUPIVACAINE 50MG/20ML",
    "categorie": "medicale",
    "classe": "ANESTHESIQUE LOCAL",
    "prixUnitaire": 0
  },
  {
    "designation": "CA 15,3",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "CA 15-3",
    "categorie": "medicale",
    "classe": "Marqueur tumoral",
    "prixUnitaire": 0
  },
  {
    "designation": "CA 19-5 / CA 125",
    "categorie": "medicale",
    "classe": "Marqueurs tumoraux",
    "prixUnitaire": 0
  },
  {
    "designation": "CA.1125",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "CA.19,5",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "CAC 1000 (acide ascorbique/calcium) COMP EFF T/10",
    "categorie": "medicale",
    "classe": "MULTIVITAMINES",
    "prixUnitaire": 1785
  },
  {
    "designation": "CAISSE D'ENSEMENCEMENT SACH/1",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "CAISSE D’ENSEMENCEMENT",
    "categorie": "medicale",
    "classe": "Matériel",
    "prixUnitaire": 0
  },
  {
    "designation": "CAL 1",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "CAL2",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "CALCIUM",
    "categorie": "medicale",
    "classe": "Électrolyte",
    "prixUnitaire": 0
  },
  {
    "designation": "CALCIUM 1G INJ AMP/10ML",
    "categorie": "medicale",
    "classe": "SUPPLEANT IONNIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "CALIBRATEUR",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "CALIBRATEUR / CAL1 / CAL2",
    "categorie": "medicale",
    "classe": "Solution d’étalonnage",
    "prixUnitaire": 0
  },
  {
    "designation": "CALIBRATEUR A",
    "categorie": "medicale",
    "classe": "Réactif",
    "prixUnitaire": 0
  },
  {
    "designation": "CALIBRATION STANDARD",
    "categorie": "medicale",
    "classe": "Réactif",
    "prixUnitaire": 0
  },
  {
    "designation": "CANULE DE GUEDEL N2",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "CANULE DE GUEDEL N3",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "CANULE DE TRACHEOTOMIE",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "CARNET DE CONSULTATION",
    "categorie": "medicale",
    "classe": "Document médical",
    "prixUnitaire": 0
  },
  {
    "designation": "CARNET PEDIATRIQUE",
    "categorie": "medicale",
    "classe": "DOCUMENT DE SUIVI SANITAIRE",
    "prixUnitaire": 0
  },
  {
    "designation": "CARNET SIMPLE",
    "categorie": "medicale",
    "classe": "DOCUMENT DE SUIVI SANITAIRE",
    "prixUnitaire": 0
  },
  {
    "designation": "CAROFIT",
    "categorie": "medicale",
    "classe": "COMPLEMENT NUTRITIONNEL",
    "prixUnitaire": 3969
  },
  {
    "designation": "CASSETTES HISTOLOGIQUES",
    "categorie": "medicale",
    "classe": "Consommable",
    "prixUnitaire": 0
  },
  {
    "designation": "CASSETTES HISTOLOGIQUES RECTANGULAIRES ( COULEUR BLANCHE, BLEU , JAUNE, VERTE)",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "CATHETER 16G GRIS",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "CATHETER 22G GRIS",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "CATHETER BLEU N 22G",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "CATHETER JAUNE N 24G",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "CATHETER ORANGE",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "CATHETER ROSE N20G",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "CATHETER VERT N18G",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "catheter violet G26",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 250
  },
  {
    "designation": "CEFALETINE",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "CEFALETINE (probablement céfalotine)",
    "categorie": "medicale",
    "classe": "Céphalosporine (1ère génération)",
    "prixUnitaire": 0
  },
  {
    "designation": "CEFIXIME",
    "categorie": "medicale",
    "classe": "Céphalosporine (3e génération)",
    "prixUnitaire": 0
  },
  {
    "designation": "CEFOTAXIME",
    "categorie": "medicale",
    "classe": "Céphalosporine (3e génération)",
    "prixUnitaire": 0
  },
  {
    "designation": "CEFTAZIDIME",
    "categorie": "medicale",
    "classe": "Céphalosporine (3e génération)",
    "prixUnitaire": 0
  },
  {
    "designation": "CEFTAZIDINE",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "CEFTRIAXONE",
    "categorie": "medicale",
    "classe": "Céphalosporine (3e génération)",
    "prixUnitaire": 0
  },
  {
    "designation": "CEFTRIAXONE 1G INJ",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "CEFUROXIME",
    "categorie": "medicale",
    "classe": "Céphalosporine (2e génération)",
    "prixUnitaire": 0
  },
  {
    "designation": "CELESTENE 4MG/ML INJ",
    "categorie": "medicale",
    "classe": "ANTIHISTAMINIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "CEPHALOTINE",
    "categorie": "medicale",
    "classe": "Céphalosporine (1ère génération)",
    "prixUnitaire": 0
  },
  {
    "designation": "CFAS PROTEINE",
    "categorie": "medicale",
    "classe": "Contrôle qualité",
    "prixUnitaire": 0
  },
  {
    "designation": "CHARLOTTE",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "CHIBRO CADRON COLLYRE",
    "categorie": "medicale",
    "classe": "CORTICOIDE/ANTIBIOTIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "CHLAM IGG",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "CHLAM IGM",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "CHLAM PCR / IGG / IGM",
    "categorie": "medicale",
    "classe": "Test diagnostic",
    "prixUnitaire": 0
  },
  {
    "designation": "CHLAMPCR",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "CHLORAMPHENICOL",
    "categorie": "medicale",
    "classe": "Phénicolé",
    "prixUnitaire": 0
  },
  {
    "designation": "CHLORE",
    "categorie": "medicale",
    "classe": "Électrolyte",
    "prixUnitaire": 0
  },
  {
    "designation": "CHLORURE DE CALCIUM",
    "categorie": "medicale",
    "classe": "Réactif",
    "prixUnitaire": 0
  },
  {
    "designation": "CHOLESTEROL HDL",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "CHOLESTEROL HDL / HDL",
    "categorie": "medicale",
    "classe": "Lipoprotéine",
    "prixUnitaire": 0
  },
  {
    "designation": "CHOLESTEROL TOTAL",
    "categorie": "medicale",
    "classe": "Lipide",
    "prixUnitaire": 0
  },
  {
    "designation": "CHRONOMETRE",
    "categorie": "medicale",
    "classe": "Équipement",
    "prixUnitaire": 0
  },
  {
    "designation": "CHRONOMETRE / MINUTERIE",
    "categorie": "medicale",
    "classe": "Équipement",
    "prixUnitaire": 0
  },
  {
    "designation": "CICASTOP",
    "categorie": "medicale",
    "classe": "CICATRISANT",
    "prixUnitaire": 3300
  },
  {
    "designation": "CILOXAN 0.3 COLLYRE F/5ML",
    "categorie": "medicale",
    "classe": "ANTIIOTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "CILOXAN POMMADE",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "CIPROFLOXACINE",
    "categorie": "medicale",
    "classe": "Fluoroquinolone",
    "prixUnitaire": 0
  },
  {
    "designation": "CITRATE DE SIMMONS",
    "categorie": "medicale",
    "classe": "Test biochimique",
    "prixUnitaire": 0
  },
  {
    "designation": "CITRATE DE SIMON",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "CK B10 LABO",
    "categorie": "medicale",
    "classe": "Réactif",
    "prixUnitaire": 0
  },
  {
    "designation": "CLAMP CORDON",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "CLARITHROMYCINE",
    "categorie": "medicale",
    "classe": "Macrolide",
    "prixUnitaire": 0
  },
  {
    "designation": "CLARIVA 500MG CPR",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "CLARIWIN 500MG",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "CLARK ET LUBS",
    "categorie": "medicale",
    "classe": "Test biochimique",
    "prixUnitaire": 0
  },
  {
    "designation": "CLAVICIN INJ",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "CLEANER / EZ CLEANER",
    "categorie": "medicale",
    "classe": "Solution de nettoyage",
    "prixUnitaire": 0
  },
  {
    "designation": "CLEANER 5L",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "CLINDAMYCINE",
    "categorie": "medicale",
    "classe": "Lincosamide",
    "prixUnitaire": 0
  },
  {
    "designation": "CLOTRIMAZOLE",
    "categorie": "medicale",
    "classe": "Antifongique (imidazolé)",
    "prixUnitaire": 0
  },
  {
    "designation": "COAGULASE",
    "categorie": "medicale",
    "classe": "Test microbiologique",
    "prixUnitaire": 0
  },
  {
    "designation": "COLLYRE BLEU",
    "categorie": "medicale",
    "classe": "ANTISEPTIQUES OCULAIRE",
    "prixUnitaire": 0
  },
  {
    "designation": "COLOMBIA",
    "categorie": "medicale",
    "classe": "Milieu enrichi",
    "prixUnitaire": 0
  },
  {
    "designation": "COLOMBIA LIORLCHEM",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "COMPRESSE EN ROULEAU",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "COMPTEUR DE CELLULE",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "CONDITIONING SOLUTION",
    "categorie": "medicale",
    "classe": "Réactif",
    "prixUnitaire": 0
  },
  {
    "designation": "CONTRACEPTIF INJ",
    "categorie": "medicale",
    "classe": "CONTRACEPTIF INJECTION",
    "prixUnitaire": 0
  },
  {
    "designation": "CONTROL NORMAL",
    "categorie": "medicale",
    "classe": "Contrôle qualité",
    "prixUnitaire": 0
  },
  {
    "designation": "COPROSYSTEM",
    "categorie": "medicale",
    "classe": "Kit microbiologique",
    "prixUnitaire": 0
  },
  {
    "designation": "COPROSYSTEM-SIMPLE",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "CORNETEARS GEL OPH T/10G",
    "categorie": "medicale",
    "classe": "ANTISEPTIQUES",
    "prixUnitaire": 1622
  },
  {
    "designation": "COTIPRED 20MG CPR",
    "categorie": "medicale",
    "classe": "CORTICOIDES",
    "prixUnitaire": 0
  },
  {
    "designation": "COTON",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "COTRIMOXAZOLE 480MG CP BL/10",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "COUTRIGE",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "COUTRIGE (cartouche)",
    "categorie": "medicale",
    "classe": "Consommable",
    "prixUnitaire": 0
  },
  {
    "designation": "CPK",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "CPK / CK",
    "categorie": "medicale",
    "classe": "Enzyme musculaire",
    "prixUnitaire": 0
  },
  {
    "designation": "CREATININE",
    "categorie": "medicale",
    "classe": "Fonction rénale",
    "prixUnitaire": 0
  },
  {
    "designation": "CREME ALFLEXIL",
    "categorie": "medicale",
    "classe": "COMPLEMENT NUTRITIONNEL",
    "prixUnitaire": 0
  },
  {
    "designation": "CRP",
    "categorie": "medicale",
    "classe": "Protéine inflammatoire",
    "prixUnitaire": 0
  },
  {
    "designation": "CRP P1LA TEST",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "CURAM500MG/62.5 CPRB/16",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "CUVETTES",
    "categorie": "medicale",
    "classe": "Consommable",
    "prixUnitaire": 0
  },
  {
    "designation": "CYTEAL SOL F/250ML",
    "categorie": "medicale",
    "classe": "ANTISEPTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "CYTEAL SOL F/500ML",
    "categorie": "medicale",
    "classe": "ANTISEPTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "CYTEAL SOLUTION F/ 500ML",
    "categorie": "medicale",
    "classe": "ANTISEPTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "D-DIMER",
    "categorie": "medicale",
    "classe": "Marqueur de coagulation",
    "prixUnitaire": 0
  },
  {
    "designation": "D. DIMER",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "DAKIN COOPER",
    "categorie": "medicale",
    "classe": "ANTISEPTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "DEBRIDAT 100MG CP",
    "categorie": "medicale",
    "classe": "ANTISPASMODIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "DERMOBACTER SOL FL/300ML",
    "categorie": "medicale",
    "classe": "ANTISEPTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "DERMOTEST",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "DESOMEDINE COLLYRE",
    "categorie": "medicale",
    "classe": "ANTISEPTIQUES",
    "prixUnitaire": 1197
  },
  {
    "designation": "DETERGENT",
    "categorie": "medicale",
    "classe": "Produit de nettoyage",
    "prixUnitaire": 0
  },
  {
    "designation": "DETERGENT C080",
    "categorie": "medicale",
    "classe": "Produit de nettoyage",
    "prixUnitaire": 0
  },
  {
    "designation": "DETERMINE HIV",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "DEXAMETHAZONE 40 MG INJ",
    "categorie": "medicale",
    "classe": "CORTICOIDES",
    "prixUnitaire": 0
  },
  {
    "designation": "DIAZEPAM INJ AMP/2ML",
    "categorie": "medicale",
    "classe": "NEUROLEPTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "DICLOFENAC 75MG INJ",
    "categorie": "medicale",
    "classe": "ANTIINFLAMMATOIRES",
    "prixUnitaire": 0
  },
  {
    "designation": "DICYNONE 250 INJ",
    "categorie": "medicale",
    "classe": "ANTIHEMORRAGIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "DILUANT 1L (C111)",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "DILUANT 20L URIENDAY",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "DILUANT 20L URIT",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "DILUANT HBA 1C",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "DILUANTS (URIT, URIENDAY, HBA1C, C111)",
    "categorie": "medicale",
    "classe": "Réactifs",
    "prixUnitaire": 0
  },
  {
    "designation": "DILUANTS (URIT, URIENDAY, HBA1C…)",
    "categorie": "medicale",
    "classe": "Réactifs",
    "prixUnitaire": 0
  },
  {
    "designation": "DIPROSTEN 2MG INJ",
    "categorie": "medicale",
    "classe": "CORTICOIDES",
    "prixUnitaire": 0
  },
  {
    "designation": "DISLEP 25 INJ",
    "categorie": "medicale",
    "classe": "ANTIEMETIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "DISLEP CP 25 MG",
    "categorie": "medicale",
    "classe": "ANTIEMETIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "DISPOSITIF COBAS",
    "categorie": "medicale",
    "classe": "Analyseur",
    "prixUnitaire": 0
  },
  {
    "designation": "DISPOSITIFS (compteur cellules)",
    "categorie": "medicale",
    "classe": "Équipement",
    "prixUnitaire": 0
  },
  {
    "designation": "DISQUE LDC",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "DISQUE ODC",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "DISQUE ONPG",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "DISQUE ONPG / ODC / LDC",
    "categorie": "medicale",
    "classe": "Tests enzymatiques",
    "prixUnitaire": 0
  },
  {
    "designation": "DISQUE OXYGENE",
    "categorie": "medicale",
    "classe": "Test microbiologique",
    "prixUnitaire": 0
  },
  {
    "designation": "DISTEM 300MG/380MG CP",
    "categorie": "medicale",
    "classe": "MYORELAXANT",
    "prixUnitaire": 0
  },
  {
    "designation": "DISTEROL NORMAL",
    "categorie": "medicale",
    "classe": "Contrôle",
    "prixUnitaire": 0
  },
  {
    "designation": "DIU",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "DIU A VENDRE",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "DOLIMEX",
    "categorie": "medicale",
    "classe": "ANTALGIQUES",
    "prixUnitaire": 800
  },
  {
    "designation": "DOLIPRANE 300MG B/10",
    "categorie": "medicale",
    "classe": "ANTALGIQUE & ANTIPYRETIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "DOLIPRANE100MG B/10",
    "categorie": "medicale",
    "classe": "ANTALGIQUE & ANTIPYRETIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "DOLIPRANE150MGB/10",
    "categorie": "medicale",
    "classe": "ANTALGIQUE & ANTIPYRETIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "DOTAREM 0.5MMOL",
    "categorie": "medicale",
    "classe": "PRODUIT DE CONTRASTE",
    "prixUnitaire": 0
  },
  {
    "designation": "DOXYCYCLINE",
    "categorie": "medicale",
    "classe": "Tétracycline",
    "prixUnitaire": 0
  },
  {
    "designation": "DPX",
    "categorie": "medicale",
    "classe": "Milieu de montage",
    "prixUnitaire": 0
  },
  {
    "designation": "DPX-MONTANT FOR MYCOSOPY",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "DRAIN D'ALBERTINI",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "DRAIN DE JOST REDON COMPLET",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "DRAIN DE REDON N14",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "DRAIN DE REDON N16",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "DRAIN DE REDON N18",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "DUPHALAC 10G SAC/15ML SOL BUV",
    "categorie": "medicale",
    "classe": "LAXATIFS",
    "prixUnitaire": 0
  },
  {
    "designation": "DUPHALAC SIROP",
    "categorie": "medicale",
    "classe": "LAXATIFS",
    "prixUnitaire": 0
  },
  {
    "designation": "DUPHASTON 10MG CP B/10",
    "categorie": "medicale",
    "classe": "PROGESTATIF",
    "prixUnitaire": 0
  },
  {
    "designation": "DYNAPAR SR",
    "categorie": "medicale",
    "classe": "ANTIINFLAMMATOIRES",
    "prixUnitaire": 0
  },
  {
    "designation": "EA 50",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "EA50",
    "categorie": "medicale",
    "classe": "Colorant",
    "prixUnitaire": 0
  },
  {
    "designation": "EAU DISTILLEE STERILE",
    "categorie": "medicale",
    "classe": "Solvant",
    "prixUnitaire": 0
  },
  {
    "designation": "EAU MINERALE",
    "categorie": "medicale",
    "classe": "ACCESSOIRES",
    "prixUnitaire": 0
  },
  {
    "designation": "EAU OXYGENEE 120ML",
    "categorie": "medicale",
    "classe": "ANTISEPTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "EAU OXYGENEE 250ML",
    "categorie": "medicale",
    "classe": "ANTISEPTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "ECHELLE DE MC FALAM",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "ECHELLE DE McFARLAND",
    "categorie": "medicale",
    "classe": "Standard microbiologique",
    "prixUnitaire": 0
  },
  {
    "designation": "ECONAZOLE",
    "categorie": "medicale",
    "classe": "Antifongique (imidazolé)",
    "prixUnitaire": 0
  },
  {
    "designation": "ECOUVILLONS (H/F)",
    "categorie": "medicale",
    "classe": "Dispositif de prélèvement",
    "prixUnitaire": 0
  },
  {
    "designation": "ECOUVILLONS (hommes/femmes)",
    "categorie": "medicale",
    "classe": "Dispositif de prélèvement",
    "prixUnitaire": 0
  },
  {
    "designation": "ECOUVILLONS FEMMES",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "ECOUVILLONS HOMMES",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "EFFERALGAN 1G CPR EFF",
    "categorie": "medicale",
    "classe": "ANTALGIQUE & ANTIPYRETIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "EFFERALGAN SP PED",
    "categorie": "medicale",
    "classe": "ANTALGIQUE & ANTIPYRETIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "EFFERALGAN80MG B/10",
    "categorie": "medicale",
    "classe": "ANTALGIQUE & ANTIPYRETIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "ELASTOPLAST",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "ELECTRODES / ISE DEPROTEINIZER",
    "categorie": "medicale",
    "classe": "Équipement",
    "prixUnitaire": 0
  },
  {
    "designation": "ELECTRODES DEPROTEINEIZER",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "ELECTRODES DEPROTEINIZER / ISE",
    "categorie": "medicale",
    "classe": "Réactif/équipement",
    "prixUnitaire": 0
  },
  {
    "designation": "ELECTRODES HOLTER ECG",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "ELECTROPHORESE Hb",
    "categorie": "medicale",
    "classe": "Analyse hémoglobine",
    "prixUnitaire": 0
  },
  {
    "designation": "ELECTROPHORESE HB SET",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "ELECTROPHORESE SERUM",
    "categorie": "medicale",
    "classe": "Analyse protéique",
    "prixUnitaire": 0
  },
  {
    "designation": "ELUDRIL SOL FL/90ML",
    "categorie": "medicale",
    "classe": "ANTISEPTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "EMBOUT BLEU",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "EMBOUT JAUNE",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "EMBOUTS (jaune, bleu)",
    "categorie": "medicale",
    "classe": "Consommables",
    "prixUnitaire": 0
  },
  {
    "designation": "ENDOPROST 250MG/ML IM SOL INJ F/1",
    "categorie": "medicale",
    "classe": "ANTIHEMORRAGIQUES",
    "prixUnitaire": 3394
  },
  {
    "designation": "ENDOPROST125MG INJ",
    "categorie": "medicale",
    "classe": "ANTIHEMORRAGIQUES",
    "prixUnitaire": 1723
  },
  {
    "designation": "ENTEROSYSTEME",
    "categorie": "medicale",
    "classe": "Identification bactérienne",
    "prixUnitaire": 0
  },
  {
    "designation": "ENTEROSYSTEME GALERIE",
    "categorie": "medicale",
    "classe": "Kit d’identification bactérienne",
    "prixUnitaire": 0
  },
  {
    "designation": "ENTEROSYSTEME-GALERIE",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "EOSINE AQU 2%",
    "categorie": "medicale",
    "classe": "ANTISEPTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "EPHEDRINE INJ",
    "categorie": "medicale",
    "classe": "ANESTHESIE",
    "prixUnitaire": 0
  },
  {
    "designation": "EPICRANIEN N 25 BLEU",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "EPICRANIEN N 25 ORANGE",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "EPICRANIEN VERT 21G",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "EPINDOPHES",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "EPINDORPHES (Eppendorf)",
    "categorie": "medicale",
    "classe": "Tubes de laboratoire",
    "prixUnitaire": 0
  },
  {
    "designation": "ERYTHROMYCINE",
    "categorie": "medicale",
    "classe": "Macrolide",
    "prixUnitaire": 0
  },
  {
    "designation": "ESOMED-40 CP B/30",
    "categorie": "medicale",
    "classe": "ANTIULCEREUX",
    "prixUnitaire": 0
  },
  {
    "designation": "ETHYLON 2 AIG T",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "EXACYL 0.5G/5ML INJ",
    "categorie": "medicale",
    "classe": "ANTIHEMORRAGIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "EZ CLEANER",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "EZ CLEANER / PROBE CLEANER",
    "categorie": "medicale",
    "classe": "Solution de nettoyage",
    "prixUnitaire": 0
  },
  {
    "designation": "FENTANYL",
    "categorie": "medicale",
    "classe": "ANTALGIQUES OPIOIDE",
    "prixUnitaire": 0
  },
  {
    "designation": "FIL D'ACIER",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "FLAGYL 0.5G INJ 100ML POCH/1",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "FLAGYL 500MG CPR/14",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "FLEMING 1G/125 CPR",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "FLUCONAZOLE",
    "categorie": "medicale",
    "classe": "Antifongique (triazolé)",
    "prixUnitaire": 0
  },
  {
    "designation": "FLUCONAZOLE INJ",
    "categorie": "medicale",
    "classe": "ANTIFONGIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "FLUCYTOCINE",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "FLUCYTOSINE",
    "categorie": "medicale",
    "classe": "Antifongique (antimétabolite)",
    "prixUnitaire": 0
  },
  {
    "designation": "FLUONOCEPTOCINE",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "FLUONOCEPTOCINE*",
    "categorie": "medicale",
    "classe": "(Probablement erreur — vérifier le nom)",
    "prixUnitaire": 0
  },
  {
    "designation": "FORLAX 10G SACHET B/10",
    "categorie": "medicale",
    "classe": "LAXATIFS",
    "prixUnitaire": 0
  },
  {
    "designation": "FORMOL",
    "categorie": "medicale",
    "classe": "DESINFECTANT ET CONSERVATEUR",
    "prixUnitaire": 0
  },
  {
    "designation": "FORTRANS SACHET",
    "categorie": "medicale",
    "classe": "LAXATIFS",
    "prixUnitaire": 0
  },
  {
    "designation": "FOSFOMYCINE",
    "categorie": "medicale",
    "classe": "Antibiotique (phosphonique)",
    "prixUnitaire": 0
  },
  {
    "designation": "FR",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "FRAKIDEX COLLY FL/5ML",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES + CORTICOIDES",
    "prixUnitaire": 0
  },
  {
    "designation": "FRAKIDEX COLLYRE",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES + CORTICOIDES",
    "prixUnitaire": 1190
  },
  {
    "designation": "FRAKIDEX POM FL/5ML",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES + CORTICOIDES",
    "prixUnitaire": 0
  },
  {
    "designation": "FRAKIDEX POMMADE",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES + CORTICOIDES",
    "prixUnitaire": 831
  },
  {
    "designation": "FSH",
    "categorie": "medicale",
    "classe": "Hormone",
    "prixUnitaire": 0
  },
  {
    "designation": "FUCITHALMIC 1%GEL",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "FUSHINE",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "FUSHINE / ZIEHL-NEELSEN",
    "categorie": "medicale",
    "classe": "Colorant microbiologique",
    "prixUnitaire": 0
  },
  {
    "designation": "FUSHINE DE ZIEL NELSON",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "G6PD",
    "categorie": "medicale",
    "classe": "Enzyme (déficit enzymatique)",
    "prixUnitaire": 0
  },
  {
    "designation": "GANTS",
    "categorie": "medicale",
    "classe": "Équipement de protection",
    "prixUnitaire": 0
  },
  {
    "designation": "GANTS DE SOINS P/100",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "GANTS OBSTETRICAUX(RU)",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "GANTS SOINS",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "GANTS STERIL 7.5",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "GANTS STERIL 8",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "GATROGRAFINE SIROP",
    "categorie": "medicale",
    "classe": "ANTISPASMODIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "GEL ACETATE DE CELLULOSE",
    "categorie": "medicale",
    "classe": "Support électrophorèse",
    "prixUnitaire": 0
  },
  {
    "designation": "GEL D'ACETATE DE CELLULE SEC",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "GEL ECHO",
    "categorie": "medicale",
    "classe": "Gel médical",
    "prixUnitaire": 0
  },
  {
    "designation": "GELOFUSINE PER",
    "categorie": "medicale",
    "classe": "SOLUTES",
    "prixUnitaire": 0
  },
  {
    "designation": "GENACOL OPTIMUM",
    "categorie": "medicale",
    "classe": "COMPLEMENT NUTRITIONNEL ARTICULAIRE",
    "prixUnitaire": 0
  },
  {
    "designation": "GENACOL ORIGINAL",
    "categorie": "medicale",
    "classe": "COMPLEMENT NUTRITIONNEL ARTICULAIRE",
    "prixUnitaire": 0
  },
  {
    "designation": "GENACOL PLUS",
    "categorie": "medicale",
    "classe": "ANALGESIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "GENSET 10MG CP",
    "categorie": "medicale",
    "classe": "ANTIHISTAMINIQUES",
    "prixUnitaire": 1552
  },
  {
    "designation": "GENSET SUSP BUV",
    "categorie": "medicale",
    "classe": "ANTIHISTAMINIQUES",
    "prixUnitaire": 797
  },
  {
    "designation": "GENTA 80 MG INJ",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "GENTA COLLYRE",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES",
    "prixUnitaire": 883
  },
  {
    "designation": "GENTAMYCINE",
    "categorie": "medicale",
    "classe": "Aminoside (aminoglycoside)",
    "prixUnitaire": 0
  },
  {
    "designation": "GENTASOL COLLYRE",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "GH RHESUS",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "GIEMSA",
    "categorie": "medicale",
    "classe": "Colorant",
    "prixUnitaire": 0
  },
  {
    "designation": "GIEMSA / MGG",
    "categorie": "medicale",
    "classe": "Colorants biologiques",
    "prixUnitaire": 0
  },
  {
    "designation": "GIEMSA RAPIDE",
    "categorie": "medicale",
    "classe": "Colorant",
    "prixUnitaire": 0
  },
  {
    "designation": "GLUCOSE",
    "categorie": "medicale",
    "classe": "Glycémie",
    "prixUnitaire": 0
  },
  {
    "designation": "GLUCOVANCE 500mg CP",
    "categorie": "medicale",
    "classe": "ANTIDIABETIQUES",
    "prixUnitaire": 3800
  },
  {
    "designation": "GLYCEROL",
    "categorie": "medicale",
    "classe": "Réactif",
    "prixUnitaire": 0
  },
  {
    "designation": "GOT",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "GOT (ASAT)",
    "categorie": "medicale",
    "classe": "Enzyme hépatique",
    "prixUnitaire": 0
  },
  {
    "designation": "GPT",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "GPT (ALAT)",
    "categorie": "medicale",
    "classe": "Enzyme hépatique",
    "prixUnitaire": 0
  },
  {
    "designation": "GRAMOCEF O 200",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "GRISEOFULVINE",
    "categorie": "medicale",
    "classe": "Antifongique",
    "prixUnitaire": 0
  },
  {
    "designation": "GYNOSPAN INJ B/6",
    "categorie": "medicale",
    "classe": "ANTISPASMODIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "HALOTHANE 250ML",
    "categorie": "medicale",
    "classe": "NEUROLEPTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "HBA 1C",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "HBA1C",
    "categorie": "medicale",
    "classe": "Hémoglobine glyquée",
    "prixUnitaire": 0
  },
  {
    "designation": "HBs",
    "categorie": "medicale",
    "classe": "Antigène hépatite B",
    "prixUnitaire": 0
  },
  {
    "designation": "HDL",
    "categorie": "medicale",
    "classe": "Lipoprotéine",
    "prixUnitaire": 0
  },
  {
    "designation": "HEC POM",
    "categorie": "medicale",
    "classe": "ANTIHEMORRAGIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "HELMINTOX 5%SUPS BUV",
    "categorie": "medicale",
    "classe": "ANTIHELMINTHES",
    "prixUnitaire": 0
  },
  {
    "designation": "HELMINTOX SACHET",
    "categorie": "medicale",
    "classe": "ANTIHELMINTHES",
    "prixUnitaire": 0
  },
  {
    "designation": "HEMAFER 100MG B/12 CP EFF",
    "categorie": "medicale",
    "classe": "ANTIANEMIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "HEMAFER INJECTABLE",
    "categorie": "medicale",
    "classe": "ANTIANEMIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "HEMALOXYLINE DE HARRIS",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "HEMATOXYLINE DE HARRIS",
    "categorie": "medicale",
    "classe": "Colorant histologique",
    "prixUnitaire": 0
  },
  {
    "designation": "HEP B",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "HEP B / PCR",
    "categorie": "medicale",
    "classe": "Test virologique",
    "prixUnitaire": 0
  },
  {
    "designation": "HEPATIT B PCR",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "HEPATITE C",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "HEPATITE C / PCR",
    "categorie": "medicale",
    "classe": "Test virologique",
    "prixUnitaire": 0
  },
  {
    "designation": "HEPATITE C PCR",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "HEPATITE DELTA ELISA",
    "categorie": "medicale",
    "classe": "Test sérologique",
    "prixUnitaire": 0
  },
  {
    "designation": "HERPES EN PCR",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "HERPES PCR",
    "categorie": "medicale",
    "classe": "Test moléculaire",
    "prixUnitaire": 0
  },
  {
    "designation": "HIV (DETERMINE HIV)",
    "categorie": "medicale",
    "classe": "Test sérologique",
    "prixUnitaire": 0
  },
  {
    "designation": "HIV (déterminer HIV)",
    "categorie": "medicale",
    "classe": "Test sérologique",
    "prixUnitaire": 0
  },
  {
    "designation": "HP TEST",
    "categorie": "medicale",
    "classe": "Test Helicobacter pylori",
    "prixUnitaire": 0
  },
  {
    "designation": "HPV",
    "categorie": "medicale",
    "classe": "Test virologique",
    "prixUnitaire": 0
  },
  {
    "designation": "HUILE A IMMERSION",
    "categorie": "medicale",
    "classe": "Microscopie",
    "prixUnitaire": 0
  },
  {
    "designation": "HUILE GOMENOLEE",
    "categorie": "medicale",
    "classe": "ANTISEPTIQUE + DECONGESTIONANT",
    "prixUnitaire": 0
  },
  {
    "designation": "HUMATOL ( CONTROL)",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "HUMATOL (CONTROL)",
    "categorie": "medicale",
    "classe": "Contrôle qualité",
    "prixUnitaire": 0
  },
  {
    "designation": "HYPAFIX BANDE ADHES 2M*10CM",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "IDEOS CP EFFV B/30",
    "categorie": "medicale",
    "classe": "SUPPLEANT IONNIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "IGE TOTAL",
    "categorie": "medicale",
    "classe": "Immunoglobuline",
    "prixUnitaire": 0
  },
  {
    "designation": "IMIPENEME",
    "categorie": "medicale",
    "classe": "Carbapénème (bêta-lactamine)",
    "prixUnitaire": 0
  },
  {
    "designation": "IMPLANON NXT",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "INDOCOLLYRE 0,1%",
    "categorie": "medicale",
    "classe": "ANTIINFLAMMATOIRES",
    "prixUnitaire": 2106
  },
  {
    "designation": "INFLACAM",
    "categorie": "medicale",
    "classe": "ANTIINFLAMMATOIRES",
    "prixUnitaire": 0
  },
  {
    "designation": "INSULINE INSULATARD",
    "categorie": "medicale",
    "classe": "INSULINE",
    "prixUnitaire": 0
  },
  {
    "designation": "INSULINE MIXTARD",
    "categorie": "medicale",
    "classe": "INSULINE",
    "prixUnitaire": 0
  },
  {
    "designation": "IONOGRAMME (PACK)",
    "categorie": "medicale",
    "classe": "Kit biochimique",
    "prixUnitaire": 0
  },
  {
    "designation": "IOPAMIDOL",
    "categorie": "medicale",
    "classe": "PRODUIT DE CONTRASTE",
    "prixUnitaire": 0
  },
  {
    "designation": "ISE DEPROTEINERSER",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "ISOFLURANE",
    "categorie": "medicale",
    "classe": "ANESTHESIQUE",
    "prixUnitaire": 30000
  },
  {
    "designation": "ISOLONE 20MG CPR EFFV",
    "categorie": "medicale",
    "classe": "CORTICOIDES",
    "prixUnitaire": 1911
  },
  {
    "designation": "ITRACONAZOLE",
    "categorie": "medicale",
    "classe": "Antifongique (triazolé)",
    "prixUnitaire": 0
  },
  {
    "designation": "JADELLE",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "KCL INJ 10% 1G/10ML",
    "categorie": "medicale",
    "classe": "SUPPLEANT IONNIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "KENACORT 80MG",
    "categorie": "medicale",
    "classe": "CORTICOIDES",
    "prixUnitaire": 0
  },
  {
    "designation": "KENAKORT 40",
    "categorie": "medicale",
    "classe": "CORTICOIDES",
    "prixUnitaire": 0
  },
  {
    "designation": "KETAMINE 500MG",
    "categorie": "medicale",
    "classe": "NEUROLEPTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "KETESSE INJ",
    "categorie": "medicale",
    "classe": "ANTIINFLAMMATOIRES",
    "prixUnitaire": 0
  },
  {
    "designation": "KETOCONAZOLE",
    "categorie": "medicale",
    "classe": "Antifongique (imidazolé)",
    "prixUnitaire": 0
  },
  {
    "designation": "KIT ACCOUCHEMENT",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "KIT CAT B IUV",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "KIT CAT V IUV",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "KIT CESARIENNE SOUS ANESTH GEN",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "KIT COLOSCOPIE CAT B",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "KIT COLOSCOPIE CAT J",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "KIT COLOSISTECTOMIE",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "KIT CYTOSCOPIE",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "KIT DE SOINS",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "KIT DE SOINS INDIVIDUEL",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "KIT REVISION UTERINE",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "KIT SODIUM POTASSIUM",
    "categorie": "medicale",
    "classe": "Kit électrolytique",
    "prixUnitaire": 0
  },
  {
    "designation": "KIT TDM CATHETER ROSE",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "KLIGER HAJNA",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "KLIGLER HAJNA",
    "categorie": "medicale",
    "classe": "Test biochimique",
    "prixUnitaire": 0
  },
  {
    "designation": "KLIPAL CODEINE 50/600MG CP B/12",
    "categorie": "medicale",
    "classe": "ANTALGIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "KOH",
    "categorie": "medicale",
    "classe": "Réactif (mycologie)",
    "prixUnitaire": 0
  },
  {
    "designation": "LA LYSE",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "LA LYSE / LYSE MINDRAY / M10 CFL LYSE",
    "categorie": "medicale",
    "classe": "Réactifs d’hématologie",
    "prixUnitaire": 0
  },
  {
    "designation": "LAME PORTE OBJET",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "LAME PORTE-OBJET",
    "categorie": "medicale",
    "classe": "Microscopie",
    "prixUnitaire": 0
  },
  {
    "designation": "LAMELLE",
    "categorie": "medicale",
    "classe": "Microscopie",
    "prixUnitaire": 0
  },
  {
    "designation": "LAMELLES / LAMES",
    "categorie": "medicale",
    "classe": "Microscopie",
    "prixUnitaire": 0
  },
  {
    "designation": "LANCE CULIBRE EN PLASTIQUE",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "LANCEUR / LANCETTE",
    "categorie": "medicale",
    "classe": "Prélèvement",
    "prixUnitaire": 0
  },
  {
    "designation": "LARGACTIL 100MG COMP B/30",
    "categorie": "medicale",
    "classe": "NEUROLEPTIQUES",
    "prixUnitaire": 3855
  },
  {
    "designation": "LARGACTIL 25mg/5ml AMP",
    "categorie": "medicale",
    "classe": "NEUROLEPTIQUES",
    "prixUnitaire": 7500
  },
  {
    "designation": "LARGACTIL 500mg",
    "categorie": "medicale",
    "classe": "NEUROLEPTIQUES",
    "prixUnitaire": 2670
  },
  {
    "designation": "LASILIX 20 MG INJ",
    "categorie": "medicale",
    "classe": "DIURECTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "LASILIX 40MG",
    "categorie": "medicale",
    "classe": "DIURECTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "LASILIX FAIBLE 20MG",
    "categorie": "medicale",
    "classe": "DIURECTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "LERIN CP",
    "categorie": "medicale",
    "classe": "UTEROTONIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "LEVOFLOXACINE",
    "categorie": "medicale",
    "classe": "Fluoroquinolone",
    "prixUnitaire": 0
  },
  {
    "designation": "LEVOPHTA COLLYRE 0,05%",
    "categorie": "medicale",
    "classe": "ANTISEPTIQUES",
    "prixUnitaire": 3224
  },
  {
    "designation": "LH",
    "categorie": "medicale",
    "classe": "Hormone",
    "prixUnitaire": 0
  },
  {
    "designation": "LINCOMYCINE",
    "categorie": "medicale",
    "classe": "Lincosamide",
    "prixUnitaire": 0
  },
  {
    "designation": "LIPASE",
    "categorie": "medicale",
    "classe": "Enzyme pancréatique",
    "prixUnitaire": 0
  },
  {
    "designation": "LIPOSIC GEL",
    "categorie": "medicale",
    "classe": "LUBRIFIANT OCCULAIRE",
    "prixUnitaire": 1442
  },
  {
    "designation": "LITACOLD SACHET",
    "categorie": "medicale",
    "classe": "ANTIGRIPAL",
    "prixUnitaire": 0
  },
  {
    "designation": "LOL",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "LOVENOX 40MG INJ",
    "categorie": "medicale",
    "classe": "ANTICOAGULANT",
    "prixUnitaire": 0
  },
  {
    "designation": "LOXEN 10MG/10ML INJ",
    "categorie": "medicale",
    "classe": "ANTIHYPPERTENSEURS",
    "prixUnitaire": 0
  },
  {
    "designation": "LUDOCAINE-ADRENALINE",
    "categorie": "medicale",
    "classe": "ANESTHESIE",
    "prixUnitaire": 2000
  },
  {
    "designation": "LUGOL",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "LUNETTE A OXYGENE",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "LYDIA CLEEK,COPPER,SAFELOOD",
    "categorie": "medicale",
    "classe": "CONTRACEPTIF INJECTION",
    "prixUnitaire": 0
  },
  {
    "designation": "LYSE MINDRAY",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "M 10 CFL LYSE",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "MAG INJECTABLE",
    "categorie": "medicale",
    "classe": "MULTIVITAMINES",
    "prixUnitaire": 0
  },
  {
    "designation": "MAGNESIUM",
    "categorie": "medicale",
    "classe": "Électrolyte",
    "prixUnitaire": 0
  },
  {
    "designation": "MALOXINE",
    "categorie": "medicale",
    "classe": "ANTIPALUDIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "MANITOL",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "MANNITOL MOBILITE",
    "categorie": "medicale",
    "classe": "Test bactérien",
    "prixUnitaire": 0
  },
  {
    "designation": "MASQUE FACIAUX",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "MAXIDROL COLLYRE",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES + CORTICOIDES",
    "prixUnitaire": 700
  },
  {
    "designation": "MAXIDROL POMMADE",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES + CORTICOIDES",
    "prixUnitaire": 0
  },
  {
    "designation": "MAXIMAG",
    "categorie": "medicale",
    "classe": "MULTIVITAMINES",
    "prixUnitaire": 0
  },
  {
    "designation": "MAY-GRÜNWALD",
    "categorie": "medicale",
    "classe": "Colorant",
    "prixUnitaire": 0
  },
  {
    "designation": "MAYGRUM VALD",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "MEBENDAZOLE 100MG",
    "categorie": "medicale",
    "classe": "ANTIHELMINTHES",
    "prixUnitaire": 0
  },
  {
    "designation": "MEDICAL SILICONE",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "MELEX 1MG CP B/30",
    "categorie": "medicale",
    "classe": "ANALGESIQUE OPIOIDE",
    "prixUnitaire": 0
  },
  {
    "designation": "MEROCEL",
    "categorie": "medicale",
    "classe": "HEMOSTATIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "MERONIA 1G INJ",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "MESPORIN 1G AMP INJ IV B/1",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES",
    "prixUnitaire": 3690
  },
  {
    "designation": "METRONIDAZOL 250MG CPR",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "METRONIDAZOLE",
    "categorie": "medicale",
    "classe": "Antibiotique (imidazolé, anti-anaérobie/antiparasitaire)",
    "prixUnitaire": 0
  },
  {
    "designation": "MGG",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "MICONAZOLE",
    "categorie": "medicale",
    "classe": "Antifongique (imidazolé)",
    "prixUnitaire": 0
  },
  {
    "designation": "MICRO CUVETTE COBAS",
    "categorie": "medicale",
    "classe": "Consommable",
    "prixUnitaire": 0
  },
  {
    "designation": "MICRO CUVETTE POUR COBASS",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "MICROALBUMINE",
    "categorie": "medicale",
    "classe": "Marqueur rénal",
    "prixUnitaire": 0
  },
  {
    "designation": "MICROLAX ADO GEL",
    "categorie": "medicale",
    "classe": "LAXATIFS",
    "prixUnitaire": 0
  },
  {
    "designation": "MICROLUT",
    "categorie": "medicale",
    "classe": "OXYTOCIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "MICROPAQUE ORAL 150ML",
    "categorie": "medicale",
    "classe": "PRODUIT DE CONTRASTE",
    "prixUnitaire": 0
  },
  {
    "designation": "MICROPAQUE ORAL 500ML",
    "categorie": "medicale",
    "classe": "PRODUIT DE CONTRASTE",
    "prixUnitaire": 0
  },
  {
    "designation": "MICROPLAQUE NAL",
    "categorie": "medicale",
    "classe": "PRODUIT DE CONTRASTE",
    "prixUnitaire": 0
  },
  {
    "designation": "MICROVICE",
    "categorie": "medicale",
    "classe": "PRODUIT DE CONTRASTE",
    "prixUnitaire": 0
  },
  {
    "designation": "MIFEDIA",
    "categorie": "medicale",
    "classe": "ANALOGUE DE PROSTAGLANDINE",
    "prixUnitaire": 0
  },
  {
    "designation": "MIFEPACK 200MG CPR B/1 + 200MCG CPR B/4",
    "categorie": "medicale",
    "classe": "UTEROTONIQUE",
    "prixUnitaire": 2735
  },
  {
    "designation": "MILIEU CHAPMAN",
    "categorie": "medicale",
    "classe": "Sélectif (Staphylocoques)",
    "prixUnitaire": 0
  },
  {
    "designation": "MILIEU CLED",
    "categorie": "medicale",
    "classe": "Urinaire",
    "prixUnitaire": 0
  },
  {
    "designation": "MILIEU COLOMBIA",
    "categorie": "medicale",
    "classe": "Enrichi",
    "prixUnitaire": 0
  },
  {
    "designation": "MILIEU DE TRANSPORT",
    "categorie": "medicale",
    "classe": "Transport d’échantillons",
    "prixUnitaire": 0
  },
  {
    "designation": "MILIEU EMB",
    "categorie": "medicale",
    "classe": "Différentiel",
    "prixUnitaire": 0
  },
  {
    "designation": "MILIEU HECTOEN",
    "categorie": "medicale",
    "classe": "Sélectif entérobactéries",
    "prixUnitaire": 0
  },
  {
    "designation": "MILIEU MAC CONKEY",
    "categorie": "medicale",
    "classe": "Sélectif/différentiel",
    "prixUnitaire": 0
  },
  {
    "designation": "MILIEU MUELLER HINTON",
    "categorie": "medicale",
    "classe": "Antibiogramme",
    "prixUnitaire": 0
  },
  {
    "designation": "MILIEU SABOURAUD",
    "categorie": "medicale",
    "classe": "Mycologie",
    "prixUnitaire": 0
  },
  {
    "designation": "MILIEU SABOURAUD CHLO",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "MILIEU SALMONELLA-SHIGELLA",
    "categorie": "medicale",
    "classe": "Sélectif",
    "prixUnitaire": 0
  },
  {
    "designation": "MILIEU SALMONELLA-SHIGHELLA",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "MILIEU SELENITE",
    "categorie": "medicale",
    "classe": "Enrichissement",
    "prixUnitaire": 0
  },
  {
    "designation": "MILIEU SS",
    "categorie": "medicale",
    "classe": "Sélectif (Salmonella-Shigella)",
    "prixUnitaire": 0
  },
  {
    "designation": "MINUTERIE",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "MIOREL 4MG CPR",
    "categorie": "medicale",
    "classe": "MYORELAXANT",
    "prixUnitaire": 0
  },
  {
    "designation": "MIOREL 4MG GELU B/12",
    "categorie": "medicale",
    "classe": "MYORELAXANT",
    "prixUnitaire": 0
  },
  {
    "designation": "MIOREL 4MG/2ML INJ IM",
    "categorie": "medicale",
    "classe": "MYORELAXANT",
    "prixUnitaire": 0
  },
  {
    "designation": "MISO-FEM",
    "categorie": "medicale",
    "classe": "ANALOGUE DE PROSTAGLANDINE",
    "prixUnitaire": 0
  },
  {
    "designation": "MORPHINE 10MG",
    "categorie": "medicale",
    "classe": "ANTALGIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "MOUSSE D'INCLUSION BLEU POUR CASSETTE",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "MOUSSE D’INCLUSION",
    "categorie": "medicale",
    "classe": "Support",
    "prixUnitaire": 0
  },
  {
    "designation": "MULTI CONTROL / MULTI SETRAL",
    "categorie": "medicale",
    "classe": "Contrôles qualité",
    "prixUnitaire": 0
  },
  {
    "designation": "MULTI CONTROL 20*5ML",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "MULTI ENZYME DEPROTEINIZER",
    "categorie": "medicale",
    "classe": "Réactif",
    "prixUnitaire": 0
  },
  {
    "designation": "MULTI ENZYME DEPROTEINZER 3*2ML",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "MULTI SETRAL 20*3ML",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "MYCOPLASME",
    "categorie": "medicale",
    "classe": "Test microbiologique",
    "prixUnitaire": 0
  },
  {
    "designation": "MYDRIATICUM 0.5% COLLYRE",
    "categorie": "medicale",
    "classe": "PRODUIT DE CONTRASTE",
    "prixUnitaire": 0
  },
  {
    "designation": "NACL INJ 10% 1G/10ML",
    "categorie": "medicale",
    "classe": "SUPPLEANT IONNIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "NEBULISATEUR",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 23000
  },
  {
    "designation": "NEUROBION CP",
    "categorie": "medicale",
    "classe": "MULTIVITAMINES",
    "prixUnitaire": 0
  },
  {
    "designation": "NIFEDIPINE 10MG 4CPR",
    "categorie": "medicale",
    "classe": "ANTIHYPPERTENSEURS",
    "prixUnitaire": 0
  },
  {
    "designation": "NIFEDIPINE 10MG CPR",
    "categorie": "medicale",
    "classe": "ANTIHYPPERTENSEURS",
    "prixUnitaire": 0
  },
  {
    "designation": "NITROFLURANT",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "NITROFURANTOIN*",
    "categorie": "medicale",
    "classe": "Antibiotique urinaire (nitrofuranes)",
    "prixUnitaire": 0
  },
  {
    "designation": "NORCUROM INJ",
    "categorie": "medicale",
    "classe": "MYORELAXANT",
    "prixUnitaire": 0
  },
  {
    "designation": "NORFLOXACINE",
    "categorie": "medicale",
    "classe": "Fluoroquinolone",
    "prixUnitaire": 0
  },
  {
    "designation": "NORMIX 200MG CPR",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "NOVALGIN INJ",
    "categorie": "medicale",
    "classe": "ANALGESIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "NT PRO-BNP",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "NT-proBNP",
    "categorie": "medicale",
    "classe": "Marqueur cardiaque",
    "prixUnitaire": 0
  },
  {
    "designation": "NUCLEO INJECTABLE",
    "categorie": "medicale",
    "classe": "NUCLEOTIDE NEUROPATHIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "NYLON (0)",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "NYLON (2)",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "NYLON (2/0) 30MMM",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "NYLON (3/0)",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "NYLON (5/0)",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "NYLON 1",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "NYLON 2/0 24MM",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "NYLON 4/0",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "NYSTATINE",
    "categorie": "medicale",
    "classe": "Antifongique (polyène)",
    "prixUnitaire": 0
  },
  {
    "designation": "OFLOCET CPR",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "OFLOCET INJ IV B/1",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "OFLOCINE PERF INJ 200MG/100",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES",
    "prixUnitaire": 4400
  },
  {
    "designation": "OFLODAZ CP",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES",
    "prixUnitaire": 4000
  },
  {
    "designation": "OFLOMAC IV INJ 200MG 100ML",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES",
    "prixUnitaire": 4240
  },
  {
    "designation": "OFLOXACINE",
    "categorie": "medicale",
    "classe": "Fluoroquinolone",
    "prixUnitaire": 0
  },
  {
    "designation": "OFUSIDIC 0.1% COLLYRE 5ML",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES",
    "prixUnitaire": 1991
  },
  {
    "designation": "OMEPRAZOLE 40 MG INJ",
    "categorie": "medicale",
    "classe": "ANTIULCEREUX IPP",
    "prixUnitaire": 0
  },
  {
    "designation": "OPATANOL 1MG/ML COLLYRE F/5ML",
    "categorie": "medicale",
    "classe": "ANTIGLAUCOMATEUX",
    "prixUnitaire": 3180
  },
  {
    "designation": "ORANGE G6",
    "categorie": "medicale",
    "classe": "Colorant",
    "prixUnitaire": 0
  },
  {
    "designation": "ORDONNANCIER",
    "categorie": "medicale",
    "classe": "Document médical",
    "prixUnitaire": 0
  },
  {
    "designation": "OROFER SIROP",
    "categorie": "medicale",
    "classe": "ANTIANEMIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "OROKEN 200MG CPR",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "OSE CALIBRE ( ENSEMENCEMENTS)",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "OSE CALIBREE",
    "categorie": "medicale",
    "classe": "Ensemencement",
    "prixUnitaire": 0
  },
  {
    "designation": "OSPAMOX 1G CPR",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "OXACILLINE",
    "categorie": "medicale",
    "classe": "Bêta-lactamine (pénicilline M, résistante à la pénicillinase)",
    "prixUnitaire": 0
  },
  {
    "designation": "OXYTOXINE 10UI INJ",
    "categorie": "medicale",
    "classe": "OXYTOCIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "OXYTOXINE 5UI INJ",
    "categorie": "medicale",
    "classe": "OXYTOCIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "PANDOM 40MG INJ",
    "categorie": "medicale",
    "classe": "ANTIULCEREUX",
    "prixUnitaire": 0
  },
  {
    "designation": "PANDOM D CPR",
    "categorie": "medicale",
    "classe": "ACCESSOIRES",
    "prixUnitaire": 0
  },
  {
    "designation": "PAPIER ENTETE",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "PAPIER ENTÊTE / LABO",
    "categorie": "medicale",
    "classe": "Fourniture",
    "prixUnitaire": 0
  },
  {
    "designation": "PAPIER IMPRIMANT",
    "categorie": "medicale",
    "classe": "Consommable",
    "prixUnitaire": 0
  },
  {
    "designation": "PAPIER LABO",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "PAPIER PH",
    "categorie": "medicale",
    "classe": "Test chimique",
    "prixUnitaire": 0
  },
  {
    "designation": "PARACETAMOL CP 500MG",
    "categorie": "medicale",
    "classe": "ANTALGIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "PARAFFINE",
    "categorie": "medicale",
    "classe": "Inclusion histologique",
    "prixUnitaire": 0
  },
  {
    "designation": "PARAVEN SP 10MG/ML SOL INJ",
    "categorie": "medicale",
    "classe": "ANTALGIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "PAREX 300MG",
    "categorie": "medicale",
    "classe": "ANTALGIQUE & ANTIPYRETIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "PATADIN 0,1%",
    "categorie": "medicale",
    "classe": "ANTISEPTIQUES",
    "prixUnitaire": 2249
  },
  {
    "designation": "PCT ( PROCALCITENINE)",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "PCT (Procalcitonine)",
    "categorie": "medicale",
    "classe": "Test immunologique",
    "prixUnitaire": 0
  },
  {
    "designation": "PENICILIN G INJ 5M UI",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "PENICILLINE",
    "categorie": "medicale",
    "classe": "Bêta-lactamine (pénicilline G/V)",
    "prixUnitaire": 0
  },
  {
    "designation": "PENIFLOW 30",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "PENIFLOW 35",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "PENIFLOW 40",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "PERFALGAN 0.5MG/ML INJ FL/50ML",
    "categorie": "medicale",
    "classe": "ANTALGIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "PERFALGAN 1G INJ 100ML",
    "categorie": "medicale",
    "classe": "ANTALGIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "PERFUSEUR",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "PERIDYS 1MG/ML SP F/200ML",
    "categorie": "medicale",
    "classe": "ANTIEMETIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "PH spermogramme",
    "categorie": "medicale",
    "classe": "Analyse spermatique",
    "prixUnitaire": 0
  },
  {
    "designation": "PHENOBARBITAL",
    "categorie": "medicale",
    "classe": "ANTICONVULSIVANT",
    "prixUnitaire": 0
  },
  {
    "designation": "PHOSPHATASE ALCALIN",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "PHOSPHATASE ALCALINE",
    "categorie": "medicale",
    "classe": "Enzyme",
    "prixUnitaire": 0
  },
  {
    "designation": "PHOSPHORE",
    "categorie": "medicale",
    "classe": "Électrolyte",
    "prixUnitaire": 0
  },
  {
    "designation": "PIPETTES",
    "categorie": "medicale",
    "classe": "Matériel",
    "prixUnitaire": 0
  },
  {
    "designation": "PISETTE",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "PISSETTE",
    "categorie": "medicale",
    "classe": "Matériel",
    "prixUnitaire": 0
  },
  {
    "designation": "PLAQUE DE LITHIUM",
    "categorie": "medicale",
    "classe": "Réactif spécifique",
    "prixUnitaire": 0
  },
  {
    "designation": "PLAQUE DPS",
    "categorie": "medicale",
    "classe": "ACCESSOIRES",
    "prixUnitaire": 0
  },
  {
    "designation": "POCHE A SANG 500ML",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "POCHE A URINE ADULTE",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "POCHE A URINE PED",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "POCHE A URINE PEDIATRIQUE",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "polyfresh collyre",
    "categorie": "medicale",
    "classe": "LUBRIFIANT OCCULAIRE",
    "prixUnitaire": 2588
  },
  {
    "designation": "POLYFRESH EXTRA COLLYRE UNID/0.4ML",
    "categorie": "medicale",
    "classe": "LUBRIFIANT OCCULAIRE",
    "prixUnitaire": 3500
  },
  {
    "designation": "POLYGYNAX OVU B/12",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUE+MYCOSIQUES+ANTIINFLAMATOIRE",
    "prixUnitaire": 0
  },
  {
    "designation": "POLYGYNAX OVU B/6",
    "categorie": "medicale",
    "classe": "ANTIFONGIQUES ET MYCOSIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "POLYVITEX",
    "categorie": "medicale",
    "classe": "Supplément nutritif",
    "prixUnitaire": 0
  },
  {
    "designation": "POPOTO",
    "categorie": "medicale",
    "classe": "MEDECINE ESTHETIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "PORTE EMBOUT / PORTOIR",
    "categorie": "medicale",
    "classe": "Support",
    "prixUnitaire": 0
  },
  {
    "designation": "PORTEUR POUR EMBOUT",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "PORTOIR EMBOUT BLEU",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "PORTOIR EMBOUT JAUNE",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "POT A SELLE",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "POT A URINE",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "POTASSIUM",
    "categorie": "medicale",
    "classe": "Électrolyte",
    "prixUnitaire": 0
  },
  {
    "designation": "POTS (urine, selles, pédiatriques)",
    "categorie": "medicale",
    "classe": "Recueil",
    "prixUnitaire": 0
  },
  {
    "designation": "POTS / RÉCIPIENTS",
    "categorie": "medicale",
    "classe": "Recueil",
    "prixUnitaire": 0
  },
  {
    "designation": "PRECISE NORME",
    "categorie": "medicale",
    "classe": "Contrôle qualité",
    "prixUnitaire": 0
  },
  {
    "designation": "PRESERVATIFS",
    "categorie": "medicale",
    "classe": "ACCESSOIRES",
    "prixUnitaire": 0
  },
  {
    "designation": "PRETREATMENT",
    "categorie": "medicale",
    "classe": "Réactif",
    "prixUnitaire": 0
  },
  {
    "designation": "PRINCI B FORT",
    "categorie": "medicale",
    "classe": "MULTIVITAMINES",
    "prixUnitaire": 0
  },
  {
    "designation": "PRINCI B FORT COMP",
    "categorie": "medicale",
    "classe": "MULTIVITAMINES",
    "prixUnitaire": 4185
  },
  {
    "designation": "PROBE CLEANER",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "PROFENID 100MG CP B/30",
    "categorie": "medicale",
    "classe": "ANTIINFLAMMATOIRES",
    "prixUnitaire": 0
  },
  {
    "designation": "PROFENID 100MG INJ",
    "categorie": "medicale",
    "classe": "ANTIINFLAMMATOIRES",
    "prixUnitaire": 0
  },
  {
    "designation": "PROGESTERONE RET",
    "categorie": "medicale",
    "classe": "HORMONES",
    "prixUnitaire": 0
  },
  {
    "designation": "PROKEFEN 100mg",
    "categorie": "medicale",
    "classe": "ANTIINFLAMMATOIRES",
    "prixUnitaire": 1600
  },
  {
    "designation": "PROLACTINE",
    "categorie": "medicale",
    "classe": "Hormone",
    "prixUnitaire": 0
  },
  {
    "designation": "PROLONGATEUR",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "PROPOFOL",
    "categorie": "medicale",
    "classe": "HYPNOTIQUES+SEDATIF",
    "prixUnitaire": 0
  },
  {
    "designation": "PROPRANOLOL EG",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "PROSTIGMINE 05MG/1ML INJ",
    "categorie": "medicale",
    "classe": "ANTICHOLINESTERASIQUE ANESTESIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "PROTEINE 24H",
    "categorie": "medicale",
    "classe": "Analyse urinaire",
    "prixUnitaire": 0
  },
  {
    "designation": "PROTEINE TOTALE",
    "categorie": "medicale",
    "classe": "Paramètre biochimique",
    "prixUnitaire": 0
  },
  {
    "designation": "PSA / TPSA",
    "categorie": "medicale",
    "classe": "Marqueur tumoral (prostate)",
    "prixUnitaire": 0
  },
  {
    "designation": "PSAT",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "PTS",
    "categorie": "medicale",
    "classe": "Appareil de mesure",
    "prixUnitaire": 0
  },
  {
    "designation": "QUININE 300 CPR",
    "categorie": "medicale",
    "classe": "ANTIPALUDIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "QUININE 600 MG INJ",
    "categorie": "medicale",
    "classe": "ANTIPALUDIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "RABELOC INJ",
    "categorie": "medicale",
    "classe": "ANTIULCEREUX",
    "prixUnitaire": 0
  },
  {
    "designation": "RANITIDINE INJ 50MG/2ML",
    "categorie": "medicale",
    "classe": "ANTIULCEREUX",
    "prixUnitaire": 0
  },
  {
    "designation": "REACTIFS HEMOLYSE HbA1C",
    "categorie": "medicale",
    "classe": "Réactif",
    "prixUnitaire": 0
  },
  {
    "designation": "RINGER LACTATE FL/500ML",
    "categorie": "medicale",
    "classe": "SOLUTES",
    "prixUnitaire": 0
  },
  {
    "designation": "RIPAXIL 750MG INJ",
    "categorie": "medicale",
    "classe": "ANTIBIOTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "ROBINET A 02 VOIX",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 800
  },
  {
    "designation": "ROBINET A 03 VOIES",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "ROSUVASTATIN PMS 10 MG",
    "categorie": "medicale",
    "classe": "HYPOLIPEMIANT",
    "prixUnitaire": 0
  },
  {
    "designation": "ROSUVASTATIN PMS 20MG",
    "categorie": "medicale",
    "classe": "HYPOLIPEMIANT",
    "prixUnitaire": 0
  },
  {
    "designation": "ROSUVASTATIN PMS 5MG",
    "categorie": "medicale",
    "classe": "HYPOLIPEMIANT",
    "prixUnitaire": 0
  },
  {
    "designation": "RPR",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "RPR VDR",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "RUB IGG",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "RUB IgG / IgM",
    "categorie": "medicale",
    "classe": "Sérologie rubéole",
    "prixUnitaire": 0
  },
  {
    "designation": "RUB IGM",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "RUB VIDAS",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "SALBUTAMOL INJ",
    "categorie": "medicale",
    "classe": "UTERORELAXANT",
    "prixUnitaire": 0
  },
  {
    "designation": "SALE 0.9 % 500 CC",
    "categorie": "medicale",
    "classe": "SOLUTES",
    "prixUnitaire": 0
  },
  {
    "designation": "SALE 3000CC",
    "categorie": "medicale",
    "classe": "SOLUTES",
    "prixUnitaire": 0
  },
  {
    "designation": "SAMPLE CUP",
    "categorie": "medicale",
    "classe": "Consommable",
    "prixUnitaire": 0
  },
  {
    "designation": "SAMPLE CUP C111",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "SANG DE CONTRÔLE",
    "categorie": "medicale",
    "classe": "Contrôle qualité",
    "prixUnitaire": 0
  },
  {
    "designation": "SAT INJ 1500 I.U.",
    "categorie": "medicale",
    "classe": "ANTITETANIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "SEL DE REHYDRATATION +ZINC",
    "categorie": "medicale",
    "classe": "ANTI DIARRHEIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "SERINGUE 10CC",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "SERINGUE 10ML",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SERINGUE 1ML",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "SERINGUE 20CC 18G",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "SERINGUE 20CC 21G",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "SERINGUE 2ML",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "SERINGUE 50CC BT C",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "SERINGUE 5CC",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "SERINGUE 5ML",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SERINGUE 60CC BTE S",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "SERINGUE 60CC BTE U",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "SERINGUE 60ML",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SERINGUE A INSULINE",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SERINGUES (toutes tailles)",
    "categorie": "medicale",
    "classe": "Dispositif médical",
    "prixUnitaire": 0
  },
  {
    "designation": "SG 10% 500 CC",
    "categorie": "medicale",
    "classe": "SOLUTES",
    "prixUnitaire": 0
  },
  {
    "designation": "SG 5% 500 CC",
    "categorie": "medicale",
    "classe": "SOLUTES",
    "prixUnitaire": 0
  },
  {
    "designation": "SODIUM",
    "categorie": "medicale",
    "classe": "Électrolyte",
    "prixUnitaire": 0
  },
  {
    "designation": "SOINS",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SOINS EP",
    "categorie": "medicale",
    "classe": "ACTE MEDICALE",
    "prixUnitaire": 0
  },
  {
    "designation": "SOLCER 40MG INJ",
    "categorie": "medicale",
    "classe": "ANTIULCEREUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SOLUMEDROL 120MG/2ML INJ B/1",
    "categorie": "medicale",
    "classe": "CORTICOIDES",
    "prixUnitaire": 0
  },
  {
    "designation": "SOLUMEDROL 40MG/2ML INJ B/1",
    "categorie": "medicale",
    "classe": "CORTICOIDES",
    "prixUnitaire": 0
  },
  {
    "designation": "SOLUTION DE GIEMSA RAPIDE",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "SOLUTION DE MAY GREENWALD",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "SONDE D'ASPIRATION N10",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SONDE D'ASPIRATION N12",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SONDE D'ASPIRATION N14",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SONDE D'ASPIRATION N6",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SONDE D'ASPIRATION N8",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SONDE DE GAVAGE",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SONDE ENDONASALE DOUBLE BALLONET",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SONDE ENDOTRACHEAL N.4.5",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SONDE ENDOTRACHEALA N4",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SONDE ENDOTRACHEALA N6",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SONDE ENDOTRACHEALA N6.5",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SONDE ENDOTRACHEALA N7",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SONDE ENDOTRACHEALA N7.5",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SONDE JJ",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SONDE NAZO-GASTRIQUE N05",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SONDE NAZO-GASTRIQUE N06",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SONDE NAZO-GASTRIQUE N08",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SONDE NAZO-GASTRIQUE N12",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SONDE NAZO-GASTRIQUE N13",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SONDE NAZO-GASTRIQUE N14",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SONDE NAZO-GASTRIQUE N15",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SONDE NAZO-GASTRIQUE N16",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SONDE NAZO-GASTRIQUE N18",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SONDE URINAIRE A 3VOIES",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SONDE URINAIRE FOLEY 1V N10",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SONDE URINAIRE FOLEY 1V N12",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SONDE URINAIRE FOLEY 1V N14",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SONDE URINAIRE FOLEY 1V N16",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SONDE URINAIRE FOLEY 1V N18",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SONDE URINAIRE FOLEY 1V N20",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SONDE URINAIRE FOLEY 1V N6",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SONDE URINAIRE FOLEY 1V N8",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SONDE URINAIRE N16",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SONDE URINAIRE SILICONNE A 2 VOIES / 3 VOIES",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 20000
  },
  {
    "designation": "SONDE VESICALE",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SPARADRAP",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SPASFON INJ AMP/4ML",
    "categorie": "medicale",
    "classe": "ANTISPASMODIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "SPASFON SUPPO B/10",
    "categorie": "medicale",
    "classe": "ANTISPASMODIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "SPASMO APOTEL INJ",
    "categorie": "medicale",
    "classe": "ANTISPASMODIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "SPASMO APOTEL SUPPO",
    "categorie": "medicale",
    "classe": "ANTISPASMODIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "SPECULUM (M, large)",
    "categorie": "medicale",
    "classe": "Dispositif médical",
    "prixUnitaire": 0
  },
  {
    "designation": "SPECULUM LARGE",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "SPECULUM M",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "STREPTOMYCINE",
    "categorie": "medicale",
    "classe": "Aminoside (aminoglycoside)",
    "prixUnitaire": 0
  },
  {
    "designation": "sucrafil o gel fl/100l",
    "categorie": "medicale",
    "classe": "ANTIACIDES",
    "prixUnitaire": 1155
  },
  {
    "designation": "SULFAMETHANIUM",
    "categorie": "medicale",
    "classe": "MYORELAXANT PERIPHERIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "SULFATE DE MAGNESIUM AMP/20ML",
    "categorie": "medicale",
    "classe": "SUPPLEANT IONNIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "SURGICEL",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "SUXAMETHONIUM",
    "categorie": "medicale",
    "classe": "MYORELAXANT PERIPHERIQUE",
    "prixUnitaire": 2500
  },
  {
    "designation": "SYNTO 10 UI INJ",
    "categorie": "medicale",
    "classe": "UTEROTONIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "T3",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "T3 / T4",
    "categorie": "medicale",
    "classe": "Hormones thyroïdiennes",
    "prixUnitaire": 0
  },
  {
    "designation": "T4",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "TAMPON POUR LAVAGE",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "TAMPON TRIS / TAMPON LAVAGE",
    "categorie": "medicale",
    "classe": "Solution tampon",
    "prixUnitaire": 0
  },
  {
    "designation": "TAMPON TRIS-GLYCEMIE",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "TCK",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "TDR",
    "categorie": "medicale",
    "classe": "Test diagnostic rapide",
    "prixUnitaire": 0
  },
  {
    "designation": "TDR PALU",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 1200
  },
  {
    "designation": "TELEBRIX 35 INJ 100ML",
    "categorie": "medicale",
    "classe": "PRODUIT DE CONTRASTE",
    "prixUnitaire": 0
  },
  {
    "designation": "TELEBRIX 35 INJ 50ML",
    "categorie": "medicale",
    "classe": "PRODUIT DE CONTRASTE",
    "prixUnitaire": 0
  },
  {
    "designation": "TEMERIT DUO 5/12.5MG",
    "categorie": "medicale",
    "classe": "ANTIHYPPERTENSEURS",
    "prixUnitaire": 0
  },
  {
    "designation": "TEMERIT DUO 5/25MG",
    "categorie": "medicale",
    "classe": "ANTIHYPPERTENSEURS",
    "prixUnitaire": 0
  },
  {
    "designation": "TEMERIT5MG",
    "categorie": "medicale",
    "classe": "ANTIHYPPERTENSEURS",
    "prixUnitaire": 0
  },
  {
    "designation": "TENSOPLAST",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "TESTOSTERONE",
    "categorie": "medicale",
    "classe": "Hormone",
    "prixUnitaire": 0
  },
  {
    "designation": "TGH3",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "THERMOMETRE",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "TOBRAMYCINE",
    "categorie": "medicale",
    "classe": "Aminoside (aminoglycoside)",
    "prixUnitaire": 0
  },
  {
    "designation": "TOT'HEMA AMP BUV B/20",
    "categorie": "medicale",
    "classe": "ANTIANEMIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "TOXO IGG",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "TOXO IgG / IgM",
    "categorie": "medicale",
    "classe": "Sérologie toxoplasmose",
    "prixUnitaire": 0
  },
  {
    "designation": "TOXO IGM",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "TP",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "TP / TCK",
    "categorie": "medicale",
    "classe": "Tests de coagulation",
    "prixUnitaire": 0
  },
  {
    "designation": "TPSA  (VIDAS)",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "TRABAR-100MG INJ",
    "categorie": "medicale",
    "classe": "ANALGESIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "TRAMACETAL 37.5MG/325MG",
    "categorie": "medicale",
    "classe": "ANTALGIQUE & ANTIPYRETIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "TRAMADOL DENK 50MG CP",
    "categorie": "medicale",
    "classe": "ANTALGIQUE & ANTIPYRETIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "TRAMAFIL 100MG INJ",
    "categorie": "medicale",
    "classe": "ANTALGIQUE & ANTIPYRETIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "TRANSFUSEUR",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "TRIGLYCERIDE",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "TRIGLYCERIDES",
    "categorie": "medicale",
    "classe": "Lipides",
    "prixUnitaire": 0
  },
  {
    "designation": "TRILINE HIV",
    "categorie": "medicale",
    "classe": "Test VIH",
    "prixUnitaire": 0
  },
  {
    "designation": "TRILINE HIV *2",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "TRILLERG COLLYRE",
    "categorie": "medicale",
    "classe": "ANTIHISTAMINIQUES",
    "prixUnitaire": 1655
  },
  {
    "designation": "TRITAZIDE 10MG/12.5MG CP",
    "categorie": "medicale",
    "classe": "TONICARDIAQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "TRITAZIDE 5MG/12.5MG",
    "categorie": "medicale",
    "classe": "TONICARDIAQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "TRITAZIDE 5MG/25MG CP",
    "categorie": "medicale",
    "classe": "TONICARDIAQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "TROFOCARD 121.5MG SACH B/20",
    "categorie": "medicale",
    "classe": "MULTIVITAMINES",
    "prixUnitaire": 0
  },
  {
    "designation": "TROPONINE",
    "categorie": "medicale",
    "classe": "Marqueur cardiaque",
    "prixUnitaire": 0
  },
  {
    "designation": "TROYCAL 500",
    "categorie": "medicale",
    "classe": "MULTIVITAMINES",
    "prixUnitaire": 0
  },
  {
    "designation": "TROYFENAC MR",
    "categorie": "medicale",
    "classe": "MULTIVITAMINES",
    "prixUnitaire": 0
  },
  {
    "designation": "TSH",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "TSH / TSHus",
    "categorie": "medicale",
    "classe": "Hormone thyroïdienne",
    "prixUnitaire": 0
  },
  {
    "designation": "TSHUS",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "TUBE AVS",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "TUBE BLEU",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "TUBE CASSABLE",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "TUBE GRIS",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "TUBE NOIR",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "TUBE POUR TP/TCK",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "TUBE ROUGE",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "TUBE SS BOUCHON",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "TUBE VERT",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "TUBE VIOLET",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "TUBES (bleu, rouge, violet, etc.)",
    "categorie": "medicale",
    "classe": "Prélèvement",
    "prixUnitaire": 0
  },
  {
    "designation": "TULLE GRAS",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "ULCAR 1G SUSP BUV",
    "categorie": "medicale",
    "classe": "ANTIACIDES",
    "prixUnitaire": 0
  },
  {
    "designation": "URBANYL",
    "categorie": "medicale",
    "classe": "BENZOTHIAZEPINES",
    "prixUnitaire": 0
  },
  {
    "designation": "UREE",
    "categorie": "medicale",
    "classe": "Fonction rénale",
    "prixUnitaire": 0
  },
  {
    "designation": "UREE INDOLE (KOVACS)",
    "categorie": "medicale",
    "classe": "Test biochimique",
    "prixUnitaire": 0
  },
  {
    "designation": "UREE INDOLE -KOVACS",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "URITEST",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "URITEST / COPROSYSTEM",
    "categorie": "medicale",
    "classe": "Kits diagnostic",
    "prixUnitaire": 0
  },
  {
    "designation": "UVESTEROL SP F/20ML",
    "categorie": "medicale",
    "classe": "MULTIVITAMINES",
    "prixUnitaire": 0
  },
  {
    "designation": "VALIUM 10MG INJ",
    "categorie": "medicale",
    "classe": "NEUROLEPTIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "VANCOMYCINE",
    "categorie": "medicale",
    "classe": "Glycopeptide",
    "prixUnitaire": 0
  },
  {
    "designation": "VCN",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "VCNT SUPPLEMENT HINEDIA",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "VCNT supplément",
    "categorie": "medicale",
    "classe": "Supplément milieu",
    "prixUnitaire": 0
  },
  {
    "designation": "VDRL / RPR",
    "categorie": "medicale",
    "classe": "Sérologie syphilis",
    "prixUnitaire": 0
  },
  {
    "designation": "VECURONIUM BROMIDE 4MG INJ",
    "categorie": "medicale",
    "classe": "MYORELAXANT PERIPHERIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "VENTOLINE SPRAY",
    "categorie": "medicale",
    "classe": "ANTIASTHMATIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "VICRYL 0 AIG RONDE",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "VICRYL 0 AIG T 35MM",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "VICRYL 1",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "VICRYL 2",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "VICRYL 2 AIG R 40 MM",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "VICRYL 2/0 AIG R",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "VICRYL 2/0 AIG TRGL",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "VICRYL 3/0 22 MM",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "VICRYL 3/0 26 MM",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "VICRYL 3/0 75 CM",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "VICRYL 3/0 AIG R 20 MM",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "VICRYL 3/0 AIG R 35 MMM",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "VICRYL 4/0",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "VIOLET DE GENTIAN",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "VIOLET DE GENTIANE",
    "categorie": "medicale",
    "classe": "Colorant",
    "prixUnitaire": 0
  },
  {
    "designation": "VIT B COMPLEX INJ",
    "categorie": "medicale",
    "classe": "MULTIVITAMINES",
    "prixUnitaire": 0
  },
  {
    "designation": "VIT B DENK CP B/10",
    "categorie": "medicale",
    "classe": "MULTIVITAMINES",
    "prixUnitaire": 0
  },
  {
    "designation": "VIT B DENK CP B/100",
    "categorie": "medicale",
    "classe": "MULTIVITAMINES",
    "prixUnitaire": 0
  },
  {
    "designation": "VIT K 1 MG INJ",
    "categorie": "medicale",
    "classe": "ANTIHEMORRAGIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "VITAFER SIROP",
    "categorie": "medicale",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "VITAMINE C INJ 500mg/5ml",
    "categorie": "medicale",
    "classe": "MULTIVITAMINES",
    "prixUnitaire": 200
  },
  {
    "designation": "VITAMINE GRAUSH SUPPLEMENT",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "VOGALENE 10MG/1ML INJ",
    "categorie": "medicale",
    "classe": "ANTIEMETIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "WHITE DIFF",
    "categorie": "medicale",
    "classe": "Réactif hématologie",
    "prixUnitaire": 0
  },
  {
    "designation": "WIDAL",
    "categorie": "medicale",
    "classe": "Antibiotique / Molécule",
    "prixUnitaire": 0
  },
  {
    "designation": "XENAMEX 500MG/5ML INJ",
    "categorie": "medicale",
    "classe": "Médicament / Soins",
    "prixUnitaire": 963
  },
  {
    "designation": "XYKAA EXTEND 1000MG",
    "categorie": "medicale",
    "classe": "ANTALGIQUES",
    "prixUnitaire": 0
  },
  {
    "designation": "XYLENE",
    "categorie": "medicale",
    "classe": "Solvant histologique",
    "prixUnitaire": 0
  },
  {
    "designation": "XYLO.NAPHAZOLINER",
    "categorie": "medicale",
    "classe": "ANESTHESIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "XYLO.NAPHAZOLINER 2",
    "categorie": "medicale",
    "classe": "ANESTHESIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "XYLOCAINE 2% INJECTABLE",
    "categorie": "medicale",
    "classe": "ANESTHESIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "YOYO",
    "categorie": "medicale",
    "classe": "MEDECINE ESTHETIQUE",
    "prixUnitaire": 0
  },
  {
    "designation": "ZINC",
    "categorie": "medicale",
    "classe": "MULTIVITAMINES",
    "prixUnitaire": 0
  },
  {
    "designation": "ZINNIA-F CPR",
    "categorie": "medicale",
    "classe": "CONTRACEPTIF",
    "prixUnitaire": 0
  },
  {
    "designation": "Élément",
    "categorie": "medicale",
    "classe": "Classe / catégorie",
    "prixUnitaire": 0
  },
  {
    "designation": "γGT (8GT)",
    "categorie": "medicale",
    "classe": "Enzyme hépatique",
    "prixUnitaire": 0
  },
  {
    "designation": "Bandelettes Urinaires 10 Paramètres (Fl/100)",
    "categorie": "reactifs_labo",
    "classe": "Biochimie Urinaire",
    "prixUnitaire": 8500
  },
  {
    "designation": "Bio-Rad D-10 Pack Réactifs HbA1c",
    "categorie": "reactifs_labo",
    "classe": "Hématologie / Diabète",
    "prixUnitaire": 185000
  },
  {
    "designation": "Colorant Giemsa Solution 500ml",
    "categorie": "reactifs_labo",
    "classe": "Colorants Hématologie",
    "prixUnitaire": 9500
  },
  {
    "designation": "DACRYOSERUM 5ml/20UN",
    "categorie": "reactifs_labo",
    "classe": "ANTISEPTIQUES",
    "prixUnitaire": 2305
  },
  {
    "designation": "Diluant Cellpack Automate NFS 20L",
    "categorie": "reactifs_labo",
    "classe": "Automate Hématologie",
    "prixUnitaire": 45000
  },
  {
    "designation": "KIT LABO",
    "categorie": "reactifs_labo",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "Kit Réactifs Groupage Sanguin ABO-Rh",
    "categorie": "reactifs_labo",
    "classe": "Immuno-Hématologie",
    "prixUnitaire": 32000
  },
  {
    "designation": "LAME DE BISTOURI N10",
    "categorie": "reactifs_labo",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "LAME DE BISTOURI N11",
    "categorie": "reactifs_labo",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "LAME DE BISTOURI N23",
    "categorie": "reactifs_labo",
    "classe": "CONSOMMABLES MEDICAUX",
    "prixUnitaire": 0
  },
  {
    "designation": "Lamelles couvre-objet 22x22mm (B/100)",
    "categorie": "reactifs_labo",
    "classe": "Consommables Labo",
    "prixUnitaire": 1800
  },
  {
    "designation": "Lames porte-objet 26x76mm (B/50)",
    "categorie": "reactifs_labo",
    "classe": "Consommables Labo",
    "prixUnitaire": 2500
  },
  {
    "designation": "Lyse Stromatolyser 500ml Automate",
    "categorie": "reactifs_labo",
    "classe": "Automate Hématologie",
    "prixUnitaire": 38000
  },
  {
    "designation": "Nettoyant Cellclean 50ml Automate",
    "categorie": "reactifs_labo",
    "classe": "Automate Hématologie",
    "prixUnitaire": 28000
  },
  {
    "designation": "Pointes micropipettes bleues 100-1000µL (Paq/1000)",
    "categorie": "reactifs_labo",
    "classe": "Consommables Labo",
    "prixUnitaire": 7500
  },
  {
    "designation": "Pointes micropipettes jaunes 10-100µL (Paq/1000)",
    "categorie": "reactifs_labo",
    "classe": "Consommables Labo",
    "prixUnitaire": 6000
  },
  {
    "designation": "Réactif Créatinine Jaffe Cinétique 4x100ml",
    "categorie": "reactifs_labo",
    "classe": "Biochimie Clinique",
    "prixUnitaire": 21000
  },
  {
    "designation": "Réactif Glycémie Glucose PAP 4x100ml",
    "categorie": "reactifs_labo",
    "classe": "Biochimie Clinique",
    "prixUnitaire": 22000
  },
  {
    "designation": "Réactif Transaminases ALAT/GPT 4x50ml",
    "categorie": "reactifs_labo",
    "classe": "Biochimie Clinique",
    "prixUnitaire": 26000
  },
  {
    "designation": "Réactif Transaminases ASAT/GOT 4x50ml",
    "categorie": "reactifs_labo",
    "classe": "Biochimie Clinique",
    "prixUnitaire": 26000
  },
  {
    "designation": "Réactif Urée UV Cinétique 4x50ml",
    "categorie": "reactifs_labo",
    "classe": "Biochimie Clinique",
    "prixUnitaire": 24000
  },
  {
    "designation": "SPECULUM",
    "categorie": "reactifs_labo",
    "classe": "CONSOMMABLES LABO",
    "prixUnitaire": 0
  },
  {
    "designation": "Test Rapide Hépatite B HBsAg (B/50)",
    "categorie": "reactifs_labo",
    "classe": "Sérologie",
    "prixUnitaire": 18000
  },
  {
    "designation": "Test Rapide Hépatite C HCV (B/50)",
    "categorie": "reactifs_labo",
    "classe": "Sérologie",
    "prixUnitaire": 22000
  },
  {
    "designation": "Test Rapide Paludisme Ag Pf/Pan (B/25)",
    "categorie": "reactifs_labo",
    "classe": "Parasitologie",
    "prixUnitaire": 12500
  },
  {
    "designation": "Test Rapide Syphilis TPHA/VDRL (B/50)",
    "categorie": "reactifs_labo",
    "classe": "Sérologie",
    "prixUnitaire": 15000
  },
  {
    "designation": "Test Rapide VIH 1/2 Determine (B/100)",
    "categorie": "reactifs_labo",
    "classe": "Sérologie / RDT",
    "prixUnitaire": 25000
  },
  {
    "designation": "Tubes Citrate de Sodium Bleu 3ml (B/100)",
    "categorie": "reactifs_labo",
    "classe": "Prélèvement Hémostase",
    "prixUnitaire": 7000
  },
  {
    "designation": "Tubes EDTA K3 4ml Violet (B/100)",
    "categorie": "reactifs_labo",
    "classe": "Prélèvement Hématologie",
    "prixUnitaire": 6500
  },
  {
    "designation": "Tubes Héparine Lithium Vert 4ml (B/100)",
    "categorie": "reactifs_labo",
    "classe": "Prélèvement Ionogramme",
    "prixUnitaire": 7500
  },
  {
    "designation": "Tubes Secs avec Activateur Rouge 5ml (B/100)",
    "categorie": "reactifs_labo",
    "classe": "Prélèvement Biochimie",
    "prixUnitaire": 6500
  }
];

/**
 * Normalise un texte (minuscules, sans accents) pour un filtrage tolérant et prédictif.
 */
export function normaliserTexte(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Recherche prédictive dans le catalogue selon le principe des DataForms.
 * Si query est vide, renvoie les suggestions de la catégorie triées par ordre alphabétique.
 * Sinon, filtre par pertinence (commence par, puis contient).
 */
export function filtrerCatalogue(
  categorie?: 'medicale' | 'reactifs_labo' | 'fourniture',
  query: string = '',
  limite: number = 25
): ArticleCatalogue[] {
  const q = normaliserTexte(query);
  
  // 1. Filtrer par catégorie si spécifiée
  let liste = categorie
    ? CATALOGUE_ARTICLES.filter((a) => a.categorie === categorie)
    : CATALOGUE_ARTICLES;

  if (!q) {
    return liste.slice(0, limite);
  }

  // 2. Filtrer avec score de pertinence
  const avecScore = liste
    .map((item) => {
      const nom = normaliserTexte(item.designation);
      const classe = item.classe ? normaliserTexte(item.classe) : '';
      let score = -1;

      if (nom.startsWith(q)) {
        score = 100 - (nom.length - q.length);
      } else if (nom.includes(' ' + q)) {
        score = 80 - (nom.length - q.length);
      } else if (nom.includes(q)) {
        score = 50 - (nom.length - q.length);
      } else if (classe.includes(q)) {
        score = 30;
      }

      return { item, score };
    })
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score || a.item.designation.localeCompare(b.item.designation));

  return avecScore.slice(0, limite).map((e) => e.item);
}
