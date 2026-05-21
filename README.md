# huozige-app-integration

用于调用活字格服务端命令及相关 WebAPI 接口的 TypeScript 包。

## 安装

```bash
npm install huozige-app-integration
```

## 导出内容

- `invoke`
- `callServerCommandWithCookie`
- `callGetTableDataWithOffsetWithCookie`
- `callGetComboBindingOptionsWithCookie`
- `HuozigeWebApiSdk`

## 请求方法

每个公开接口的第一个参数都是 `method`，支持 `POST` 和 `GET`，默认值为 `POST`。

- 当 `method` 为 `POST` 时，会把 `requestInJSON` 作为请求体发送。
- 当 `method` 为 `GET` 时，不会发送请求体，而是把 `requestInJSON` 拼接到 URL query 中。
- 如果 `requestInJSON` 是 JSON 对象字符串，会按对象字段展开为 query 参数。
- 如果字段值是对象或数组，会先做 `JSON.stringify` 再写入 query。
- 如果 `requestInJSON` 不是合法的 JSON 对象字符串，则回退为 `requestInJSON=<原始内容>`。
- `appBaseUrl` 同时兼容以下两种形式：
  - `https://example.com/playground`
  - `https://example.com/playground/`

## 使用示例

```ts
import {
  callGetComboBindingOptionsWithCookie,
  callGetTableDataWithOffsetWithCookie,
  callServerCommandWithCookie,
  invoke
} from "huozige-app-integration";

await invoke(
  "POST",
  "https://example.com/playground",
  "demoCommand",
  JSON.stringify({ hello: "world" }),
  "your-client-id",
  "your-client-secret",
  (httpCode, responseInJSON, errorMessage) => {
    console.log(httpCode, responseInJSON, errorMessage);
  }
);

await callServerCommandWithCookie(
  "GET",
  "https://example.com/playground",
  "demoCommand",
  JSON.stringify({ hello: "world" }),
  "sid=abc123",
  (httpCode, responseInJSON, errorMessage) => {
    console.log(httpCode, responseInJSON, errorMessage);
  }
);

await callGetTableDataWithOffsetWithCookie(
  "POST",
  "https://example.com/playground",
  JSON.stringify({ pageName: "DemoPage" }),
  "sid=abc123",
  (httpCode, responseInJSON, errorMessage) => {
    console.log(httpCode, responseInJSON, errorMessage);
  }
);

await callGetComboBindingOptionsWithCookie(
  "POST",
  "https://example.com/playground",
  JSON.stringify({ pageName: "DemoPage" }),
  "sid=abc123",
  (httpCode, responseInJSON, errorMessage) => {
    console.log(httpCode, responseInJSON, errorMessage);
  }
);
```

上面的 `GET` 调用最终会得到类似这样的地址：

```text
https://example.com/playground/ServerCommand/demoCommand?hello=world
```

## API 说明

### `invoke(method, appBaseUrl, serverCommand, requestInJSON, clientId, secretKey, callback)`

调用地址为 `/{appBaseUrl}/ServerCommand/{serverCommand}`。

当 `clientId` 和 `secretKey` 同时存在时，会先申请 OAuth2 令牌，再调用服务端命令：

1. 请求 `POST {scheme}://{host}:22345/UserService/connect/token`
2. 如果返回 `404` 或发生可重试网络错误，则回退到 `POST {scheme}://{host}/UserService/connect/token`
3. 将 `access_token` 按 `expires_in - 1` 秒缓存到内存中
4. 调用目标接口时带上 `Authorization: Bearer <token>`

如果 `clientId` 或 `secretKey` 缺失，则按匿名方式直接调用服务端命令。

当 `method` 为 `GET` 时，`requestInJSON` 不会作为请求体发送，而会被转换为 query 参数并拼接到目标 URL。

### `callServerCommandWithCookie(method, appBaseUrl, serverCommand, requestInJSON, cookie, callback)`

调用 `/{appBaseUrl}/ServerCommand/{serverCommand}`，当 `cookie` 有值时会发送 `Cookie: <cookie>` 请求头。

### `callGetTableDataWithOffsetWithCookie(method, appBaseUrl, requestInJSON, cookie, callback)`

调用 `/{appBaseUrl}/Home/GetTableDataWithOffset`，当 `cookie` 有值时会发送 `Cookie: <cookie>` 请求头。

### `callGetComboBindingOptionsWithCookie(method, appBaseUrl, requestInJSON, cookie, callback)`

调用 `/{appBaseUrl}/Home/GetComboBindingOptions`，当 `cookie` 有值时会发送 `Cookie: <cookie>` 请求头。

## 脚本

```bash
npm run build
npm test
```

## 测试说明

当前仓库包含两类测试：

- `npm test`：单元测试，覆盖请求方法、query 拼接、token 缓存、Cookie 请求和错误透传。
- `npm run test:integration`：集成测试，包含以下服务端命令场景：
  - `匿名请求`
  - `匿名请求-GET`
  - `登录用户认证`
  - `登录用户认证-出错`
