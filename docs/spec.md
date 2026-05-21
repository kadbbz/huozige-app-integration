# huozige-app-integration 规格说明

## 1. 目标

提供一个 TypeScript SDK，用于调用活字格服务端命令以及基于 Cookie 的 WebAPI 接口。

SDK 对外暴露 4 个公开函数：

- `invoke`
- `callServerCommandWithCookie`
- `callGetTableDataWithOffsetWithCookie`
- `callGetComboBindingOptionsWithCookie`

## 2. 通用约定

### 2.1 `appBaseUrl`

所有接收 `appBaseUrl` 的接口都必须兼容以下两种形式：

- `https://example.com/playground`
- `https://example.com/playground/`

SDK 在内部会将其标准化，再与目标路径拼接。

### 2.2 回调签名

所有公开接口统一使用以下回调签名：

```ts
type HuozigeCallback = (
  httpCode: number,
  responseInJSON: string | null,
  errorMessage: string | null
) => void;
```

回调语义如下：

- `httpCode === 0`：表示在收到 HTTP 响应之前就发生了失败，例如网络错误、运行时错误、响应加工错误。
- `httpCode >= 100`：表示已收到 HTTP 响应，此值为真实 HTTP 状态码。
- `responseInJSON`：成功时返回响应文本。对 `callGetTableDataWithOffsetWithCookie` 与 `callGetComboBindingOptionsWithCookie` 而言，返回的是 SDK 二次加工后的 JSON 字符串；如果加工失败，则返回原始响应文本。
- `errorMessage`：当请求失败、非 2xx 响应、或成功响应的二次加工失败时返回错误消息；否则为 `null`。

### 2.3 `GET` / `POST` 规则

以下两个接口支持 `GET` 与 `POST`：

- `invoke`
- `callServerCommandWithCookie`

规则如下：

- `method` 仅支持 `"GET"` 或 `"POST"`
- 默认值为 `"POST"`
- 当 `method === "POST"` 时：
  - 发送 `requestInJSON` 作为请求体
  - `Content-Type` 为 `application/json; charset=utf-8`
- 当 `method === "GET"` 时：
  - 不发送请求体
  - 将 `requestInJSON` 转换为 URL query 参数后附加到请求地址

`requestInJSON` 转 query 的规则如下：

1. 当 `requestInJSON` 为 `null`、`undefined` 或空字符串时，不追加 query。
2. 当 `requestInJSON` 是合法的 JSON 对象字符串时：
   - 按对象一层字段展开为 query 参数
   - 键名直接使用对象字段名
   - 如果字段值为基础类型，直接转为字符串
   - 如果字段值为对象或数组，先执行 `JSON.stringify(value)` 再写入 query
   - 如果字段值为 `null`，写入字符串 `"null"`
3. 当 `requestInJSON` 不是合法的 JSON 对象字符串时：
   - 回退为 `requestInJSON=<原始内容>`

说明：

- 顶层 JSON 数组不会按数组项展开，也会走回退逻辑。
- 该规则只适用于 `invoke` 和 `callServerCommandWithCookie`。

### 2.4 固定 `POST` 的接口

以下两个接口固定使用 `POST`，不接收 `method` 参数：

- `callGetTableDataWithOffsetWithCookie`
- `callGetComboBindingOptionsWithCookie`

它们的请求体不是由调用方直接传 JSON 字符串，而是由 SDK 根据绑定对象自动构造。

## 3. `invoke`

### 3.1 函数签名

```ts
invoke(
  method: "GET" | "POST" = "POST",
  appBaseUrl: string,
  serverCommand: string,
  requestInJSON: string | null | undefined,
  clientId: string | null | undefined,
  secretKey: string | null | undefined,
  callback: HuozigeCallback
): Promise<void>
```

### 3.2 请求地址

目标地址：

```text
{appBaseUrl}/ServerCommand/{encodeURIComponent(serverCommand)}
```

### 3.3 鉴权规则

当 `clientId` 和 `secretKey` 同时为非空字符串时，SDK 先获取 OAuth2 令牌，再调用目标服务端命令。

取 token 的地址顺序如下：

1. 首选：

```text
{scheme}://{host}:22345/UserService/connect/token
```

2. 回退：

```text
{scheme}://{host}/UserService/connect/token
```

说明：

- 这里的 `{scheme}` 与 `{host}` 从 `appBaseUrl` 中提取。
- 会忽略 `appBaseUrl` 上已有的端口和路径，只使用协议与主机名。

