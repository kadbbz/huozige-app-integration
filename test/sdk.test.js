import test from "node:test";
import assert from "node:assert/strict";
import {
  __resetTokenCacheForTests,
  callCalcBindingDataSourceWithCookie,
  callGetComboBindingOptionsWithCookie,
  callGetTableDataWithOffsetWithCookie,
  callServerCommandWithCookie,
  invoke
} from "../dist/index.js";

test.beforeEach(() => {
  __resetTokenCacheForTests();
});

test("invoke sends anonymous server-command request", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({ input, init });
    return new Response(JSON.stringify({ ErrCode: 0, Value1: "a", Value2: "b" }), { status: 200 });
  };

  try {
    const result = await invokeWithCallback((callback) =>
      invoke(
        "POST",
        "http://example.com/playground",
        "anonymous-command",
        JSON.stringify({ param1: "a", param2: "b" }),
        null,
        null,
        callback
      )
    );

    assert.equal(calls.length, 1);
    assert.equal(calls[0].input, "http://example.com/playground/ServerCommand/anonymous-command");
    assert.equal(calls[0].init.method, "POST");
    assert.equal(calls[0].init.body, JSON.stringify({ param1: "a", param2: "b" }));
    assert.equal(calls[0].init.headers.get("Authorization"), null);
    assert.deepEqual(result, {
      httpCode: 200,
      responseInJSON: JSON.stringify({ ErrCode: 0, Value1: "a", Value2: "b" }),
      errorMessage: null
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("public request APIs use their expected HTTP methods", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({ input, init });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  try {
    await invokeWithCallback((callback) =>
      invoke(
        "GET",
        "http://example.com/playground",
        "anonymous-command",
        JSON.stringify({ a: 1, nested: { ok: true } }),
        null,
        null,
        callback
      )
    );
    await invokeWithCallback((callback) =>
      callServerCommandWithCookie(
        "GET",
        "http://example.com/playground",
        "cookie-command",
        JSON.stringify({ a: 1 }),
        "sid=123",
        callback
      )
    );
    await invokeWithCallback((callback) =>
      callGetTableDataWithOffsetWithCookie(
        "http://example.com/playground",
        {
          columns: [{ "column-name": "文本", guid: "col-1" }],
          "table-name": "表格1",
          "view-name": "显式视图名",
          "list-view-location": "显式|位置",
          "page-name": "DemoPage",
          "target-page": 1,
          "page-limit-row-count": 20
        },
        "sid=123",
        callback
      )
    );
    await invokeWithCallback((callback) =>
      callGetComboBindingOptionsWithCookie(
        "http://example.com/playground",
        {
          "id-column": { "column-name": "ID", guid: "id-col" },
          "text-column": { "column-name": "名称", guid: "text-col" },
          "table-name": "表格1",
          "page-name": "DemoPage"
        },
        "sid=123",
        callback
      )
    );

    assert.equal(calls.length, 4);
    assert.deepEqual(
      calls.map((call) => call.init.method),
      ["GET", "GET", "POST", "POST"]
    );
    assert.equal(
      calls[0].input,
      "http://example.com/playground/ServerCommand/anonymous-command?a=1&nested=%7B%22ok%22%3Atrue%7D"
    );
    assert.equal(calls[1].input, "http://example.com/playground/ServerCommand/cookie-command?a=1");
    assert.equal(calls[2].input, "http://example.com/playground/Home/GetTableDataWithOffset");
    assert.equal(calls[3].input, "http://example.com/playground/Home/GetComboBindingOptions");
    assert.equal(
      calls[2].init.body,
      JSON.stringify({
        bindingInfos: ["col-1"],
        currentRowInfo: {
          currentTable: "表格1",
          viewname: "显式视图名",
          listviewLocation: "显式|位置"
        },
        demandRowCount: 0,
        currentDataLength: 0,
        needRowVersion: true,
        editorDataInfos: null,
        sortCommandID: null,
        orderByInfo: null,
        offsetConditionInfo: {
          targetPage: 1,
          pageLimitRowCount: 20
        },
        columnFilterQueries: null,
        totalRowBindingInfos: [],
        pageName: "DemoPage"
      })
    );
    assert.equal(
      calls[3].init.body,
      JSON.stringify({
        tableName: "表格1",
        valueColumnBindingInfo: "id-col",
        displayColumnBindingInfo: "text-col",
        itemQuery: null,
        offset: null,
        pageName: "DemoPage"
      })
    );
    for (const call of calls.slice(0, 2)) {
      assert.equal(call.init.body, undefined);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GET requests fall back to requestInJSON query param when body is not a JSON object", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({ input, init });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  try {
    await invokeWithCallback((callback) =>
      callServerCommandWithCookie(
        "GET",
        "http://example.com/playground",
        "raw-query-command",
        "not-json",
        "sid=123",
        callback
      )
    );

    assert.equal(
      calls[0].input,
      "http://example.com/playground/ServerCommand/raw-query-command?requestInJSON=not-json"
    );
    assert.equal(calls[0].init.body, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("invoke fetches and caches token before calling server command", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({ input, init });
    if (calls.length === 1) {
      return new Response("not found", { status: 404, statusText: "Not Found" });
    }

    if (calls.length === 2) {
      return Response.json({ access_token: "cached-token", expires_in: 120 });
    }

    if (calls.length === 4) {
      return new Response("not found", { status: 404, statusText: "Not Found" });
    }

    return new Response(JSON.stringify({ ErrCode: 0, Value1: "a", Value2: "b" }), { status: 200 });
  };

  try {
    const firstResult = await invokeWithCallback((callback) =>
      invoke(
        "POST",
        "https://example.com:8091/playground",
        "login-command",
        JSON.stringify({ param1: "a", param2: "b" }),
        "client-id",
        "secret-key",
        callback
      )
    );

    const secondResult = await invokeWithCallback((callback) =>
      invoke(
        "POST",
        "https://example.com:8091/playground",
        "login-command",
        JSON.stringify({ param1: "a", param2: "b" }),
        "client-id",
        "secret-key",
        callback
      )
    );

    assert.equal(calls.length, 5);
    assert.equal(calls[0].input, "https://example.com:22345/UserService/connect/token");
    assert.equal(calls[1].input, "https://example.com/UserService/connect/token");
    assert.equal(calls[2].input, "https://example.com:8091/playground/ServerCommand/login-command");
    assert.equal(calls[3].input, "https://example.com:22345/UserService/connect/token");
    assert.equal(calls[4].input, "https://example.com:8091/playground/ServerCommand/login-command");
    assert.equal(calls[2].init.headers.get("Authorization"), "Bearer cached-token");
    assert.equal(calls[4].init.headers.get("Authorization"), "Bearer cached-token");
    assert.equal(firstResult.httpCode, 200);
    assert.equal(secondResult.httpCode, 200);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("invoke token cache is isolated by token url and client id", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({ input, init });
    if (String(input).includes("/UserService/connect/token")) {
      const clientId = new URLSearchParams(init.body).get("client_id");
      return Response.json({ access_token: `token-for-${clientId}`, expires_in: 120 });
    }

    return new Response(JSON.stringify({ ErrCode: 0 }), { status: 200 });
  };

  try {
    await invokeWithCallback((callback) =>
      invoke(
        "POST",
        "https://example.com:8091/playground",
        "login-command",
        JSON.stringify({ param1: "a" }),
        "client-a",
        "secret-key",
        callback
      )
    );

    await invokeWithCallback((callback) =>
      invoke(
        "POST",
        "https://example.com:8091/playground",
        "login-command",
        JSON.stringify({ param1: "a" }),
        "client-a",
        "secret-key",
        callback
      )
    );

    await invokeWithCallback((callback) =>
      invoke(
        "POST",
        "https://example.com:8091/playground",
        "login-command",
        JSON.stringify({ param1: "a" }),
        "client-b",
        "secret-key",
        callback
      )
    );

    assert.equal(calls.length, 5);
    assert.equal(calls[0].input, "https://example.com:22345/UserService/connect/token");
    assert.equal(calls[1].input, "https://example.com:8091/playground/ServerCommand/login-command");
    assert.equal(calls[2].input, "https://example.com:8091/playground/ServerCommand/login-command");
    assert.equal(calls[3].input, "https://example.com:22345/UserService/connect/token");
    assert.equal(calls[4].input, "https://example.com:8091/playground/ServerCommand/login-command");
    assert.equal(calls[1].init.headers.get("Authorization"), "Bearer token-for-client-a");
    assert.equal(calls[2].init.headers.get("Authorization"), "Bearer token-for-client-a");
    assert.equal(calls[4].init.headers.get("Authorization"), "Bearer token-for-client-b");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("cookie endpoints send cookie header to the expected endpoints", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({ input, init });
    if (String(input).includes("GetTableDataWithOffset")) {
      return new Response(
        JSON.stringify({
          table: {
            Data: [
              { C0: "ABC", C1: 1, Query: "{\"ID\":1}" },
              { C0: "DEF", C1: 2, Query: "{\"ID\":2}" }
            ],
            AllRowLoaded: true
          }
        }),
        { status: 200 }
      );
    }

    if (String(input).includes("GetComboBindingOptions")) {
      return new Response(
        JSON.stringify({
          Items: [
            { Value: 1, DisplayValue: "ABC" },
            { Value: 2, DisplayValue: "DEF" }
          ],
          DisplayValueType: 3,
          SubItemsColumnTypeDic: {}
        }),
        { status: 200 }
      );
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  try {
    await invokeWithCallback((callback) =>
      callServerCommandWithCookie(
        "POST",
        "http://example.com/playground",
        "cookie-command",
        JSON.stringify({ param1: "a", param2: "b" }),
        "sid=123",
        callback
      )
    );
    await invokeWithCallback((callback) =>
      callGetTableDataWithOffsetWithCookie(
        "http://example.com/playground",
        {
          columns: [
            { "column-name": "文本", guid: "col-1" },
            { "column-name": "整数", guid: "col-2" }
          ],
          "table-name": "表格1",
          "view-name": "显式视图名",
          "list-view-location": "显式|位置",
          "page-name": "DemoPage",
          "target-page": 1,
          "page-limit-row-count": 0
        },
        "sid=123",
        callback
      )
    );
    await invokeWithCallback((callback) =>
      callGetComboBindingOptionsWithCookie(
        "http://example.com/playground",
        {
          "id-column": { "column-name": "整数", guid: "id-col" },
          "text-column": { "column-name": "文本", guid: "text-col" },
          "table-name": "表格1",
          "page-name": "DemoPage"
        },
        "sid=123",
        callback
      )
    );

    assert.deepEqual(
      calls.map((call) => call.input),
      [
        "http://example.com/playground/ServerCommand/cookie-command",
        "http://example.com/playground/Home/GetTableDataWithOffset",
        "http://example.com/playground/Home/GetComboBindingOptions"
      ]
    );
    for (const call of calls) {
      assert.equal(call.init.headers.get("Cookie"), "sid=123");
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("appBaseUrl works with or without trailing slash", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({ input, init });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  try {
    await invokeWithCallback((callback) =>
      invoke(
        "POST",
        "http://example.com/playground/",
        "slash-command",
        JSON.stringify({ ok: true }),
        null,
        null,
        callback
      )
    );
    await invokeWithCallback((callback) =>
      callServerCommandWithCookie(
        "POST",
        "http://example.com/playground",
        "no-slash-command",
        JSON.stringify({ ok: true }),
        "sid=123",
        callback
      )
    );
    await invokeWithCallback((callback) =>
      callGetTableDataWithOffsetWithCookie(
        "http://example.com/playground/",
        {
          columns: [{ "column-name": "文本", guid: "col-1" }],
          "table-name": "表格1",
          "view-name": "显式视图名",
          "list-view-location": "显式|位置",
          "page-name": "DemoPage",
          "target-page": 1,
          "page-limit-row-count": 0
        },
        "sid=123",
        callback
      )
    );
    await invokeWithCallback((callback) =>
      callGetComboBindingOptionsWithCookie(
        "http://example.com/playground",
        {
          "id-column": { "column-name": "ID", guid: "id-col" },
          "text-column": { "column-name": "名称", guid: "text-col" },
          "table-name": "表格1",
          "page-name": "DemoPage"
        },
        "sid=123",
        callback
      )
    );

    assert.deepEqual(
      calls.map((call) => call.input),
      [
        "http://example.com/playground/ServerCommand/slash-command",
        "http://example.com/playground/ServerCommand/no-slash-command",
        "http://example.com/playground/Home/GetTableDataWithOffset",
        "http://example.com/playground/Home/GetComboBindingOptions"
      ]
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("non-200 responses surface error messages through callback", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ErrCode: 400, Message: "bad request", Value1: "a", Value2: "b" }), {
      status: 400,
      statusText: "Bad Request"
    });

  try {
    const result = await invokeWithCallback((callback) =>
      callServerCommandWithCookie(
        "POST",
        "http://example.com/playground",
        "cookie-command-error",
        JSON.stringify({ param1: "a", param2: "b" }),
        "sid=123",
        callback
      )
    );

    assert.deepEqual(result, {
      httpCode: 400,
      responseInJSON: JSON.stringify({ ErrCode: 400, Message: "bad request", Value1: "a", Value2: "b" }),
      errorMessage: "bad request"
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("callGetTableDataWithOffsetWithCookie maps request and response by binding columns", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({ input, init });
    return new Response(
      JSON.stringify({
        table: {
          Data: [
            { C0: "ABC", C1: 1, Query: "{\"ID\":1}" },
            { C0: "DEF", C1: 2, Query: "{\"ID\":2}" }
          ],
          AllRowLoaded: true
        }
      }),
      { status: 200 }
    );
  };

  try {
    const result = await invokeWithCallback((callback) =>
      callGetTableDataWithOffsetWithCookie(
        "http://example.com/playground",
        {
          columns: [
            { "column-name": "文本", guid: "col-1" },
            { "column-name": "整数", guid: "col-2" }
          ],
          "table-name": "表格1",
          "view-name": "explicit-view",
          "list-view-location": "explicit|location",
          "page-name": "DemoPage",
          "target-page": 2,
          "page-limit-row-count": 50
        },
        "sid=123",
        callback
      )
    );

    assert.equal(calls.length, 1);
    assert.equal(calls[0].init.method, "POST");
    assert.equal(
      calls[0].init.body,
      JSON.stringify({
        bindingInfos: ["col-1", "col-2"],
        currentRowInfo: {
          currentTable: "表格1",
          viewname: "explicit-view",
          listviewLocation: "explicit|location"
        },
        demandRowCount: 0,
        currentDataLength: 0,
        needRowVersion: true,
        editorDataInfos: null,
        sortCommandID: null,
        orderByInfo: null,
        offsetConditionInfo: {
          targetPage: 2,
          pageLimitRowCount: 50
        },
        columnFilterQueries: null,
        totalRowBindingInfos: [],
        pageName: "DemoPage"
      })
    );
    assert.deepEqual(JSON.parse(result.responseInJSON), {
      data: [
        { 文本: "ABC", 整数: 1 },
        { 文本: "DEF", 整数: 2 }
      ]
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("callGetComboBindingOptionsWithCookie maps request and response by binding columns", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({ input, init });
    return new Response(
      JSON.stringify({
        Items: [
          { Value: 1, DisplayValue: "ABC" },
          { Value: 2, DisplayValue: "DEF" }
        ],
        DisplayValueType: 3,
        SubItemsColumnTypeDic: {}
      }),
      { status: 200 }
    );
  };

  try {
    const result = await invokeWithCallback((callback) =>
      callGetComboBindingOptionsWithCookie(
        "http://example.com/playground",
        {
          "id-column": { "column-name": "整数", guid: "id-col" },
          "text-column": { "column-name": "文本", guid: "text-col" },
          "table-name": "表格1",
          "page-name": "DemoPage"
        },
        "sid=123",
        callback
      )
    );

    assert.equal(calls.length, 1);
    assert.equal(calls[0].init.method, "POST");
    assert.equal(
      calls[0].init.body,
      JSON.stringify({
        tableName: "表格1",
        valueColumnBindingInfo: "id-col",
        displayColumnBindingInfo: "text-col",
        itemQuery: null,
        offset: null,
        pageName: "DemoPage"
      })
    );
    assert.deepEqual(JSON.parse(result.responseInJSON), {
      data: [
        { 文本: "ABC", 整数: 1 },
        { 文本: "DEF", 整数: 2 }
      ]
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("callCalcBindingDataSourceWithCookie locates runtime binding and maps rows by data columns", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({ input, init });
    if (String(input).includes("GetMetadata2")) {
      return new Response(JSON.stringify(createCalcMetadataResponse()), { status: 200 });
    }

    if (String(input).includes("CalcBindingDataSource")) {
      return new Response(
        JSON.stringify([
          { date: "2021/11/17", text: "第23场 阿里动物园背后的品牌与IP思维" },
          { date: "2021/12/1", text: "开发部新人座谈" }
        ]),
        { status: 200 }
      );
    }

    return new Response("not found", { status: 404 });
  };

  try {
    const result = await invokeWithCallback((callback) =>
      callCalcBindingDataSourceWithCookie(
        "http://example.com/playground",
        {
          "page-name": "Calendar 日历",
          "cell-location": "102,2",
          "table-name": "日程表",
          columns: [
            { "response-name": "date", "table-name": "日程表", "column-name": "日期" },
            { "response-name": "text", "table-name": "日程表", "column-name": "详情" }
          ]
        },
        "sid=123",
        callback
      )
    );

    assert.equal(calls.length, 2);
    assert.equal(calls[0].init.method, "GET");
    const metadataUrl = new URL(calls[0].input);
    assert.equal(metadataUrl.pathname, "/playground/Home/GetMetadata2");
    assert.equal(metadataUrl.searchParams.get("pageName"), "Calendar 日历");
    assert.equal(metadataUrl.searchParams.get("isMobile"), null);
    assert.equal(metadataUrl.searchParams.get("v2"), null);
    assert.equal(calls[0].init.headers.get("Cookie"), "sid=123");

    assert.equal(calls[1].input, "http://example.com/playground/Home/CalcBindingDataSource");
    assert.equal(calls[1].init.method, "POST");
    assert.equal(calls[1].init.headers.get("Cookie"), "sid=123");
    assert.equal(
      calls[1].init.body,
      JSON.stringify({
        CommandId: "calc-guid"
      })
    );
    assert.deepEqual(JSON.parse(result.responseInJSON), {
      data: [
        { 日期: "2021/11/17", 详情: "第23场 阿里动物园背后的品牌与IP思维" },
        { 日期: "2021/12/1", 详情: "开发部新人座谈" }
      ]
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("callCalcBindingDataSourceWithCookie sends params and options from runtime metadata", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({ input, init });
    if (String(input).includes("GetMetadata2")) {
      return new Response(JSON.stringify(createCalcMetadataResponse({ params: ["=A1"] })), { status: 200 });
    }

    return new Response(JSON.stringify([{ value: "ABC" }]), { status: 200 });
  };

  try {
    const result = await invokeWithCallback((callback) =>
      callCalcBindingDataSourceWithCookie(
        "http://example.com/playground",
        {
          "page-name": "Calendar 日历",
          "cell-location": "102,2",
          "table-name": "日程表",
          columns: [{ "response-name": "value", "table-name": "日程表", "column-name": "名称" }],
          params: { "=A1": "active" },
          options: { distinct: true }
        },
        "sid=123",
        callback
      )
    );

    assert.equal(calls.length, 2);
    assert.equal(
      calls[1].init.body,
      JSON.stringify({
        CommandId: "calc-guid",
        Params: { "=A1": "active" },
        options: { distinct: true }
      })
    );
    assert.deepEqual(JSON.parse(result.responseInJSON), {
      data: [{ 名称: "ABC" }]
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("callCalcBindingDataSourceWithCookie maps query param names to runtime metadata params", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({ input, init });
    if (String(input).includes("GetMetadata2")) {
      return new Response(JSON.stringify(createCalcMetadataResponse({ params: ["=A1"] })), { status: 200 });
    }

    return new Response(JSON.stringify([{ value: "ABC" }]), { status: 200 });
  };

  try {
    await invokeWithCallback((callback) =>
      callCalcBindingDataSourceWithCookie(
        "http://example.com/playground",
        {
          "page-name": "Calendar 日历",
          "cell-location": "102,2",
          "table-name": "日程表",
          "query-params": [{ "table-name": "日程表", "column-name": "状态" }],
          columns: [{ "response-name": "value", "table-name": "日程表", "column-name": "名称" }],
          params: { "日程表.状态": "active" }
        },
        "sid=123",
        callback
      )
    );

    assert.equal(calls.length, 2);
    assert.equal(
      calls[1].init.body,
      JSON.stringify({
        CommandId: "calc-guid",
        Params: { "=A1": "active" }
      })
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("callCalcBindingDataSourceWithCookie rejects supplied params when runtime metadata has no params", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  const metadataResponse = createCalcMetadataResponse();
  globalThis.fetch = async (input, init) => {
    calls.push({ input, init });
    return new Response(JSON.stringify(metadataResponse), { status: 200 });
  };

  try {
    const result = await invokeWithCallback((callback) =>
      callCalcBindingDataSourceWithCookie(
        "http://example.com/playground",
        {
          "page-name": "Calendar 日历",
          "cell-location": "102,2",
          "table-name": "日程表",
          columns: [{ "response-name": "value", "table-name": "日程表", "column-name": "名称" }],
          params: { "日程表.状态": "active" }
        },
        "sid=123",
        callback
      )
    );

    assert.equal(calls.length, 1);
    assert.equal(result.httpCode, 200);
    assert.equal(result.responseInJSON, JSON.stringify(metadataResponse));
    assert.match(result.errorMessage, /runtime metadata has no Params/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("callCalcBindingDataSourceWithCookie reports metadata lookup errors before calc request", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  const metadataResponse = {
    "calendar 日历": {
      metaData: JSON.stringify({ Cells: [] })
    }
  };
  globalThis.fetch = async (input, init) => {
    calls.push({ input, init });
    return new Response(JSON.stringify(metadataResponse), { status: 200 });
  };

  try {
    const result = await invokeWithCallback((callback) =>
      callCalcBindingDataSourceWithCookie(
        "http://example.com/playground",
        {
          "page-name": "Calendar 日历",
          "cell-location": "102,2",
          "table-name": "日程表",
          columns: [{ "response-name": "date", "table-name": "日程表", "column-name": "日期" }]
        },
        "sid=123",
        callback
      )
    );

    assert.equal(calls.length, 1);
    assert.equal(result.httpCode, 200);
    assert.equal(result.responseInJSON, JSON.stringify(metadataResponse));
    assert.match(result.errorMessage, /Calc binding metadata is missing/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function invokeWithCallback(invokeFn) {
  return new Promise((resolve, reject) => {
    invokeFn((httpCode, responseInJSON, errorMessage) => {
      resolve({ httpCode, responseInJSON, errorMessage });
    }).catch(reject);
  });
}

function createCalcMetadataResponse({ guid = "calc-guid", params = [] } = {}) {
  return {
    "calendar 日历": {
      metaData: JSON.stringify({
        Cells: [
          {
            Row: 8,
            Column: 2,
            CellType: {
              $type: "ElementUI.CalendarCellType, ElementUI"
            }
          },
          {
            Row: 102,
            Column: 2,
            CellType: {
              $type: "ElementUI.CalendarCellType, ElementUI",
              bindingOptions: {
                $type: "ServerDesignerCommon.Model.BindingDataSourceModel, ServerDesignerCommon",
                GUID: guid,
                TableName: "日程表",
                Params: params,
                CustomColumns: []
              }
            }
          }
        ]
      })
    }
  };
}
