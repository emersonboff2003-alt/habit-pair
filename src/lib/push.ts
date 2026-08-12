// =============================================================================
// Utilitários de Web Push no navegador.
// Toda a persistência acontece via Server Actions (src/lib/actions/push.ts);
// estas funções cuidam apenas da permissão + assinatura do dispositivo.
// =============================================================================

export type PushPermissionState = NotificationPermission | "unsupported";

export function notificationPermissionStatus(): PushPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/** Converte uma chave pública base64url (VAPID) para Uint8Array. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

async function ensureRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

/** Pede permissão e assina o dispositivo nas notificações push. */
export async function subscribeDevice(): Promise<PushSubscription | null> {
  if (typeof window === "undefined" || !("Notification" in window)) return null;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) return null;

  const registration = await ensureRegistration();
  if (!registration) return null;

  try {
    return await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  } catch {
    return registration.pushManager.getSubscription();
  }
}

/** Retorna a assinatura atual do dispositivo (se existir). */
export async function getDeviceSubscription(): Promise<PushSubscription | null> {
  const registration = await ensureRegistration();
  if (!registration) return null;
  try {
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/** Remove a assinatura deste dispositivo. */
export async function unsubscribeDevice(): Promise<boolean> {
  const subscription = await getDeviceSubscription();
  if (!subscription) return true;
  try {
    return await subscription.unsubscribe();
  } catch {
    return false;
  }
}

/** Serializa a assinatura para persistir no Supabase (push_subscriptions). */
export function pushSubscriptionToKeys(subscription: PushSubscription): {
  endpoint: string;
  p256dh: string;
  auth: string;
} {
  const json = subscription.toJSON();
  return {
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? "",
  };
}