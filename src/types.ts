export type HuozigeCallback = (
  httpCode: number,
  responseInJSON: string | null,
  errorMessage: string | null
) => void;

export type HuozigeRequestMethod = "GET" | "POST";

export interface TokenResponse {
  access_token: string;
  expires_in: number;
}

export interface TokenCacheEntry {
  accessToken: string;
  expiresAt: number;
}

export interface HuozigeBindingColumn {
  "column-name": string;
  guid: string;
}

export interface HuozigeTableBinding {
  columns: HuozigeBindingColumn[];
  "table-name": string;
  "view-name": string;
  "list-view-location": string;
  "page-name": string;
  "target-page": number;
  "page-limit-row-count": number;
}

export interface HuozigeComboBinding {
  "id-column": HuozigeBindingColumn;
  "text-column": HuozigeBindingColumn;
  "table-name": string;
  "page-name": string;
}
