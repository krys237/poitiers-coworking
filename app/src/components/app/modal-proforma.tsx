import { useRef } from "react";
import { X, Printer, Building2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fcfa } from "@/lib/format";
import logoPolyclinique from "@/assets/logo-polyclinique.png";

interface ModalProformaProps {
  ouverte: boolean;
  onFermer: () => void;
  commande: {
    reference: string;
    proformaRef?: string;
    date: string;
    type: string;
    libelle?: string;
    demandeur: string;
    service?: string;
    statut: string;
    validePar?: string;
    valideLe?: string;
    validateur?: string;
    fournisseur?: {
      nom: string;
      telephone: string;
      ville?: string;
    };
    lignes: {
      produit: string;
      dci?: string;
      quantite: number;
      prixUnitaire: number;
    }[];
    total: number;
  } | null;
}

export function ModalProforma({ ouverte, onFermer, commande }: ModalProformaProps) {
  const contenuRef = useRef<HTMLDivElement>(null);

  if (!ouverte || !commande) return null;

  const proformaNumero = commande.proformaRef || `PRO-${commande.reference}`;
  const dateFormatee = commande.date
    ? new Date(commande.date + "T00:00:00").toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "—";

  const handlePrint = () => {
    window.print();
  };

  const estValide = commande.statut === "validee" || commande.statut === "en_reception" || commande.statut === "cloturee" || commande.statut === "livree";

  return (
    <div id="modal-proforma" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white">
      {/* Conteneur de la feuille proforma */}
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto print:border-none print:shadow-none print:max-w-none print:w-full">
        {/* Barre d'outils supérieure (non imprimable) */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-100 border-b border-slate-200 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-ocean-nuit">
              Bon de commande proforma officiel
            </span>
            <span className="font-mono text-2xs px-2 py-0.5 rounded bg-ocean-ceruleen/20 text-ocean-profond font-bold">
              {proformaNumero}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              id="btn-imprimer-proforma"
              size="sm"
              onClick={handlePrint}
              className="bg-ocean-profond hover:bg-ocean-nuit text-white text-xs font-bold gap-1.5 shadow-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimer / Enregistrer PDF
            </Button>
            <Button
              id="btn-fermer-proforma"
              size="sm"
              variant="ghost"
              onClick={onFermer}
              className="text-slate-500 hover:text-slate-700 h-8 w-8 p-0 rounded-lg cursor-pointer"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Corps de la Feuille Proforma / Bon officiel Polyclinique */}
        <div ref={contenuRef} className="p-8 sm:p-12 space-y-6 text-slate-800 bg-white print:p-8">
          {/* En-tête institutionnel */}
          <div className="flex items-start justify-between border-b-2 border-ocean-profond pb-6 gap-6">
            <div className="flex items-center gap-4">
              <img
                src={logoPolyclinique}
                alt="Polyclinique de Poitiers"
                className="h-16 w-auto object-contain"
              />
              <div>
                <h1 className="text-lg font-black tracking-tight text-ocean-nuit uppercase">
                  Polyclinique de Poitiers
                </h1>
                <p className="text-2xs text-slate-500 font-medium">
                  Soins Médicaux · Chirurgie · Maternité · Laboratoire d'Analyses
                </p>
                <p className="text-3xs text-slate-400 mt-0.5">
                  BP 1254 Yaoundé — République du Cameroun · Tél : (+237) 222 00 00 00
                </p>
              </div>
            </div>

            <div className="text-right space-y-1">
              <span className="inline-block px-3 py-1 bg-ocean-nuit text-white font-mono text-xs font-bold uppercase tracking-wider rounded">
                Bon de commande proforma
              </span>
              <div className="text-xs font-bold text-ocean-profond font-mono">
                Réf : {proformaNumero}
              </div>
              <div className="text-2xs text-slate-500">
                Date d'émission : <span className="font-medium text-slate-700">{dateFormatee}</span>
              </div>
            </div>
          </div>

          {/* Cartouche Fournisseur & Informations Livraison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Destinataire / Fournisseur */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-ocean-profond">
                <Building2 className="h-3.5 w-3.5" />
                Fournisseur Destinataire
              </div>
              {commande.fournisseur ? (
                <div className="space-y-1">
                  <div className="font-bold text-sm text-slate-900">
                    {commande.fournisseur.nom}
                  </div>
                  <div className="font-mono text-2xs text-slate-600">
                    Tél : <span className="font-bold text-slate-800">{commande.fournisseur.telephone}</span>
                  </div>
                  {commande.fournisseur.ville && (
                    <div className="text-2xs text-slate-500">
                      Ville : {commande.fournisseur.ville}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-slate-400 italic">
                  Fournisseur général / Non spécifié
                </div>
              )}
            </div>

            {/* Cadre Dossier & Destination */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
              <div className="text-2xs font-bold uppercase tracking-wider text-slate-600">
                Destination & Service Demandeur
              </div>
              <div className="space-y-1 text-2xs">
                <div>
                  <span className="text-slate-500">Service : </span>
                  <span className="font-bold text-slate-800">{commande.service || "Services Généraux"}</span>
                </div>
                <div>
                  <span className="text-slate-500">Demandeur : </span>
                  <span className="font-semibold text-slate-800">{commande.demandeur}</span>
                </div>
                {commande.libelle && (
                  <div>
                    <span className="text-slate-500">Objet : </span>
                    <span className="text-slate-700">{commande.libelle}</span>
                  </div>
                )}
                <div>
                  <span className="text-slate-500">Flux : </span>
                  <span className="font-medium text-ocean-nuit">
                    {commande.type === "medicale"
                      ? "Pharmacie & Médicaments"
                      : commande.type === "reactifs_labo"
                      ? "Laboratoire (Réactifs)"
                      : "Fournitures générales"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tableau épuré des articles commandés (fiche extérieure propre) */}
          <div className="space-y-2">
            <div className="text-2xs font-bold uppercase tracking-wider text-slate-700">
              Désignation des fournitures commandées ({commande.lignes.length} article{commande.lignes.length > 1 ? "s" : ""})
            </div>

            <table className="w-full text-left text-xs border border-slate-300 border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold text-3xs uppercase tracking-wider border-b border-slate-300">
                  <th className="p-2.5 w-10 text-center border-r border-slate-300">#</th>
                  <th className="p-2.5 border-r border-slate-300">Désignation</th>
                  <th className="p-2.5 text-right w-24 border-r border-slate-300">Quantité</th>
                  <th className="p-2.5 text-right w-32 border-r border-slate-300">Prix Unit. (FCFA)</th>
                  <th className="p-2.5 text-right w-36">Montant Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {commande.lignes.map((l, i) => {
                  const total = (Number(l.quantite) || 0) * (Number(l.prixUnitaire) || 0);
                  return (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="p-2 text-center font-mono text-slate-400 text-2xs border-r border-slate-200">
                        {i + 1}
                      </td>
                      <td className="p-2 font-medium text-slate-900 border-r border-slate-200">
                        {l.produit}
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-slate-800 border-r border-slate-200">
                        {l.quantite}
                      </td>
                      <td className="p-2 text-right font-mono text-slate-700 border-r border-slate-200">
                        {fcfa(l.prixUnitaire)}
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-ocean-nuit">
                        {fcfa(total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                  <td colSpan={4} className="p-3 text-right text-xs text-slate-800 uppercase tracking-wider">
                    Total Général Arrêté TTC :
                  </td>
                  <td className="p-3 text-right font-mono text-sm text-ocean-profond font-extrabold">
                    {fcfa(commande.total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Validation & Signatures */}
          <div className="pt-4 border-t border-slate-200 space-y-4">
            <div className="text-2xs text-slate-600 italic">
              Arrêté le présent bon de commande proforma à la somme totale de :{" "}
              <b className="text-slate-900 font-mono">{fcfa(commande.total)}</b>.
            </div>

            <div className="grid grid-cols-2 gap-8 pt-4">
              {/* Visa Comptabilité */}
              <div className="rounded-xl border border-dashed border-slate-300 p-4 min-h-[110px] flex flex-col justify-between">
                <span className="text-3xs uppercase font-bold text-slate-500">
                  Établi par le Service Comptabilité / Demandeur
                </span>
                <div className="text-2xs font-semibold text-slate-800">
                  {commande.demandeur}
                </div>
              </div>

              {/* Visa Direction Générale */}
              <div className="rounded-xl border border-ocean-profond/40 bg-ocean-ceruleen/5 p-4 min-h-[110px] flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-3xs uppercase font-bold text-ocean-profond">
                    Visa & Signature Direction Générale
                  </span>
                  {estValide && (
                    <span className="text-emerald-700 flex items-center gap-1 font-bold text-3xs bg-emerald-100 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="h-3 w-3" /> Validé
                    </span>
                  )}
                </div>
                <div className="space-y-0.5 text-2xs">
                  <div className="font-bold text-ocean-nuit">
                    {commande.validateur || "Direction Générale"}
                  </div>
                  {commande.valideLe && (
                    <div className="text-3xs text-slate-500 font-mono">
                      Approuvé le {new Date(commande.valideLe).toLocaleDateString("fr-FR")}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
