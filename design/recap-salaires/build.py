# -*- coding: utf-8 -*-
"""Génère les artboards .dc.html du canvas « Récapitulatif salaires ».

Jetons repris de app/src/styles/theme.css (charte Ocean Breeze) et des
composants app/src/components/{ui,app}. Tout est statique : maquettes.
"""
import json, os

OUT = os.path.dirname(os.path.abspath(__file__))

# --- Jetons (theme.css) -----------------------------------------------------
NUIT, PROFOND, CERULEEN, CIEL, BRUME = "#03045e", "#0077b6", "#00b4d8", "#90e0ef", "#caf0f8"
PAPIER, BANDE, ENCRE, SURFACE = "#f6f9fb", "#eaf3f8", "#0b132b", "#ffffff"
DOUCE, PALE, FILET, FILET_CLAIR = "#334155", "#64748b", "#e2e8f0", "#f1f5f9"
CARMIN, CARMIN_CLAIR, OCRE, OCRE_CLAIR = "#9e2b20", "#fee2e2", "#8a5d12", "#fef3c7"
SANS = "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif"
MONO = "'IBM Plex Mono', ui-monospace, 'Cascadia Mono', Consolas, monospace"

# --- Données de démonstration (convex/seed.ts) ------------------------------
EMP = [
    # matricule, nom, fonction, societe, brut, jours, primesFixes, transport, assiduite, logement, congesPris, hs, anc, sanctions, absences, dettes, acompte, mutPct
    ("E001", "ABAMI Rosine Belie", "Infirmière DE", "SESAME", 106950, 30, 10000, 5000, 0, 0, 0, 0, 2000, 0, 0, 0, 0, 0),
    ("E002", "ACHALE Roderick Essoh", "Aide-soignant", "SGC", 195941, 30, 15000, 10000, 5000, 0, 2, 12000, 6000, 0, 0, 0, 25000, 2.5),
    ("E003", "AMEFFO Lucie C.", "Agent d'accueil", "SGC", 122621, 28, 0, 5000, 5000, 0, 0, 0, 0, 5000, 8175, 0, 10000, 0),
    ("E004", "ATCHEMO Geneviève", "Technicienne labo", "SGC", 133464, 30, 10000, 5000, 0, 15000, 0, 8000, 4000, 0, 0, 12000, 0, 2.5),
    ("E005", "BIAHEU Amandine", "Agent d'entretien", "SGC", 123055, 26, 0, 5000, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0),
    ("E006", "BILOA ELOUNDOU Gertrude", "Sage-femme", "SGC", 130665, 30, 20000, 5000, 5000, 0, 0, 15000, 8000, 0, 0, 0, 30000, 2.5),
    ("E007", "BINAMA Patrick Junior", "Caissier", "SOFINA", 102450, 30, 0, 5000, 5000, 0, 0, 0, 0, 2500, 0, 0, 0, 0),
    ("E008", "TCHIDJO Magloire", "Directeur Général", "SGC", 2500000, 30, 0, 50000, 0, 200000, 0, 0, 100000, 0, 0, 0, 0, 2.5),
]

def fmt(n):
    """fcfa() : entier, séparateur de milliers = espace insécable (U+00A0)."""
    n = int(round(n))
    s = f"{abs(n):,}".replace(",", " ")
    return ("-" if n < 0 else "") + s

def calc(e):
    (mat, nom, fct, soc, brut, jours, pf, tr, ass, log, cp, hs, anc, san, absf, det, aco, mut) = e
    journalier = round(brut / 30)
    base = journalier * jours
    primes = pf + tr + ass + log
    ind = journalier * cp
    total1 = base + primes + ind + hs + anc
    taxable = total1 - tr
    charges = round(taxable * (0.052 if brut < 1_000_000 else 0.27))
    acoImp = aco + charges
    mutuelle = round(total1 * mut / 100)
    total2 = total1 - san - absf - det - acoImp - mutuelle
    net = max(0, total2)
    return dict(mat=mat, nom=nom, fct=fct, soc=soc, brut=brut, journalier=journalier, jours=jours,
                base=base, pf=pf, tr=tr, ass=ass, log=log, primes=primes, cp=cp, ind=ind, hs=hs, anc=anc,
                total1=total1, san=san, absf=absf, det=det, aco=aco, charges=charges, acoImp=acoImp,
                mut=mut, mutuelle=mutuelle, total2=total2, net=net)

ROWS = [calc(e) for e in EMP]
TOT = {k: sum(r[k] for r in ROWS) for k in ("base", "primes", "ind", "hs", "anc", "total1", "san", "absf", "det", "acoImp", "mutuelle", "total2", "net")}
NET_SOC = {s: sum(r["net"] for r in ROWS if r["soc"] == s) for s in ("SESAME", "SOFINA", "SGC")}
RET = TOT["san"] + TOT["absf"] + TOT["det"] + TOT["acoImp"] + TOT["mutuelle"]

