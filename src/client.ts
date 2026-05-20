import type {
  HuozigeAppClientApi,
  ServerCommandCallback
} from "./types.js";

const DEFAULT_TOKEN_PATH = "/UserService/connect/token";
const DEFAULT_TOKEN_SCOPE = "FGC_AllAppsServerCommands";
const DEFAULT_TOKEN_SKEW_MS = 30_000;

const tokenCache = new Map<string, CachedTokenEntry>();

interface CachedTokenEntry {
  accessToken: string;
  expiresAt: number;
}

interface ServerCommandOAuth2Options {
  clientId: string;
  clientSecret: string;
  tokenUrl?: string;
  tokenPath?: string;
  scope?: string;
  grantType?: "client_credentials";
  expiresInSkewMs?: number;
}

interface ServerCommandTokenResponse {
  access_token: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

class ServerCommandError extends Error {
  readonly status: number;
  readonly responseText: string;

  constructor(message: string, status: number, responseText: string) {
    super(message);
    this.name = "ServerCommandError";
    this.status = status;
    this.responseText = responseText;
  }
}

export const HuozigeAppClient: HuozigeAppClientApi = {
  async "invoke-server-command"(
    baseUrl,
    appName,
    serverCommandName,
    requestJson,
    ak,
    sk,
    callback
  ): Promise<void> {
    return runWithCallback(callback, async () => {
      const fetchImpl = getFetch();
      const accessToken =
        ak != null && sk != null
          ? await getAccessToken(fetchImpl, baseUrl, {
              clientId: ak,
              clientSecret: sk
            })
          : undefined;
      const responseJson = await postJsonString(
        fetchImpl,
        buildServerCommandUrl(baseUrl, appName, serverCommandName),
        requestJson,
        buildHeaders({
          Authorization: accessToken ? `Bearer ${accessToken}` : undefined
        })
      );

      callback(false, responseJson, "", "");
    });
  },
  async "invoke-general-api"(endpoint, requestJson, cookie, callback): Promise<void> {
    return runWithCallback(callback, async () => {
      const fetchImpl = getFetch();
      const responseJson = await postGeneralApiJson(
        fetchImpl,
        endpoint,
        requestJson,
        buildHeaders({
          Cookie: cookie ?? undefined
        })
      );

      callback(false, responseJson, "", "");
    });
  }
};

async function runWithCallback(
  callback: ServerCommandCallback,
  run: () => Promise<void>
): Promise<void> {
  try {
    await run();
  } catch (error) {
    callback(true, "", getErrorCode(error), getErrorMessage(error));
  }
}

async function postJsonString(
  fetchImpl: typeof fetch,
  url: string,
  requestJson: string,
  extraHeaders?: Record<string, string>
): Promise<string> {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: buildHeaders({
      "content-type": "application/json",
      ...extraHeaders
    }),
    body: JSON.stringify({
      input: requestJson
    })
  });

  const text = await response.text();

  if (!response.ok) {
    throw new ServerCommandError(
      `Request failed with status ${response.status}.`,
      response.status,
      text
    );
  }

  return text;
}

async function postGeneralApiJson(
  fetchImpl: typeof fetch,
  endpoint: string,
  requestJson: string,
  extraHeaders?: Record<string, string>
): Promise<string> {
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: buildHeaders({
      "content-type": "application/json",
      ...extraHeaders
    }),
    body: requestJson
  });

  const text = await response.text();

  if (!response.ok) {
    throw new ServerCommandError(
      `Request failed with status ${response.status}.`,
      response.status,
      text
    );
  }

  return text;
}

async function getAccessToken(
  fetchImpl: typeof fetch,
  baseUrl: string,
  oauth2: ServerCommandOAuth2Options
): Promise<string> {
  const cacheKey = getTokenCacheKey(baseUrl, oauth2);
  const cachedToken = tokenCache.get(cacheKey);

  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.accessToken;
  }

  const response = await requestAccessToken(fetchImpl, baseUrl, oauth2);
  tokenCache.set(cacheKey, toCachedToken(response, oauth2));

  return response.access_token;
}

