// GET /api/catalogs
// Returns active tilbudsavis catalogs from all sources.
// Query params:
//   source   — "coop" | "rema" | "tjek" | "all" (default: "all")
//   lat, lng — coordinates (used by tjek for nearby catalogs)
//   radius   — radius in km (default: 25)

import { NextRequest, NextResponse } from "next/server";
import * as coop from "@/lib/connectors/coop";
import * as rema from "@/lib/connectors/rema";
import * as tjek from "@/lib/connectors/tjek";
import type { Catalog } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const source = searchParams.get("source") ?? "all";
  const lat = searchParams.get("lat") ? Number(searchParams.get("lat")) : undefined;
  const lng = searchParams.get("lng") ? Number(searchParams.get("lng")) : undefined;
  const radius = Number(searchParams.get("radius") ?? 25);

  const results: Catalog[] = [];
  const errors: Record<string, string> = {};

  await Promise.allSettled([
    (source === "all" || source === "coop") &&
      (async () => {
        try {
          const r = await coop.getPublications();
          if (r.ok && r.data) results.push(...r.data);
          else if (r.error) errors.coop = r.error;
        } catch (e) {
          errors.coop = String(e);
        }
      })(),

    (source === "all" || source === "rema") &&
      (async () => {
        try {
          const r = await rema.getCatalogs();
          if (r.ok && r.data) results.push(...r.data);
          else if (r.error) errors.rema = r.error;
        } catch (e) {
          errors.rema = String(e);
        }
      })(),

    (source === "all" || source === "tjek") &&
      (async () => {
        try {
          const r = await tjek.getCatalogs({ lat, lng, radiusMeters: radius * 1000 });
          if (r.ok && r.data) results.push(...r.data);
          else if (r.error) errors.tjek = r.error;
        } catch (e) {
          errors.tjek = String(e);
        }
      })(),
  ]);

  // Sort by validFrom descending (newest first)
  results.sort(
    (a, b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime()
  );

  return NextResponse.json({
    count: results.length,
    catalogs: results,
    ...(Object.keys(errors).length > 0 ? { errors } : {}),
  });
}