# --- Icônes (SVG trait, grille 24, style lucide) ----------------------------
def ico(name, size=16, color="currentColor", sw=2):
    P = {
        "chevron-left": '<path d="m15 18-6-6 6-6"/>',
        "chevron-right": '<path d="m9 18 6-6-6-6"/>',
        "chevron-down": '<path d="m6 9 6 6 6-6"/>',
        "pencil": '<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
        "lock": '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
        "unlock": '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
        "printer": '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
        "file-check": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/>',
        "check": '<path d="M20 6 9 17l-5-5"/>',
        "x": '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
        "plus": '<path d="M5 12h14"/><path d="M12 5v14"/>',
        "minus": '<path d="M5 12h14"/>',
        "arrow-up-right": '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
        "calendar": '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
        "bell": '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
        "search": '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
        "layout": '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
        "wallet": '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
        "folder": '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
        "users": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
        "table": '<path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>',
        "list": '<path d="M11 12h10"/><path d="M11 18h10"/><path d="M11 6h10"/><path d="M4 12h1"/><path d="M4 18h1"/><path d="M4 6h1"/>',
        "mail": '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
        "settings": '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
        "menu": '<path d="M4 12h16"/><path d="M4 6h16"/><path d="M4 18h16"/>',
        "panel-left": '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
        "clipboard": '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
        "info": '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
        "columns": '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/>',
        "expand": '<path d="m21 21-6-6m6 6v-4.8m0 4.8h-4.8"/><path d="M3 16.2V21m0 0h4.8M3 21l6-6"/><path d="M21 7.8V3m0 0h-4.8M21 3l-6 6"/><path d="M3 7.8V3m0 0h4.8M3 3l6 6"/>',
        "alert": '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    }[name]
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{color}" '
            f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{P}</svg>')

# --- Briques HTML -----------------------------------------------------------
HEAD = f'''<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&amp;family=IBM+Plex+Sans:wght@400;500;600;700&amp;display=swap">
  <style>
    body {{ margin: 0; font-family: {SANS}; color: {ENCRE}; background: {PAPIER}; font-size: 15px; line-height: 1.5; -webkit-font-smoothing: antialiased; }}
    a {{ color: {PROFOND}; text-decoration: none; }} a:hover {{ color: {NUIT}; }}
    * {{ box-sizing: border-box; }}
    .mono {{ font-family: {MONO}; font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }}
    table {{ border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }}
    th {{ font-weight: 600; font-size: 10px; line-height: 1.2; letter-spacing: .01em; text-transform: uppercase; padding: 7px 8px; text-align: right; vertical-align: bottom; white-space: nowrap; }}
    th.l, td.l {{ text-align: left; }}
    td {{ padding: 0 6px; height: 40px; font-size: 11.5px; text-align: right; white-space: nowrap; border-bottom: 1px solid {FILET_CLAIR}; font-family: {MONO}; }}
    td.l {{ font-family: {SANS}; font-size: 13px; }}
    tbody tr:nth-child(even) td {{ background: {BANDE}; }}
    tbody tr:hover td {{ background: {BRUME}; }}
    td.t1, th.t1 {{ background: {BRUME}; font-weight: 600; }}
    td.soc {{ font-weight: 600; }}
    .ed {{ position: relative; display: inline-block; min-width: 44px; padding: 3px 6px; border-radius: 4px; border: 1px solid transparent; border-bottom: 1px dashed #7dd3fc; border-bottom-left-radius: 0; border-bottom-right-radius: 0; }}
    .ed.hov::after, .ed:hover::after {{ content: ""; position: absolute; right: 5px; top: 50%; width: 9px; height: 9px; margin-top: -5px; background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%2364748b" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>') no-repeat center / contain; opacity: .55; }}
    .ed.hov, .ed:hover {{ border: 1px solid {FILET}; border-radius: 4px; background: {SURFACE}; padding-right: 18px; }}
    .ed.on {{ border: 1px solid {CERULEEN}; border-radius: 4px; background: {SURFACE}; box-shadow: 0 0 0 3px rgba(0,180,216,.25); }}
    .ed.on::after {{ display: none; }}
    .ed.mod {{ border: 1px solid {OCRE}; border-radius: 4px; background: {OCRE_CLAIR}; }}
    .ed.ro {{ border-bottom-color: transparent; color: {DOUCE}; }} .ed.ro::after {{ display: none; }}
    tfoot td {{ border-top: 4px double {ENCRE}; border-bottom: 0; font-weight: 600; background: {SURFACE}; height: 42px; }}
    .pill {{ display: inline-flex; align-items: center; gap: 6px; border-radius: 9999px; border: 1px solid; padding: 3px 10px; font-size: 10px; font-weight: 600; letter-spacing: .04em; line-height: 1.2; white-space: nowrap; font-family: {SANS}; }}
    .btn {{ display: inline-flex; align-items: center; gap: 8px; height: 36px; padding: 0 14px; border-radius: 8px; border: 1px solid {FILET}; background: {SURFACE}; color: {ENCRE}; font-size: 13px; font-weight: 500; white-space: nowrap; font-family: {SANS}; }}
    .btn.pri {{ background: {PROFOND}; border-color: {PROFOND}; color: #fff; font-weight: 600; }}
    .btn.sm {{ height: 30px; padding: 0 10px; font-size: 12px; }}
    .btn.ghost {{ border-color: transparent; background: transparent; color: {DOUCE}; }}
    .nav {{ display: flex; align-items: center; gap: 10px; height: 36px; padding: 0 12px; border-radius: 10px; font-size: 12px; font-weight: 500; color: #475569; }}
    .nav.on {{ background: linear-gradient(90deg, #2563eb, {PROFOND}); color: #fff; font-weight: 600; }}
    .kpi {{ display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; border-radius: 12px; border: 1px solid {FILET}; background: {SURFACE}; }}
    .kpi .k {{ font-size: 11px; font-weight: 600; color: {DOUCE}; }}
    .kpi .v {{ font-family: {MONO}; font-size: 22px; font-weight: 600; line-height: 1.1; letter-spacing: -.01em; }}
    .kpi .n {{ font-size: 11px; color: {PALE}; }}
    .lbl {{ display: block; font-size: 11px; font-weight: 600; color: {DOUCE}; margin-bottom: 3px; white-space: nowrap; }}
    .inp {{ display: flex; align-items: center; justify-content: space-between; height: var(--h, 36px); border: 1px solid {FILET}; border-radius: 8px; background: {SURFACE}; padding: 0 10px; font-family: {MONO}; font-size: 13px; }}
    .inp .u {{ font-family: {SANS}; font-size: 10px; color: {PALE}; font-weight: 600; }}
    .inp.err {{ border-color: {CARMIN}; }}
    .h2 {{ font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: {PROFOND}; }}
  </style>
</helmet>
'''
FOOT = '''</x-dc>
</body>
</html>
'''

def pill(text, kind, icon=None):
    K = {
        "ouvert": (OCRE_CLAIR, "#fcd34d", OCRE),
        "verrou": ("#f1f5f9", "#cbd5e1", "#475569"),
        "ok": ("#ecfdf5", "#a7f3d0", "#065f46"),
        "info": (BRUME, "#7dd3fc", PROFOND),
        "actif": (PROFOND, CERULEEN, "#fff"),
        "soc": (BANDE, FILET, DOUCE),
    }[kind]
    i = ico(icon, 11, K[2], 2.4) if icon else ""
    return f'<span class="pill" style="background:{K[0]}; border-color:{K[1]}; color:{K[2]};">{i}<span>{text}</span></span>'

def rail(active="paie"):
    """Barre latérale repliée en rail d'icônes (64 px) — proposition liée à l'option A."""
    items = [("layout", "Tableau de bord", "dash"), ("wallet", "Financier", "fin"), ("folder", "Documents", "doc"),
             ("users", "Employés", "emp"), ("table", "Récapitulatif salaires", "paie"), ("list", "Liste des salaires", "liste"),
             ("file-check", "Bulletins", "bul"), ("mail", "Courrier", "mail"), ("settings", "Paramètres", "param")]
    nav = "".join(
        f'<div title="{t}" style="display:flex; align-items:center; justify-content:center; width:40px; height:40px; border-radius:10px; '
        + (f'background:linear-gradient(90deg,#2563eb,{PROFOND}); color:#fff;' if k == active else 'color:#64748b;')
        + f'">{ico(i, 18)}</div>' for i, t, k in items)
    return f'''<aside style="width:64px; flex-shrink:0; display:flex; flex-direction:column; align-items:center; justify-content:space-between; background:{SURFACE}; border-right:1px solid {FILET}; position:relative; overflow:hidden;">
  <div style="position:absolute; left:0; right:0; top:0; height:200px; background:linear-gradient(180deg,#1e69ff 0%,#155dfc 40%,{PROFOND} 62%,rgba(56,189,248,.25) 84%,#fff 100%);"></div>
  <div style="position:relative; display:flex; flex-direction:column; align-items:center; gap:6px; padding-top:14px;">
    <div style="width:40px; height:40px; border-radius:12px; background:#fff; box-shadow:0 2px 6px rgba(0,0,0,.15); display:flex; align-items:center; justify-content:center; font-weight:700; color:{NUIT}; font-size:16px;">P</div>
    <div style="height:10px;"></div>
    {nav}
  </div>
  <div style="position:relative; width:100%; display:flex; flex-direction:column; align-items:center; gap:10px; padding:12px 0; background:{NUIT};">
    <div title="Déplier la barre latérale" style="color:#94a3b8;">{ico("panel-left", 16)}</div>
    <div style="width:34px; height:34px; border-radius:9999px; background:{PROFOND}; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:12px; box-shadow:0 0 0 2px rgba(0,180,216,.4);">T</div>
  </div>
</aside>'''

def sidebar():
    """Barre latérale complète (Layout.tsx actuel), 256 px."""
    groups = [("Exploitation", [("layout", "Tableau de bord", False), ("wallet", "Récapitulatif financier", False), ("folder", "Documents", False)]),
              ("Paie", [("users", "Employés", False), ("table", "Récapitulatif salaires", True), ("list", "Liste des salaires", False), ("file-check", "Bulletins du mois", False), ("mail", "Courrier de paie", False)]),
              ("Contrôle", [("settings", "Paramètres", False)])]
    body = ""
    for g, items in groups:
        body += f'<div style="padding:0 12px; font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#94a3b8; margin:10px 0 4px;">{g}</div>'
        body += '<div style="display:flex; flex-direction:column; gap:2px;">' + "".join(
            f'<div class="nav{" on" if on else ""}">{ico(i, 16)}<span>{t}</span></div>' for i, t, on in items) + '</div>'
    return f'''<aside style="width:256px; flex-shrink:0; display:flex; flex-direction:column; justify-content:space-between; background:{SURFACE}; border-right:1px solid {FILET}; position:relative; overflow:hidden;">
  <div style="position:absolute; left:0; right:0; top:0; height:280px; background:linear-gradient(180deg,#1e69ff 0%,#155dfc 45%,{PROFOND} 65%,rgba(56,189,248,.25) 85%,#fff 100%);"></div>
  <div style="position:relative; display:flex; flex-direction:column; align-items:center; padding:20px 16px 12px; text-align:center;">
    <div style="border-radius:16px; background:#fff; padding:6px 14px; box-shadow:0 2px 6px rgba(0,0,0,.15); font-weight:700; color:{NUIT}; font-size:13px;">POLYCLINIQUE</div>
    <div style="margin-top:10px; font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#fff;">Polyclinique de Poitiers</div>
    <div style="font-size:11px; color:rgba(219,234,254,.9);">Plateforme de gestion &amp; paie</div>
  </div>
  <div style="position:relative; flex:1; margin:0 10px; border-radius:26px 26px 0 0; background:#fff; box-shadow:0 -8px 25px rgba(13,80,208,.12); padding:14px 12px; overflow:hidden;">{body}</div>
  <div style="position:relative; display:flex; align-items:center; gap:10px; padding:14px 16px; background:{NUIT}; color:#e2e8f0;">
    <div style="width:36px; height:36px; border-radius:9999px; background:{PROFOND}; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:12px; box-shadow:0 0 0 2px rgba(0,180,216,.4);">T</div>
    <div style="min-width:0; flex:1;"><div style="font-size:12px; font-weight:600; color:#fff;">TCHIDJO Magloire</div><div style="font-size:11px; color:{CIEL};">Directeur Général · niv. 7</div></div>
  </div>
</aside>'''

def header(titre="Récapitulatif salaires", sous="Grille mensuelle des éléments de paie"):
    return f'''<header style="display:flex; flex-shrink:0; align-items:center; justify-content:space-between; height:64px; padding:0 24px; border-bottom:1px solid {FILET}; background:rgba(255,255,255,.95);">
  <div style="display:flex; align-items:center; gap:8px;">
    <div style="font-size:17px; font-weight:600; letter-spacing:-.01em;">{titre}</div>
    <span style="font-size:12px; color:{PALE};">/</span>
    <span style="font-size:12px; font-weight:500; color:{DOUCE};">{sous}</span>
  </div>
  <div style="display:flex; align-items:center; gap:12px;">
    <div style="display:flex; align-items:center; gap:6px; border-radius:9999px; border:1px solid rgba(0,180,216,.3); background:rgba(202,240,248,.4); padding:4px 12px; font-size:12px; font-weight:500; color:{PROFOND};">{ico("calendar", 14, PROFOND)}<span>Septembre 2026</span></div>
    <div style="display:flex; align-items:center; gap:6px; border-radius:9999px; border:1px solid #a7f3d0; background:#ecfdf5; padding:4px 10px; font-size:11px; font-weight:500; color:#047857;"><span style="width:8px; height:8px; border-radius:9999px; background:#10b981;"></span><span>En direct</span></div>
    <div style="display:flex; align-items:center; gap:8px; border-radius:8px; border:1px solid {FILET}; background:{PAPIER}; padding:6px 10px; font-size:12px; color:{PALE};">{ico("search", 14, PALE)}<span>Rechercher...</span><span style="border:1px solid {FILET}; background:#fff; border-radius:4px; padding:1px 6px; font-size:10px; font-weight:600;">Ctrl K</span></div>
    <div style="color:{DOUCE};">{ico("bell", 16)}</div>
    <div style="display:flex; align-items:center; gap:8px; padding-left:12px; border-left:1px solid {FILET};">
      <div style="width:32px; height:32px; border-radius:9999px; background:{PROFOND}; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:12px;">T</div>
      <div style="display:flex; flex-direction:column;"><span style="font-size:12px; font-weight:600;">TCHIDJO Magloire</span><span style="font-size:10px; color:{PALE};">Directeur Général</span></div>
    </div>
  </div>
</header>'''

TAUX_LONG = (f'<span class="mono">CNPS 4,2 %</span><span style="color:{PALE};">·</span><span class="mono">CFC 1 %</span>'
             f'<span style="color:{PALE};">·</span><span class="mono">CAC 10 %</span><span style="color:{PALE};">·</span><span>TDL &amp; RAV</span>')

def barre_controle(taux="long"):
    """Ligne de contrôle slim (48 px) : période, statut, taux du mois, actions."""
    return f'''<div style="display:flex; align-items:center; gap:12px; height:50px; padding:0 12px 0 8px; border-radius:16px; white-space:nowrap; border:1px solid {FILET}; background:{SURFACE}; box-shadow:0 1px 2px rgba(15,23,42,.04);">
  <div style="display:flex; align-items:center; gap:2px;">
    <span class="btn ghost sm" style="width:30px; padding:0; justify-content:center;">{ico("chevron-left", 16)}</span>
    <span style="display:inline-flex; align-items:center; gap:8px; height:32px; padding:0 12px; border-radius:8px; border:1px solid {FILET}; font-weight:600; font-size:13px; white-space:nowrap;">{ico("calendar", 14, PROFOND)}Septembre 2026{ico("chevron-down", 14, PALE)}</span>
    <span class="btn ghost sm" style="width:30px; padding:0; justify-content:center;">{ico("chevron-right", 16)}</span>
  </div>
  {pill("Mois ouvert · recalcul en direct", "ouvert", "unlock")}
  <div style="width:1px; height:24px; background:{FILET};"></div>
  <div style="display:flex; align-items:center; gap:8px; font-size:12px; color:{DOUCE}; white-space:nowrap;">
    <span style="font-weight:600; color:{ENCRE};">Taux du mois</span>
    {TAUX_LONG if taux == "long" else ""}
    <span style="display:inline-flex; align-items:center; gap:4px; color:{PROFOND}; font-weight:500;">Barème 2026-01{ico("chevron-down", 13, PROFOND)}</span>
  </div>
  <div style="flex:1;"></div>
  <span class="btn sm">{ico("printer", 14)}Imprimer</span>
  <span class="btn sm pri">{ico("file-check", 14, "#fff")}Générer et clôturer le mois</span>
</div>'''

def kpis(slim=True):
    p = "10px 14px" if slim else "12px 14px"
    return f'''<div style="display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:12px;">
  <div class="kpi" style="padding:{p};"><span class="k">Effectif payé</span><span class="v">8</span><span class="n">30 jours calendaires · paiement le 05/10</span></div>
  <div class="kpi" style="padding:{p};"><span class="k">Masse brute · Total 1</span><span class="v">{fmt(TOT["total1"])}</span><span class="n">FCFA · base + primes + congés + HS + ancienneté</span></div>
  <div class="kpi" style="padding:{p};"><span class="k">Retenues du mois</span><span class="v" style="color:{CARMIN};">-{fmt(RET)}</span><span class="n">FCFA · impôts &amp; CNPS, acomptes, mutuelle, sanctions</span></div>
  <div class="kpi" style="padding:{p}; border-color:rgba(0,180,216,.4); box-shadow:0 0 0 1px rgba(0,180,216,.2);"><span class="k" style="color:{PROFOND};">Net à payer · Total 2</span><span class="v">{fmt(TOT["net"])}</span><span class="n mono">SESAME {fmt(NET_SOC["SESAME"])} · SOFINA {fmt(NET_SOC["SOFINA"])} · SGC {fmt(NET_SOC["SGC"])}</span></div>
</div>'''

def legende():
    return f'''<div style="display:flex; flex-wrap:wrap; gap:6px 18px; font-size:11px; color:{DOUCE}; line-height:1.45;">
  <span><b style="color:{ENCRE};">Total 1</b> = base + primes + congés + heures sup + ancienneté</span>
  <span><b style="color:{ENCRE};">Total 2 (net)</b> = Total 1 − sanctions − absences − dettes − acompte / impôts &amp; CNPS − mutuelle</span>
  <span><b style="color:{ENCRE};">SESAME</b> non déclarés CNPS · <b style="color:{ENCRE};">SOFINA</b> nouveaux employés · <b style="color:{ENCRE};">SGC</b> déclarés CNPS</span>
  <span>Journalier = brut ÷ 30 · transport exonéré de cotisations</span>
</div>'''

def toast(text, sub):
    return f'''<div style="position:absolute; right:24px; bottom:24px; display:flex; align-items:flex-start; gap:10px; width:340px; padding:12px 14px; border-radius:10px; border:1px solid {FILET}; background:{SURFACE}; box-shadow:0 8px 24px -8px rgba(21,28,24,.24), 0 2px 6px -2px rgba(21,28,24,.12); font-size:13px;">
  <span style="display:flex; width:20px; height:20px; border-radius:9999px; background:#ecfdf5; color:#047857; align-items:center; justify-content:center; flex-shrink:0;">{ico("check", 12, "#047857", 3)}</span>
  <div><div style="font-weight:600;">{text}</div><div style="font-size:12px; color:{DOUCE};">{sub}</div></div>
</div>'''

def cell_name(r, actions=True, sticky=False, extra=""):
    st = (f"position:sticky; left:0; z-index:2; box-shadow: 6px 0 12px -8px rgba(15,23,42,.25);" if sticky else "") + extra
    act = (f'<span style="display:inline-flex; align-items:center; gap:4px; color:{PROFOND}; font-size:11px; font-weight:500;">{ico("clipboard", 12, PROFOND)}Saisie du mois</span>' if actions else "")
    return (f'<td class="l" style="{st} height:46px; line-height:1.25; overflow:hidden;">'
            f'<div style="display:flex; flex-direction:column; gap:2px;"><span style="font-weight:600;">{r["nom"]}</span>'
            f'<span style="display:flex; gap:8px; align-items:center; font-size:11px; color:{PALE};"><span>{r["fct"]}</span>{pill(r["soc"], "soc")}{act}</span></div></td>')

# --- Tableau 18 colonnes (option A : tout visible) --------------------------
HEADS_A = [("Noms et prénoms", "l", 178), ("Sal. journalier", "", 66), ("Jours trav.", "", 52), ("Salaire de base", "", 74),
           ("Primes fixes / congé", "", 82), ("H. sup / ancienneté", "", 78), ("Total 1", "t1", 78),
           ("Sanctions", "", 58), ("Absence", "", 58), ("Dettes de soins", "", 60), ("Acompte / dette / impôts & CNPS", "", 94),
           ("Mut. %", "", 46), ("Mutuelle", "", 60), ("Total 2", "t1", 78),
           ("Sal. SESAME", "s", 70), ("Sal. SOFINA", "s", 70), ("Sal. SGC", "s", 70), ("", "b", 32)]

def table_A():
    ths = ""
    for h, cls, w in HEADS_A:
        extra = f"background:{NUIT};" if cls == "t1" else (f"background:#0a5c8f;" if cls == "s" else "")
        ths += f'<th class="{ "l" if cls == "l" else ""}" style="width:{w}px; {extra} white-space:normal;">{h}</th>'
    thead = f'<thead><tr style="background:{PROFOND}; color:#fff;">{ths}</tr></thead>'
    body = ""
    for i, r in enumerate(ROWS):
        ed = lambda v, cls="": f'<span class="ed {cls}">{v}</span>'
        # ligne 3 : cellule Acompte en cours d'édition ; ligne 2 : cellule modifiée non encore enregistrée
        acompte = ed(fmt(r["aco"]), "on") if i == 2 else ed(fmt(r["aco"]))
        jours = ed(str(r["jours"]), "mod") if i == 4 else (ed(str(r["jours"]), "hov") if i == 0 else ed(str(r["jours"])))
        primes_cell = (f'<span class="ed" style="min-width:64px;">{fmt(r["primes"] + r["ind"])}</span>'
                       f'<div style="font-family:{SANS}; font-size:10px; color:{PALE}; line-height:1; margin-top:-2px;">{r["cp"]} j congés</div>')
        hs_cell = f'<span class="ed" style="min-width:60px;">{fmt(r["hs"] + r["anc"])}</span>'
        acoImp = f'{acompte}<div style="font-family:{SANS}; font-size:10px; color:{PALE}; line-height:1; margin-top:-2px;">= <b class="mono" style="color:{ENCRE};">{fmt(r["acoImp"])}</b> avec impôts</div>'
        soc = "".join(f'<td class="soc">{fmt(r["net"]) if r["soc"] == s else "—"}</td>' for s in ("SESAME", "SOFINA", "SGC"))
        body += (f'<tr>{cell_name(r, actions=False, sticky=True)}'
                 f'<td><span class="ed ro">{fmt(r["journalier"])}</span><div style="font-family:{SANS}; font-size:10px; color:{PALE}; line-height:1; margin-top:-2px;">brut {fmt(r["brut"])}</div></td>'
                 f'<td>{jours}</td><td>{fmt(r["base"])}</td><td>{primes_cell}</td><td>{hs_cell}</td>'
                 f'<td class="t1">{fmt(r["total1"])}</td>'
                 f'<td>{ed(fmt(r["san"]))}</td><td>{ed(fmt(r["absf"]))}</td><td>{ed(fmt(r["det"]))}</td><td>{acoImp}</td>'
                 f'<td>{ed(("%.1f" % r["mut"]).replace(".", ",").replace(",0", ""))}</td><td>{fmt(r["mutuelle"])}</td>'
                 f'<td class="t1">{fmt(r["total2"])}</td>{soc}'
                 f'<td style="text-align:center; padding:0 4px;"><span title="Ouvrir le bulletin" style="display:inline-flex; width:26px; height:26px; border-radius:6px; border:1px solid {FILET}; align-items:center; justify-content:center; color:{PROFOND}; background:#fff;">{ico("file-check", 13, PROFOND)}</span></td></tr>')
    tfoot = (f'<tfoot><tr><td class="l" style="position:sticky; left:0; z-index:2; font-family:{SANS};">TOTAL · 8 employés</td><td></td><td></td>'
             f'<td>{fmt(TOT["base"])}</td><td>{fmt(TOT["primes"] + TOT["ind"])}</td><td>{fmt(TOT["hs"] + TOT["anc"])}</td><td class="t1">{fmt(TOT["total1"])}</td>'
             f'<td>{fmt(TOT["san"])}</td><td>{fmt(TOT["absf"])}</td><td>{fmt(TOT["det"])}</td><td>{fmt(TOT["acoImp"])}</td><td></td><td>{fmt(TOT["mutuelle"])}</td>'
             f'<td class="t1">{fmt(TOT["total2"])}</td><td>{fmt(NET_SOC["SESAME"])}</td><td>{fmt(NET_SOC["SOFINA"])}</td><td>{fmt(NET_SOC["SGC"])}</td><td></td></tr></tfoot>')
    return f'<div style="border:1px solid {FILET}; border-radius:12px; background:{SURFACE}; overflow:hidden;"><table style="table-layout:fixed;">{thead}<tbody>{body}</tbody>{tfoot}</table></div>'

def popover_primes():
    """Éditeur groupé ouvert sur la cellule « Primes fixes / congé » d'AMEFFO (ligne 3)."""
    r = ROWS[2]
    rows = [("Primes fixes", r["pf"]), ("Transport", r["tr"]), ("Assiduité", r["ass"]), ("Ind. logement", r["log"])]
    lines = "".join(f'<label style="display:flex; align-items:center; justify-content:space-between; gap:12px; font-size:12px;"><span style="color:{DOUCE};">{l}</span><span class="inp" style="width:120px; height:30px; justify-content:flex-end;">{fmt(v)}</span></label>' for l, v in rows)
    return f'''<div style="position:absolute; left:452px; top:446px; width:290px; padding:12px; border-radius:10px; border:1px solid {FILET}; background:{SURFACE}; box-shadow:0 8px 24px -8px rgba(21,28,24,.24), 0 2px 6px -2px rgba(21,28,24,.12); z-index:5;">
  <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;"><div><div style="font-size:12px; font-weight:600;">Primes fixes / congé</div><div style="font-size:11px; color:{PALE};">AMEFFO Lucie C. · septembre 2026</div></div><span style="color:{PALE};">{ico("x", 14)}</span></div>
  <div style="display:flex; flex-direction:column; gap:6px;">{lines}</div>
  <div style="display:flex; align-items:center; justify-content:space-between; margin-top:10px; padding-top:8px; border-top:1px solid {FILET_CLAIR}; font-size:11px; color:{DOUCE};"><span>Congés pris : <b class="mono">0 j</b> → indemnité <b class="mono">0</b></span><span style="font-size:10px;">Planning ↗</span></div>
  <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;"><span style="font-size:11px; color:{PALE};">Total primes <b class="mono" style="color:{ENCRE};">{fmt(r["primes"])}</b></span><div style="display:flex; gap:6px;"><span class="btn sm">Annuler</span><span class="btn sm pri">Enregistrer</span></div></div>
</div>'''

def page_A():
    return HEAD + f'''<div style="display:flex; width:1440px; height:900px; background:{PAPIER}; overflow:hidden; position:relative;">
  {rail()}
  <div style="display:flex; flex-direction:column; flex:1; min-width:0;">
    {header()}
    <main style="display:flex; flex-direction:column; gap:12px; padding:16px 20px;">
      {barre_controle()}
      {kpis()}
      {table_A()}
      {legende()}
    </main>
  </div>
  {popover_primes()}
  {toast("Saisie enregistrée", "BIAHEU Amandine · jours travaillés 26 → 28")}
</div>
''' + FOOT

# --- Option B : groupes de colonnes repliables ------------------------------
def table_B():
    # Groupes : Employé | Base (3) | Gains (replié → Total 1) | Retenues (déplié, 7) | Net par société (3) | bulletin
    grp = (f'<tr style="background:{NUIT}; color:#fff;">'
           f'<th class="l" rowspan="2" style="width:210px; vertical-align:middle; position:sticky; left:0; z-index:3; background:{NUIT};">Noms et prénoms</th>'
           f'<th colspan="1" style="text-align:center; border-left:1px solid rgba(255,255,255,.15); background:#0a5c8f;"><span style="display:inline-flex; align-items:center; gap:6px;">{ico("plus", 12, "#fff", 2.6)}Base</span></th>'
           f'<th colspan="1" style="text-align:center; border-left:1px solid rgba(255,255,255,.15); background:#0a5c8f;"><span style="display:inline-flex; align-items:center; gap:6px;">{ico("plus", 12, "#fff", 2.6)}Gains</span></th>'
           f'<th colspan="7" style="text-align:center; border-left:1px solid rgba(255,255,255,.15);"><span style="display:inline-flex; align-items:center; gap:6px;">{ico("minus", 12, "#fff", 2.6)}Retenues</span></th>'
           f'<th colspan="3" style="text-align:center; border-left:1px solid rgba(255,255,255,.15); background:#0a5c8f;"><span style="display:inline-flex; align-items:center; gap:6px;">{ico("minus", 12, "#fff", 2.6)}Net par société</span></th>'
           f'<th rowspan="2" style="width:72px;"></th></tr>')
    sub = [("Sal. de base", 84), ("Total 1", 84), ("Sanctions", 64), ("Absence", 60), ("Dettes", 60), ("Ac. / impôts", 104), ("Mut. %", 50), ("Mutuelle", 66), ("Total 2", 84), ("SESAME", 76), ("SOFINA", 76), ("SGC", 76)]
    sub_html = "".join(f'<th style="width:{w}px; background:{PROFOND}; {"background:#0a5c8f;" if h in ("Total 1","Sal. de base","SESAME","SOFINA","SGC") else ""}">{h}</th>' for h, w in sub)
    thead = f'<thead>{grp}<tr style="background:{PROFOND}; color:#fff;">{sub_html}</tr></thead>'
    body = ""
    for i, r in enumerate(ROWS):
        soc = "".join(f'<td class="soc">{fmt(r["net"]) if r["soc"] == s else "—"}</td>' for s in ("SESAME", "SOFINA", "SGC"))
        body += (f'<tr>{cell_name(r, actions=False, sticky=True)}'
                 f'<td class="t1">{fmt(r["base"])}</td>'
                 f'<td class="t1">{fmt(r["total1"])}</td>'
                 f'<td>{fmt(r["san"])}</td><td>{fmt(r["absf"])}</td><td>{fmt(r["det"])}</td><td>{fmt(r["acoImp"])}</td><td>{("%.1f" % r["mut"]).replace(".", ",").replace(",0", "")}</td><td>{fmt(r["mutuelle"])}</td>'
                 f'<td class="t1">{fmt(r["total2"])}</td>{soc}'
                 f'<td style="text-align:center; padding:0 4px;"><span style="display:inline-flex; gap:4px;"><span title="Saisie du mois" style="display:inline-flex; width:26px; height:26px; border-radius:6px; border:1px solid {PROFOND}; align-items:center; justify-content:center; color:#fff; background:{PROFOND};">{ico("clipboard", 13, "#fff")}</span><span title="Bulletin" style="display:inline-flex; width:26px; height:26px; border-radius:6px; border:1px solid {FILET}; align-items:center; justify-content:center; color:{PROFOND}; background:#fff;">{ico("file-check", 13, PROFOND)}</span></span></td></tr>')
    tfoot = (f'<tfoot><tr><td class="l" style="position:sticky; left:0; z-index:2; font-family:{SANS};">TOTAL · 8 employés</td><td class="t1">{fmt(TOT["base"])}</td><td class="t1">{fmt(TOT["total1"])}</td>'
             f'<td>{fmt(TOT["san"])}</td><td>{fmt(TOT["absf"])}</td><td>{fmt(TOT["det"])}</td><td>{fmt(TOT["acoImp"])}</td><td></td><td>{fmt(TOT["mutuelle"])}</td><td class="t1">{fmt(TOT["total2"])}</td>'
             f'<td>{fmt(NET_SOC["SESAME"])}</td><td>{fmt(NET_SOC["SOFINA"])}</td><td>{fmt(NET_SOC["SGC"])}</td><td></td></tr></tfoot>')
    return f'<div style="border:1px solid {FILET}; border-radius:12px; background:{SURFACE}; overflow:hidden;"><table style="table-layout:fixed;">{thead}<tbody>{body}</tbody>{tfoot}</table></div>'

def segments_B():
    seg = lambda t, on, n: (f'<span style="display:inline-flex; align-items:center; gap:6px; height:28px; padding:0 12px; border-radius:9999px; font-size:12px; font-weight:600; '
                            + (f'background:{PROFOND}; color:#fff;' if on else f'background:{SURFACE}; color:{DOUCE}; border:1px solid {FILET};') + f'">{t}<span style="font-size:10px; opacity:.75; font-weight:500;">{n}</span></span>')
    return f'''<div style="display:flex; align-items:center; gap:8px; font-size:12px; color:{DOUCE};">
  <span style="display:inline-flex; align-items:center; gap:6px; font-weight:600; color:{ENCRE};">{ico("columns", 14, PROFOND)}Groupes de colonnes</span>
  {seg("Base", False, "replié · base")}{seg("Gains", False, "replié · Total 1")}{seg("Retenues", True, "7")}{seg("Net par société", True, "3")}
  <span style="color:{PALE};">·</span><span style="display:inline-flex; align-items:center; gap:4px; color:{PROFOND}; font-weight:500;">{ico("expand", 13, PROFOND)}Tout déplier (18 colonnes, défilement horizontal)</span>
  <div style="flex:1;"></div>
  <span style="font-size:11px; color:{PALE};">Un groupe replié affiche son total ; il s'ouvre d'un clic. Saisie par la fiche « Saisie du mois » (bouton bleu).</span>
</div>'''

def page_B():
    return HEAD + f'''<div style="display:flex; width:1440px; height:900px; background:{PAPIER}; overflow:hidden; position:relative;">
  {sidebar()}
  <div style="display:flex; flex-direction:column; flex:1; min-width:0;">
    {header()}
    <main style="display:flex; flex-direction:column; gap:12px; padding:16px 20px;">
      {barre_controle("court")}
      {kpis()}
      {segments_B()}
      {table_B()}
      {legende()}
    </main>
  </div>
</div>
''' + FOOT

# --- Option C : synthèse + fiche latérale ----------------------------------
def table_C():
    heads = [("Noms et prénoms", "l", 196), ("Jours", "", 46), ("Salaire de base", "", 84), ("Total 1", "t1", 84), ("Retenues", "", 84), ("Total 2 · net", "t1", 84), ("Société", "", 72), ("", "b", 30)]
    thead = f'<thead><tr style="background:{PROFOND}; color:#fff;">' + "".join(f'<th class="{"l" if c == "l" else ""}" style="width:{w}px; {"background:" + NUIT + ";" if c == "t1" else ""}">{h}</th>' for h, c, w in heads) + '</tr></thead>'
    body = ""
    for i, r in enumerate(ROWS):
        ret = r["san"] + r["absf"] + r["det"] + r["acoImp"] + r["mutuelle"]
        active = f'style="background:{BRUME}; box-shadow: inset 3px 0 0 {CERULEEN};"' if i == 2 else ""
        body += (f'<tr>{cell_name(r, actions=False, extra=(f"background:{BRUME}; box-shadow: inset 3px 0 0 {CERULEEN};" if i == 2 else ""))}'
                 f'<td {active}>{r["jours"]}</td><td {active}>{fmt(r["base"])}</td><td class="t1">{fmt(r["total1"])}</td><td {active} style="color:{CARMIN};">-{fmt(ret)}</td><td class="t1">{fmt(r["total2"])}</td><td {active}>{pill(r["soc"], "soc")}</td>'
                 f'<td {active} style="text-align:center; padding:0 4px;"><span style="color:{PROFOND};">{ico("chevron-right", 16, PROFOND)}</span></td></tr>')
    tfoot = f'<tfoot><tr><td class="l" style="font-family:{SANS};">TOTAL · 8 employés</td><td></td><td>{fmt(TOT["base"])}</td><td class="t1">{fmt(TOT["total1"])}</td><td style="color:{CARMIN};">-{fmt(RET)}</td><td class="t1">{fmt(TOT["total2"])}</td><td></td><td></td></tr></tfoot>'
    return f'<div style="border:1px solid {FILET}; border-radius:12px; background:{SURFACE}; overflow:hidden;"><table style="table-layout:fixed;">{thead}<tbody>{body}</tbody>{tfoot}</table></div>'

def champ(l, v, unit="FCFA", w="100%", err=None, ro=False):
    e = f'<span style="display:block; font-size:10px; color:{CARMIN}; font-weight:600; margin-top:3px;">{err}</span>' if err else ""
    return f'<label style="display:block; width:{w};"><span class="lbl">{l}</span><span class="inp{" err" if err else ""}" style="{"background:" + FILET_CLAIR + "; color:" + DOUCE + ";" if ro else ""}"><span>{v}</span><span class="u">{unit}</span></span>{e}</label>'

def sheet_C():
    r = ROWS[2]
    sec = lambda t: f'<div class="h2" style="margin:4px 0 8px;">{t}</div>'
    g3 = 'display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap:10px;'
    g2 = 'display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:10px;'
    return f'''<aside style="width:440px; flex-shrink:0; display:flex; flex-direction:column; background:{SURFACE}; border:1px solid {FILET}; border-radius:12px; overflow:hidden; align-self:stretch;">
  <div style="display:flex; align-items:flex-start; justify-content:space-between; padding:18px 20px 12px; border-bottom:1px solid {FILET};">
    <div><div style="font-size:16px; font-weight:600;">{r["nom"]}</div><div style="display:flex; align-items:center; gap:8px; font-size:12px; color:{DOUCE}; margin-top:2px;"><span>{r["fct"]}</span>{pill(r["soc"], "soc")}<span class="mono" style="color:{PALE};">E003 · brut {fmt(r["brut"])}</span></div></div>
    <span style="color:{PALE};">{ico("x", 18)}</span>
  </div>
  <div style="flex:1; overflow:auto; padding:12px 18px; display:flex; flex-direction:column; gap:10px; --h:32px;">
    <div>{sec("Temps de travail")}<div style="{g3}">{champ("Jours travaillés", "28", "j")}{champ("Congés pris", "0", "j", ro=True)}{champ("Absences", fmt(r["absf"]), "FCFA")}</div></div>
    <div>{sec("Gains")}<div style="{g3}">{champ("Primes fixes", fmt(r["pf"]))}{champ("Transport", fmt(r["tr"]))}{champ("Assiduité", fmt(r["ass"]))}{champ("Ind. logement", fmt(r["log"]))}{champ("Heures sup", fmt(r["hs"]))}{champ("Ancienneté", fmt(r["anc"]))}</div></div>
    <div>{sec("Retenues")}<div style="display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:10px;">{champ("Sanctions", fmt(r["san"]))}{champ("Dettes", fmt(r["det"]))}{champ("Acompte", fmt(r["aco"]))}{champ("Mutuelle", "0", "%")}</div></div>
    <div style="border-radius:10px; border:1px solid {FILET}; background:{PAPIER}; padding:12px 14px;">
      <div style="font-size:11px; font-weight:600; color:{DOUCE}; margin-bottom:8px;">Aperçu en direct</div>
      <div style="{g2} gap:8px;">
        <div><span style="display:block; font-size:11px; color:{PALE};">Salaire de base</span><span class="mono" style="font-weight:600;">{fmt(r["base"])}</span></div>
        <div><span style="display:block; font-size:11px; color:{PALE};">Total 1</span><span class="mono" style="font-weight:600;">{fmt(r["total1"])}</span></div>
        <div><span style="display:block; font-size:11px; color:{PALE};">Impôts &amp; CNPS + acompte</span><span class="mono" style="font-weight:600; color:{CARMIN};">-{fmt(r["acoImp"])}</span></div>
        <div><span style="display:block; font-size:11px; color:{PALE};">Net à payer · Total 2</span><span class="mono" style="font-weight:600; font-size:16px; color:{PROFOND};">{fmt(r["total2"])} FCFA</span></div>
      </div>
    </div>
  </div>
  <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; padding:12px 20px; border-top:1px solid {FILET}; background:{SURFACE};">
    <span style="display:inline-flex; align-items:center; gap:4px; font-size:12px; color:{PROFOND};">{ico("file-check", 14, PROFOND)}Ouvrir le bulletin</span>
    <div style="display:flex; gap:8px;"><span class="btn">Annuler</span><span class="btn pri">{ico("check", 14, "#fff", 2.6)}Enregistrer la saisie</span></div>
  </div>
</aside>'''

def page_C():
    return HEAD + f'''<div style="display:flex; width:1440px; height:900px; background:{PAPIER}; overflow:hidden; position:relative;">
  {sidebar()}
  <div style="display:flex; flex-direction:column; flex:1; min-width:0;">
    {header()}
    <main style="display:flex; flex-direction:column; gap:12px; padding:16px 20px;">
      {barre_controle("court")}
      {kpis()}
      <div style="display:flex; gap:14px; align-items:stretch;">
        <div style="flex:1; min-width:0; display:flex; flex-direction:column; gap:10px;">{table_C()}{legende()}</div>
        {sheet_C()}
      </div>
    </main>
  </div>
</div>
''' + FOOT

# --- Dialogue « Saisie du mois » (options A et B) ---------------------------
def dialog():
    r = ROWS[1]
    g3 = 'display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap:12px;'
    return HEAD + f'''<div style="display:flex; align-items:center; justify-content:center; width:900px; height:720px; background:rgba(11,19,43,.45);">
  <div style="width:720px; border-radius:12px; background:{SURFACE}; box-shadow:0 8px 24px -8px rgba(21,28,24,.24), 0 2px 6px -2px rgba(21,28,24,.12); overflow:hidden;">
    <div style="display:flex; align-items:flex-start; justify-content:space-between; padding:20px 24px 14px;">
      <div><div style="font-size:18px; font-weight:600;">Saisie du mois — {r["nom"]}</div><div style="font-size:13px; color:{DOUCE}; margin-top:2px;">Éléments variables de septembre 2026. Le récapitulatif et le bulletin se recalculent à l'enregistrement.</div></div>
      <span style="color:{PALE};">{ico("x", 18)}</span>
    </div>
    <div style="padding:0 24px 20px; display:flex; flex-direction:column; gap:14px;">
      <div><div class="h2" style="margin-bottom:8px;">Temps de travail</div><div style="{g3}">{champ("Jours travaillés", "30", "j")}{champ("Congés pris", "2", "j", ro=True)}{champ("Absences", "0", "FCFA")}</div>
        <div style="font-size:11px; color:{PALE}; margin-top:6px;">Congés pris et jours travaillés viennent du planning des absences ; ils se modifient là-bas.</div></div>
      <div><div class="h2" style="margin-bottom:8px;">Gains</div><div style="{g3}">{champ("Primes fixes", fmt(r["pf"]))}{champ("Prime transport", fmt(r["tr"]))}{champ("Prime assiduité", fmt(r["ass"]))}{champ("Ind. logement", fmt(r["log"]))}{champ("Heures supplémentaires", fmt(r["hs"]))}{champ("Ancienneté", fmt(r["anc"]))}</div></div>
      <div><div class="h2" style="margin-bottom:8px;">Retenues</div><div style="display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:12px;">{champ("Sanctions", "0")}{champ("Dettes de soins", "0")}{champ("Acompte", "-5 000", "FCFA", err="Montant négatif interdit.")}{champ("Mutuelle", "2,5", "%")}</div></div>
      <div style="display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:8px; border-radius:10px; border:1px solid {FILET}; background:{PAPIER}; padding:12px 14px;">
        <div><span style="display:block; font-size:11px; color:{PALE};">Salaire de base</span><span class="mono" style="font-weight:600;">{fmt(r["base"])}</span></div>
        <div><span style="display:block; font-size:11px; color:{PALE};">Total 1</span><span class="mono" style="font-weight:600;">{fmt(r["total1"])}</span></div>
        <div><span style="display:block; font-size:11px; color:{PALE};">Mutuelle</span><span class="mono" style="font-weight:600;">{fmt(r["mutuelle"])}</span></div>
        <div><span style="display:block; font-size:11px; color:{PALE};">Net à payer</span><span class="mono" style="font-weight:600; color:{PROFOND};">{fmt(r["total2"])} FCFA</span></div>
      </div>
    </div>
    <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 24px; border-top:1px solid {FILET}; background:{PAPIER};">
      <span style="display:inline-flex; align-items:center; gap:6px; font-size:12px; color:{DOUCE};">{ico("info", 14, PALE)}Ctrl + Entrée pour enregistrer · Échap pour annuler</span>
      <div style="display:flex; gap:8px;"><span class="btn">Annuler</span><span class="btn pri">{ico("check", 14, "#fff", 2.6)}Enregistrer la saisie</span></div>
    </div>
  </div>
</div>
''' + FOOT

# --- États d'une cellule éditable (option A) --------------------------------
def etats():
    def card(t, d, inner):
        return f'<div style="display:flex; flex-direction:column; gap:10px; padding:14px; border-radius:10px; border:1px solid {FILET}; background:{SURFACE};"><div style="height:40px; display:flex; align-items:center; justify-content:flex-end; padding:0 8px; background:{BANDE}; border-radius:6px;" class="mono">{inner}</div><div><div style="font-size:12px; font-weight:600;">{t}</div><div style="font-size:11px; color:{DOUCE}; line-height:1.4;">{d}</div></div></div>'
    cards = [
        card("1 · Lecture", "Le trait pointillé signale la cellule modifiable. Une cellule calculée n'en a pas.", '<span class="ed" style="font-size:12px;">25 000</span>'),
        card("2 · Survol", "Contour et crayon apparaissent : on voit exactement ce qu'on va modifier (ligne + colonne dans le libellé accessible).", f'<span class="ed hov" style="font-size:12px;">25 000</span>'),
        card("3 · Édition", "Un clic ou Entrée : anneau céruléen, saisie au clavier, Tab passe à la cellule suivante de la ligne.", '<span class="ed on" style="font-size:12px;">25 0<span style="border-left:1.5px solid #0b132b; margin-left:1px;"></span></span>'),
        card("4 · Modifié, enregistrement…", "À la sortie du champ la mutation part seule (pas de bouton Enregistrer). Teinte ocre le temps du serveur.", '<span class="ed mod" style="font-size:12px;">27 500</span>'),
        card("5 · Enregistré", "Le total 1 / total 2 de la ligne et le pied de tableau se recalculent ; un toast confirme.", f'<span class="ed" style="font-size:12px;">27 500</span><span style="display:inline-flex; margin-left:6px; width:16px; height:16px; border-radius:9999px; background:#ecfdf5; align-items:center; justify-content:center;">{ico("check", 10, "#047857", 3)}</span>'),
        card("6 · Mois clôturé", "Aucune cellule éditable : verrou dans la barre de contrôle, chiffres figés (snapshot).", f'<span class="ed ro" style="font-size:12px;">27 500</span><span style="margin-left:6px; color:{PALE};">{ico("lock", 12, PALE)}</span>'),
    ]
    return HEAD + f'''<div style="width:1180px; height:300px; background:{PAPIER}; padding:20px; display:flex; flex-direction:column; gap:12px;">
  <div style="display:flex; align-items:baseline; gap:12px;"><span style="font-size:16px; font-weight:600;">Cellule éditable — les 6 états</span><span style="font-size:12px; color:{DOUCE};">Ce qui rend la modification sans ambiguïté dans l'option A. Composant <span class="mono">CelluleNombre</span> (app/champs.tsx), libellé = « Acompte — AMEFFO Lucie C. ».</span></div>
  <div style="display:grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap:12px;">{"".join(cards)}</div>
</div>
''' + FOOT

def write(name, html):
    with open(os.path.join(OUT, name), "w", encoding="utf-8", newline="\n") as f:
        f.write(html)
    print("écrit", name, len(html))

write("Main.dc.html", page_A())
write("OptionB.dc.html", page_B())
write("OptionC.dc.html", page_C())
write("SaisieDuMois.dc.html", dialog())
write("EtatsCellule.dc.html", etats())

canvas = {
    "artboards": [
        {"file": "Main.dc.html", "title": "Option A — Tout visible (rail + densité registre)", "x": 0, "y": 0, "w": 1440, "h": 900},
        {"file": "EtatsCellule.dc.html", "title": "Option A — États d'une cellule éditable", "x": 0, "y": 1040, "w": 1180, "h": 300},
        {"file": "OptionB.dc.html", "title": "Option B — Groupes de colonnes repliables", "x": 1560, "y": 0, "w": 1440, "h": 900},
        {"file": "SaisieDuMois.dc.html", "title": "Options A et B — Dialogue « Saisie du mois »", "x": 1560, "y": 1040, "w": 900, "h": 720},
        {"file": "OptionC.dc.html", "title": "Option C — Synthèse 8 colonnes + fiche latérale", "x": 3120, "y": 0, "w": 1440, "h": 900},
    ],
    "annotations": [
        {"id": "brief", "x": 0, "y": -230, "w": 620, "text": "Récapitulatif salaires — 3 façons de tenir 18 colonnes\n\nContrainte : toutes les colonnes visibles d'un coup si possible ; sinon une navigation simple et une modification sans ambiguïté.\n\nA · Tout visible : sidebar repliée en rail (64 px) + densité « registre » → les 18 colonnes tiennent en 1336 px, sans défilement horizontal à 1440. Édition directe dans la cellule (crayon), les cellules composées (primes, HS/anc.) s'ouvrent en mini-fenêtre.\n\nB · Groupes repliables : sidebar complète ; Base / Gains / Retenues / Net se replient sur leur total. Édition par le dialogue « Saisie du mois ». Tout déplier = défilement horizontal, colonne des noms figée.\n\nC · Synthèse + fiche : 8 colonnes de lecture, la ligne s'ouvre dans un volet latéral avec les 13 champs groupés et l'aperçu en direct. Le plus simple à lire, un clic de plus pour saisir."},
        {"id": "a-note", "x": 1240, "y": 1040, "w": 200, "text": "Commun aux 3 options :\n· barre de contrôle 50 px (période, statut, taux, actions)\n· 4 tuiles KPI fines\n· pied de tableau à filet double\n· clôture par BoutonConfirmation\n· toasts sonner"},
    ],
    "launch": {"view": "canvas"},
}
with open(os.path.join(OUT, "canvas.json"), "w", encoding="utf-8") as f:
    json.dump(canvas, f, ensure_ascii=False, indent=2)
print("canvas.json ok")
