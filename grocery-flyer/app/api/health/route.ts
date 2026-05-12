// GET /api/health
// Reports which API keys are configured (never exposes the key values themselves).

import { NextResponse } from "next/server";

export async function GET() {
  const connectors = {
    salling: {
      configured: Boolean(process.env.SALLING_API_KEY),
      registerAt: "https://developer.sallinggroup.com",
      covers: ["netto", "føtex", "bilka", "salling", "basalt"],
      freeApi: true,
    },
    coop: {
      configured: Boolean(process.env.COOP_SUBSCRIPTION_KEY),
      registerAt: "https://developer.cl.coop.dk",
      covers: ["365discount", "superbrugsen", "kvickly", "dagliBrugsen"],
      freeApi: true,
    },
    rema: {
      configured: Boolean(process.env.REMA_SUBSCRIPTION_KEY),
      registerAt: "https://apiportal.rema.no",
      covers: ["rema1000"],
      freeApi: true,
      note: "Commercial use requires license — contact REMA 1000",
    },
    tjek: {
      configured: Boolean(process.env.TJEK_API_KEY),
      registerAt: "https://tjek.com/apis-and-sdks",
      covers: ["all Danish chains"],
      freeApi: false,
      note: "Legacy v2 API may work without key. Commercial use requires agreement: services@tjek.com",
    },
  };

  const allConfigured = Object.values(connectors).every((c) => c.configured);

  return NextResponse.json({
    status: allConfigured ? "all_configured" : "partial",
    connectors,
  });
}
