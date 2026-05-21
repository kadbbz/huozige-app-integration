import assert from "node:assert/strict";
import {
  callGetComboBindingOptionsWithCookie,
  callGetTableDataWithOffsetWithCookie,
  callServerCommandWithCookie,
  invoke
} from "../dist/index.js";

const config = {
  appBaseUrl: "http://xa-gcscn-mkt:8081/playground",
  clientId: "ee543888-237f-4b75-81e7-f49d129d",
  secretKey: "8beb37c8-ea5e-44ac-a881-5e9e0560",
  cookie:
    "ForguncyServer=9mfghtL3fR2SNA-RRDSJPAMLbXh-H18XEC1yrC6zvjL4xxoXnCL9_gjT_y_vtedp1JknBIyxoDzsJQd7nESlMe_4CbaDY96YxImQR_AzQQRbtu7XynbHzDaWeDVBGLDaUKdY8lzGF9fuCEa2xtgKC1ud0UF69E0RqotCqXDsJ1p76ysidUJ3oqinezJ49tBpE08QOvEDqlwSbpg19be_Wrhp5u24Njy6uWDoFqmj_k2ZdGMPuY0uHvqdeQd3r3bRIxayAILJ01Q13dGVMPgF_FLpesiIJCwziqCLfM1ox5blQf0lvbjKchmFMEnDS6nldG-L7wKb6zs91RtWKgaLCJ0ojuhewACc1UmhfMlrMsveBKBWLidhlyJ04yO6rpq7Eek1IQM7hFBlHqNFOQgu_SWmydw7ygqKoViwPdLTS04u7gBNq42NQTTsMeFpDmYfGritn7thw8U2Ovl2s6ATw3QUNzPea0kpE62T__H0QxNjYEevFHIRlrcArere6nksxRoSiTFexCfxR9xG8rRsE--rKykMMb_zUqqbTYqaeHrT8MKTHZeMusWkzFGt4BUjhB91mcMCkHYQIFdSzuwksAqrBqDEySVqHsaHyBsnCdTEWGmXuBThbxrzvevqkyzij_FR0rEcyYx1Da7-U-7dl136I52xExE_7WCWId-M0LPFXZ_5opufPOHSDHC0TolN15Ut9wEnGE4F6bg3r8890uASd9dcWrAS3E0CL0yjEYsxJjVtbalN5RevzFabi84_oeF44CzLLSZaGD4Hmsmd_w6DKtAqldeNar1foJQe5b6EUCULf2BVeyf7PktG2m2QO3TaQFdnsPQVNfwiJLNrLuJh9fsZULjd3p4xRLC7LTYb0oFVEoP57iDZGaYUaH-y; fgc_UID_anMfdXFhcXwff3lm=dfc4140b-5c0a-4cfe-8ff8-81df14aa75e9"
};

const tableBinding = {
  columns: [
    {
      "column-name": "文本",
      guid: "38bc1902-7dea-421d-a10e-4cec1c7ab95e"
    },
    {
      "column-name": "整数",
      guid: "c93f6c99-4cdb-45de-b174-b3196a61cb7e"
    }
  ],
  "table-name": "数据表1",
  "view-name": "测试页面表格1",
  "list-view-location": "测试页面|表格1",
  "page-name": "测试页面",
  "target-page": 1,
  "page-limit-row-count": 0
};

const comboBinding = {
  "id-column": {
    "column-name": "整数",
    guid: "9e5cf221-9fbd-4ded-aeb5-bb02449e819d"
  },
  "text-column": {
    "column-name": "文本",
    guid: "7135e363-d135-4c05-91b2-c162a85f050c"
  },
  "table-name": "数据表1",
  "page-name": "测试页面"
};

