# 接口测试说明

## 测试定位

当前接口测试使用 `Vitest` 和真实 HTTP 请求执行。

测试会在随机本地端口启动短链接 HTTP 服务，并通过服务当前 `baseUrl` 生成和断言 `shortUrl`。测试中不固定传入 `https://s.example.com`。

接口测试目录：

```text
tests/api/
```

## 自动化接口测试

执行命令：

```bash
npm run test:api
```

完整测试命令：

```bash
npm test
```

测试文件：

```text
tests/api/short-links.api.test.ts
```

## 覆盖范围

| 接口行为 | 期望结果 |
|---|---|
| `GET /health` | 返回 `200` 和 `{ "status": "ok" }` |
| `POST /api/short-links` 创建合法短链接 | 返回 `201`，响应包含 `shortCode` 和 `shortUrl` |
| `javascript:` URL | 返回 `400 UNSUPPORTED_URL_SCHEME` |
| `localhost` 目标 URL | 返回 `400 URL_NOT_ALLOWED` |
| 内网 IP 目标 URL | 返回 `400 URL_NOT_ALLOWED` |
| 缺少 `url` 或 URL 格式非法 | 返回 `400 URL_REQUIRED` / `400 INVALID_URL` |
| 请求体不是合法 JSON | 返回 `400 INVALID_JSON` |
| 请求体过大 | 返回 `413 REQUEST_BODY_TOO_LARGE` |
| 访问有效短码 | 返回 `302`，`Location` 指向原始 URL |
| 访问有效短码后 | 仓储中的 `clickCount` 增加 1 |
| 访问不存在短码 | 返回 `404 SHORT_LINK_NOT_FOUND` |
| 访问非法短码格式 | 返回 `400 INVALID_SHORT_CODE` |
| 访问过期短码 | 返回 `410 SHORT_LINK_EXPIRED`，且不增加 `clickCount` |
| 访问禁用短码 | 返回 `410 SHORT_LINK_DISABLED`，且不增加 `clickCount` |

## 手工接口测试

手工命令保存在：

```text
tests/api/manual-commands.md
```

用于本地调试或向面试官展示 HTTP 调用方式。

## 运行结果示例

成功时会看到类似结果：

```text
tests 12
pass 12
fail 0
```

## 目录约定

1. `tests/api` 表示正式后端接口自动化测试。
2. `tests/api/manual-commands.md` 表示手工接口测试命令。
3. 接口验证以 Vitest 自动化测试为准，手工命令用于本地调试和复核。
