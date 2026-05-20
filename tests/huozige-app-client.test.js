import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { HuozigeAppClient } from "../dist/index.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  if (originalFetch === undefined) {
    delete globalThis.fetch;
    return;
  }

  globalThis.fetch = originalFetch;
});

test("invoke-server-command anonymous request", async () => {
  const calls = [];
  let callbackArgs;

  globalThis.fetch = async (url, init) => {
    calls.push({
      url: String(url),
      method: init?.method,
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: init?.body
    });

    return new Response("{\"ok\":true}", {
      status: 200,
      headers: {
        "content-type": "application/json"
      }
    });
  };

  await HuozigeAppClient["invoke-server-command"](
    "https://example.com/root/",
    "App1",
    "demo",
    "{\"hello\":\"world\"}",
    null,
    undefined,
    (isError, responseJson, errCode, errMessage) => {
      callbackArgs = { isError, responseJson, errCode, errMessage };
    }
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://example.com/root/App1/ServerCommand/demo");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].headers["content-type"], "application/json");
  assert.equal(calls[0].headers.authorization, undefined);
  assert.equal(calls[0].body, "{\"input\":\"{\\\"hello\\\":\\\"world\\\"}\"}");
  assert.deepEqual(callbackArgs, {
    isError: false,
    responseJson: "{\"ok\":true}",
    errCode: "",
    errMessage: ""
  });
});

test("invoke-server-command authenticated request", async () => {
  const calls = [];
  let callbackArgs;

  globalThis.fetch = async (url, init) => {
    const request = {
      url: String(url),
      method: init?.method,
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: init?.body
    };

    calls.push(request);

    if (request.url.includes("/UserService/connect/token")) {
      return new Response(
        JSON.stringify({
          access_token: "token-abc",
          expires_in: 7200
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    }

    return new Response("{\"ok\":true}", {
      status: 200,
      headers: {
        "content-type": "application/json"
      }
    });
  };

  await HuozigeAppClient["invoke-server-command"](
    "https://example.com/root/",
    "App2",
    "secure-demo",
    "{\"secure\":true}",
    "ak-1",
    "sk-1",
    (isError, responseJson, errCode, errMessage) => {
      callbackArgs = { isError, responseJson, errCode, errMessage };
    }
  );

  assert.equal(calls.length, 2);
  assert.equal(
    calls[0].url,
    "https://example.com:22345/UserService/connect/token"
  );
  assert.equal(calls[0].method, "POST");
  assert.equal(
    calls[0].body,
    "client_id=ak-1&client_secret=sk-1&scope=FGC_AllAppsServerCommands&grant_type=client_credentials"
  );
  assert.equal(
    calls[1].url,
    "https://example.com/root/App2/ServerCommand/secure-demo"
  );
  assert.equal(calls[1].headers.authorization, "Bearer token-abc");
  assert.equal(calls[1].body, "{\"input\":\"{\\\"secure\\\":true}\"}");
  assert.deepEqual(callbackArgs, {
    isError: false,
    responseJson: "{\"ok\":true}",
    errCode: "",
    errMessage: ""
  });
});

test("invoke-general-api anonymous request", async () => {
  const calls = [];
  let callbackArgs;

  globalThis.fetch = async (url, init) => {
    calls.push({
      url: String(url),
      method: init?.method,
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: init?.body
    });

    return new Response("{\"ok\":true}", {
      status: 200,
      headers: {
        "content-type": "application/json"
      }
    });
  };

  await HuozigeAppClient["invoke-general-api"](
    "https://api.example.com/demo",
    "{\"ping\":1}",
    undefined,
    (isError, responseJson, errCode, errMessage) => {
      callbackArgs = { isError, responseJson, errCode, errMessage };
    }
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.example.com/demo");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].headers["content-type"], "application/json");
  assert.equal(calls[0].headers.cookie, undefined);
  assert.equal(calls[0].body, "{\"ping\":1}");
  assert.deepEqual(callbackArgs, {
    isError: false,
    responseJson: "{\"ok\":true}",
    errCode: "",
    errMessage: ""
  });
});

test("invoke-general-api request with cookie", async () => {
  const calls = [];
  let callbackArgs;

  globalThis.fetch = async (url, init) => {
    calls.push({
      url: String(url),
      method: init?.method,
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: init?.body
    });

    return new Response("{\"ok\":true}", {
      status: 200,
      headers: {
        "content-type": "application/json"
      }
    });
  };

  await HuozigeAppClient["invoke-general-api"](
    "https://api.example.com/secure-demo",
    "{\"ping\":2}",
    "sid=abc123",
    (isError, responseJson, errCode, errMessage) => {
      callbackArgs = { isError, responseJson, errCode, errMessage };
    }
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.example.com/secure-demo");
  assert.equal(calls[0].headers.cookie, "sid=abc123");
  assert.equal(calls[0].body, "{\"ping\":2}");
  assert.deepEqual(callbackArgs, {
    isError: false,
    responseJson: "{\"ok\":true}",
    errCode: "",
    errMessage: ""
  });
});
