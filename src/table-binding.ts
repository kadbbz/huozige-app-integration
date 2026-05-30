import type { HuozigeCallback, HuozigeTableBinding } from "./types.js";
import { getBindingGuid } from "./binding-column.js";
import { createCookieHeaders, createEndpoint, sendRequestWithResponseMapper } from "./http.js";
import { parseJsonObject } from "./json.js";

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

function mapTableDataResponse(responseText: string, tableBinding: HuozigeTableBinding): { data: Array<Record<string, unknown>> } {
  const parsed = parseJsonObject(responseText);
  const rows = getTableDataRows(parsed);

  return {
    data: rows.map((row) => mapTableRow(row, tableBinding.columns))
  };
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