### 3.4 Token 请求格式

请求方法固定为 `POST`。

请求头：

```text
Content-Type: application/x-www-form-urlencoded; charset=utf-8
```

请求体：

```text
client_id=<clientId>
client_secret=<secretKey>
scope=FGC_AllAppsServerCommands
grant_type=client_credentials
```

### 3.5 Token 缓存规则

- 缓存键为最终实际访问的 token URL。
- 当 token 返回：

```json
{
  "access_token": "xxx",
  "expires_in": 120
}
```

SDK 会将其缓存到内存中。

- 过期时间按 `expires_in - 1` 秒计算。
- 当缓存未过期时，后续相同 token URL 直接复用，不再重新请求。

### 3.6 Token 回退规则

会继续尝试回退地址的情况：

- 首选 token 地址返回 `404`
- 首选 token 地址发生可重试网络错误

当前可重试网络错误判定：

- `TypeError`
- 错误消息包含 `fetch failed`
- 错误消息包含 `ECONNREFUSED`

### 3.7 服务端命令请求头

始终包含：

```text
Content-Type: application/json; charset=utf-8
```

当成功拿到 token 时，追加：

```text
Authorization: Bearer <access_token>
```

### 3.8 响应处理

- 2xx：回调 `callback(status, responseText, null)`
- 非 2xx：回调 `callback(status, responseText || null, errorMessage)`
- 网络或运行时异常：回调 `callback(0, null, errorMessage)`

非 2xx 时，错误消息提取顺序如下：

1. `error_description`
2. `error`
3. `Message`
4. `message`
5. 原始响应文本
6. `response.statusText`
7. `"Request failed."`

## 4. `callServerCommandWithCookie`

### 4.1 函数签名

```ts
callServerCommandWithCookie(
  method: "GET" | "POST" = "POST",
  appBaseUrl: string,
  serverCommand: string,
  requestInJSON: string | null | undefined,
  cookie: string | null | undefined,
  callback: HuozigeCallback
): Promise<void>
```

### 4.2 请求地址

```text
{appBaseUrl}/ServerCommand/{encodeURIComponent(serverCommand)}
```

### 4.3 请求头

始终包含：

```text
Content-Type: application/json; charset=utf-8
```

当 `cookie` 为非空字符串时，追加：

```text
Cookie: <cookie>
```

### 4.4 其他行为

- `GET` / `POST` 规则与 `invoke` 完全一致
- 不参与 token 获取
- 响应处理规则与 `invoke` 一致

## 5. `callGetTableDataWithOffsetWithCookie`

### 5.1 函数签名

```ts
callGetTableDataWithOffsetWithCookie(
  appBaseUrl: string,
  tableBinding: {
    columns: Array<{
      "column-name": string;
      guid: string;
    }>;
    "table-name": string;
    "view-name": string;
    "list-view-location": string;
    "page-name": string;
    "target-page": number;
    "page-limit-row-count": number;
  },
  cookie: string | null | undefined,
  callback: HuozigeCallback
): Promise<void>
```

### 5.2 请求地址

```text
{appBaseUrl}/Home/GetTableDataWithOffset
```

### 5.3 请求方法

固定为：

```text
POST
```

### 5.4 请求头

始终包含：

```text
Content-Type: application/json; charset=utf-8
```

当 `cookie` 为非空字符串时，追加：

```text
Cookie: <cookie>
```

### 5.5 输入结构

`tableBinding` 示例：

```javascript
{
  columns: [
    {
      "column-name": "文本",
      "guid": "38bc1902-7dea-421d-a10e-4cec1c7ab95e"
    },
    {
      "column-name": "整数",
      "guid": "c93f6c99-4cdb-45de-b174-b3196a61cb7e"
    }
  ],
  "table-name": "数据表1",
  "view-name": "测试页面表格1",
  "list-view-location": "测试页面|表格1",
  "page-name": "测试页面",
  "target-page": 1,
  "page-limit-row-count": 0
}
```

字段要求：

- `columns`：按期望输出列顺序排列
- `columns[n].column-name`：输出结果中的字段名
- `columns[n].guid`：对应列绑定 ID
- `table-name`：表名
- `view-name`：传给 `currentRowInfo.viewname` 的值
- `list-view-location`：传给 `currentRowInfo.listviewLocation` 的值
- `page-name`：页名
- `target-page`：目标页码
- `page-limit-row-count`：每页数量，`0` 表示不分页

### 5.6 请求体转换规则

SDK 会将 `tableBinding` 转换为以下结构：

