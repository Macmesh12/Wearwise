import type { IncomingMessage, ServerResponse } from "node:http";

type SharedProduct = {
  name: string;
  description: string | null;
  price: number | string;
  image_paths: string[] | null;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function respond(
  response: ServerResponse,
  status: number,
  title: string,
  message: string,
) {
  response.statusCode = status;
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#141414">
    <title>${escapeHtml(title)} | WearWise</title>
  </head>
  <body style="margin:0;background:#f4f3ef;color:#171815;font:16px/1.5 Georgia,serif">
    <main style="max-width:560px;margin:12vh auto;padding:32px">
      <a href="/" style="color:inherit;text-decoration:none;font:900 15px Arial,sans-serif;letter-spacing:2px">WEAR<span style="color:#85877d">WISE</span></a>
      <h1 style="margin:44px 0 12px;font-size:32px">${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      <a href="/" style="display:inline-block;margin-top:18px;padding:13px 20px;background:#171815;color:white;text-decoration:none;font:700 13px Arial,sans-serif">Visit WearWise</a>
    </main>
  </body>
</html>`);
}

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
) {
  const requestUrl = new URL(request.url ?? "/", "https://wearwise.invalid");
  const productId = requestUrl.searchParams.get("id") ?? "";
  const imageIndex = Number.parseInt(requestUrl.searchParams.get("image") ?? "0", 10);
  if (!/^[0-9a-f-]{36}$/i.test(productId)) {
    respond(response, 400, "Product unavailable", "This product link is not valid.");
    return;
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    respond(
      response,
      503,
      "Product preview unavailable",
      "The product preview is temporarily unavailable. Please open WearWise to browse the shop.",
    );
    return;
  }

  const query = new URL("/rest/v1/store_items", supabaseUrl);
  query.search = new URLSearchParams({
    select: "name,description,price,image_paths",
    id: `eq.${productId}`,
    is_published: "eq.true",
    is_available: "eq.true",
    limit: "1",
  }).toString();

  let product: SharedProduct | undefined;
  try {
    const result = await fetch(query, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    });
    if (!result.ok) {
      respond(
        response,
        502,
        "Product preview unavailable",
        "We could not load this product preview right now.",
      );
      return;
    }
    product = ((await result.json()) as SharedProduct[])[0];
  } catch {
    respond(
      response,
      502,
      "Product preview unavailable",
      "We could not load this product preview right now.",
    );
    return;
  }
  if (!product) {
    respond(
      response,
      404,
      "Product unavailable",
      "This product may have been removed from the shop.",
    );
    return;
  }

  const imagePaths = product.image_paths ?? [];
  const chosenImageIndex =
    Number.isInteger(imageIndex) && imageIndex >= 0 && imageIndex < imagePaths.length
      ? imageIndex
      : 0;
  const imagePath = imagePaths[chosenImageIndex];
  const imageUrl = imagePath
    ? `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/store-items/${imagePath
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`
    : "";
  const name = escapeHtml(product.name);
  const description = escapeHtml(
    product.description?.trim() ||
      `GHS ${Number(product.price).toLocaleString()} · Ghanaian streetwear from WearWise.`,
  );
  const price = `GHS ${Number(product.price).toLocaleString()}`;
  const host = request.headers["x-forwarded-host"] ?? request.headers.host;
  const safeHost =
    typeof host === "string" && /^[a-z0-9.-]+(?::\d+)?$/i.test(host)
      ? host
      : "wearwise.invalid";
  const protocol =
    request.headers["x-forwarded-proto"] === "http" ? "http" : "https";
  const origin = `${protocol}://${safeHost}`;
  const destination = `${origin}/?product=${encodeURIComponent(productId)}`;
  const shareUrl = `${origin}/share/product/${encodeURIComponent(productId)}/${chosenImageIndex}`;
  const imageMeta = imageUrl
    ? `<meta property="og:image" content="${escapeHtml(imageUrl)}">
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}">`
    : "";

  response.statusCode = 200;
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  response.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#141414">
    <title>${name} | WearWise</title>
    <meta name="description" content="${description}">
    <meta property="og:type" content="product">
    <meta property="og:site_name" content="WearWise">
    <meta property="og:title" content="${name} | WearWise">
    <meta property="og:description" content="${escapeHtml(`${price} · ${product.description?.trim() || "Ghanaian streetwear from WearWise."}`)}">
    <meta property="og:url" content="${escapeHtml(shareUrl)}">
    ${imageMeta}
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${name} | WearWise">
    <meta name="twitter:description" content="${description}">
  </head>
  <body style="margin:0;background:#f4f3ef;color:#171815;font:16px/1.5 Georgia,serif">
    <main style="max-width:720px;margin:6vh auto;padding:24px">
      <a href="/" style="color:inherit;text-decoration:none;font:900 15px Arial,sans-serif;letter-spacing:2px">WEAR<span style="color:#85877d">WISE</span></a>
      <article style="margin-top:28px;background:#fff">
        ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${name}" style="display:block;width:100%;max-height:68vh;object-fit:cover">` : ""}
        <div style="padding:24px">
          <span style="font:800 10px Arial,sans-serif;letter-spacing:2px;color:#777">WEARWISE / SHOP</span>
          <h1 style="margin:10px 0;font-size:30px">${name}</h1>
          <p style="color:#666">${description}</p>
          <strong style="font:800 18px Arial,sans-serif">${escapeHtml(price)}</strong>
          <p><a href="${escapeHtml(destination)}" style="display:inline-block;margin-top:16px;padding:13px 20px;background:#171815;color:white;text-decoration:none;font:700 13px Arial,sans-serif">View product</a></p>
        </div>
      </article>
    </main>
    <script>window.location.replace(${JSON.stringify(destination)});</script>
  </body>
</html>`);
}
