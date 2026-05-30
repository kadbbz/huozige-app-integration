import type { HuozigeCallback, HuozigeComboBinding } from "./types.js";
import { getBindingGuid } from "./binding-column.js";
import { createCookieHeaders, createEndpoint, sendRequestWithResponseMapper } from "./http.js";
import { parseJsonObject } from "./json.js";

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
