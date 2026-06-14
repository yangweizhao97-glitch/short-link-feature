# 当前 Diff Review

## Review 范围

本次根据短链接规格 review 当前实现，重点关注：

1. 正确性。
2. 边界条件。
3. 安全风险。
4. 可维护性。

说明：

当前目录不是 git 仓库，无法读取真实 `git diff`。本次 review 基于当前实现相对短链接规格进行。

## Findings

### High：已禁用短链接仍会跳转，违反规格

位置：

1. `src/api/getShortLinkByCode.ts`
2. `docs/后端开发规格.md`

问题：

当前跳转逻辑只检查：

1. code 是否存在。
2. `expiresAt` 是否过期。

没有检查 `record.status`。

规格要求：

1. 访问已禁用短码时返回 `410`。
2. 禁用后的短链接不再跳转。

影响：

如果后续用户或管理员禁用了短链接，当前实现仍然会返回 `302` 并跳转到原始地址。

建议：

1. 在跳转前检查 `status === "active"`。
2. `status !== "active"` 时返回 `410 SHORT_LINK_DISABLED`。
3. 禁用短链接不递增访问次数。

### High：访问计数不是原子更新，并发访问会丢计数

位置：

1. `src/shortLinkRepository.ts`
2. `docs/数据库模型设计.md`

问题：

当前 JSON 仓储通过以下流程更新访问次数：

1. 读取全部记录。
2. 在内存中执行 `clickCount += 1`。
3. 整体写回 JSON 文件。

并发请求下，后写入的请求可能覆盖先写入的计数结果。

影响：

访问统计会不准确，不满足“并发访问时点击数不会明显丢失”的规格要求。

建议：

1. 如果这是生产实现，应改为真实数据库原子更新。
2. 数据库中使用类似 `click_count = click_count + 1` 的原子语句。
3. 如果 JSON 仓储只是开发替身，应在代码或文档中明确“非生产用途”。

### High：缺少频率限制，存在短码枚举和批量创建风险

位置：

1. `src/api/postShortLinks.ts`
2. `src/api/getShortLinkByCode.ts`

问题：

当前创建接口和跳转接口都没有 IP 级、用户级或全局频率限制。

影响：

1. 攻击者可以批量创建短链接。
2. 攻击者可以高频枚举短码。
3. 存储资源可能被滥用。
4. 访问统计可能被刷。

建议：

1. 创建接口增加 IP 级和用户级限流。
2. 跳转接口对连续 404 增加更严格限流。
3. 限流命中时返回 `429 TOO_MANY_REQUESTS`。

### Medium：短码格式过宽，允许任意长度枚举请求

位置：

1. `src/api/getShortLinkByCode.ts`
2. `src/generateShortCode.ts`

问题：

当前访问接口短码格式为：

```text
/^[A-Za-z0-9]+$/
```

这会接受 1 位或超长 code。

当前生成函数默认生成 6 位，但调用方可以传任意正整数长度。

影响：

1. 枚举面更大。
2. 超长短码会产生无意义查询。
3. 与“短码长度至少 6-8 位”的安全建议不一致。

建议：

1. 访问接口短码格式限制为 6 到 8 位。
2. 生成函数限制 `length` 只能在 6 到 8 之间。

### Medium：URL 校验无法拦截解析到内网 IP 的域名

位置：

`src/validateShortLinkUrl.ts`

问题：

当前 URL 校验只拦截：

1. `localhost`。
2. 直接填写的部分内网 IP。
3. 部分本地或保留地址。

没有 DNS 解析检查。

影响：

如果域名解析到内网 IP，当前校验无法发现。虽然当前服务端不 fetch 原始 URL，SSRF 风险较低，但仍可能将用户引导到内部地址。

建议：

1. 明确是否允许内部域名。
2. 如果不允许，增加 DNS 解析校验。
3. 任一解析结果为私网、回环、链路本地或保留地址时拒绝。

### Medium：跳转使用 raw `originalUrl`，没有使用 `normalizedUrl`

位置：

1. `src/shortLinkRepository.ts`
2. `src/api/getShortLinkByCode.ts`

问题：

创建时同时保存：

1. `originalUrl`
2. `normalizedUrl`

但跳转时使用的是 `originalUrl`。

影响：

实际跳转目标和校验后的规范化结果不一致。后续如果归一化逻辑增加安全处理，跳转仍可能绕开规范化结果。

建议：

1. 展示层可以保留 `originalUrl`。
2. 实际跳转使用 `normalizedUrl`。

### Medium：依赖使用 TypeScript dev 版本，可维护性偏弱

位置：

`package.json`

问题：

当前 TypeScript 依赖使用的是 dev 版本：

```json
"typescript": "^6.0.0-dev.20251122"
```

影响：

1. 行为可能不稳定。
2. 协作环境可能出现不可预期的类型检查差异。
3. 后续维护成本增加。

建议：

使用稳定版 TypeScript。

## Open Questions

1. `JsonShortLinkRepository` 是否只用于本地开发和演示？
2. 短链接服务是否允许内部域名？
3. 短码最终长度是固定 6 位，还是允许 6 到 8 位配置？
4. 是否计划实现真实 HTTP 路由和真实数据库？

## Verification

已执行：

```bash
npm run typecheck
```

结果：

1. TypeScript 类型检查通过。

未完成：

```bash
npm audit --audit-level=high
```

原因：

1. 本次执行时网络 TLS 连接失败。
2. 因此不能把本次 `npm audit` 作为依赖安全验证依据。

## Review 结论

当前实现能覆盖短链接核心原型流程，但距离符合规格和安全基线仍有差距。

建议优先修复：

1. 禁用短链接仍会跳转的问题。
2. 访问计数非原子更新问题。
3. 创建和跳转接口缺少频率限制的问题。
4. 短码长度约束问题。
5. 跳转使用 `originalUrl` 而不是 `normalizedUrl` 的问题。
