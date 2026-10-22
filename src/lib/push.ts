import { supabase } from "./supabase";

const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as
  | string
  | undefined;

function decodeBase64Url(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const decoded = atob(
    `${value.replace(/-/g, "+").replace(/_/g, "/")}${padding}`,
  );
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

export async function enablePushNotifications() {
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    throw new Error("This browser does not support push notifications.");
  }
  if (!vapidPublicKey)
    throw new Error("Push notifications are not configured yet.");
  const registration = await navigator.serviceWorker.register("/sw.js");
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error("Notification permission was not granted.");
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeBase64Url(vapidPublicKey),
  });
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      endpoint: subscription.endpoint,
      subscription: subscription.toJSON(),
      user_agent: navigator.userAgent,
    },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(error.message);
}
