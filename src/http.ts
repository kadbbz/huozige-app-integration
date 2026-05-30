import type { HuozigeCallback, HuozigeRequestMethod } from "./types.js";
import { extractErrorMessage, getErrorMessage } from "./errors.js";

export function createCookieHeaders(cookie: string | null | undefined): Headers {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8"
  });

  if (cookie) {
    headers.set("Cookie", cookie);
  }

  return headers;
}

export function createEndpoint(appBaseUrl: string, path: string): string {
  const normalizedBaseUrl = appBaseUrl.endsWith("/") ? appBaseUrl : `${appBaseUrl}/`;
  return new URL(path, normalizedBaseUrl).toString();
}

export async function sendRequest(
  endpoint: string,
  headers: Headers,
  requestInJSON: string | null | undefined,
  callback: HuozigeCallback,
  method: HuozigeRequestMethod
): Promise<void> {
  try {
    const normalizedMethod = normalizeMethod(method);
    const requestUrl = createRequestUrl(endpoint, requestInJSON, normalizedMethod);
    const response = await fetch(requestUrl, {
      method: normalizedMethod,
      headers,
      body: normalizedMethod === "POST" ? (requestInJSON ?? null) : undefined
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

export async function sendRequestWithResponseMapper(
  endpoint: string,
  headers: Headers,
  requestInJSON: string,
  callback: HuozigeCallback,
  mapResponse: (responseText: string) => string
): Promise<void> {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: requestInJSON
    });

    const responseText = await response.text();
    if (!response.ok) {
      callback(response.status, responseText || null, extractErrorMessage(responseText, response.statusText));
      return;
    }

    try {
      callback(response.status, mapResponse(responseText), null);
    } catch (error) {
      callback(response.status, responseText, getErrorMessage(error));
    }
  } catch (error) {
    callback(0, null, getErrorMessage(error));
  }
}

function createRequestUrl(
  endpoint: string,
  requestInJSON: string | null | undefined,
  method: HuozigeRequestMethod
): string {
  if (method !== "GET" || requestInJSON == null || requestInJSON.length === 0) {
    return endpoint;
  }

  const url = new URL(endpoint);
  const queryEntries = createQueryEntries(requestInJSON);
  for (const [key, value] of queryEntries) {
    url.searchParams.append(key, value);
  }

  return url.toString();
}

function createQueryEntries(requestInJSON: string): Array<[string, string]> {
  try {
    const parsed = JSON.parse(requestInJSON) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [key, serializeQueryValue(value)]);
    }
  } catch {
    return [["requestInJSON", requestInJSON]];
  }

  return [["requestInJSON", requestInJSON]];
}

function serializeQueryValue(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  return JSON.stringify(value);
}

function normalizeMethod(method: HuozigeRequestMethod): HuozigeRequestMethod {
  if (method === "GET" || method === "POST") {
    return method;
  }

  throw new Error(`Unsupported request method: ${String(method)}. Only GET and POST are allowed.`);
}
