import webpush from "web-push";

let configured = false;

/**
 * Instância do web-push já configurada com as chaves VAPID.
 * Retorna null quando as variáveis não estão presentes (ex.: em dev sem as
 * envs) — nesse caso o cron de lembretes pula o envio em vez de quebrar.
 */
export function getWebPush() {
  if (configured) return webpush;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (publicKey && privateKey && subject) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
    return webpush;
  }
  return null;
}