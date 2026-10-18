import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse(405, { error: "Use POST to place a shop order." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse(503, { error: "Shop checkout is temporarily unavailable." });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip)));
  const ipHash = [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const { data: allowed, error: rateLimitError } = await admin.rpc("check_guest_order_rate_limit", {
    p_ip_hash: ipHash,
  });
  if (rateLimitError || !allowed) {
    return jsonResponse(rateLimitError ? 503 : 429, {
      error: rateLimitError ? "Checkout is temporarily unavailable." : "Too many attempts. Please try again later.",
    });
  }

  const input = await request.json().catch(() => null);
  if (!input || typeof input !== "object") return jsonResponse(400, { error: "Review the checkout details and try again." });

  const itemId = cleanText(input.itemId, 50);
  const quantity = Number(input.quantity);
  const size = cleanText(input.size, 40);
  const color = cleanText(input.color, 60);
  const customer = input.customer && typeof input.customer === "object" ? input.customer : {};
  const delivery = input.delivery && typeof input.delivery === "object" ? input.delivery : {};
  const customerName = cleanText(customer.name, 120);
  const customerPhone = cleanText(customer.phone, 40);
  const customerEmail = cleanText(customer.email, 160).toLowerCase();
  const deliveryMethod = cleanText(delivery.method, 40);

  if (!/^[0-9a-f-]{36}$/i.test(itemId)) return jsonResponse(400, { error: "That shop item could not be found." });
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) return jsonResponse(400, { error: "Choose a quantity between 1 and 20." });
  if (customerName.length < 2 || customerPhone.replace(/\D/g, "").length < 7) {
    return jsonResponse(400, { error: "Enter your name and a valid phone number." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return jsonResponse(400, { error: "Enter a valid email address for your payment receipt." });
  }
  if (!["campus_handoff", "sister_office_handoff", "courier", "other"].includes(deliveryMethod)) {
    return jsonResponse(400, { error: "Choose one of the delivery methods." });
  }

  const { data, error } = await admin.rpc("create_store_purchase", {
    p_item_id: itemId,
    p_quantity: quantity,
    p_size: size,
    p_color: color,
    p_customer_name: customerName,
    p_customer_phone: customerPhone,
    p_customer_email: customerEmail,
    p_delivery_method: deliveryMethod,
    p_delivery_area: cleanText(delivery.area, 120),
    p_delivery_address: cleanText(delivery.address, 500),
    p_delivery_instructions: cleanText(delivery.instructions, 500),
  });

  if (error || !data) {
    const message = error?.message ?? "We could not place this order. Please try again.";
    return jsonResponse(400, { error: message.replace(/^.*?ERROR:\s*/i, "").replace(/\s*CONTEXT:.*$/is, "") });
  }

  return jsonResponse(201, { ok: true, ...data });
});