```javascript
{
  bindingInfos: [
    "38bc1902-7dea-421d-a10e-4cec1c7ab95e",
    "c93f6c99-4cdb-45de-b174-b3196a61cb7e"
  ],
  currentRowInfo: {
    currentTable: "数据表1",
    viewname: "测试页面表格1",
    listviewLocation: "测试页面|表格1"
  },
  demandRowCount: 0,
  currentDataLength: 0,
  needRowVersion: true,
  editorDataInfos: null,
  sortCommandID: null,
  orderByInfo: null,
  offsetConditionInfo: {
    targetPage: 1,
    pageLimitRowCount: 0
  },
  columnFilterQueries: null,
  totalRowBindingInfos: [],
  pageName: "测试页面"
}
```

逐字段规则如下：

- `bindingInfos`
  - 取自 `tableBinding.columns.map(column => column.guid)`
- `currentRowInfo.currentTable`
  - 取自 `tableBinding["table-name"]`
- `currentRowInfo.viewname`
  - 取自 `tableBinding["view-name"]`
- `currentRowInfo.listviewLocation`
  - 取自 `tableBinding["list-view-location"]`
- `demandRowCount`
  - 固定为 `0`
- `currentDataLength`
  - 固定为 `0`
- `needRowVersion`
  - 固定为 `true`
- `editorDataInfos`
  - 固定为 `null`
- `sortCommandID`
  - 固定为 `null`
- `orderByInfo`
  - 固定为 `null`
- `offsetConditionInfo.targetPage`
  - 取自 `tableBinding["target-page"]`
- `offsetConditionInfo.pageLimitRowCount`
  - 取自 `tableBinding["page-limit-row-count"]`
- `columnFilterQueries`
  - 固定为 `null`
- `totalRowBindingInfos`
  - 固定为空数组 `[]`
- `pageName`
  - 取自 `tableBinding["page-name"]`

### 5.7 原始响应结构

SDK 期待服务端返回形如：

```json
{
  "table": {
    "Data": [
      {
        "C0": "ABC",
        "C1": 1,
        "C2": "",
        "Query": "{\"ID\":1}"
      },
      {
        "C0": "DEF",
        "C1": 2,
        "C2": "",
        "Query": "{\"ID\":2}"
      }
    ],
    "AllRowLoaded": true
  }
}
```

要求：

- 顶层必须是 JSON 对象
- `table` 必须是对象
- `table.Data` 必须是数组
- 数组中每个元素必须是对象

### 5.8 成功响应加工规则

SDK 会将 `table.Data` 的每一行映射为一个普通对象：

- 第 0 列取 `C0`
- 第 1 列取 `C1`
- 第 2 列取 `C2`
- 以此类推

字段名来自 `tableBinding.columns[n]["column-name"]`。

因此上面的原始响应会被加工为：

```json
{
  "data": [
    {
      "文本": "ABC",
      "整数": 1
    },
    {
      "文本": "DEF",
      "整数": 2
    }
  ]
}
```

加工后会执行：

```ts
callback(httpCode, JSON.stringify(mappedResult), null)
```

### 5.9 加工失败处理

如果 HTTP 为 2xx，但原始响应无法按预期结构解析或加工，则：

- `httpCode` 仍为真实 HTTP 状态码
- `responseInJSON` 返回原始响应文本
- `errorMessage` 返回加工失败信息

## 6. `callGetComboBindingOptionsWithCookie`

### 6.1 函数签名

```ts
callGetComboBindingOptionsWithCookie(
  appBaseUrl: string,
  comboBinding: {
    "id-column": {
      "column-name": string;
      guid: string;
    };
    "text-column": {
      "column-name": string;
      guid: string;
    };
    "table-name": string;
    "page-name": string;
  },
  cookie: string | null | undefined,
  callback: HuozigeCallback
): Promise<void>
```

### 6.2 请求地址

```text
{appBaseUrl}/Home/GetComboBindingOptions
```

### 6.3 请求方法

固定为：

```text
POST
```

### 6.4 请求头

始终包含：

```text
Content-Type: application/json; charset=utf-8
```

当 `cookie` 为非空字符串时，追加：

```text
Cookie: <cookie>
```

### 6.5 输入结构

`comboBinding` 示例：

```javascript
{
  "id-column": {
    "column-name": "整数",
    "guid": "9e5cf221-9fbd-4ded-aeb5-bb02449e819d"
  },
  "text-column": {
    "column-name": "文本",
    "guid": "7135e363-d135-4c05-91b2-c162a85f050c"
  },
  "table-name": "数据表1",
  "page-name": "测试页面"
}
```

