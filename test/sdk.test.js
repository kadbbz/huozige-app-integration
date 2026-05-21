import test from "node:test";
import assert from "node:assert/strict";
import {
  __resetTokenCacheForTests,
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

test("all public request APIs accept GET method", async () => {
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
        "GET",
        "http://example.com/playground",
        JSON.stringify({ pageName: "DemoPage" }),
        "sid=123",
        callback
      )
    );
    await invokeWithCallback((callback) =>
      callGetComboBindingOptionsWithCookie(
        "GET",
        "http://example.com/playground",
        JSON.stringify({ pageName: "DemoPage" }),
        "sid=123",
        callback
      )
    );

    assert.equal(calls.length, 4);
    assert.deepEqual(
      calls.map((call) => call.init.method),
      ["GET", "GET", "GET", "GET"]
    );
    assert.equal(
      calls[0].input,
      "http://example.com/playground/ServerCommand/anonymous-command?a=1&nested=%7B%22ok%22%3Atrue%7D"
    );
    assert.equal(calls[1].input, "http://example.com/playground/ServerCommand/cookie-command?a=1");
    assert.equal(calls[2].input, "http://example.com/playground/Home/GetTableDataWithOffset?pageName=DemoPage");
    assert.equal(calls[3].input, "http://example.com/playground/Home/GetComboBindingOptions?pageName=DemoPage");
    for (const call of calls) {
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

test("cookie endpoints send cookie header to the expected endpoints", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({ input, init });
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
        "POST",
        "http://example.com/playground",
        JSON.stringify({ pageName: "DemoPage" }),
        "sid=123",
        callback
      )
    );
    await invokeWithCallback((callback) =>
      callGetComboBindingOptionsWithCookie(
        "POST",
        "http://example.com/playground",
        JSON.stringify({ pageName: "DemoPage" }),
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
        "POST",
        "http://example.com/playground/",
        JSON.stringify({ pageName: "DemoPage" }),
        "sid=123",
        callback
      )
    );
    await invokeWithCallback((callback) =>
      callGetComboBindingOptionsWithCookie(
        "POST",
        "http://example.com/playground",
        JSON.stringify({ pageName: "DemoPage" }),
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

function invokeWithCallback(invokeFn) {
  return new Promise((resolve, reject) => {
    invokeFn((httpCode, responseInJSON, errorMessage) => {
      resolve({ httpCode, responseInJSON, errorMessage });
    }).catch(reject);
  });
}
