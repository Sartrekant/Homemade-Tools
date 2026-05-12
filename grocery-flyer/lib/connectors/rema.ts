// REMA 1000 API connector
// Documentation: https://apiportal.rema.no
// Auth: Subscription key — register at https://apiportal.rema.no
// Terms: API must only be used to advertise REMA 1000 stores/products.
//        Commercial use (charging users / generating revenue) may require license fee.

import type { Catalog, ConnectorResult, Offer, Store } from "@/lib/types";
import { MOCK_CATALOGS, MOCK_OFFERS, MOCK_STORES } from "@/lib/mock-data";

const BASE_URL = "https://api.rema.no";
const USE_MOCK = !process.env.REMA_SUBSCRIPTION_KEY;

function headers(): HeadersInit {
  const key = process.env.REMA_SUBSCRIPTION_KEY;
  if (!key) throw new Error("REMA_SUBSCRIPTION_KEY is not set");
  return {
    "Ocp-Apim-Subscription-Key": key,
    "Content-Type": "application/json",
  };
}

// --- Offers ---
// The offers endpoint is user-scoped in the official API.
// For a general product/offer catalog we use the public storefront endpoint
// that the REMA 1000 website and app use.

interface RemaOffer {
  id: string | number;
  name: string;
  description?: string;
  pricing?: {
    price: number;
    original_price?: number;
    is_on_sale: boolean;
    price_per_unit?: string;
  };
  underline?: string;
  image?: { thumbnail?: { url: string } };
  valid_from?: string;
  valid_to?: string;
  ean?: string;
}

export async function getOffers(
  storeId?: string
): Promise<ConnectorResult<Offer[]>> {
  if (USE_MOCK) {
    return { ok: true, data: MOCK_OFFERS.filter((o) => o.source === "rema") };
  }
  try {
    // The official portal endpoint — falls back to store-specific offers if storeId given
    const path = storeId
      ? `/gordo/offers/${storeId}`
      : `/gordo/offers`;

    const res = await fetch(`${BASE_URL}${path}`, {
      headers: headers(),
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return { ok: false, error: await res.text(), statusCode: res.status };
    }

    const raw: RemaOffer[] = await res.json();

    const offers: Offer[] = raw.map((o) => ({
      id: `rema-${o.id}`,
      source: "rema",
      chain: "rema1000",
      name: o.name,
      description: o.description ?? o.underline,
      originalPrice: o.pricing?.original_price,
      offerPrice: o.pricing?.price,
      discountPercent:
        o.pricing?.original_price && o.pricing?.price
          ? Math.round(
              ((o.pricing.original_price - o.pricing.price) /
                o.pricing.original_price) *
                100
            )
          : undefined,
      currency: "DKK",
      unit: o.pricing?.price_per_unit,
      imageUrl: o.image?.thumbnail?.url,
      validFrom: o.valid_from,
      validUntil: o.valid_to,
      storeId: storeId,
      ean: o.ean,
    }));

    return { ok: true, data: offers };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// --- Stores ---

interface RemaStore {
  id: string | number;
  name: string;
  address: string;
  city: string;
  zip_code: string;
  latitude?: number;
  longitude?: number;
  opening_hours?: {
    monday?: { open: string; close: string };
    tuesday?: { open: string; close: string };
    wednesday?: { open: string; close: string };
    thursday?: { open: string; close: string };
    friday?: { open: string; close: string };
    saturday?: { open: string; close: string };
    sunday?: { open: string; close: string };
  };
}

export async function getStores(
  zip?: string
): Promise<ConnectorResult<Store[]>> {
  if (USE_MOCK) {
    return { ok: true, data: MOCK_STORES.filter((s) => s.source === "rema") };
  }
  try {
    const url = zip
      ? `${BASE_URL}/stores?zip=${zip}&country=DK`
      : `${BASE_URL}/stores?country=DK`;

    const res = await fetch(url, {
      headers: headers(),
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return { ok: false, error: await res.text(), statusCode: res.status };
    }

    const raw: RemaStore[] = await res.json();

    const stores: Store[] = raw.map((s) => ({
      id: `rema-${s.id}`,
      source: "rema",
      chain: "rema1000",
      name: s.name,
      address: s.address,
      city: s.city,
      zipCode: s.zip_code,
      lat: s.latitude,
      lng: s.longitude,
      openingHours: s.opening_hours,
    }));

    return { ok: true, data: stores };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// --- Catalogs (tilbudsaviser) ---

interface RemaCatalog {
  id: string;
  title: string;
  valid_from: string;
  valid_to: string;
  cover_image?: string;
  page_count?: number;
  pdf_url?: string;
  web_url?: string;
}

export async function getCatalogs(): Promise<ConnectorResult<Catalog[]>> {
  if (USE_MOCK) {
    return { ok: true, data: MOCK_CATALOGS.filter((c) => c.source === "rema") };
  }
  try {
    const res = await fetch(`${BASE_URL}/catalogs`, {
      headers: headers(),
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return { ok: false, error: await res.text(), statusCode: res.status };
    }

    const raw: RemaCatalog[] = await res.json();

    const catalogs: Catalog[] = raw.map((c) => ({
      id: `rema-catalog-${c.id}`,
      source: "rema",
      chain: "rema1000",
      title: c.title,
      validFrom: c.valid_from,
      validUntil: c.valid_to,
      coverImageUrl: c.cover_image,
      pageCount: c.page_count,
      pdfUrl: c.pdf_url,
      webUrl: c.web_url,
    }));

    return { ok: true, data: catalogs };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
