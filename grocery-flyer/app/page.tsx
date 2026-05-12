"use client";

import { useState, useCallback } from "react";
import type { Offer } from "@/lib/types";

const CHAIN_LABELS: Record<string, string> = {
  netto: "Netto",
  foetex: "Føtex",
  bilka: "Bilka",
  salling: "Salling",
  basalt: "Basalt",
  "365discount": "365discount",
  superbrugsen: "SuperBrugsen",
  kvickly: "Kvickly",
  dagliBrugsen: "Dagli'Brugsen",
  rema1000: "REMA 1000",
  meny: "Meny",
  spar: "SPAR",
  lidl: "Lidl",
  unknown: "Ukendt",
};

const CHAIN_COLORS: Record<string, string> = {
  netto: "bg-yellow-400 text-yellow-900",
  foetex: "bg-blue-600 text-white",
  bilka: "bg-red-600 text-white",
  "365discount": "bg-orange-500 text-white",
  superbrugsen: "bg-green-600 text-white",
  kvickly: "bg-purple-600 text-white",
  rema1000: "bg-red-700 text-white",
  meny: "bg-green-800 text-white",
  lidl: "bg-yellow-500 text-blue-900",
  unknown: "bg-gray-400 text-white",
};

function ChainBadge({ chain }: { chain: string }) {
  const color = CHAIN_COLORS[chain] ?? "bg-gray-400 text-white";
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
      {CHAIN_LABELS[chain] ?? chain}
    </span>
  );
}

function OfferCard({ offer }: { offer: Offer }) {
  const savings =
    offer.originalPrice && offer.offerPrice
      ? (offer.originalPrice - offer.offerPrice).toFixed(2)
      : null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex gap-4 hover:shadow-md transition-shadow">
      <div className="w-20 h-20 rounded-lg bg-gray-50 flex-shrink-0 overflow-hidden">
        {offer.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={offer.imageUrl} alt={offer.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">🛒</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-gray-900 leading-tight">{offer.name}</h3>
          <ChainBadge chain={offer.chain} />
        </div>
        {offer.description && (
          <p className="text-sm text-gray-500 mb-2">{offer.description}</p>
        )}
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-gray-900">
            {offer.offerPrice?.toFixed(2)} kr
          </span>
          {offer.originalPrice && (
            <span className="text-sm text-gray-400 line-through">
              {offer.originalPrice.toFixed(2)} kr
            </span>
          )}
          {offer.discountPercent && (
            <span className="text-sm font-semibold text-green-600">
              -{offer.discountPercent}%
            </span>
          )}
        </div>
        {savings && (
          <p className="text-xs text-green-600 mt-0.5">Du sparer {savings} kr</p>
        )}
        {offer.validUntil && (
          <p className="text-xs text-gray-400 mt-1">
            Gælder til {new Date(offer.validUntil).toLocaleDateString("da-DK")}
          </p>
        )}
      </div>
    </div>
  );
}

const QUICK_SEARCHES = ["Kylling", "Oksekød", "Mælk", "Ost", "Laks", "Æg", "Kaffe", "Pasta"];

export default function Home() {
  const [query, setQuery] = useState("");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const fetchOffers = useCallback(async (q: string) => {
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch("/api/offers?source=all");
      const json = await res.json();
      const all: Offer[] = json.offers ?? [];
      const filtered = q.trim()
        ? all.filter(
            (o) =>
              o.name.toLowerCase().includes(q.toLowerCase()) ||
              o.description?.toLowerCase().includes(q.toLowerCase())
          )
        : all;
      setOffers(filtered);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback(
    (q: string) => {
      setQuery(q);
      fetchOffers(q);
    },
    [fetchOffers]
  );

  const grouped = offers.reduce<Record<string, Offer[]>>((acc, o) => {
    const label = CHAIN_LABELS[o.chain] ?? o.chain;
    (acc[label] ??= []).push(o);
    return acc;
  }, {});

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">🛒</span>
            <h1 className="text-xl font-bold text-gray-900">Tilbudsavis</h1>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium ml-auto">
              AI-drevet
            </span>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch(query);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Søg efter vare, f.eks. "kylling" eller "mælk"…'
              className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "…" : "Søg"}
            </button>
          </form>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Quick searches */}
        {!searched && (
          <div className="mb-6">
            <p className="text-sm text-gray-500 mb-3">Populære søgninger</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {QUICK_SEARCHES.map((term) => (
                <button
                  key={term}
                  onClick={() => handleSearch(term)}
                  className="bg-white border border-gray-200 rounded-full px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
            <button
              onClick={() => handleSearch("")}
              className="text-sm text-blue-600 hover:underline"
            >
              Vis alle aktuelle tilbud →
            </button>
          </div>
        )}

        {/* Empty state */}
        {searched && !loading && offers.length === 0 && (
          <p className="text-center text-gray-400 py-12">
            Ingen tilbud fundet{query ? ` for "${query}"` : ""}
          </p>
        )}

        {/* Results */}
        {offers.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">
                {offers.length} tilbud{query && ` for "${query}"`}
              </p>
              <button
                onClick={() => {
                  setOffers([]);
                  setSearched(false);
                  setQuery("");
                }}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                Ryd
              </button>
            </div>

            {Object.entries(grouped).map(([chain, chainOffers]) => (
              <div key={chain} className="mb-6">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  {chain} ({chainOffers.length})
                </h2>
                <div className="flex flex-col gap-3">
                  {chainOffers.map((o) => (
                    <OfferCard key={o.id} offer={o} />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </main>
  );
}