const cases = [
  createMachineCase({
    name: "machine-1 anonymous command",
    serverCommand: "匿名访问",
    requestBody: { 参数1: "a", 参数2: "b" },
    clientId: null,
    secretKey: null,
    verify: (result) => {
      assert.equal(result.httpCode, 200);
      const body = parseJson(result.responseInJSON);
      assert.equal(body.ErrCode, 0);
      assert.equal(body["返回值1"], "a");
      assert.equal(body["返回值2"], "b");
    }
  }),
  createMachineCase({
    name: "machine-1b anonymous command GET",
    method: "GET",
    serverCommand: "匿名访问-GET",
    requestBody: { 参数1: "a", 参数2: "b" },
    clientId: null,
    secretKey: null,
    verify: (result) => {
      assert.equal(result.httpCode, 200);
      const body = parseJson(result.responseInJSON);
      assert.equal(body.ErrCode, 0);
      assert.equal(body["返回值1"], "a");
      assert.equal(body["返回值2"], "b");
    }
  }),
  createMachineCase({
    name: "machine-2 authenticated command",
    serverCommand: "登录用户认证",
    requestBody: { 参数1: "a", 参数2: "b" },
    clientId: config.clientId,
    secretKey: config.secretKey,
    verify: (result) => {
      assert.equal(result.httpCode, 200);
      const body = parseJson(result.responseInJSON);
      assert.equal(body.ErrCode, 0);
      assert.equal(body["返回值1"], "a");
      assert.equal(body["返回值2"], "b");
    }
  }),
  createMachineCase({
    name: "machine-3 authenticated command with business error",
    serverCommand: "登录用户认证-出错",
    requestBody: { 参数1: "a", 参数2: "b" },
    clientId: config.clientId,
    secretKey: config.secretKey,
    verify: (result) => {
      assert.equal(result.httpCode, 200);
      const body = parseJson(result.responseInJSON);
      assert.equal(body.ErrCode, 400);
      assert.equal(body.Message, "错误消息");
      assert.equal(body["返回值1"], "a");
      assert.equal(body["返回值2"], "b");
    }
  })
];

if (config.cookie) {
  cases.push(
    createCookieCommandCase({
      name: "cookie-1 server command",
      serverCommand: "登录用户认证",
      requestBody: { 参数1: "a", 参数2: "b" },
      verify: (result) => {
        assert.equal(result.httpCode, 200);
        const body = parseJson(result.responseInJSON);
        assert.equal(body.ErrCode, 0);
      }
    }),
    {
      name: "cookie-2 GetTableDataWithOffset",
      endpoint: createEndpoint(config.appBaseUrl, "Home/GetTableDataWithOffset"),
      requestBody: tableBinding,
      run: () =>
        runCallback((callback) =>
          callGetTableDataWithOffsetWithCookie(config.appBaseUrl, tableBinding, config.cookie, callback)
        ),
      verify: (result) => {
        assert.equal(result.httpCode, 200);
        const body = parseJson(result.responseInJSON);
        assert.deepEqual(body, {
          data: [
            { 文本: "ABC", 整数: 1 },
            { 文本: "DEF", 整数: 2 }
          ]
        });
      }
    },
    {
      name: "cookie-3 GetComboBindingOptions",
      endpoint: createEndpoint(config.appBaseUrl, "Home/GetComboBindingOptions"),
      requestBody: comboBinding,
      run: () =>
        runCallback((callback) =>
          callGetComboBindingOptionsWithCookie(config.appBaseUrl, comboBinding, config.cookie, callback)
        ),
      verify: (result) => {
        assert.equal(result.httpCode, 200);
        const body = parseJson(result.responseInJSON);
        assert.deepEqual(body, {
          data: [
            { 文本: "ABC", 整数: 1 },
            { 文本: "DEF", 整数: 2 }
          ]
        });
      }
    }
  );
} else {
  console.log("HUOZIGE_COOKIE is not set. Cookie-based integration cases will be skipped.");
}

let currentTrace = [];

installFetchTracer();