async function requestAccessToken(
  fetchImpl: typeof fetch,
  baseUrl: string,
  oauth2: ServerCommandOAuth2Options
): Promise<ServerCommandTokenResponse> {
  const tokenUrls = buildTokenUrls(baseUrl, oauth2);
  let lastError: unknown;

  for (const tokenUrl of tokenUrls) {
    try {
      return await requestAccessTokenFromUrl(fetchImpl, tokenUrl, oauth2);
    } catch (error) {
      lastError = error;

      if (!shouldTryNextTokenUrl(error)) {
        throw error;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("Token request failed.");
}

async function requestAccessTokenFromUrl(
  fetchImpl: typeof fetch,
  tokenUrl: string,
  oauth2: ServerCommandOAuth2Options
): Promise<ServerCommandTokenResponse> {
  const response = await fetchImpl(tokenUrl, {
    method: "POST",
    headers: buildHeaders({
      "content-type": "application/x-www-form-urlencoded"
    }),
    body: new URLSearchParams({
      client_id: oauth2.clientId,
      client_secret: oauth2.clientSecret,
      scope: oauth2.scope ?? DEFAULT_TOKEN_SCOPE,
      grant_type: oauth2.grantType ?? "client_credentials"
    }).toString()
  });

  const text = await response.text();

  if (!response.ok) {
    throw new ServerCommandError(
      `Token request failed with status ${response.status}.`,
      response.status,
      text
    );
  }

  const parsed = safeParseJson(text);

  if (!parsed?.access_token || typeof parsed.access_token !== "string") {
    throw new Error("Token response does not contain a valid access_token.");
  }

  return {
    access_token: parsed.access_token,
    expires_in:
      typeof parsed.expires_in === "number" ? parsed.expires_in : undefined,
    token_type:
      typeof parsed.token_type === "string" ? parsed.token_type : undefined,
    scope: typeof parsed.scope === "string" ? parsed.scope : undefined
  };
}

function buildServerCommandUrl(
  baseUrl: string,
  appName: string,
  serverCommandName: string
): string {
  return new URL(
    `${trimSlashes(appName)}/ServerCommand/${trimSlashes(serverCommandName)}`,
    ensureTrailingSlash(baseUrl)
  ).toString();
}

function getFetch(): typeof fetch {
  if (typeof globalThis.fetch !== "function") {
    throw new Error("No fetch implementation available in the current runtime.");
  }

  return globalThis.fetch;
}

function buildTokenUrls(
  baseUrl: string,
  oauth2: ServerCommandOAuth2Options
): string[] {
  if (oauth2.tokenUrl) {
    return [oauth2.tokenUrl];
  }

  const tokenPath = oauth2.tokenPath ?? DEFAULT_TOKEN_PATH;
  const sourceUrl = new URL(baseUrl);
  const ports = ["22345", "443", "80"];
  const hostname = formatHostname(sourceUrl.hostname);

  return ports.map((port) => {
    return `${sourceUrl.protocol}//${hostname}:${port}${tokenPath}`;
  });
}

function toCachedToken(
  tokenResponse: ServerCommandTokenResponse,
  oauth2: ServerCommandOAuth2Options
): CachedTokenEntry {
  const skewMs = oauth2.expiresInSkewMs ?? DEFAULT_TOKEN_SKEW_MS;
  const expiresInMs = Math.max((tokenResponse.expires_in ?? 0) * 1000 - skewMs, 1);

  return {
    accessToken: tokenResponse.access_token,
    expiresAt: Date.now() + expiresInMs
  };
}

function getTokenCacheKey(
  baseUrl: string,
  oauth2: ServerCommandOAuth2Options
): string {
  return [
    baseUrl,
    oauth2.clientId,
    oauth2.clientSecret,
    oauth2.tokenUrl ?? "",
    oauth2.tokenPath ?? "",
    oauth2.scope ?? "",
    oauth2.grantType ?? ""
  ].join("\u0000");
}

function safeParseJson(value: string): Partial<ServerCommandTokenResponse> | undefined {
  try {
    return JSON.parse(value) as Partial<ServerCommandTokenResponse>;
  } catch {
    return undefined;
  }
}

function shouldTryNextTokenUrl(error: unknown): boolean {
  if (error instanceof ServerCommandError) {
    return error.status === 404;
  }

  return error instanceof TypeError;
}

function getErrorCode(error: unknown): string {
  if (error instanceof ServerCommandError) {
    return String(error.status);
  }

  return "UNKNOWN_ERROR";
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ServerCommandError) {
    return error.responseText || error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

function formatHostname(hostname: string): string {
  return hostname.includes(":") ? `[${hostname}]` : hostname;
}

function buildHeaders(headers: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).filter(([, value]) => value !== undefined)
  ) as Record<string, string>;
}

export { ServerCommandError };
