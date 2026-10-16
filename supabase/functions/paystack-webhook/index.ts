import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function isValidSignature(rawBody: Uint8Array, signature: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, rawBody));
  const expected = [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  if (expected.length !== signature.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return difference === 0;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const secret = Deno.env.get("PAYSTACK_SECRET_KEY"), url = Deno.env.get("SUPABASE_URL"), serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret || !url || !serviceKey) return new Response("Not configured", { status: 503 });
  const rawBody = new Uint8Array(await request.arrayBuffer());
  const signature = request.headers.get("x-paystack-signature") ?? "";
  if (!await isValidSignature(rawBody, signature, secret)) return new Response("Invalid signature", { status: 401 });
  const event = JSON.parse(new TextDecoder().decode(rawBody));
  if (event.event !== "charge.success" || !event.data?.reference) return new Response("Ignored", { status: 200 });

  // Verify with Paystack's API as well as authenticating the webhook signature.
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(event.data.reference)}`, { headers: { Authorization: `Bearer ${secret}` } });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.status || result.data?.status !== "success") return new Response("Verification pending", { status: 503 });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await admin.rpc("settle_paystack_order_payment", { p_reference: result.data.reference, p_amount: Number(result.data.amount) / 100, p_currency: result.data.currency, p_payment_method: result.data.channel ?? "Paystack" });
  if (error) {
    console.error("Paystack webhook settlement failed:", error.message);
    return new Response("Settlement failed", { status: 503 });
  }
  return new Response("OK", { status: 200 });
});
