import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply(405, { error: "Use POST to track an order." });

  const url = Deno.env.get("SUPABASE_URL"), serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return reply(503, { error: "Order lookup is temporarily unavailable." });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip)));
  const ipHash = [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const { data: allowed, error: limitError } = await admin.rpc("check_guest_order_rate_limit", { p_ip_hash: ipHash });
  if (limitError || !allowed) return reply(limitError ? 503 : 429, {
    error: limitError ? "Order lookup is temporarily unavailable." : "Too many lookups. Please try again later.",
  });

  const input = await request.json().catch(() => null);
  const orderCode = typeof input?.orderCode === "string" ? input.orderCode.trim().toUpperCase() : "";
  const lastFour = typeof input?.lastFour === "string" ? input.lastFour.replace(/\D/g, "") : "";
  if (!/^(WW|WQ)-[A-Z0-9]{8}$/.test(orderCode) || !/^\d{4}$/.test(lastFour)) {
    return reply(400, { error: "Enter a valid order code and the last four digits of the phone used at checkout." });
  }

  const { data: order, error } = await admin.from("orders")
    .select("id,order_code,customer_phone,status,payment_status,total_amount,amount_paid,currency_code,created_at,estimated_delivery_date")
    .eq("order_code", orderCode).maybeSingle();
  const phoneDigits = String(order?.customer_phone ?? "").replace(/\D/g, "");
  if (error || !order || phoneDigits.slice(-4) !== lastFour) {
    return reply(404, { error: "We couldn’t find an order with those details. Check the code and phone digits and try again." });
  }

  const { data: history, error: historyError } = await admin.from("order_status_history")
    .select("status,created_at").eq("order_id", order.id).order("created_at", { ascending: true }).limit(30);
  if (historyError) return reply(503, { error: "Order status is temporarily unavailable." });
  const timeline = history?.length ? history : [{ status: order.status, created_at: order.created_at }];
  return reply(200, {
    orderCode: order.order_code,
    status: order.status,
    paymentStatus: order.payment_status,
    amount: Number(order.total_amount),
    currency: order.currency_code,
    createdAt: order.created_at,
    estimatedDeliveryDate: order.estimated_delivery_date,
    history: timeline.map((entry) => ({ status: entry.status, createdAt: entry.created_at })),
  });
});
