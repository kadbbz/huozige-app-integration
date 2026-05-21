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
        "http://example.com/playground",
        "匿名访问",
        JSON.stringify({ 参数1: "a", 参数2: "b" }),
        null,
        null,
        callback
      )
    );

    assert.equal(calls.length, 1);
    assert.equal(calls[0].input, "http://example.com/playground/ServerCommand/%E5%8C%BF%E5%90%8D%E8%AE%BF%E9%97%AE");
    assert.equal(calls[0].init.method, "POST");
    assert.equal(calls[0].init.body, JSON.stringify({ 参数1: "a", 参数2: "b" }));
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
        "https://example.com:8091/playground",
        "登录用户认证",
        JSON.stringify({ 参数1: "a", 参数2: "b" }),
        "client-id",
        "secret-key",
        callback
      )
    );

    const secondResult = await invokeWithCallback((callback) =>
      invoke(
        "https://example.com:8091/playground",
        "登录用户认证",
        JSON.stringify({ 参数1: "a", 参数2: "b" }),
        "client-id",
        "secret-key",
        callback
      )
    );

    assert.equal(calls.length, 5);
    assert.equal(calls[0].input, "https://example.com:22345/UserService/connect/token");
    assert.equal(calls[1].input, "https://example.com/UserService/connect/token");
    assert.equal(calls[2].input, "https://example.com:8091/playground/ServerCommand/%E7%99%BB%E5%BD%95%E7%94%A8%E6%88%B7%E8%AE%A4%E8%AF%81");
    assert.equal(calls[3].input, "https://example.com:22345/UserService/connect/token");
    assert.equal(calls[4].input, "https://example.com:8091/playground/ServerCommand/%E7%99%BB%E5%BD%95%E7%94%A8%E6%88%B7%E8%AE%A4%E8%AF%81");
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
        "http://example.com/playground",
        "登录用户认证",
        JSON.stringify({ 参数1: "a", 参数2: "b" }),
        "sid=123",
        callback
      )
    );
    await invokeWithCallback((callback) =>
      callGetTableDataWithOffsetWithCookie(
        "http://example.com/playground",
        JSON.stringify({ pageName: "测试页面" }),
        "sid=123",
        callback
      )
    );
    await invokeWithCallback((callback) =>
      callGetComboBindingOptionsWithCookie(
        "http://example.com/playground",
        JSON.stringify({ pageName: "测试页面" }),
        "sid=123",
        callback
      )
    );

    assert.deepEqual(
      calls.map((call) => call.input),
      [
        "http://example.com/playground/ServerCommand/%E7%99%BB%E5%BD%95%E7%94%A8%E6%88%B7%E8%AE%A4%E8%AF%81",
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

test("non-200 responses surface error messages through callback", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ErrCode: 400, Message: "错误消息", 值1: "a", 值2: "b" }), {
      status: 400,
      statusText: "Bad Request"
    });

  try {
    const result = await invokeWithCallback((callback) =>
      callServerCommandWithCookie(
        "http://example.com/playground",
        "登录用户认证-出错",
        JSON.stringify({ 参数1: "a", 参数2: "b" }),
        "sid=123",
        callback
      )
    );

    assert.deepEqual(result, {
      httpCode: 400,
      responseInJSON: JSON.stringify({ ErrCode: 400, Message: "错误消息", 值1: "a", 值2: "b" }),
      errorMessage: "错误消息"
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
