// GET /api/offers
// Query params:
//   q        — search term (required for tjek source)
//   source   — "salling" | "coop" | "rema" | "tjek" | "all" (default: "all")
//   zip      — postal code (used by salling)
//   lat, lng — coordinates (used by salling + tjek)
//   radius   — radius in km (default: 5 for salling, 10 for tjek)
//   limit    — max results per source (default: 24)

import { NextRequest, NextResponse } from "next/server";
import * as salling from "@/lib/connectors/salling";
import * as coop from "@/lib/connectors/coop";
import * as rema from "@/lib/connectors/rema";
import * as tjek from "@/lib/connectors/tjek";
import type { Offer } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const source = searchParams.get("source") ?? "all";
  const q = searchParams.get("q") ?? "";
  const zip = searchParams.get("zip") ?? undefined;
  const lat = searchParams.get("lat") ? Number(searchParams.get("lat")) : undefined;
  const lng = searchParams.get("lng") ? Number(searchParams.get("lng")) : undefined;
  const radius = Number(searchParams.get("radius") ?? 5);
  const limit = Number(searchParams.get("limit") ?? 24);

  const results: Offer[] = [];
  const errors: Record<string, string> = {};

  const fetchSalling = source === "all" || source === "salling";
  const fetchCoop = source === "all" || source === "coop";
  const fetchRema = source === "all" || source === "rema";
  const fetchTjek = source === "all" || source === "tjek";

  await Promise.allSettled([
    fetchSalling &&
      (async () => {
        try {
          const r = zip
            ? await salling.getFoodWasteByZip(zip)
            : lat && lng
            ? await salling.getFoodWasteByCoords(lat, lng, radius)
            : await salling.getFoodWasteByZip("2200"); // default to Copenhagen N
          if (r.ok && r.data) results.push(...r.data);
          else if (r.error) errors.salling = r.error;
        } catch (e) {
          errors.salling = String(e);
        }
      })(),

    fetchCoop &&
      (async () => {
        try {
          const r = await coop.getIpaperOffers();
          if (r.ok && r.data) results.push(...r.data.slice(0, limit));
          else if (r.error) errors.coop = r.error;
        } catch (e) {
          errors.coop = String(e);
        }
      })(),

    fetchRema &&
      (async () => {
        try {
          const r = await rema.getOffers();
          if (r.ok && r.data) results.push(...r.data.slice(0, limit));
          else if (r.error) errors.rema = r.error;
        } catch (e) {
          errors.rema = String(e);
        }
      })(),

    fetchTjek &&
      q &&
      (async () => {
        try {
          const r = await tjek.searchOffers(q, {
            lat,
            lng,
            radiusMeters: radius * 1000,
            limit,
          });
          if (r.ok && r.data) results.push(...r.data);
          else if (r.error) errors.tjek = r.error;
        } catch (e) {
          errors.tjek = String(e);
        }
      })(),
  ]);

  return NextResponse.json({
    count: results.length,
    offers: results,
    ...(Object.keys(errors).length > 0 ? { errors } : {}),
  });
}