字段要求：

- `id-column.column-name`：输出中值列对应的字段名
- `id-column.guid`：值列绑定 ID
- `text-column.column-name`：输出中显示列对应的字段名
- `text-column.guid`：显示列绑定 ID
- `table-name`：表名
- `page-name`：页名

### 6.6 请求体转换规则

SDK 会将 `comboBinding` 转换为：

```javascript
{
  tableName: "数据表1",
  valueColumnBindingInfo: "9e5cf221-9fbd-4ded-aeb5-bb02449e819d",
  displayColumnBindingInfo: "7135e363-d135-4c05-91b2-c162a85f050c",
  itemQuery: null,
  offset: null,
  pageName: "测试页面"
}
```

逐字段规则如下：

- `tableName`
  - 取自 `comboBinding["table-name"]`
- `valueColumnBindingInfo`
  - 取自 `comboBinding["id-column"].guid`
- `displayColumnBindingInfo`
  - 取自 `comboBinding["text-column"].guid`
- `itemQuery`
  - 固定为 `null`
- `offset`
  - 固定为 `null`
- `pageName`
  - 取自 `comboBinding["page-name"]`

### 6.7 原始响应结构

SDK 期待服务端返回形如：

```json
{
  "Items": [
    {
      "Value": 1,
      "DisplayValue": "ABC"
    },
    {
      "Value": 2,
      "DisplayValue": "DEF"
    }
  ],
  "DisplayValueType": 3,
  "SubItemsColumnTypeDic": {}
}
```

要求：

- 顶层必须是 JSON 对象
- `Items` 必须是数组
- 数组中每个元素必须是对象

### 6.8 成功响应加工规则

SDK 会将 `Items` 映射为：

- `DisplayValue` 映射到 `text-column.column-name`
- `Value` 映射到 `id-column.column-name`

例如：

```json
{
  "data": [
    {
      "文本": "ABC",
      "整数": 1
    },
    {
      "文本": "DEF",
      "整数": 2
    }
  ]
}
```

加工后会执行：

```ts
callback(httpCode, JSON.stringify(mappedResult), null)
```

### 6.9 加工失败处理

如果 HTTP 为 2xx，但原始响应无法按预期结构解析或加工，则：

- `httpCode` 仍为真实 HTTP 状态码
- `responseInJSON` 返回原始响应文本
- `errorMessage` 返回加工失败信息

## 7. 类型导出

SDK 额外导出以下类型：

```ts
type HuozigeCallback
type HuozigeRequestMethod
type HuozigeBindingColumn
type HuozigeTableBinding
type HuozigeComboBinding
```

## 8. 当前实现中的非兼容变更

相对于旧接口，本次按新 spec 的非兼容变更如下：

1. `callGetTableDataWithOffsetWithCookie` 不再接收 `method`
2. `callGetTableDataWithOffsetWithCookie` 不再接收原始 `requestInJSON` 字符串
3. `callGetComboBindingOptionsWithCookie` 不再接收 `method`
4. `callGetComboBindingOptionsWithCookie` 不再接收原始 `requestInJSON` 字符串
5. 两个接口的成功回调 `responseInJSON` 不再返回服务端原始 JSON，而是返回 SDK 二次加工后的 `{"data":[...]}` JSON 字符串
6. 绑定列字段统一使用 `guid`
7. `callGetTableDataWithOffsetWithCookie` 的 `viewname` 与 `listviewLocation` 不再由 SDK 内部拼接，改为调用方显式传入 `view-name` 与 `list-view-location`

## 9. 测试覆盖

当前自动化测试覆盖以下场景：

- 匿名 `invoke`
- `invoke` 的 `GET` 请求
- `callServerCommandWithCookie` 的 `GET` 请求
- `GET` 请求把 `requestInJSON` 转成 query 参数
- `GET` 请求处理非 JSON 对象字符串的回退逻辑
- 带 token 缓存的鉴权 `invoke`
- Cookie 请求头附加
- `appBaseUrl` 带和不带尾部 `/`
- `callGetTableDataWithOffsetWithCookie` 的请求体转换
- `callGetTableDataWithOffsetWithCookie` 的响应加工
- `callGetComboBindingOptionsWithCookie` 的请求体转换
- `callGetComboBindingOptionsWithCookie` 的响应加工
- 非 2xx 响应的错误透传
