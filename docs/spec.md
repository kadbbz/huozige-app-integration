# 活字格WebAPI SDK（ts版）

## 目的

帮助ts的项目调用使用活字格开发的WebAPP的API接口，通常用于系统集成。

## 调用模式一：机机接口

机机接口是指使用活字格面向第三方系统开发的服务端命令，采用OAuth2客户端凭证模式认证。因为机机接口的实现，不能依赖“当前用户/CurrentUser”，所以通常不能直接复用面向Web前端的服务端命令、数据绑定后端服务等人机接口。

机机接口名为：invoke，需要传入以下参数：

- appBaseUrl：使用【获取APP根目录的URL】命令获取，如 `https://xxx:8091/xxx`
- serverCommand：服务端命令名
- requestInJSON：请求参数，通常为JSON对象序列化后的字符串，无参数的话，这里可以传null或{}
- clientId：客户端标识符，匿名访问时，这里可以传null或undefined
- secretKey：客户端密钥，匿名访问时，这里可以传null或undefined

输出参数：

- callback：回调，function(httpCode,responseInJSON,errorMessage)
  - httpCode：服务器返回的code，如200
  - responseInJSON：响应内容，通常为JSON序列化的对象，来自服务器的响应
  - errorMessage：如果服务器返回的code不是200，这里需要传递错误消息

实现方法：

1. 从appBaseUrl中推断出获取token的Url地址，{schema}://{Server}:22345/UserService/connect/token 或 {schema}://{Server}/UserService/connect/token ，22345是首选，如果不存在则回退到默认端口
2. 向获取token的Url发送x-www-form-urlencoded编码的参数
|参数|说明|示例|
|client_id|客户端标识符|使用clientId参数|
|client_secret|客户端密钥|使用secretKey参数|
|scope|申请的权限范围|固定为： FGC_AllAppsServerCommands|
|grant_type|申请方式|固定为：client_credentials|
3. 解析返回的值，获取 access_token 和 expires_in（单位是秒），将access_token缓存到内存，缓存Key为token的Url地址，过期时间为expires_in-1秒
4. 发送请求到appBaseUrl + /ServerCommand/ + 服务端命令名称，head的Authorization为Bearer + 空格 + access_token，body是requestInJSON
5. 等待请求返回后，执行callback回调，按照约定传递参数

## 调用模式二：人机接口

人机接口指使用Cookie模拟前端调用所有公开服务端命令和数据绑定后端服务（GetTableDataWithOffset、GetComboBindingOptions）。

人机接口分为4个接口：call-server-command-with-cookie, call-get-table-data-with-offset-with-cookie, call-get-combo-binding-options-with-cookie，均需要传入以下参数：

- appBaseUrl：使用【获取APP根目录的URL】命令获取，如 `https://xxx:8091/xxx`
- requestInJSON：请求参数，通常为JSON对象序列化后的字符串，无参数的话，这里可以传null或{}
- cookie：Cookie字符串

输出参数：

- callback：回调，function(httpCode,responseInJSON,errorMessage)
  - httpCode：服务器返回的code，如200
  - responseInJSON：响应内容，通常为JSON序列化的对象，来自服务器的响应
  - errorMessage：如果服务器返回的code不是200，这里需要传递错误消息

实现方法：

1. 发送请求到endpoint，head的Cookie为cookie，body是requestInJSON，endpoint的生成方法如下
   1. call-server-command-with-cookie：appBaseUrl + /ServerCommand/ + 服务端命令名称
   2. call-get-table-data-with-offset-with-cookie：appBaseUrl + /Home/GetTableDataWithOffset
   3. call-get-combo-binding-options-with-cookie：appBaseUrl + /Home/GetComboBindingOptions
2. 等待请求返回后，执行callback回调，按照约定传递参数

## 测试

- appBaseUrl：http://10.32.6.242:8081/playground
- clientId：ee543888-237f-4b75-81e7-f49d129d
- secretKey：8beb37c8-ea5e-44ac-a881-5e9e0560
- cookie：临时提供

### 机机接口1/人机接口1

- 服务端命令：匿名访问
- 请求：{"参数1":"a","参数2":"b"}
- 预期httpCode：200
- 预期响应：

```json
{
  "ErrCode": 0,
  "返回值1": "a",
  "返回值2": "b"
}
```

### 机机接口2/人机接口2

- 服务端命令：登录用户认证
- 请求：{"参数1":"a","参数2":"b"}
- 预期httpCode：200
- 预期响应：

```json
{
  "ErrCode": 0,
  "返回值1": "a",
  "返回值2": "b"
}
```

### 机机接口3/人机接口3

- 服务端命令：登录用户认证-出错
- 请求：{"参数1":"a","参数2":"b"}
- 预期httpCode：200
- 预期响应：{ErrCode: 400, Message: "错误消息", 返回值1: "a", 返回值2: "b"}

### 人机接口4（GetTableDataWithOffset）

- 请求

```json
{"bindingInfos":["38bc1902-7dea-421d-a10e-4cec1c7ab95e","c93f6c99-4cdb-45de-b174-b3196a61cb7e"],"currentRowInfo":{"currentTable":"数据表1","viewname":"测试页面表格1","listviewLocation":"测试页面|表格1"},"demandRowCount":0,"currentDataLength":0,"needRowVersion":true,"editorDataInfos":null,"sortCommandID":null,"orderByInfo":null,"offsetConditionInfo":{"targetPage":1,"pageLimitRowCount":0},"columnFilterQueries":null,"totalRowBindingInfos":[],"pageName":"测试页面"}
```

- 预期httpCode：200
- 预期响应：

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

### 人机接口5（GetComboBindingOptions）

- 请求

```json
{"tableName":"数据表1","valueColumnBindingInfo":"9e5cf221-9fbd-4ded-aeb5-bb02449e819d","displayColumnBindingInfo":"7135e363-d135-4c05-91b2-c162a85f050c","itemQuery":null,"offset":null,"pageName":"测试页面","cacheSettingID":"f604732f-465b-3429-27d7-75ed83b39a6e"}
```

- 预期httpCode：200
- 预期响应：

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
