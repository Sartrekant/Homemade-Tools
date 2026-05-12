// GET /api/stores
// Returns stores from Salling and REMA 1000.
// Query params:
//   source — "salling" | "rema" | "all" (default: "all")
//   zip    — postal code filter

import { NextRequest, NextResponse } from "next/server";
import * as salling from "@/lib/connectors/salling";
import * as rema from "@/lib/connectors/rema";
import type { Store } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const source = searchParams.get("source") ?? "all";
  const zip = searchParams.get("zip") ?? undefined;

  const results: Store[] = [];
  const errors: Record<string, string> = {};

  await Promise.allSettled([
    (source === "all" || source === "salling") &&
      (async () => {
        try {
          const r = await salling.getStores(zip);
          if (r.ok && r.data) results.push(...r.data);
          else if (r.error) errors.salling = r.error;
        } catch (e) {
          errors.salling = String(e);
        }
      })(),

    (source === "all" || source === "rema") &&
      (async () => {
        try {
          const r = await rema.getStores(zip);
          if (r.ok && r.data) results.push(...r.data);
          else if (r.error) errors.rema = r.error;
        } catch (e) {
          errors.rema = String(e);
        }
      })(),
  ]);

  return NextResponse.json({
    count: results.length,
    stores: results,
    ...(Object.keys(errors).length > 0 ? { errors } : {}),
  });
}
