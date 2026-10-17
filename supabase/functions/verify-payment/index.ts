import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
const reply = (status: number, data: Record<string, unknown>) => new Response(JSON.stringify(data), { status, headers: cors });

async function verifyAndSettle(reference: string, admin: ReturnType<typeof createClient>, secret: string) {
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${secret}` } });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.status) throw new Error("Paystack could not verify this payment yet.");
  const payment = result.data;
  if (["failed", "abandoned", "reversed"].includes(payment.status)) {
    const { error: updateError } = await admin.from("order_payments")
      .update({ status: "failed", notes: `Paystack payment ${payment.status}.`, updated_at: new Date().toISOString() })
      .eq("provider", "paystack")
      .eq("transaction_type", "payment")
      .eq("provider_reference", reference)
      .eq("status", "pending");
    if (updateError) throw new Error("Payment was not completed. Please contact WearWise to retry.");
    return "failed";
  }
  if (payment.status !== "success") return "pending";
  const { data, error } = await admin.rpc("settle_paystack_order_payment", {
    p_reference: reference, p_amount: Number(payment.amount) / 100, p_currency: payment.currency, p_payment_method: payment.channel ?? "Paystack",
  });
  if (error) throw new Error("Payment needs support review. Contact WearWise with your order code.");
  return data === "already_settled" ? "paid" : "paid";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return reply(405, { error: "Use POST." });
  const url = Deno.env.get("SUPABASE_URL"), serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), secret = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!url || !serviceKey || !secret) return reply(503, { error: "Payment verification is temporarily unavailable." });
  const input = await request.json().catch(() => null);
  const reference = typeof input?.reference === "string" ? input.reference.trim() : "";
  if (!/^WW-[a-f0-9]{32}$/i.test(reference)) return reply(400, { error: "Invalid payment reference." });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const status = await verifyAndSettle(reference, admin, secret);
    return reply(200, { status });
  } catch (error) {
    console.error("Paystack payment verification error:", error instanceof Error ? error.message : "unknown");
    return reply(502, { error: error instanceof Error ? error.message : "We could not verify this payment yet." });
  }
});
