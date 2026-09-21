# -*- coding: utf-8 -*-
"""Rapport de semaine : markdown -> HTML A4 (charte documents) -> PDF via design/print-file.mjs.
Usage : python design/rapport-pdf.py rapport-de-la-semaine-du-14.md
Produit rapport-de-la-semaine-du-14.html (dans design/) et rapport-de-la-semaine-du-14.pdf (à la racine)."""
import sys, os, re, subprocess, markdown

src = sys.argv[1]
racine = os.path.dirname(os.path.abspath(src))
nom = os.path.splitext(os.path.basename(src))[0]
texte = open(src, encoding="utf-8").read()

# Le bloc « Projet / Période / Rédigé par » devient un en-tête de document.
m = re.match(r"# (.+?)\n\n\*\*Projet\*\* : (.+?)\n\*\*Période couverte\*\* : (.+?)\n\*\*Rédigé par\*\* : (.+?)\n\n---\n", texte, re.S)
titre, projet, periode, auteur = m.groups()
corps = texte[m.end():]
html_corps = markdown.markdown(corps, extensions=["tables"])

page = f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>{titre}</title>
<style>
  @page {{ size: A4; margin: 15mm 14mm 16mm; }}
  :root {{ --sceau:#0077b6; --nuit:#03045e; --encre:#0b132b; --douce:#334155; --pale:#64748b; --filet:#8a968d; --bande:#eaf3f8; --brume:#caf0f8; }}
  body {{ margin:0; font-family:"IBM Plex Sans","Segoe UI",system-ui,sans-serif; font-size:10pt; line-height:1.5; color:var(--encre); }}
  header {{ display:flex; justify-content:space-between; align-items:flex-start; gap:10mm; padding-bottom:3mm; margin-bottom:5mm; border-bottom:2.5pt solid var(--sceau); }}
  header .raison {{ font-size:13pt; font-weight:700; color:var(--sceau); }}
  header .coord {{ font-size:8pt; color:var(--pale); margin-top:1mm; max-width:95mm; }}
  header .nature {{ text-align:right; font-size:12pt; font-weight:700; }}
  header .nature span {{ display:block; font-size:8.5pt; font-weight:400; color:var(--pale); }}
  h2 {{ font-size:11pt; margin:6mm 0 2mm; color:var(--nuit); text-transform:uppercase; letter-spacing:.04em; border-left:3pt solid var(--sceau); padding-left:2.5mm; break-after:avoid; }}
  h3 {{ font-size:10pt; margin:4mm 0 1.5mm; color:var(--sceau); break-after:avoid; }}
  p {{ margin:0 0 2.5mm; }}
  ul, ol {{ margin:0 0 2.5mm; padding-left:5mm; }}
  li {{ margin-bottom:1mm; }}
  hr {{ display:none; }}
  table {{ width:100%; border-collapse:collapse; font-size:8.8pt; margin:1.5mm 0 3.5mm; break-inside:auto; }}
  th, td {{ border:.5pt solid var(--filet); padding:1.4mm 2mm; vertical-align:top; text-align:left; }}
  thead th {{ background:var(--bande); font-size:8pt; }}
  tr {{ break-inside:avoid; }}
  code {{ font-family:"IBM Plex Mono",Consolas,monospace; font-size:8.5pt; background:var(--bande); padding:0 1.2mm; border-radius:3px; }}
  strong {{ color:var(--nuit); }}
  footer {{ position:fixed; bottom:-10mm; left:0; right:0; display:flex; justify-content:space-between; font-size:7.5pt; color:var(--pale); }}
</style></head><body>
<header>
  <div><div class="raison">POITIERS COWORKING</div><div class="coord">{projet}</div></div>
  <div class="nature">{titre.replace('Rapport de la semaine', 'RAPPORT DE LA SEMAINE').upper()}<span>{periode}</span><span>Rédigé par {auteur}</span></div>
</header>
{html_corps}
<footer><span>POITIERS COWORKING · {titre}</span><span>{auteur}</span></footer>
</body></html>"""

html_path = os.path.join(racine, "design", nom + ".html")
open(html_path, "w", encoding="utf-8").write(page)
pdf_path = os.path.join(racine, nom + ".pdf")
subprocess.run(["node", os.path.join(racine, "design", "print-file.mjs"), html_path, pdf_path], check=True, env={**os.environ, "MSYS_NO_PATHCONV": "1"})
print(pdf_path)
