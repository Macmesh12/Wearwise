import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: cors });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: cors });
  if (request.method !== "POST") return reply(405, { error: "Use POST." });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT");
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  if (
    !url ||
    !serviceKey ||
    !vapidSubject ||
    !vapidPublicKey ||
    !vapidPrivateKey
  ) {
    return reply(503, { error: "Push notifications are not configured." });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  const input = await request.json().catch(() => null);
  const notificationId =
    typeof input?.notificationId === "string"
      ? input.notificationId
      : typeof input?.record?.id === "string"
        ? input.record.id
        : "";
  if (!notificationId)
    return reply(400, { error: "notificationId is required." });

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
  const { data: notification, error: notificationError } = await admin
    .from("admin_notifications")
    .select("id,title,body")
    .eq("id", notificationId)
    .single();
  if (notificationError || !notification)
    return reply(404, { error: "Notification not found." });

  const { data: subscriptions, error: subscriptionError } = await admin
    .from("push_subscriptions")
    .select("id,endpoint,subscription");
  if (subscriptionError)
    return reply(500, { error: subscriptionError.message });

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    url: "/admin",
  });
  let sent = 0;
  for (const subscription of subscriptions ?? []) {
    try {
      await webpush.sendNotification(subscription.subscription, payload);
      sent += 1;
    } catch (error) {
      const statusCode =
        error instanceof webpush.WebPushError ? error.statusCode : 0;
      if (statusCode === 404 || statusCode === 410) {
        await admin
          .from("push_subscriptions")
          .delete()
          .eq("id", subscription.id);
      }
    }
  }
  return reply(200, { ok: true, sent });
});
