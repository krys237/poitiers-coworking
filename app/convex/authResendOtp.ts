// Fournisseur « code à usage unique par e-mail » (OTP) pour Convex Auth.
// Le code à 6 chiffres est envoyé via l'API HTTP Resend — la même que le courrier de paie
// (`paiePdf.envoyerCourrier`), donc une seule clé `RESEND_API_KEY` sert aux deux usages.
import { Email } from "@convex-dev/auth/providers/Email";

const DUREE_S = 10 * 60; // validité du code
const MINUTES = Math.round(DUREE_S / 60);

// Code à 6 chiffres tiré du générateur cryptographique, sans biais modulo :
// 2^32 n'est pas un multiple de 10^6, on rejette la queue qui déséquilibrerait le tirage.
const PLAFOND = 4_294_000_000; // plus grand multiple de 10^6 sous 2^32
function codeOtp(): string {
  const buf = new Uint32Array(1);
  let n: number;
  do {
    crypto.getRandomValues(buf);
    n = buf[0];
  } while (n >= PLAFOND);
  return String(n % 1_000_000).padStart(6, "0");
}

const corpsHtml = (code: string) => `<!doctype html>
<html lang="fr"><body style="margin:0;padding:24px;background:#f4f6f3;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#16222e">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #d6ded4;border-radius:10px;padding:28px">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#48586a">POITIERS COWORKING</p>
    <h1 style="margin:0 0 18px;font-size:19px">Votre code de connexion</h1>
    <p style="margin:0 0 18px;font-size:14px;line-height:1.5">Saisissez ce code pour ouvrir votre session :</p>
    <p style="margin:0 0 18px;font-size:30px;font-weight:700;letter-spacing:.22em;text-align:center;padding:14px;background:#f4f6f3;border-radius:8px">${code}</p>
    <p style="margin:0;font-size:13px;line-height:1.5;color:#48586a">Ce code expire dans ${MINUTES} minutes et ne sert qu'une fois.
    Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : aucune session ne sera ouverte.</p>
  </div>
</body></html>`;

export const ResendOTP = Email({
  id: "resend-otp",
  maxAge: DUREE_S,
  async generateVerificationToken() {
    return codeOtp();
  },
  async sendVerificationRequest({ identifier: email, token }) {
    const key = process.env.RESEND_API_KEY;
    // Expéditeur : doit appartenir à un domaine vérifié chez Resend en production.
    const from = process.env.AUTH_EMAIL_FROM ?? "POITIERS COWORKING <onboarding@resend.dev>";

    if (!key) {
      // Sans clé, aucun envoi n'est possible. En développement on écrit le code dans les logs
      // Convex pour ne pas bloquer la mise au point ; en production on refuse franchement
      // plutôt que de laisser croire à un envoi. NE JAMAIS activer AUTH_DEV_BYPASS en production.
      if (process.env.AUTH_DEV_BYPASS === "true") {
        console.warn(`[auth] mode dev — code de connexion pour ${email} : ${token} (valable ${MINUTES} min)`);
        return;
      }
      throw new Error("Envoi d'e-mail non configuré : définir RESEND_API_KEY sur le déploiement Convex.");
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `Code de connexion : ${token}`,
        html: corpsHtml(token),
      }),
    });
    if (!res.ok) throw new Error(`Envoi du code impossible (Resend ${res.status}) : ${(await res.text()).slice(0, 300)}`);
  },
});
