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

const maxArtworkBytes = 5 * 1024 * 1024;
const artworkBucket = "customer-artwork";
const acceptedArtworkTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function hasValidImageSignature(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e &&
      bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a &&
      bytes[6] === 0x1a && bytes[7] === 0x0a;
  }
  if (mimeType === "image/webp") {
    return bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Use POST to submit an order request." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing Supabase server environment variables.");
    return jsonResponse(500, { error: "Order submission is temporarily unavailable." });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const requesterIp = request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const ipDigest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(requesterIp),
  );
  const ipHash = Array.from(new Uint8Array(ipDigest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  const { data: requestAllowed, error: rateLimitError } = await admin.rpc(
    "check_guest_order_rate_limit",
    { p_ip_hash: ipHash },
  );
  if (rateLimitError) {
    console.error("Guest order rate limit could not be checked:", rateLimitError.message);
    return jsonResponse(503, { error: "Order submission is temporarily unavailable. Please try again shortly." });
  }
  if (!requestAllowed) {
    return jsonResponse(429, { error: "Too many requests from this connection. Please try again later." });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return jsonResponse(400, { error: "The order request could not be read." });
  }

  // Hidden honeypot field used to screen out simple automated submissions.
  if (cleanText(formData.get("website"), 200)) {
    return jsonResponse(200, { ok: true, orderCode: "" });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return jsonResponse(400, { error: "Please review the form and try again." });
  }

  const orderType = payload.orderType;
  const customer = payload.customer as Record<string, unknown> | undefined;
  const delivery = payload.delivery as Record<string, unknown> | undefined;
  const customization = payload.customization as Record<string, unknown> | undefined;
  const designId = cleanText(payload.designId, 80);
  const productId = cleanText(payload.productId, 80);
  const customerName = cleanText(customer?.name, 120);
  const customerPhone = cleanText(customer?.phone, 40);
  const customerEmail = cleanText(customer?.email, 160);
  const customerRequest = cleanText(payload.customerRequest, 2000);
  const quantity = Number(payload.quantity);
  const rushDaysEarly = Number(payload.rushDaysEarly ?? 0);
  const method = cleanText(delivery?.method, 40);
  const requestedSize = cleanText(payload.size, 30);
  const requestedColor = cleanText(payload.color, 60);

  if (orderType !== "existing_design" && orderType !== "custom_design") {
    return jsonResponse(400, { error: "Choose an existing design or request a custom design." });
  }
  if (!productId || !customerName || !customerPhone || !method || !requestedSize || !requestedColor) {
    return jsonResponse(400, { error: "Fill in your shirt type, requested size and color, name, phone number, and delivery option." });
  }
  if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return jsonResponse(400, { error: "Enter a valid email address, or leave it blank." });
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
    return jsonResponse(400, { error: "Choose a quantity between 1 and 20." });
  }
  if (!Number.isInteger(rushDaysEarly) || rushDaysEarly < 0 || rushDaysEarly > 6) {
    return jsonResponse(400, { error: "Urgent delivery can be requested up to six days earlier." });
  }
  if (!["campus_handoff", "sister_office_handoff", "courier", "other"].includes(method)) {
    return jsonResponse(400, { error: "Choose one of the listed delivery options." });
  }
  if (method === "courier" && !cleanText(delivery?.address, 500)) {
    return jsonResponse(400, { error: "Add the delivery address for your courier request." });
  }
  if (orderType === "existing_design" && !designId) return jsonResponse(400, { error: "Select a design from the gallery first." });

  const fileValue = formData.get("artwork");
  let artworkFile: File | null = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
  if (artworkFile) {
    if (artworkFile.size > maxArtworkBytes) {
      return jsonResponse(400, { error: "Artwork must be 5 MB or smaller." });
    }
    if (!acceptedArtworkTypes.has(artworkFile.type)) {
      return jsonResponse(400, { error: "Upload a PNG, JPG, or WebP image." });
    }
    const bytes = new Uint8Array(await artworkFile.arrayBuffer());
    if (!hasValidImageSignature(bytes, artworkFile.type)) {
      return jsonResponse(400, { error: "That file does not appear to be a supported image." });
    }
    artworkFile = new File([bytes], "customer-artwork", { type: artworkFile.type });
  }

  const customText = cleanText(customization?.customText, 250);
  if (orderType === "custom_design" && !artworkFile && !designId && !customerRequest && !customText) {
    return jsonResponse(400, { error: "Describe your design idea or attach a reference image." });
  }

  const { data: product, error: productError } = await admin
    .from("products")
    .select("id, name, category, is_active")
    .eq("id", productId)
    .eq("is_active", true)
    .maybeSingle();

  if (productError || !product) {
    return jsonResponse(400, { error: "That shirt type is no longer available. Refresh the page and choose another." });
  }

  let designSnapshot: Record<string, unknown> = {};
  if (designId) {
    const { data: design, error: designError } = await admin
      .from("designs")
      .select("id, title, category, image_path, preview_path")
      .eq("id", designId)
      .eq("published", true)
      .maybeSingle();

    if (designError || !design) {
      return jsonResponse(400, { error: "That design is no longer available. Refresh the gallery and try again." });
    }
    if (design.category !== product.category) {
      return jsonResponse(400, { error: "Choose a shirt type that matches the selected design." });
    }
    designSnapshot = design;
  }

  if (artworkFile) {
    const { error: bucketError } = await admin.storage.createBucket(artworkBucket, {
      public: false,
      fileSizeLimit: maxArtworkBytes,
      allowedMimeTypes: [...acceptedArtworkTypes],
    });
    if (bucketError && !bucketError.message.toLowerCase().includes("already exists")) {
      console.error("Could not prepare private customer artwork storage:", bucketError.message);
      return jsonResponse(500, { error: "Artwork upload is temporarily unavailable. You can still submit the request without an image." });
    }
    const { data: bucket, error: bucketCheckError } = await admin.storage.getBucket(artworkBucket);
    if (bucketCheckError || bucket?.public !== false) {
      console.error("Customer artwork bucket must be private.", bucketCheckError?.message ?? "Bucket is public or unavailable.");
      return jsonResponse(500, { error: "Secure artwork storage is unavailable. You can still submit the request without an image." });
    }
  }

  const { data: createdOrder, error: createOrderError } = await admin
    .from("orders")
    .insert({
      order_type: orderType,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail || null,
      delivery_method: method,
      delivery_area: cleanText(delivery?.area, 120) || null,
      delivery_address: cleanText(delivery?.address, 500) || null,
      delivery_instructions: cleanText(delivery?.instructions, 500) || null,
      customer_request: customerRequest || null,
      selected_design_snapshot: designSnapshot,
      rush_days_early: rushDaysEarly,
    })
    .select("id, order_code")
    .single();

  if (createOrderError || !createdOrder) {
    console.error("Could not create WearWise order:", createOrderError?.message);
    return jsonResponse(500, { error: "We could not save your request. Please try again." });
  }

  let artworkPath: string | null = null;
  if (artworkFile) {
    const extension = artworkFile.type === "image/jpeg" ? "jpg" : artworkFile.type.split("/")[1];
    artworkPath = `${createdOrder.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await admin.storage
      .from(artworkBucket)
      .upload(artworkPath, artworkFile, {
        contentType: artworkFile.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Could not store customer artwork:", uploadError.message);
      await admin.from("orders").delete().eq("id", createdOrder.id);
      return jsonResponse(500, { error: "We could not save the artwork. Please try again without the image or choose a different file." });
    }

    const { error: updateArtworkError } = await admin
      .from("orders")
      .update({ customer_artwork_path: artworkPath, updated_at: new Date().toISOString() })
      .eq("id", createdOrder.id);
    if (updateArtworkError) {
      await admin.storage.from(artworkBucket).remove([artworkPath]);
      await admin.from("orders").delete().eq("id", createdOrder.id);
      return jsonResponse(500, { error: "We could not save the artwork. Please try again." });
    }
  }

  const itemDetails = {
    printPlacement: cleanText(customization?.printPlacement, 80),
    customText,
  };

  const { error: itemError } = await admin.from("order_items").insert({
    order_id: createdOrder.id,
    product_id: product.id,
    product_name_snapshot: product.name,
    category_snapshot: product.category,
    requested_size: requestedSize,
    requested_color: requestedColor,
    quantity,
    selected_design_snapshot: designSnapshot,
    customization_details: itemDetails,
  });

  if (itemError) {
    console.error("Could not save WearWise order item:", itemError.message);
    if (artworkPath) await admin.storage.from(artworkBucket).remove([artworkPath]);
    await admin.from("orders").delete().eq("id", createdOrder.id);
    return jsonResponse(500, { error: "We could not save your request. Please try again." });
  }

  return jsonResponse(201, { ok: true, orderCode: createdOrder.order_code });
});
