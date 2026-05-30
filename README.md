# huozige-app-integration

用于调用活字格服务端命令及相关 WebAPI 接口的 TypeScript SDK。

## 安装

```bash
npm install huozige-app-integration
```

## 导出内容

- `invoke`
- `callServerCommandWithCookie`
- `callGetTableDataWithOffsetWithCookie`
- `callGetComboBindingOptionsWithCookie`
- `callCalcBindingDataSourceWithCookie`
- `HuozigeWebApiSdk`

## 用法

### 调用服务端命令

```ts
import { invoke } from "huozige-app-integration";

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
```

### 使用 Cookie 调用服务端命令

```ts
import { callServerCommandWithCookie } from "huozige-app-integration";

await callServerCommandWithCookie(
  "GET",
  "https://example.com/playground",
  "demoCommand",
  JSON.stringify({ hello: "world" }),
  "ForguncyServer=9mfghtL3fR2S...",
  (httpCode, responseInJSON, errorMessage) => {
    console.log(httpCode, responseInJSON, errorMessage);
  }
);
```

### 获取表格数据

```ts
import { callGetTableDataWithOffsetWithCookie } from "huozige-app-integration";

await callGetTableDataWithOffsetWithCookie(
  "https://example.com/playground",
  {
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
  },
  "ForguncyServer=9mfghtL3fR2S...",
  (httpCode, responseInJSON, errorMessage) => {
    console.log(httpCode, responseInJSON, errorMessage);
  }
);
```

### 获取下拉选项

```ts
import { callGetComboBindingOptionsWithCookie } from "huozige-app-integration";

await callGetComboBindingOptionsWithCookie(
  "https://example.com/playground",
  {
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
  },
  "ForguncyServer=9mfghtL3fR2S...",
  (httpCode, responseInJSON, errorMessage) => {
    console.log(httpCode, responseInJSON, errorMessage);
  }
);
```

### 获取 Calc 绑定数据源

```ts
import { callCalcBindingDataSourceWithCookie } from "huozige-app-integration";

await callCalcBindingDataSourceWithCookie(
  "https://example.com/playground",
  {
    "page-name": "Calendar 日历",
    "cell-location": "102,2",
    "table-name": "日程表",
    columns: [
      {
        "response-name": "date",
        "table-name": "日程表",
        "column-name": "日期"
      },
      {
        "response-name": "text",
        "table-name": "日程表",
        "column-name": "详情"
      }
    ]
  },
  "ForguncyServer=9mfghtL3fR2S...",
  (httpCode, responseInJSON, errorMessage) => {
    console.log(httpCode, responseInJSON, errorMessage);
  }
);
```

该接口会先通过 `GetMetadata2` 使用 `page-name + cell-location` 定位运行态绑定 `GUID`，再调用 `CalcBindingDataSource`。返回结果会按 `columns` 将 Calc 响应中的 `response-name` 字段映射为数据表 `column-name`。

如果绑定存在可传入的查询参数，传入 `query-params` 与 `params`。SDK 会按顺序把 `query-params` 中的 `表名.列名` 映射到运行态 `bindingOptions.Params` 中的公式参数名；如果运行态元数据没有暴露 `Params`，SDK 会返回错误，不会发送一个服务端会忽略的无效 `Params`。

## 脚本

```bash
npm run build
npm test
```

详细规格见 [docs/spec.md](E:\CODE\call-huozige-servercommand\docs\spec.md)。
