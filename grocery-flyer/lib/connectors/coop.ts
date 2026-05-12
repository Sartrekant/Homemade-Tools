// Coop Danmark API connector
// Documentation: https://developer.cl.coop.dk
// Covers: 365discount, SuperBrugsen, Kvickly, Dagli'Brugsen, Brugsen
// Auth: Subscription key — register at https://developer.cl.coop.dk
// Key sent as header: Ocp-Apim-Subscription-Key

import type { Catalog, Chain, ConnectorResult, Offer } from "@/lib/types";
import { MOCK_CATALOGS, MOCK_OFFERS } from "@/lib/mock-data";

const BASE_URL = "https://api.cl.coop.dk";
const USE_MOCK = !process.env.COOP_SUBSCRIPTION_KEY;

function headers(): HeadersInit {
  const key = process.env.COOP_SUBSCRIPTION_KEY;
  if (!key) throw new Error("COOP_SUBSCRIPTION_KEY is not set");
  return {
    "Ocp-Apim-Subscription-Key": key,
    "Content-Type": "application/json",
  };
}

function mapDealerId(dealerId: string): Chain {
  // Coop uses dealer IDs — map known ones to chain names
  const map: Record<string, Chain> = {
    "365": "365discount",
    superbrugsen: "superbrugsen",
    kvickly: "kvickly",
    dagliBrugsen: "dagliBrugsen",
  };
  const lower = dealerId?.toLowerCase();
  for (const [key, chain] of Object.entries(map)) {
    if (lower?.includes(key.toLowerCase())) return chain;
  }
  return "unknown";
}

// --- eTilbudsavis Publications ---
// Returns all currently active Coop tilbudsavis publications

interface CoopPublication {
  id: string;
  dealerId: string;
  dealerName: string;
  title: string;
  validFrom: string;
  validTo: string;
  pageCount?: number;
  coverImage?: string;
  webUrl?: string;
  pdfUrl?: string;
}

export async function getPublications(): Promise<ConnectorResult<Catalog[]>> {
  if (USE_MOCK) {
    return {
      ok: true,
      data: MOCK_CATALOGS.filter((c) => c.source === "coop"),
    };
  }
  try {
    const res = await fetch(
      `${BASE_URL}/marketingapi/v1.1/marketing/etilbudsavispublications`,
      {
        headers: headers(),
        next: { revalidate: 3600 }, // cache 1 hour — publications change weekly
      }
    );

    if (!res.ok) {
      return { ok: false, error: await res.text(), statusCode: res.status };
    }

    const raw: CoopPublication[] = await res.json();

    const catalogs: Catalog[] = raw.map((p) => ({
      id: `coop-${p.id}`,
      source: "coop",
      chain: mapDealerId(p.dealerId ?? p.dealerName),
      title: p.title,
      validFrom: p.validFrom,
      validUntil: p.validTo,
      pageCount: p.pageCount,
      coverImageUrl: p.coverImage,
      webUrl: p.webUrl,
      pdfUrl: p.pdfUrl,
    }));

    return { ok: true, data: catalogs };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// --- iPaper Offers ---
// Returns campaign/offer data from the iPaper publication system

interface CoopIpaperOffer {
  id: string;
  publicationId: string;
  dealerName: string;
  heading: string;
  description?: string;
  price?: number;
  originalPrice?: number;
  currency?: string;
  validFrom?: string;
  validTo?: string;
  imageUrl?: string;
  ean?: string;
}

export async function getIpaperOffers(
  publicationId?: string
): Promise<ConnectorResult<Offer[]>> {
  if (USE_MOCK) {
    return {
      ok: true,
      data: MOCK_OFFERS.filter((o) => o.source === "coop"),
    };
  }
  try {
    const url = publicationId
      ? `${BASE_URL}/marketingapi/v1.1/marketing/ipaperOffers?publicationId=${publicationId}`
      : `${BASE_URL}/marketingapi/v1.1/marketing/ipaperOffers`;

    const res = await fetch(url, {
      headers: headers(),
      next: { revalidate: 1800 },
    });

    if (!res.ok) {
      return { ok: false, error: await res.text(), statusCode: res.status };
    }

    const raw: CoopIpaperOffer[] = await res.json();

    const offers: Offer[] = raw.map((o) => ({
      id: `coop-offer-${o.id}`,
      source: "coop",
      chain: mapDealerId(o.dealerName),
      name: o.heading,
      description: o.description,
      originalPrice: o.originalPrice,
      offerPrice: o.price,
      discountPercent:
        o.originalPrice && o.price
          ? Math.round(((o.originalPrice - o.price) / o.originalPrice) * 100)
          : undefined,
      currency: "DKK",
      imageUrl: o.imageUrl,
      validFrom: o.validFrom,
      validUntil: o.validTo,
      catalogId: o.publicationId,
      ean: o.ean,
    }));

    return { ok: true, data: offers };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
