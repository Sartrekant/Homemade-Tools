// Unified types for all Danish supermarket API connectors

export type Chain =
  | "netto"
  | "foetex"
  | "bilka"
  | "salling"
  | "basalt"
  | "365discount"
  | "superbrugsen"
  | "kvickly"
  | "dagliBrugsen"
  | "rema1000"
  | "meny"
  | "spar"
  | "lidl"
  | "unknown";

export interface Offer {
  id: string;
  source: "salling" | "coop" | "rema" | "tjek";
  chain: Chain;
  name: string;
  description?: string;
  originalPrice?: number;
  offerPrice?: number;
  discountPercent?: number;
  currency: "DKK";
  unit?: string;
  quantity?: number;
  imageUrl?: string;
  validFrom?: string; // ISO 8601
  validUntil?: string; // ISO 8601
  catalogId?: string;
  storeId?: string;
  ean?: string;
}

export interface Store {
  id: string;
  source: "salling" | "coop" | "rema" | "tjek";
  chain: Chain;
  name: string;
  address: string;
  city: string;
  zipCode: string;
  lat?: number;
  lng?: number;
  openingHours?: OpeningHours;
}

export interface OpeningHours {
  monday?: DayHours;
  tuesday?: DayHours;
  wednesday?: DayHours;
  thursday?: DayHours;
  friday?: DayHours;
  saturday?: DayHours;
  sunday?: DayHours;
}

export interface DayHours {
  open: string; // "08:00"
  close: string; // "21:00"
  closed?: boolean;
}

export interface Catalog {
  id: string;
  source: "salling" | "coop" | "rema" | "tjek";
  chain: Chain;
  title: string;
  validFrom: string;
  validUntil: string;
  pageCount?: number;
  coverImageUrl?: string;
  pdfUrl?: string;
  webUrl?: string;
}

export interface ConnectorResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}
