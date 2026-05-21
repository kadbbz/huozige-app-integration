import type { HuozigeCallback, TokenCacheEntry, TokenResponse } from "./types.js";

const TOKEN_SCOPE = "FGC_AllAppsServerCommands";
const TOKEN_GRANT_TYPE = "client_credentials";
const TOKEN_PORT = "22345";
const tokenCache = new Map<string, TokenCacheEntry>();

export async function invoke(
  appBaseUrl: string,
  serverCommand: string,
  requestInJSON: string | null | undefined,
  clientId: string | null | undefined,
  secretKey: string | null | undefined,
  callback: HuozigeCallback
): Promise<void> {
  try {
    const headers = new Headers({
      "Content-Type": "application/json; charset=utf-8"
    });

    const credentials = getCredentials(clientId, secretKey);
    if (credentials) {
      const accessToken = await getAccessToken(appBaseUrl, credentials.clientId, credentials.secretKey);
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    await sendRequest(
      createEndpoint(appBaseUrl, `ServerCommand/${encodeURIComponent(serverCommand)}`),
      headers,
      requestInJSON,
      callback
    );
  } catch (error) {
    callback(0, null, getErrorMessage(error));
  }
}

export async function callServerCommandWithCookie(
  appBaseUrl: string,
  serverCommand: string,
  requestInJSON: string | null | undefined,
  cookie: string | null | undefined,
  callback: HuozigeCallback
): Promise<void> {
  const headers = createCookieHeaders(cookie);
  await sendRequest(
    createEndpoint(appBaseUrl, `ServerCommand/${encodeURIComponent(serverCommand)}`),
    headers,
    requestInJSON,
    callback
  );
}

export async function callGetTableDataWithOffsetWithCookie(
  appBaseUrl: string,
  requestInJSON: string | null | undefined,
  cookie: string | null | undefined,
  callback: HuozigeCallback
): Promise<void> {
  const headers = createCookieHeaders(cookie);
  await sendRequest(
    createEndpoint(appBaseUrl, "Home/GetTableDataWithOffset"),
    headers,
    requestInJSON,
    callback
  );
}

export async function callGetComboBindingOptionsWithCookie(
  appBaseUrl: string,
  requestInJSON: string | null | undefined,
  cookie: string | null | undefined,
  callback: HuozigeCallback
): Promise<void> {
  const headers = createCookieHeaders(cookie);
  await sendRequest(
    createEndpoint(appBaseUrl, "Home/GetComboBindingOptions"),
    headers,
    requestInJSON,
    callback
  );
}

function createCookieHeaders(cookie: string | null | undefined): Headers {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8"
  });

  if (cookie) {
    headers.set("Cookie", cookie);
  }

  return headers;
}

async function sendRequest(
  endpoint: string,
  headers: Headers,
  requestInJSON: string | null | undefined,
  callback: HuozigeCallback
): Promise<void> {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: requestInJSON ?? null
    });

    const responseText = await response.text();
    if (response.ok) {
      callback(response.status, responseText, null);
      return;
    }

    callback(response.status, responseText || null, extractErrorMessage(responseText, response.statusText));
  } catch (error) {
    callback(0, null, getErrorMessage(error));
  }
}

async function getAccessToken(
  appBaseUrl: string,
  clientId: string,
  secretKey: string
): Promise<string> {
  const tokenUrls = createTokenUrls(appBaseUrl);
  let lastError: unknown;

  for (let index = 0; index < tokenUrls.length; index += 1) {
    const tokenUrl = tokenUrls[index];
    const cachedToken = tokenCache.get(tokenUrl);
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
      tokenCache.set(tokenUrl, {
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

function createTokenUrls(appBaseUrl: string): string[] {
  const appUrl = new URL(appBaseUrl);
  const preferredUrl = new URL(`${appUrl.protocol}//${appUrl.hostname}:${TOKEN_PORT}/UserService/connect/token`);
  const fallbackUrl = new URL(`${appUrl.protocol}//${appUrl.hostname}/UserService/connect/token`);
  return [preferredUrl.toString(), fallbackUrl.toString()];
}

function createEndpoint(appBaseUrl: string, path: string): string {
  const normalizedBaseUrl = appBaseUrl.endsWith("/") ? appBaseUrl : `${appBaseUrl}/`;
  return new URL(path, normalizedBaseUrl).toString();
}

function getCredentials(
  clientId: string | null | undefined,
  secretKey: string | null | undefined
): { clientId: string; secretKey: string } | null {
  if (typeof clientId === "string" && clientId.length > 0 && typeof secretKey === "string" && secretKey.length > 0) {
    return { clientId, secretKey };
  }

  return null;
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

function extractErrorMessage(responseText: string, fallback: string): string {
  if (!responseText) {
    return fallback || "Request failed.";
  }

  try {
    const parsed = JSON.parse(responseText) as Record<string, unknown>;
    const candidates = [parsed.error_description, parsed.error, parsed.Message, parsed.message];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.length > 0) {
        return candidate;
      }
    }
  } catch {
    return responseText;
  }

  return responseText;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Request failed.";
}

export function __resetTokenCacheForTests(): void {
  tokenCache.clear();
}
