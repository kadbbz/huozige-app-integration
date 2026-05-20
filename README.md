# call-huozige-servercommand

TypeScript package for calling Huozige server commands and general HTTP APIs.

- `HuozigeAppClient["invoke-server-command"](...)`
- `HuozigeAppClient["invoke-general-api"](...)`

Both APIs use callback style:

```ts
function callback(
  isError: boolean,
  responseJson: string,
  errCode: string,
  errMessage: string
): void
```

## Install

```bash
npm install call-huozige-servercommand
```

## Usage

```ts
import { HuozigeAppClient } from "call-huozige-servercommand";

await HuozigeAppClient["invoke-server-command"](
  "https://example.com/",
  "MyApp",
  "demoCommand",
  JSON.stringify({ hello: "world" }),
  "your-client-id",
  "your-client-secret",
  (isError, responseJson, errCode, errMessage) => {
    console.log(isError, responseJson, errCode, errMessage);
  }
);
```

Anonymous server command call:

```ts
await HuozigeAppClient["invoke-server-command"](
  "https://example.com/",
  "MyApp",
  "publicCommand",
  JSON.stringify({ hello: "world" }),
  null,
  null,
  (isError, responseJson) => {
    console.log(isError, responseJson);
  }
);
```

General API call:

```ts
await HuozigeAppClient["invoke-general-api"](
  "https://api.example.com/demo",
  JSON.stringify({ hello: "world" }),
  "sid=abc123",
  (isError, responseJson) => {
    console.log(isError, responseJson);
  }
);
```

## API

### `HuozigeAppClient["invoke-server-command"](baseUrl, appName, serverCommandName, requestJson, ak, sk, callback)`

Calls `/{appName}/ServerCommand/{serverCommandName}`.

When `ak` and `sk` are both provided, it uses OAuth2 `client_credentials`:

1. Tries `{schema}://{host}:22345/UserService/connect/token`
2. If that fails with a network error or `404`, falls back to port `443`
3. If that still fails with a network error or `404`, falls back to port `80`
4. Reads `access_token`
5. Calls `/{appName}/ServerCommand/{serverCommandName}` with `Authorization: Bearer <token>`

If `ak` or `sk` is `null` or `undefined`, it calls the server command directly as an anonymous request.

The request body sent to the server command is:

```json
{
  "input": "{\"hello\":\"world\"}"
}
```

### `HuozigeAppClient["invoke-general-api"](endpoint, requestJson, cookie, callback)`

Calls `endpoint` directly and sends:

- `Cookie: <cookie>` when `cookie` is not `null` and not `undefined`

If `cookie` is `null` or `undefined`, it calls the API directly without a `Cookie` header.

The request body sent to the API is:

```json
"{\"hello\":\"world\"}"
```

## Scripts

```bash
npm run build
npm test
```

## Tests

`tests/huozige-app-client.test.js` contains 4 fast tests:

- `invoke-server-command` anonymous request
- `invoke-server-command` authenticated request
- `invoke-general-api` anonymous request
- `invoke-general-api` request with cookie
