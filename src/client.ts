import type {
  HuozigeCalcBindingDataSource,
  HuozigeComboBinding,
  HuozigeBindingColumn,
  HuozigeCallback,
  HuozigeRequestMethod,
  HuozigeTableBinding,
  TokenCacheEntry,
  TokenResponse
} from "./types.js";

const TOKEN_SCOPE = "FGC_AllAppsServerCommands";
const TOKEN_GRANT_TYPE = "client_credentials";
const TOKEN_PORT = "22345";
const tokenCache = new Map<string, TokenCacheEntry>();

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

export async function callGetTableDataWithOffsetWithCookie(
  appBaseUrl: string,
  tableBinding: HuozigeTableBinding,
  cookie: string | null | undefined,
  callback: HuozigeCallback
): Promise<void> {
  const headers = createCookieHeaders(cookie);
  await sendRequestWithResponseMapper(
    createEndpoint(appBaseUrl, "Home/GetTableDataWithOffset"),
    headers,
    JSON.stringify(createTableDataRequest(tableBinding)),
    callback,
    (responseText) => JSON.stringify(mapTableDataResponse(responseText, tableBinding))
  );
}

export async function callGetComboBindingOptionsWithCookie(
  appBaseUrl: string,
  comboBinding: HuozigeComboBinding,
  cookie: string | null | undefined,
  callback: HuozigeCallback
): Promise<void> {
  const headers = createCookieHeaders(cookie);
  await sendRequestWithResponseMapper(
    createEndpoint(appBaseUrl, "Home/GetComboBindingOptions"),
    headers,
    JSON.stringify(createComboBindingRequest(comboBinding)),
    callback,
    (responseText) => JSON.stringify(mapComboBindingOptionsResponse(responseText, comboBinding))
  );
}

