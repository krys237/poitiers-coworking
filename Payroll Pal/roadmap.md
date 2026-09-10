# Roadmap Paie Poitiers

## En attente (besoin des données réelles)
- [ ] Recevoir le fichier Excel complété (fonction, adresse, CNPS/NIU, jours travaillés) → importer → générer bulletins exacts
- [ ] Rattacher le vrai domaine d'envoi au bouton « Envoyer le PDF » → envoyer bulletin test → vérifier page Bulletins envoyés

## Déjà livré
- Module récapitulatif salaires + bulletins de paie liés
- 92 employés extraits du PDF (noms + montants + société)
- Fiche employé, saisie mensuelle, planning absences/congés
- Historique / archives, primes & charges, taux officiels, veille barème CNPS
- Courrier de paie + page Bulletins envoyés
- RBAC Admin/RH/Utilisateur

## Suivi (04/09)
- [x] Page Employés (/employes) : saisie ligne par ligne + import Excel/CSV
- [x] Liste des salaires (/liste-salaires) : colonnes SOFINA/SGC/SESAME/primes/total + génération des bulletins
- [ ] Envoi e-mail avec le vrai domaine (étape reportée à la demande de l'utilisateur)

- [x] Page « Bulletins du mois » : tous les bulletins A4 du mois, filtre mois/année, impression groupée

## Suivi (04/09 - suite)
- [ ] Import du vrai fichier Excel employés + alignement colonnes ↔ bulletin (fichier non encore reçu)
- [x] Saisie des jours de congés dans /planning et vérification dans les bulletins
- [ ] Rattacher le compte e-mail réel au bouton « Envoyer le PDF » + envoi automatique par employé (nécessite un domaine)
