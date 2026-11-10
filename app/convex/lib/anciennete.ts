// Les deux colonnes d'ancienneté — logique PURE (lot R10, point A6).
//
// LA DISTINCTION, telle que la RH l'a expliquée le 05/11/2026
//
// « Il n'y a qu'UNE prime d'ancienneté. Il y a une prime d'ancienneté de base (disons 2 000 F) ;
//   la nouvelle année son montant peut être de 3 000 F, cela veut dire que 1 000 F s'ajoutent à la
//   prime existante, donc dans la case nouvelle ancienneté on va mettre 1 000 F et ce sera juste à
//   titre indicatif ; c'est le 3 000 global qui sera finalement considéré. »
//
// Donc :
//   `anciennete`        = le montant TOTAL, celui qui entre dans les assiettes et le brut ;
//   `ancienneteSeparee` = l'AUGMENTATION de l'année, affichée pour mémoire et comptée nulle part.
//
// Ce module calcule la seconde à partir de la première et de celle du mois précédent, pour que la
// RH n'ait pas à faire la soustraction — c'est la demande « prime d'ancienneté et nouvelle
// ancienneté qui s'incrémentent ensemble » du 03/11/2026.
//
// ⚠️ La valeur proposée n'est JAMAIS écrite d'office. La RH la voit, et l'accepte ou la corrige :
// une augmentation peut porter sur un mois autre que celui où le montant change en base (rappel,
// rattrapage, correction d'une saisie antérieure), et nous n'avons aucun moyen de le savoir.

export interface Augmentation {
  /** Ce qu'on propose de mettre dans la case indicative. Jamais négatif. */
  proposee: number;
  /** L'écart réel, signé. Négatif = la prime a BAISSÉ. */
  variation: number;
  precedente: number;
  nouvelle: number;
  /** Vrai si la prime a baissé : à signaler, car « augmentation » n'a alors plus de sens. */
  baisse: boolean;
  /** Vrai si aucun mois précédent n'est connu : la variation n'est pas calculable. */
  sansReference: boolean;
  /** Phrase affichable, qui dit d'où vient le chiffre. */
  explication: string;
}

const arr = (n: number) => Math.round(n || 0);
const fmt = (n: number) => n.toLocaleString("fr-FR").replace(/ /g, " ");

/**
 * L'augmentation d'ancienneté à proposer, d'après le montant du mois précédent.
 *
 * `precedente` absente = premier mois connu du salarié : on ne propose rien plutôt que de
 * proposer le montant entier, qui serait faux — une prime existante n'est pas une augmentation.
 */
export function augmentationAnciennete(
  precedente: number | undefined,
  nouvelle: number,
): Augmentation {
  const n = arr(nouvelle);
  const sansReference = precedente === undefined || precedente === null;
  const p = arr(precedente ?? 0);
  const variation = sansReference ? 0 : n - p;

  const explication = sansReference
    ? "Aucun mois précédent connu : l'augmentation n'est pas calculable, la case reste à votre main."
    : variation > 0
      ? `La prime passe de ${fmt(p)} à ${fmt(n)} FCFA, soit ${fmt(variation)} FCFA de plus.`
      : variation < 0
        ? `⚠️ La prime BAISSE de ${fmt(p)} à ${fmt(n)} FCFA. « Augmentation » n'a pas de sens ici : vérifiez la saisie.`
        : `La prime est inchangée à ${fmt(n)} FCFA : aucune augmentation à signaler.`;

  return {
    proposee: Math.max(0, variation),
    variation,
    precedente: p,
    nouvelle: n,
    baisse: variation < 0,
    sansReference,
    explication,
  };
}

/**
 * Contrôle de cohérence d'une saisie des deux colonnes, sans rien corriger.
 *
 * Le cas qu'il attrape et qui compte : l'augmentation saisie DÉPASSE le total. Impossible —
 * l'augmentation est une part du total. C'est le signe que la RH a inversé les deux cases, et
 * depuis la correction du 05/11 cette inversion fait DISPARAÎTRE le montant du brut au lieu de le
 * doubler. Un message vaut mieux qu'un bulletin silencieusement amputé.
 */
export function controlerAnciennete(args: {
  anciennete: number;
  ancienneteSeparee?: number;
  precedente?: number;
}): string[] {
  const total = arr(args.anciennete);
  const supp = arr(args.ancienneteSeparee ?? 0);
  const erreurs: string[] = [];

  if (supp > total && total > 0)
    erreurs.push(
      `L'augmentation (${fmt(supp)}) dépasse le total (${fmt(total)}) : les deux cases sont ` +
        "probablement inversées. Le total est ce qui est payé ; l'augmentation n'en est qu'une part.",
    );
  if (supp && !total)
    erreurs.push(
      `Une augmentation de ${fmt(supp)} est saisie sans montant total. Seul le total est payé : ` +
        "la case indicative ne produit aucun franc.",
    );
  if (supp < 0) erreurs.push("L'augmentation ne peut pas être négative.");

  if (args.precedente !== undefined) {
    const attendue = augmentationAnciennete(args.precedente, total);
    if (supp && attendue.variation > 0 && supp !== attendue.variation)
      erreurs.push(
        `L'augmentation saisie (${fmt(supp)}) ne correspond pas à l'écart avec le mois précédent ` +
          `(${fmt(attendue.variation)}). Ce n'est pas forcément une erreur — un rattrapage par ` +
          "exemple — mais vérifiez.",
      );
  }
  return erreurs;
}