export async function callCalcBindingDataSourceWithCookie(
  appBaseUrl: string,
  calcBinding: HuozigeCalcBindingDataSource,
  cookie: string | null | undefined,
  callback: HuozigeCallback
): Promise<void> {
  const headers = createCookieHeaders(cookie);

  try {
    const metadataResponse = await fetch(createGetMetadata2RequestUrl(appBaseUrl, calcBinding), {
      method: "GET",
      headers
    });
    const metadataResponseText = await metadataResponse.text();
    if (!metadataResponse.ok) {
      callback(
        metadataResponse.status,
        metadataResponseText || null,
        extractErrorMessage(metadataResponseText, metadataResponse.statusText)
      );
      return;
    }

    let requestInJSON: string;
    try {
      requestInJSON = JSON.stringify(createCalcBindingDataSourceRequest(metadataResponseText, calcBinding));
    } catch (error) {
      callback(metadataResponse.status, metadataResponseText, getErrorMessage(error));
      return;
    }

    await sendRequestWithResponseMapper(
      createEndpoint(appBaseUrl, "Home/CalcBindingDataSource"),
      headers,
      requestInJSON,
      callback,
      (responseText) => JSON.stringify(mapCalcBindingDataSourceResponse(responseText, calcBinding))
    );
  } catch (error) {
    callback(0, null, getErrorMessage(error));
  }
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

async function sendRequestWithResponseMapper(
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

async function getAccessToken(
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

function createTokenCacheKey(tokenUrl: string, clientId: string): string {
  return `${tokenUrl}|${clientId}`;
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

function createGetMetadata2RequestUrl(appBaseUrl: string, calcBinding: HuozigeCalcBindingDataSource): string {
  const url = new URL(createEndpoint(appBaseUrl, "Home/GetMetadata2"));
  url.searchParams.set("pageName", calcBinding["page-name"]);

  const isMobile = calcBinding["is-mobile"];
  if (isMobile !== undefined) {
    url.searchParams.set("isMobile", String(isMobile));
  }

  const metadataVersion = calcBinding["metadata-version"];
  if (metadataVersion !== undefined && metadataVersion !== null && String(metadataVersion).length > 0) {
    url.searchParams.set("v2", String(metadataVersion));
  }

  return url.toString();
}

function createTableDataRequest(tableBinding: HuozigeTableBinding): Record<string, unknown> {
  const pageName = tableBinding["page-name"];
  const tableName = tableBinding["table-name"];

  return {
    bindingInfos: tableBinding.columns.map((column) => getBindingGuid(column)),
    currentRowInfo: {
      currentTable: tableName,
      viewname: tableBinding["view-name"],
      listviewLocation: tableBinding["list-view-location"]
    },
    demandRowCount: 0,
    currentDataLength: 0,
    needRowVersion: true,
    editorDataInfos: null,
    sortCommandID: null,
    orderByInfo: null,
    offsetConditionInfo: {
      targetPage: tableBinding["target-page"],
      pageLimitRowCount: tableBinding["page-limit-row-count"]
    },
    columnFilterQueries: null,
    totalRowBindingInfos: [],
    pageName
  };
}

function createComboBindingRequest(comboBinding: HuozigeComboBinding): Record<string, unknown> {
  return {
    tableName: comboBinding["table-name"],
    valueColumnBindingInfo: getBindingGuid(comboBinding["id-column"]),
    displayColumnBindingInfo: getBindingGuid(comboBinding["text-column"]),
    itemQuery: null,
    offset: null,
    pageName: comboBinding["page-name"]
  };
}

function createCalcBindingDataSourceRequest(
  metadataResponseText: string,
  calcBinding: HuozigeCalcBindingDataSource
): Record<string, unknown> {
  const runtimeBinding = getCalcBindingRuntimeInfo(metadataResponseText, calcBinding);
  const request: Record<string, unknown> = {
    CommandId: getCalcBindingGuid(runtimeBinding)
  };
  const params = createCalcBindingParams(runtimeBinding, calcBinding);
  if (params) {
    request.Params = params;
  }

  if (calcBinding.options !== undefined) {
    request.options = calcBinding.options;
  }

  return request;
}

function mapTableDataResponse(responseText: string, tableBinding: HuozigeTableBinding): { data: Array<Record<string, unknown>> } {
  const parsed = parseJsonObject(responseText);
  const rows = getTableDataRows(parsed);

  return {
    data: rows.map((row) => mapTableRow(row, tableBinding.columns))
  };
}

function mapComboBindingOptionsResponse(
  responseText: string,
  comboBinding: HuozigeComboBinding
): { data: Array<Record<string, unknown>> } {
  const parsed = parseJsonObject(responseText);
  const items = getComboItems(parsed);
  const textColumnName = comboBinding["text-column"]["column-name"];
  const idColumnName = comboBinding["id-column"]["column-name"];

  return {
    data: items.map((item) => ({
      [textColumnName]: item.DisplayValue,
      [idColumnName]: item.Value
    }))
  };
}

function mapCalcBindingDataSourceResponse(
  responseText: string,
  calcBinding: HuozigeCalcBindingDataSource
): { data: Array<Record<string, unknown>> } {
  const parsed = JSON.parse(responseText) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Response is not a JSON array.");
  }

  return {
    data: parsed.map((row) => mapCalcBindingDataSourceRow(row, calcBinding.columns))
  };
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

function getBindingGuid(column: HuozigeBindingColumn): string {
  if (!column.guid) {
    throw new Error("Binding column is missing guid.");
  }

  return column.guid;
}

function parseJsonObject(responseText: string): Record<string, unknown> {
  const parsed = JSON.parse(responseText) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Response is not a JSON object.");
  }

  return parsed as Record<string, unknown>;
}

function getCalcBindingRuntimeInfo(
  metadataResponseText: string,
  calcBinding: HuozigeCalcBindingDataSource
): Record<string, unknown> {
  const cellLocation = parseCalcBindingCellLocation(calcBinding["cell-location"]);
  const metadataResponse = parseJsonObject(metadataResponseText);
  const pageMetadata = getMetadataPageEntry(metadataResponse, calcBinding["page-name"]);
  const metadata = parseMetadataContent(pageMetadata);
  const cells = metadata.Cells;
  if (!Array.isArray(cells)) {
    throw new Error("GetMetadata2 metaData.Cells is missing.");
  }

  for (const cell of cells) {
    if (!cell || typeof cell !== "object" || Array.isArray(cell)) {
      continue;
    }

    const cellRecord = cell as Record<string, unknown>;
    if (Number(cellRecord.Row) !== cellLocation.row || Number(cellRecord.Column) !== cellLocation.column) {
      continue;
    }

    const runtimeBinding = getCellRuntimeBinding(cellRecord, calcBinding);
    const runtimeTableName = runtimeBinding.TableName;
    if (
      typeof runtimeTableName === "string" &&
      calcBinding["table-name"] &&
      runtimeTableName !== calcBinding["table-name"]
    ) {
      throw new Error(
        `Calc binding table mismatch at ${cellLocation.label}: expected ${calcBinding["table-name"]}, got ${runtimeTableName}.`
      );
    }

    return runtimeBinding;
  }

  throw new Error(
    `Calc binding metadata is missing for page ${calcBinding["page-name"]} at ${cellLocation.label}.`
  );
}

function parseCalcBindingCellLocation(cellLocation: string): { row: number; column: number; label: string } {
  const parts = cellLocation.split(",");
  if (parts.length !== 2) {
    throw new Error('Calc binding cell-location must use "row,column" format.');
  }

  const row = Number(parts[0].trim());
  const column = Number(parts[1].trim());
  if (!Number.isFinite(row) || !Number.isFinite(column)) {
    throw new Error('Calc binding cell-location must use numeric "row,column" values.');
  }

  return {
    row,
    column,
    label: `${row},${column}`
  };
}

function getMetadataPageEntry(
  metadataResponse: Record<string, unknown>,
  pageName: string
): Record<string, unknown> {
  const pageEntry = metadataResponse[pageName] ?? metadataResponse[pageName.toLowerCase()];
  if (isRecord(pageEntry)) {
    return pageEntry;
  }

  const matchedEntry = Object.entries(metadataResponse).find(([key]) => key.toLowerCase() === pageName.toLowerCase());
  if (matchedEntry && isRecord(matchedEntry[1])) {
    return matchedEntry[1];
  }

  throw new Error(`GetMetadata2 page metadata is missing for page ${pageName}.`);
}

function parseMetadataContent(pageMetadata: Record<string, unknown>): Record<string, unknown> {
  const rawMetadata = pageMetadata.metaData;
  if (typeof rawMetadata === "string") {
    return parseJsonObject(rawMetadata);
  }

  if (isRecord(rawMetadata)) {
    return rawMetadata;
  }

  throw new Error("GetMetadata2 metaData is missing.");
}

function getCellRuntimeBinding(
  cell: Record<string, unknown>,
  calcBinding: HuozigeCalcBindingDataSource
): Record<string, unknown> {
  const candidates = findRuntimeBindingCandidates(cell);
  if (candidates.length === 0) {
    throw new Error("Calc binding options are missing.");
  }

  const matchedCandidates = candidates.filter((candidate) => candidate.TableName === calcBinding["table-name"]);
  if (matchedCandidates.length > 0) {
    return matchedCandidates[0];
  }

  return candidates[0];
}

function getCalcBindingGuid(runtimeBinding: Record<string, unknown>): string {
  const guid = runtimeBinding.GUID;
  if (typeof guid !== "string" || guid.length === 0) {
    throw new Error("Calc binding GUID is missing.");
  }

  return guid;
}

function findRuntimeBindingCandidates(value: unknown): Record<string, unknown>[] {
  const candidates: Record<string, unknown>[] = [];
  collectRuntimeBindingCandidates(value, candidates, new Set());
  return candidates;
}

function collectRuntimeBindingCandidates(
  value: unknown,
  candidates: Record<string, unknown>[],
  visited: Set<object>
): void {
  if (!isRecord(value) && !Array.isArray(value)) {
    return;
  }

  if (visited.has(value)) {
    return;
  }
  visited.add(value);

  if (isRecord(value) && isRuntimeBindingDataSource(value)) {
    candidates.push(value);
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectRuntimeBindingCandidates(item, candidates, visited));
    return;
  }

  for (const child of Object.values(value)) {
    collectRuntimeBindingCandidates(child, candidates, visited);
  }
}

function isRuntimeBindingDataSource(value: Record<string, unknown>): boolean {
  const typeName = value.$type;
  return (
    typeof value.GUID === "string" &&
    value.GUID.length > 0 &&
    typeof value.TableName === "string" &&
    (Array.isArray(value.Params) ||
      Array.isArray(value.CustomColumns) ||
      (typeof typeName === "string" && typeName.includes("BindingDataSourceModel")))
  );
}

function createCalcBindingParams(
  runtimeBinding: Record<string, unknown>,
  calcBinding: HuozigeCalcBindingDataSource
): Record<string, unknown> | undefined {
  const suppliedParams = calcBinding.params ?? {};
  const suppliedParamNames = Object.keys(suppliedParams);
  const runtimeParams = getStringArray(runtimeBinding.Params);
  if (runtimeParams.length === 0) {
    if (suppliedParamNames.length > 0) {
      throw new Error(
        `Calc binding params were provided, but runtime metadata has no Params for ${calcBinding["page-name"]} at ${calcBinding["cell-location"]} (${calcBinding["table-name"]}).`
      );
    }

    return undefined;
  }

  const params: Record<string, unknown> = {};
  const consumedParamNames = new Set<string>();
  for (let index = 0; index < runtimeParams.length; index += 1) {
    const runtimeParamName = runtimeParams[index];
    const suppliedParamName = findSuppliedCalcParamName(suppliedParams, calcBinding, runtimeParamName, index);
    if (!suppliedParamName) {
      throw new Error(`Calc binding param value is missing: ${getCalcParamLabel(calcBinding, runtimeParamName, index)}.`);
    }

    consumedParamNames.add(suppliedParamName);
    params[runtimeParamName] = suppliedParams[suppliedParamName];
  }

  const unusedParamNames = suppliedParamNames.filter((paramName) => !consumedParamNames.has(paramName));
  if (unusedParamNames.length > 0) {
    throw new Error(`Calc binding params include unsupported keys: ${unusedParamNames.join(", ")}.`);
  }

  return params;
}

function findSuppliedCalcParamName(
  suppliedParams: Record<string, unknown>,
  calcBinding: HuozigeCalcBindingDataSource,
  runtimeParamName: string,
  index: number
): string | undefined {
  if (Object.prototype.hasOwnProperty.call(suppliedParams, runtimeParamName)) {
    return runtimeParamName;
  }

  const queryParamName = getCalcQueryParamName(calcBinding, index);
  if (queryParamName && Object.prototype.hasOwnProperty.call(suppliedParams, queryParamName)) {
    return queryParamName;
  }

  return undefined;
}

function getCalcParamLabel(
  calcBinding: HuozigeCalcBindingDataSource,
  runtimeParamName: string,
  index: number
): string {
  const queryParamName = getCalcQueryParamName(calcBinding, index);
  return queryParamName ? `${queryParamName} (${runtimeParamName})` : runtimeParamName;
}

function getCalcQueryParamName(calcBinding: HuozigeCalcBindingDataSource, index: number): string | undefined {
  const queryParam = calcBinding["query-params"]?.[index];
  if (!queryParam) {
    return undefined;
  }

  return `${queryParam["table-name"]}.${queryParam["column-name"]}`;
}

function getTableDataRows(response: Record<string, unknown>): Array<Record<string, unknown>> {
  const table = response.table;
  if (!table || typeof table !== "object" || Array.isArray(table)) {
    throw new Error("Response table is missing.");
  }

  const data = (table as Record<string, unknown>).Data;
  if (!Array.isArray(data)) {
    throw new Error("Response table.Data is missing.");
  }

  return data.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error("Response row is invalid.");
    }

    return row as Record<string, unknown>;
  });
}

