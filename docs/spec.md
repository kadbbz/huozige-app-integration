# huozige-app-integration 规格说明

## 目标

提供一个 TypeScript SDK，用于调用活字格服务端命令以及基于 Cookie 的 WebAPI 接口。

## 公共约定

所有接收 `appBaseUrl` 的接口都必须兼容以下两种形式：

- `https://example.com/playground`
- `https://example.com/playground/`

所有公开接口的第一个参数都是 `method`：

- 支持 `POST` 和 `GET`
- 默认值为 `POST`
- 当 `method` 为 `POST` 时，发送 `requestInJSON` 作为请求体
- 当 `method` 为 `GET` 时，不发送请求体，而是把 `requestInJSON` 转为 URL query
- 当 `requestInJSON` 是 JSON 对象字符串时，按对象字段展开为 query 参数
- 当字段值是对象或数组时，使用 `JSON.stringify(value)` 后再写入 query
- 当 `requestInJSON` 不是合法的 JSON 对象字符串时，回退为 `requestInJSON=<原始内容>`

## 公开接口

### `invoke(method, appBaseUrl, serverCommand, requestInJSON, clientId, secretKey, callback)`

- `method`：请求方法，支持 `POST` 和 `GET`
- `appBaseUrl`：应用根地址，例如 `https://example.com/playground`
- `serverCommand`：服务端命令名称
- `requestInJSON`：JSON 字符串格式的请求内容，可为空
- `clientId`：OAuth 客户端 ID，可为空
- `secretKey`：OAuth 客户端密钥，可为空
- `callback`：`function(httpCode, responseInJSON, errorMessage)`

行为说明：

1. 如果 `clientId` 和 `secretKey` 同时存在，先获取令牌：
   - `{scheme}://{host}:22345/UserService/connect/token`
   - 回退地址：`{scheme}://{host}/UserService/connect/token`
2. 再向以下地址发送服务端命令请求：
   - `{appBaseUrl}/ServerCommand/{encodeURIComponent(serverCommand)}`
3. 当 `method` 为 `POST` 时，发送 `requestInJSON` 作为请求体。
4. 当 `method` 为 `GET` 时，不发送请求体，而是将 `requestInJSON` 转成 query 参数后附加到 URL。

### `callServerCommandWithCookie(method, appBaseUrl, serverCommand, requestInJSON, cookie, callback)`

- 请求地址：`{appBaseUrl}/ServerCommand/{encodeURIComponent(serverCommand)}`
- 当 `cookie` 不为空时，附加 `Cookie` 请求头
- 支持 `POST` 和 `GET`

### `callGetTableDataWithOffsetWithCookie(appBaseUrl, tableBinding, cookie, callback)`

- 请求地址：`{appBaseUrl}/Home/GetTableDataWithOffset`
- 当 `cookie` 不为空时，附加 `Cookie` 请求头
- method 固定为 `POST`
- tableBinding的数据结构如下所示，columns是列定义（含列名和绑定ID），table-name是数据表的名字，page-name是页面的名字，target-page是当前需要获取的数据分页（1基），page-limit-row-count是每一页的行数（0表示不分页）：

```javascript
{
   columns: [
      {
         "column-name":"文本",
         "giud":"38bc1902-7dea-421d-a10e-4cec1c7ab95e"
      },
      {
         "column-name":"整数",
         "giud":"c93f6c99-4cdb-45de-b174-b3196a61cb7e"
      }
   ],
   table-name: "数据表1",
   page-name: "测试页面",
   target-page: 1,
   page-limit-row-count: 0
}
```

该参数会被转化为HTTP请求参数：

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

- 返回值的结构如下所示，每一个元素表示一行数据，属性名需要使用columns中的column-name。

```json
{
   "data":[
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

该数据从返回结果，和请求参数结合，做二次加工而来，原始结果如下：

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

### `callGetComboBindingOptionsWithCookie(method, appBaseUrl, comboBinding, cookie, callback)`

- 请求地址：`{appBaseUrl}/Home/GetComboBindingOptions`
- 当 `cookie` 不为空时，附加 `Cookie` 请求头
- method 固定为 `POST`
- comboBinding的数据结构如下所示，columns是列定义（含列名和绑定ID），table-name是数据表的名字，page-name是页面的名字：

```javascript
{
   id-column: {
      "column-name":"整数",
      "giud":"9e5cf221-9fbd-4ded-aeb5-bb02449e819d"
   },
   text-column:{
      "column-name":"文本",
      "giud":"7135e363-d135-4c05-91b2-c162a85f050c"
   },
   table-name: "数据表1",
   page-name: "测试页面"
}
```

该参数会被转化为HTTP请求参数：

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

- 返回值的结构如下所示，每一个元素表示一行数据，属性名需要使用columns中的column-name。

```json
{
   "data":[
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

该数据从返回结果，和请求参数结合，做二次加工而来，原始结果如下：

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

## 回调约定

所有公开接口统一使用以下回调签名：

```ts
type HuozigeCallback = (
  httpCode: number,
  responseInJSON: string | null,
  errorMessage: string | null
) => void;
```

规则如下：

- `httpCode === 0` 表示在收到 HTTP 响应前就发生了失败
- `responseInJSON` 在可用时返回原始响应文本
- `errorMessage` 用于承载传输错误或非 2xx 响应的错误信息

## 测试覆盖

当前自动化测试覆盖以下场景：

- 匿名 `invoke`
- 集成测试中的 `匿名请求-GET`
- 带令牌缓存的鉴权 `invoke`
- 基于 Cookie 的接口调用
- `appBaseUrl` 带和不带尾部 `/`
- 所有公开请求接口显式使用 `GET`
- `GET` 请求把 `requestInJSON` 转成 query 参数
- `GET` 请求处理非 JSON 对象字符串的回退逻辑
- 非 2xx 响应的错误透传

集成测试脚本中的服务端命令场景包括：

- `匿名请求`
- `匿名请求-GET`
- `登录用户认证`
- `登录用户认证-出错`
