import type { HuozigeCalcBindingDataSource, HuozigeCallback } from "./types.js";
import { extractErrorMessage, getErrorMessage } from "./errors.js";
import { createCookieHeaders, createEndpoint, sendRequestWithResponseMapper } from "./http.js";
import { getStringArray, isRecord, parseJsonObject } from "./json.js";

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
    if (!isRecord(cell)) {
      continue;
    }

    if (Number(cell.Row) !== cellLocation.row || Number(cell.Column) !== cellLocation.column) {
      continue;
    }

    const runtimeBinding = getCellRuntimeBinding(cell, calcBinding);
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