function mapTableRow(
  row: Record<string, unknown>,
  columns: HuozigeTableBinding["columns"]
): Record<string, unknown> {
  const mappedRow: Record<string, unknown> = {};

  columns.forEach((column, index) => {
    mappedRow[column["column-name"]] = row[`C${index}`];
  });

  return mappedRow;
}

function mapCalcBindingDataSourceRow(
  row: unknown,
  columns: HuozigeCalcBindingDataSource["columns"]
): Record<string, unknown> {
  if (!isRecord(row)) {
    throw new Error("Response row is invalid.");
  }

  const mappedRow: Record<string, unknown> = {};
  columns.forEach((column) => {
    mappedRow[column["column-name"]] = row[column["response-name"]];
  });

  return mappedRow;
}

function getComboItems(response: Record<string, unknown>): Array<{ Value: unknown; DisplayValue: unknown }> {
  const items = response.Items;
  if (!Array.isArray(items)) {
    throw new Error("Response Items is missing.");
  }

  return items.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("Response item is invalid.");
    }

    const record = item as Record<string, unknown>;
    return {
      Value: record.Value,
      DisplayValue: record.DisplayValue
    };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
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

function normalizeMethod(method: HuozigeRequestMethod): HuozigeRequestMethod {
  if (method === "GET" || method === "POST") {
    return method;
  }

  throw new Error(`Unsupported request method: ${String(method)}. Only GET and POST are allowed.`);
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
