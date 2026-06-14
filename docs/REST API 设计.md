# 短链接功能 REST API 设计

## 设计原则

1. API 路径使用复数资源名：`/api/short-links`。
2. 请求参数和响应字段使用 camelCase。
3. 枚举值使用小写字符串，与现有后端规格保持一致：`active`、`disabled`。
4. 所有 API 错误响应使用统一结构。
5. 列表接口必须分页。
6. 跳转接口不要求登录；管理类接口要求登录。

## 通用响应结构

### 错误响应

所有 API 错误统一返回：

```json
{
  "code": "INVALID_URL",
  "message": "URL is invalid or unsupported."
}
```

字段说明：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `code` | string | 是 | 机器可读错误码 |
| `message` | string | 是 | 面向调用方的错误说明 |

### 短链接对象

```json
{
  "id": "sl_123",
  "originalUrl": "https://example.com/articles/123",
  "shortCode": "aB91xZ",
  "shortUrl": "https://s.example.com/aB91xZ",
  "status": "active",
  "clickCount": 42,
  "expiresAt": null,
  "createdAt": "2026-06-14T10:00:00Z",
  "updatedAt": "2026-06-14T10:00:00Z"
}
```

字段说明：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `id` | string | 是 | 短链接 ID |
| `originalUrl` | string | 是 | 原始长链接 |
| `shortCode` | string | 是 | 短码 |
| `shortUrl` | string | 是 | 完整短链接 |
| `status` | string | 是 | `active` 或 `disabled` |
| `clickCount` | number | 是 | 成功跳转次数 |
| `expiresAt` | string 或 null | 是 | ISO 8601 时间；null 表示不过期 |
| `createdAt` | string | 是 | ISO 8601 创建时间 |
| `updatedAt` | string | 是 | ISO 8601 更新时间 |

## API 列表

| 方法 | 路径 | 登录 | 说明 |
|---|---|---:|---|
| `POST` | `/api/short-links` | 是 | 创建短链接 |
| `GET` | `/api/short-links` | 是 | 查询当前用户短链接列表 |
| `GET` | `/api/short-links/{id}` | 是 | 查询短链接详情 |
| `PATCH` | `/api/short-links/{id}` | 是 | 更新短链接状态 |
| `GET` | `/{shortCode}` | 否 | 访问短链接并跳转 |

## 创建短链接

`POST /api/short-links`

### 请求参数

请求头：

| 名称 | 必填 | 说明 |
|---|---:|---|
| `Content-Type: application/json` | 是 | 请求体格式 |
| 登录凭证 | 是 | 使用项目现有认证机制 |

请求体：

```json
{
  "url": "https://example.com/articles/123"
}
```

| 字段 | 类型 | 必填 | 约束 |
|---|---|---:|---|
| `url` | string | 是 | 必须是合法 `http` 或 `https` URL |

### 成功响应

HTTP 状态码：`201 Created`

```json
{
  "id": "sl_123",
  "originalUrl": "https://example.com/articles/123",
  "shortCode": "aB91xZ",
  "shortUrl": "https://s.example.com/aB91xZ",
  "status": "active",
  "clickCount": 0,
  "expiresAt": null,
  "createdAt": "2026-06-14T10:00:00Z",
  "updatedAt": "2026-06-14T10:00:00Z"
}
```

如果同一用户重复提交相同归一化 URL，返回已有 active 短链接。建议状态码使用 `200 OK`，响应结构与创建成功一致。

### 错误码

| HTTP 状态码 | code | 场景 |
|---:|---|---|
| 400 | `URL_REQUIRED` | `url` 为空、缺失或只包含空白字符 |
| 400 | `INVALID_URL` | `url` 不是合法 URL，或缺少协议 |
| 400 | `UNSUPPORTED_URL_SCHEME` | 协议不是 `http` 或 `https` |
| 400 | `URL_NOT_ALLOWED` | 指向 localhost、内网 IP 或保留地址段 |
| 401 | `UNAUTHENTICATED` | 未登录 |
| 500 | `SHORT_CODE_GENERATION_FAILED` | 短码生成多次冲突后失败 |
| 500 | `INTERNAL_ERROR` | 未预期系统错误 |

### 边界条件

