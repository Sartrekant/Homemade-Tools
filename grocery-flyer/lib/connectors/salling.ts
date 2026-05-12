// Salling Group API connector
// Documentation: https://developer.sallinggroup.com/api-reference
// Covers: Netto, Føtex, Bilka, Salling, Basalt
// Auth: Bearer token — register at https://developer.sallinggroup.com
// Rate limit: 10,000 requests/day

import type { Chain, ConnectorResult, Offer, Store } from "@/lib/types";

const BASE_URL = "https://api.sallinggroup.com";

function headers(): HeadersInit {
  const token = process.env.SALLING_API_KEY;
  if (!token) throw new Error("SALLING_API_KEY is not set");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// Maps Salling brand strings to our Chain type
function mapBrand(brand: string): Chain {
  const map: Record<string, Chain> = {
    netto: "netto",
    foetex: "foetex",
    bilka: "bilka",
    salling: "salling",
    basalt: "basalt",
  };
  return map[brand?.toLowerCase()] ?? "unknown";
}

// --- Food Waste (Nedsat mad nær udløb) ---

interface SallingFoodWasteProduct {
  id: string;
  description: string;
  newPrice: number;
  originalPrice: number;
  discount: number;
  percentDiscount: number;
  stock: number;
  unit: string;
  endTime: string;
  startTime: string;
  image?: string;
  ean?: string;
}

interface SallingFoodWasteStore {
  id: string;
  name: string;
  brand: string;
  address: { city: string; zip: string; street: string };
  coordinates: { lat: number; lng: number };
  clearances: SallingFoodWasteProduct[];
}

export async function getFoodWasteByZip(
  zip: string
): Promise<ConnectorResult<Offer[]>> {
  try {
    const res = await fetch(`${BASE_URL}/v1/food-waste/?zip=${zip}`, {
      headers: headers(),
      next: { revalidate: 300 }, // cache 5 minutes
    });

    if (!res.ok) {
      return { ok: false, error: await res.text(), statusCode: res.status };
    }

    const stores: SallingFoodWasteStore[] = await res.json();
    const offers: Offer[] = [];

    for (const store of stores) {
      for (const p of store.clearances) {
        offers.push({
          id: `salling-fw-${store.id}-${p.id}`,
          source: "salling",
          chain: mapBrand(store.brand),
          name: p.description,
          originalPrice: p.originalPrice,
          offerPrice: p.newPrice,
          discountPercent: p.percentDiscount,
          currency: "DKK",
          unit: p.unit,
          quantity: p.stock,
          imageUrl: p.image,
          validFrom: p.startTime,
          validUntil: p.endTime,
          storeId: store.id,
          ean: p.ean,
        });
      }
    }

    return { ok: true, data: offers };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function getFoodWasteByCoords(
  lat: number,
  lng: number,
  radiusKm = 5
): Promise<ConnectorResult<Offer[]>> {
  try {
    const res = await fetch(
      `${BASE_URL}/v1/food-waste/?geo=${lat},${lng}&radius=${radiusKm}`,
      {
        headers: headers(),
        next: { revalidate: 300 },
      }
    );

    if (!res.ok) {
      return { ok: false, error: await res.text(), statusCode: res.status };
    }

    const stores: SallingFoodWasteStore[] = await res.json();
    const offers: Offer[] = [];

    for (const store of stores) {
      for (const p of store.clearances) {
        offers.push({
          id: `salling-fw-${store.id}-${p.id}`,
          source: "salling",
          chain: mapBrand(store.brand),
          name: p.description,
          originalPrice: p.originalPrice,
          offerPrice: p.newPrice,
          discountPercent: p.percentDiscount,
          currency: "DKK",
          unit: p.unit,
          quantity: p.stock,
          imageUrl: p.image,
          validFrom: p.startTime,
          validUntil: p.endTime,
          storeId: store.id,
          ean: p.ean,
        });
      }
    }

    return { ok: true, data: offers };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// --- Stores ---

interface SallingStore {
  id: string;
  name: string;
  brand: string;
  address: {
    city: string;
    zip: string;
    street: string;
    country: string;
  };
  coordinates: { lat: number; lng: number };
  hours?: {
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
  try {
    const url = zip
      ? `${BASE_URL}/v2/stores?zip=${zip}&country=DK`
      : `${BASE_URL}/v2/stores?country=DK&per_page=100`;

    const res = await fetch(url, {
      headers: headers(),
      next: { revalidate: 3600 }, // cache 1 hour
    });

    if (!res.ok) {
      return { ok: false, error: await res.text(), statusCode: res.status };
    }

    const raw: SallingStore[] = await res.json();

    const stores: Store[] = raw.map((s) => ({
      id: `salling-${s.id}`,
      source: "salling",
      chain: mapBrand(s.brand),
      name: s.name,
      address: s.address.street,
      city: s.address.city,
      zipCode: s.address.zip,
      lat: s.coordinates?.lat,
      lng: s.coordinates?.lng,
      openingHours: s.hours,
    }));

    return { ok: true, data: stores };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
