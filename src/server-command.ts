import type { HuozigeCallback, HuozigeRequestMethod } from "./types.js";
import { getErrorMessage } from "./errors.js";
import { createCookieHeaders, createEndpoint, sendRequest } from "./http.js";
import { getAccessToken, getCredentials } from "./oauth.js";

export async function invoke(
  method: HuozigeRequestMethod = "POST",
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
      callback,
      method
    );
  } catch (error) {
    callback(0, null, getErrorMessage(error));
  }
}

export async function callServerCommandWithCookie(
  method: HuozigeRequestMethod = "POST",
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
    callback,
    method
  );
}