1. 不自动为 `example.com` 补全协议，缺少协议按非法 URL 处理。
2. 拒绝 `javascript:`、`data:`、`file:` 等协议。
3. 拒绝 `localhost`、`127.0.0.1`、`0.0.0.0`、内网 IP 和保留地址段。
4. URL 长度超过系统限制时返回 `INVALID_URL` 或后续单独定义 `URL_TOO_LONG`。
5. 短码冲突由服务端自动重试，客户端不需要感知。
6. 同一用户重复提交同一 URL 时不重复创建 active 记录。
7. 不同用户提交同一 URL 时可以生成各自的短链接。

## 查询短链接列表

`GET /api/short-links`

### 请求参数

Query 参数：

| 参数 | 类型 | 必填 | 默认值 | 约束 |
|---|---|---:|---|---|
| `page` | number | 否 | `1` | 最小值 `1` |
| `pageSize` | number | 否 | `20` | 最小值 `1`，最大值 `100` |
| `status` | string | 否 | 无 | 可选 `active`、`disabled` |

### 成功响应

HTTP 状态码：`200 OK`

```json
{
  "items": [
    {
      "id": "sl_123",
      "originalUrl": "https://example.com/articles/123",
      "shortCode": "aB91xZ",
      "shortUrl": "https://s.example.com/aB91xZ",
      "status": "active",
      "clickCount": 42,
      "expiresAt": null,
      "createdAt": "2026-06-14T10:00:00Z",
      "updatedAt": "2026-06-14T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

### 错误码

| HTTP 状态码 | code | 场景 |
|---:|---|---|
| 400 | `INVALID_PAGINATION` | `page` 或 `pageSize` 非法 |
| 400 | `INVALID_STATUS` | `status` 不是允许值 |
| 401 | `UNAUTHENTICATED` | 未登录 |
| 500 | `INTERNAL_ERROR` | 未预期系统错误 |

### 边界条件

1. 只返回当前登录用户创建的短链接。
2. 默认按 `createdAt` 倒序排序。
3. 无数据时返回空数组，`totalItems` 为 `0`。
4. `page` 超出总页数时返回空数组。
5. `pageSize` 超过最大值时返回 `INVALID_PAGINATION`，不静默截断。

## 查询短链接详情

`GET /api/short-links/{id}`

### 请求参数

Path 参数：

| 参数 | 类型 | 必填 | 约束 |
|---|---|---:|---|
| `id` | string | 是 | 短链接 ID |

### 成功响应

HTTP 状态码：`200 OK`

```json
{
  "id": "sl_123",
  "originalUrl": "https://example.com/articles/123",
  "shortCode": "aB91xZ",
  "shortUrl": "https://s.example.com/aB91xZ",
  "status": "active",
  "clickCount": 42,
  "expiresAt": null,
  "createdAt": "2026-06-14T10:00:00Z",
  "updatedAt": "2026-06-14T10:00:00Z"
}
```

### 错误码

| HTTP 状态码 | code | 场景 |
|---:|---|---|
| 400 | `INVALID_SHORT_LINK_ID` | `id` 格式非法 |
| 401 | `UNAUTHENTICATED` | 未登录 |
| 403 | `FORBIDDEN` | 查询他人短链接 |
| 404 | `SHORT_LINK_NOT_FOUND` | 短链接不存在 |
| 500 | `INTERNAL_ERROR` | 未预期系统错误 |

### 边界条件

1. 普通用户只能查询自己创建的短链接。
2. 如果项目采用隐藏资源存在性的安全策略，可以把他人资源返回 `404 SHORT_LINK_NOT_FOUND`，但需要全项目一致。
3. 已禁用短链接仍可被创建者查询。
4. 已过期短链接仍可被创建者查询。

## 更新短链接状态

`PATCH /api/short-links/{id}`

MVP 只支持禁用短链接。

### 请求参数

Path 参数：

| 参数 | 类型 | 必填 | 约束 |
|---|---|---:|---|
| `id` | string | 是 | 短链接 ID |

请求体：

```json
{
  "status": "disabled"
}
```

| 字段 | 类型 | 必填 | 约束 |
|---|---|---:|---|
| `status` | string | 是 | MVP 仅允许 `disabled` |

### 成功响应

HTTP 状态码：`200 OK`

```json
{
  "id": "sl_123",
  "status": "disabled",
  "updatedAt": "2026-06-14T10:05:00Z"
}
```

### 错误码

| HTTP 状态码 | code | 场景 |
|---:|---|---|
| 400 | `INVALID_SHORT_LINK_ID` | `id` 格式非法 |
| 400 | `INVALID_STATUS` | `status` 缺失或不是允许值 |
| 401 | `UNAUTHENTICATED` | 未登录 |
| 403 | `FORBIDDEN` | 操作他人短链接 |
| 404 | `SHORT_LINK_NOT_FOUND` | 短链接不存在 |
| 500 | `INTERNAL_ERROR` | 未预期系统错误 |

### 边界条件

1. 禁用操作是软删除，不物理删除数据。
2. 重复禁用已禁用短链接时建议保持幂等，返回 `200 OK`。
3. MVP 不支持从 `disabled` 恢复为 `active`。
4. 禁用后访问短码必须返回 `410 SHORT_LINK_DISABLED`。

## 访问短链接并跳转

`GET /{shortCode}`

该接口是公开访问接口，不要求登录。

### 请求参数

Path 参数：

| 参数 | 类型 | 必填 | 约束 |
|---|---|---:|---|
| `shortCode` | string | 是 | 只允许短码字符集中的字符 |

### 成功响应

HTTP 状态码：`302 Found`

```http
HTTP/1.1 302 Found
Location: https://example.com/articles/123
```

成功跳转时不返回 JSON body。

### 错误响应

API 调用或纯后端场景可返回 JSON：

```json
{
  "code": "SHORT_LINK_NOT_FOUND",
  "message": "Short link was not found."
}
```

面向浏览器用户时，也可以渲染错误页面，但错误语义必须与下表一致。

### 错误码

| HTTP 状态码 | code | 场景 |
|---:|---|---|
| 400 | `INVALID_SHORT_CODE` | 短码格式非法 |
| 404 | `SHORT_LINK_NOT_FOUND` | 短码不存在 |
| 410 | `SHORT_LINK_DISABLED` | 短链接已禁用 |
| 410 | `SHORT_LINK_EXPIRED` | 短链接已过期 |
| 500 | `INTERNAL_ERROR` | 未预期系统错误 |

### 边界条件

1. 有效短链返回 `302`，`Location` 必须等于 `originalUrl`。
2. 成功跳转后 `clickCount` 增加 1。
3. 不存在、禁用、过期的短链不增加 `clickCount`。
4. 禁用或过期短链不返回 `Location` header。
5. 短码查询应避免大小写规则不清；如果短码区分大小写，必须全链路保持区分。
6. 不跟随原始 URL，也不在跳转前请求原始 URL。

## 全局错误码表

| HTTP 状态码 | code | 说明 |
|---:|---|---|
| 400 | `URL_REQUIRED` | URL 为空 |
| 400 | `INVALID_URL` | URL 格式非法 |
| 400 | `UNSUPPORTED_URL_SCHEME` | URL 协议不支持 |
| 400 | `URL_NOT_ALLOWED` | URL 指向不允许的地址 |
| 400 | `INVALID_PAGINATION` | 分页参数非法 |
| 400 | `INVALID_STATUS` | 状态参数非法 |
| 400 | `INVALID_SHORT_LINK_ID` | 短链接 ID 格式非法 |
| 400 | `INVALID_SHORT_CODE` | 短码格式非法 |
| 401 | `UNAUTHENTICATED` | 未登录 |
| 403 | `FORBIDDEN` | 无权限 |
| 404 | `SHORT_LINK_NOT_FOUND` | 短链接不存在 |
| 410 | `SHORT_LINK_DISABLED` | 短链接已禁用 |
| 410 | `SHORT_LINK_EXPIRED` | 短链接已过期 |
| 500 | `SHORT_CODE_GENERATION_FAILED` | 短码生成失败 |
| 500 | `INTERNAL_ERROR` | 系统内部错误 |

## 兼容性约束

1. 后续新增响应字段必须是可选字段或对旧客户端无害的附加字段。
2. 不修改已有字段的类型和含义。
3. 不移除已有错误码。
4. 不改变列表接口默认排序，除非发布明确迁移说明。
5. 不改变短码大小写规则。
