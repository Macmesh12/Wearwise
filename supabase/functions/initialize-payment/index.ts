import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
const reply = (status: number, data: Record<string, unknown>) => new Response(JSON.stringify(data), { status, headers: cors });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return reply(405, { error: "Use POST." });
  const url = Deno.env.get("SUPABASE_URL"), serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), paystackKey = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!url || !serviceKey || !paystackKey) return reply(503, { error: "Online payment is not configured yet." });
  const input = await request.json().catch(() => null);
  const orderCode = typeof input?.orderCode === "string" ? input.orderCode.trim().toUpperCase() : "";
  const phone = typeof input?.phone === "string" ? input.phone.trim() : "";
  const email = typeof input?.email === "string" ? input.email.trim().toLowerCase() : "";
  if (!orderCode || !phone || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(400, { error: "Enter your order code, phone number, and a valid email address." });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip)));
  const ipHash = [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const { data: allowed, error: limitError } = await admin.rpc("check_guest_order_rate_limit", { p_ip_hash: ipHash });
  if (limitError || !allowed) return reply(limitError ? 503 : 429, { error: limitError ? "Payment is temporarily unavailable." : "Too many attempts. Try again later." });

  const reference = `WW-${crypto.randomUUID().replaceAll("-", "")}`;
  const { data: reservation, error: reserveError } = await admin.rpc("reserve_paystack_checkout", {
    p_order_code: orderCode, p_phone: phone, p_email: email, p_reference: reference,
  });
  if (reserveError || !reservation) return reply(400, { error: reserveError?.message ?? "Could not prepare checkout. Please try again." });
  const amount = Number(reservation.amount);

  const siteUrl = Deno.env.get("SITE_URL") ?? "https://wearwise-gold.vercel.app";
  const callback = new URL("/payment-return", siteUrl);
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST", headers: { Authorization: `Bearer ${paystackKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, amount: Math.round(amount * 100), currency: "GHS", reference, callback_url: callback.toString(), metadata: { order_code: reservation.order_code } }),
  }).catch(() => null);
  const result = await response?.json().catch(() => null);
  if (!response?.ok || !result?.status || !result?.data?.authorization_url) {
    await admin.from("order_payments").update({ status: "failed", notes: "Paystack checkout initialization failed.", updated_at: new Date().toISOString() }).eq("provider_reference", reference);
    console.error("Paystack initialization failed", result?.message ?? response?.status);
    return reply(502, { error: "Checkout could not be started. Please try again or contact WearWise." });
  }
  return reply(200, { authorizationUrl: result.data.authorization_url });
});