let failed = false;
for (const testCase of cases) {
  process.stdout.write(`[run] ${testCase.name}\n`);
  resetCurrentTrace();
  try {
    const result = await testCase.run();
    testCase.verify(result);
    process.stdout.write(`[pass] ${testCase.name}\n`);
  } catch (error) {
    failed = true;
    process.stderr.write(`[fail] ${testCase.name}: ${formatError(error)}\n`);
    process.stderr.write(formatTraceOutput(getCurrentTrace()));
  }
}

if (failed) {
  process.exitCode = 1;
}

function createMachineCase({ name, method = "POST", serverCommand, requestBody, clientId, secretKey, verify }) {
  return createGenericCase({
    name,
    endpoint: createEndpoint(config.appBaseUrl, `ServerCommand/${encodeURIComponent(serverCommand)}`),
    requestBody,
    run: (requestInJSON, callback) =>
      invoke(method, config.appBaseUrl, serverCommand, requestInJSON, clientId, secretKey, callback),
    verify
  });
}

function createCookieCommandCase({ name, serverCommand, requestBody, verify }) {
  return createGenericCase({
    name,
    endpoint: createEndpoint(config.appBaseUrl, `ServerCommand/${encodeURIComponent(serverCommand)}`),
    requestBody,
    run: (requestInJSON, callback) =>
      callServerCommandWithCookie("POST", config.appBaseUrl, serverCommand, requestInJSON, config.cookie, callback),
    verify
  });
}

function createGenericCase({ name, endpoint, requestBody, run, verify }) {
  const requestInJSON = JSON.stringify(requestBody);
  return {
    name,
    endpoint,
    requestBody: requestInJSON,
    run: () => runCallback((callback) => run(requestInJSON, callback)),
    verify
  };
}

function runCallback(invokeFn) {
  return new Promise((resolve, reject) => {
    invokeFn((httpCode, responseInJSON, errorMessage) => {
      if (httpCode === 0) {
        reject(new Error(errorMessage ?? "Request failed."));
        return;
      }

      resolve({ httpCode, responseInJSON, errorMessage });
    }).catch(reject);
  });
}

function parseJson(raw) {
  if (!raw) {
    throw new Error("Response body is empty.");
  }

  return JSON.parse(raw);
}

function createEndpoint(appBaseUrl, path) {
  const normalizedBaseUrl = appBaseUrl.endsWith("/") ? appBaseUrl : `${appBaseUrl}/`;
  return new URL(path, normalizedBaseUrl).toString();
}

function installFetchTracer() {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input, init) => {
    const traceEntry = {
      method: init?.method ?? "GET",
      url: typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url,
      requestBody: normalizeRequestBody(init?.body),
      responseStatus: null,
      responseBody: null,
      fetchError: null
    };
    currentTrace.push(traceEntry);

    try {
      const response = await originalFetch(input, init);
      traceEntry.responseStatus = response.status;
      traceEntry.responseBody = await response.clone().text();
      return response;
    } catch (error) {
      traceEntry.fetchError = formatError(error);
      throw error;
    }
  };
}

function resetCurrentTrace() {
  currentTrace = [];
}

function getCurrentTrace() {
  return currentTrace;
}

function normalizeRequestBody(body) {
  if (body == null) {
    return null;
  }

  if (typeof body === "string") {
    return body;
  }

  if (body instanceof URLSearchParams) {
    return body.toString();
  }

  if (body instanceof ArrayBuffer) {
    return `[ArrayBuffer ${body.byteLength} bytes]`;
  }

  return `[${body.constructor?.name ?? typeof body}]`;
}

function formatTraceOutput(traceEntries) {
  if (traceEntries.length === 0) {
    return "  request address: <none>\n  request body: <none>\n  response body: <none>\n";
  }

  return traceEntries
    .map((entry, index) => {
      return [
        `  interaction ${index + 1}:`,
        `  request address: ${entry.url}`,
        `  request body: ${entry.requestBody ?? "<empty>"}`,
        `  response status: ${entry.responseStatus ?? "<no response>"}`,
        `  response body: ${entry.responseBody ?? entry.fetchError ?? "<empty>"}`
      ].join("\n");
    })
    .join("\n");
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}
