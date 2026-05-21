export type HuozigeCallback = (
  httpCode: number,
  responseInJSON: string | null,
  errorMessage: string | null
) => void;

export interface TokenResponse {
  access_token: string;
  expires_in: number;
}

export interface TokenCacheEntry {
  accessToken: string;
  expiresAt: number;
}
