import type { TokenCacheEntry, TokenResponse } from "./types.js";
import { extractErrorMessage } from "./errors.js";

const TOKEN_SCOPE = "FGC_AllAppsServerCommands";
const TOKEN_GRANT_TYPE = "client_credentials";
const TOKEN_PORT = "22345";
const tokenCache = new Map<string, TokenCacheEntry>();

export async function getAccessToken(
  appBaseUrl: string,
  clientId: string,
  secretKey: string
): Promise<string> {
  const tokenUrls = createTokenUrls(appBaseUrl);
  let lastError: unknown;

  for (let index = 0; index < tokenUrls.length; index += 1) {
    const tokenUrl = tokenUrls[index];
    const cacheKey = createTokenCacheKey(tokenUrl, clientId);
    const cachedToken = tokenCache.get(cacheKey);
    if (cachedToken && cachedToken.expiresAt > Date.now()) {
      return cachedToken.accessToken;
    }

    try {
      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=utf-8"
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: secretKey,
          scope: TOKEN_SCOPE,
          grant_type: TOKEN_GRANT_TYPE
        })
      });

      if (response.status === 404 && index < tokenUrls.length - 1) {
        continue;
      }

      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(extractErrorMessage(responseText, response.statusText));
      }

      const tokenResponse = (await response.json()) as TokenResponse;
      validateTokenResponse(tokenResponse);
      tokenCache.set(cacheKey, {
        accessToken: tokenResponse.access_token,
        expiresAt: Date.now() + Math.max(tokenResponse.expires_in - 1, 0) * 1000
      });
      return tokenResponse.access_token;
    } catch (error) {
      lastError = error;
      if (index < tokenUrls.length - 1 && isRetryableTokenError(error)) {
        continue;
      }

      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Failed to acquire access token.");
}

export function getCredentials(
  clientId: string | null | undefined,
  secretKey: string | null | undefined
): { clientId: string; secretKey: string } | null {
  if (typeof clientId === "string" && clientId.length > 0 && typeof secretKey === "string" && secretKey.length > 0) {
    return { clientId, secretKey };
  }

  return null;
}

export function __resetTokenCacheForTests(): void {
  tokenCache.clear();
}

function createTokenCacheKey(tokenUrl: string, clientId: string): string {
  return `${tokenUrl}|${clientId}`;
}

function createTokenUrls(appBaseUrl: string): string[] {
  const appUrl = new URL(appBaseUrl);
  const preferredUrl = new URL(`${appUrl.protocol}//${appUrl.hostname}:${TOKEN_PORT}/UserService/connect/token`);
  const fallbackUrl = new URL(`${appUrl.protocol}//${appUrl.hostname}/UserService/connect/token`);
  return [preferredUrl.toString(), fallbackUrl.toString()];
}

function isRetryableTokenError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes("fetch failed") || error.message.includes("ECONNREFUSED");
}

function validateTokenResponse(tokenResponse: Partial<TokenResponse>): asserts tokenResponse is TokenResponse {
  if (!tokenResponse.access_token || typeof tokenResponse.expires_in !== "number") {
    throw new Error("Token response is missing access_token or expires_in.");
  }
}
