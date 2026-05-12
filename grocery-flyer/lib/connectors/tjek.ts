// Tjek / eTilbudsavis connector
// Tjek A/S (formerly ShopGun) powers digital flyers for virtually all Danish supermarkets.
//
// API status: The v2 API (api.etilbudsavis.dk) was historically open.
// For commercial access contact: services@tjek.com
//
// This connector targets the legacy v2 REST API.
// If you get a 401/403, the endpoint has been closed — contact Tjek for a commercial agreement.

import type { Catalog, Chain, ConnectorResult, Offer } from "@/lib/types";

const BASE_URL = "https://api.etilbudsavis.dk/v2";

// Optional: Tjek may require an API key obtained from their developer console.
// Set TJEK_API_KEY if you have one; otherwise requests are sent without auth (legacy behavior).
function buildParams(extra: Record<string, string> = {}): URLSearchParams {
  const params = new URLSearchParams({
    r_locale: "da_DK",
    api_av: "0.3.0",
    ...extra,
  });
  const apiKey = process.env.TJEK_API_KEY;
  if (apiKey) params.set("api_key", apiKey);
  return params;
}

// Maps Tjek dealer names to our Chain type
function mapDealer(dealer: string): Chain {
  const lower = dealer?.toLowerCase() ?? "";
  if (lower.includes("netto")) return "netto";
  if (lower.includes("føtex") || lower.includes("foetex")) return "foetex";
  if (lower.includes("bilka")) return "bilka";
  if (lower.includes("salling")) return "salling";
  if (lower.includes("rema")) return "rema1000";
  if (lower.includes("365")) return "365discount";
  if (lower.includes("kvickly")) return "kvickly";
  if (lower.includes("superbrugsen")) return "superbrugsen";
  if (lower.includes("dagli")) return "dagliBrugsen";
  if (lower.includes("meny")) return "meny";
  if (lower.includes("spar")) return "spar";
  if (lower.includes("lidl")) return "lidl";
  return "unknown";
}

// --- Offer search ---
// Search for offers across ALL Danish supermarkets simultaneously.
// This is the key advantage of Tjek: one call covers all chains.

interface TjekOffer {
  id: string;
  heading: string;
  description?: string;
  price?: { from: number; to: number; currency: string };
  quantity?: { from: number; to: number; unit?: string; pieces?: number };
  run_from?: string;
  run_till?: string;
  images?: { view: string; zoom: string; thumb: string };
  dealer?: { id: string; name: string };
  catalog_id?: string;
  store_id?: string;
}

export async function searchOffers(
  query: string,
  options: { lat?: number; lng?: number; radiusMeters?: number; limit?: number } = {}
): Promise<ConnectorResult<Offer[]>> {
  try {
    const params = buildParams({
      query,
      offset: "0",
      limit: String(options.limit ?? 24),
      ...(options.lat && options.lng
        ? {
            r_lat: String(options.lat),
            r_lng: String(options.lng),
            r_radius: String(options.radiusMeters ?? 10000),
          }
        : {}),
    });

    const res = await fetch(`${BASE_URL}/offers/search?${params}`, {
      next: { revalidate: 900 },
    });

    if (!res.ok) {
      return { ok: false, error: await res.text(), statusCode: res.status };
    }

    const raw: TjekOffer[] = await res.json();

    const offers: Offer[] = raw.map((o) => ({
      id: `tjek-${o.id}`,
      source: "tjek",
      chain: mapDealer(o.dealer?.name ?? ""),
      name: o.heading,
      description: o.description,
      offerPrice: o.price?.from,
      originalPrice: o.price?.to !== o.price?.from ? o.price?.to : undefined,
      currency: "DKK",
      unit: o.quantity?.unit,
      imageUrl: o.images?.view,
      validFrom: o.run_from,
      validUntil: o.run_till,
      catalogId: o.catalog_id,
      storeId: o.store_id,
    }));

    return { ok: true, data: offers };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// --- Catalogs (tilbudsaviser) ---
// Returns active catalogs/flyers — optionally filtered by dealer or location.

interface TjekCatalog {
  id: string;
  label: string;
  run_from: string;
  run_till: string;
  page_count?: number;
  images?: { view: string; zoom: string; thumb: string };
  pdf_url?: string;
  offer_count?: number;
  dealer?: { id: string; name: string };
  store_id?: string;
}

export async function getCatalogs(options: {
  lat?: number;
  lng?: number;
  radiusMeters?: number;
  dealerId?: string;
  limit?: number;
} = {}): Promise<ConnectorResult<Catalog[]>> {
  try {
    const params = buildParams({
      limit: String(options.limit ?? 50),
      ...(options.lat && options.lng
        ? {
            r_lat: String(options.lat),
            r_lng: String(options.lng),
            r_radius: String(options.radiusMeters ?? 25000),
          }
        : {}),
      ...(options.dealerId ? { dealer_id: options.dealerId } : {}),
    });

    const res = await fetch(`${BASE_URL}/catalogs?${params}`, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return { ok: false, error: await res.text(), statusCode: res.status };
    }

    const raw: TjekCatalog[] = await res.json();

    const catalogs: Catalog[] = raw.map((c) => ({
      id: `tjek-catalog-${c.id}`,
      source: "tjek",
      chain: mapDealer(c.dealer?.name ?? ""),
      title: c.label,
      validFrom: c.run_from,
      validUntil: c.run_till,
      pageCount: c.page_count,
      coverImageUrl: c.images?.view,
      pdfUrl: c.pdf_url,
    }));

    return { ok: true, data: catalogs };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// --- Session creation ---
// Some Tjek endpoints require an active session token.
// This creates an anonymous session and returns the token.

interface TjekSession {
  token: string;
  expires?: string;
  user?: { id: string; email?: string };
}

export async function createSession(): Promise<ConnectorResult<TjekSession>> {
  try {
    const res = await fetch(`${BASE_URL}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      return { ok: false, error: await res.text(), statusCode: res.status };
    }

    const session: TjekSession = await res.json();
    return { ok: true, data: session };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
