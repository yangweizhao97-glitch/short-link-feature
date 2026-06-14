# 短链接功能安全 Review

## Review 范围

本次从安全角度 review 当前短链接实现，重点检查：

1. URL 校验。
2. 开放重定向。
3. 短码枚举。
4. 频率限制。
5. 日志脱敏。

涉及代码：

1. `src/validateShortLinkUrl.ts`
2. `src/api/postShortLinks.ts`
3. `src/api/getShortLinkByCode.ts`
4. `src/generateShortCode.ts`
5. `src/shortLinkRepository.ts`

## 结论摘要

| 检查项 | 当前状态 | 风险 |
|---|---|---|
| URL 协议限制 | 已实现 | 低 |
| localhost / 直接内网 IP 拦截 | 部分实现 | 中 |
| DNS 解析到内网 IP 拦截 | 未实现 | 中 |
| 开放重定向治理 | 部分实现 | 高 |
| 短码枚举防护 | 未实现 | 高 |
| 创建接口 IP 级限流 | 未实现 | 高 |
| 访问日志脱敏 | 未实现，但当前无访问日志 | 中 |
| 短码长度约束 | 部分实现 | 中 |

## Findings

### High：缺少频率限制，创建接口和跳转接口都可能被滥用

位置：

1. `src/api/postShortLinks.ts`
2. `src/api/getShortLinkByCode.ts`

问题：

当前创建接口没有 IP 级、用户级或全局频率限制。攻击者可以批量创建短链接，占用存储、刷短码空间，或把服务用作恶意链接分发器。

跳转接口也没有频率限制。攻击者可以高频请求不同短码，进行短码枚举。

影响：

1. 批量创建垃圾短链接。
2. 短码枚举。
3. 存储资源消耗。
4. 访问统计被刷。

建议：

1. 创建接口增加 IP 级限流，例如每 IP 每分钟最多 N 次。
2. 登录后再叠加用户级限流，例如每用户每小时最多 N 条。
3. 跳转接口对高频 404 增加更严格限流。
4. 限流命中时返回 `429 TOO_MANY_REQUESTS`。

### High：短码枚举防护不足

位置：

1. `src/api/getShortLinkByCode.ts`
2. `src/generateShortCode.ts`

问题：

当前短码默认 6 位，字符集为大小写字母和数字，空间约为 `62^6`。默认长度尚可，但访问接口只校验短码匹配 `[A-Za-z0-9]+`，没有限制长度范围。

当前代码允许请求任意长度短码：

```text
GET /A
GET /AAAA
GET /AAAAAAAAAAAAAAAAAAAA
```

影响：

1. 攻击者可以批量探测短码是否存在。
2. 404 / 410 响应会泄露短码状态。
3. 超长 code 会带来无意义查询和资源消耗。

建议：

1. 将访问接口短码格式限制为 6 到 8 位，例如 `/^[A-Za-z0-9]{6,8}$/`。
2. 创建函数限制 `length` 只能在 6 到 8 之间。
3. 对不存在短码的高频请求加 IP 级限流。
4. 生产环境考虑更长短码或不可预测 ID 策略。

### High：开放重定向治理不足

位置：

1. `src/api/getShortLinkByCode.ts`
2. `src/validateShortLinkUrl.ts`

问题：

短链接服务天然需要重定向，但当前治理能力不足。跳转逻辑直接把 `record.originalUrl` 放到 `Location`：

```text
Location: record.originalUrl
```

当前只做了基础 URL 协议和部分地址拦截，没有实现：

1. 恶意域名拦截。
2. 风险域名黑名单。
3. 管理员禁用后阻止跳转。
4. 举报或审核机制。
5. 高风险跳转提示页。

影响：

1. 服务可能被用作钓鱼跳板。
2. 服务可能被用于隐藏恶意下载链接。
3. 品牌域名信誉受损。

建议：

1. 跳转前检查 `status === "active"`。
2. 增加域名黑名单或风险域名拦截。
3. 后续接入恶意 URL 检测或人工审核。
4. 对高风险链接返回警示页，而不是直接 302。
5. 实际跳转建议使用 `normalizedUrl`，展示层再保留 `originalUrl`。

### Medium：URL 校验无法拦截解析到内网 IP 的域名

位置：

`src/validateShortLinkUrl.ts`

当前已实现：

1. 只允许 `http:` 和 `https:`。
2. 拒绝 `localhost`。
3. 拒绝直接填写的部分 IPv4 私网、回环、链路本地和保留地址。
4. 拒绝部分 IPv6 本地地址。
5. `file:`、`javascript:`、`data:` 会因为协议不在允许列表中被拒绝。

未实现：

1. 不解析 DNS。
2. 不能发现域名最终解析到内网 IP。
3. 不能拦截内部主机名，例如 `http://intranet`。

影响：

虽然当前服务端不会 fetch 用户提交的 URL，SSRF 风险较低，但用户可能被引导访问内部网络资源或企业内网页面。

建议：

1. 明确是否允许内部域名。
2. 如果不允许，增加 DNS 解析校验：任一解析地址为私网、回环、链路本地或保留地址时拒绝。
3. 拦截常见内部域名后缀或单标签主机名。
4. 如果后续服务端会请求原始 URL，必须做更严格 SSRF 防护。

### Medium：跳转时使用 `originalUrl` 而不是 `normalizedUrl`

位置：

1. `src/shortLinkRepository.ts`
2. `src/api/getShortLinkByCode.ts`

问题：

创建时同时保存了：

1. `originalUrl`
2. `normalizedUrl`

但跳转时使用的是 `originalUrl`。

影响：

1. 原始输入中的 fragment、大小写、编码差异会被保留。
2. 校验和实际跳转目标之间存在不必要的差异。
3. 后续如果归一化逻辑增加安全处理，跳转仍可能绕开归一化结果。

建议：

1. 实际跳转使用 `normalizedUrl`。
2. API 展示可以继续返回 `originalUrl`。
3. 增加测试确认 fragment/query 处理符合预期。

### Medium：未检查禁用状态，安全治理入口失效

位置：

`src/api/getShortLinkByCode.ts`

问题：

跳转逻辑只检查：

1. code 是否存在。
2. `expiresAt` 是否过期。

没有检查 `status`。如果后续把恶意短链接标记为 `disabled`，当前逻辑仍会跳转。

影响：

1. 管理员禁用不能真正阻止访问。
2. 风险链接无法通过状态字段快速封禁。

建议：

1. `status !== "active"` 时返回 `410 SHORT_LINK_DISABLED`。
2. 禁用或过期时不递增 `clickCount`。
3. 增加对应验证用例。

### Medium：访问统计不是原子更新

位置：

`src/shortLinkRepository.ts`

问题：

当前 JSON 仓储中访问次数更新流程是：

1. 读取全部记录。
2. 找到记录。
3. `clickCount += 1`。
4. 写回全部记录。

并发访问时可能出现丢失更新。

影响：

1. 访问统计不准确。
2. 高频访问下数据竞争明显。

建议：

1. 当前 JSON 仓储只作为开发替身。
2. 真实数据库中应使用原子更新，例如 `click_count = click_count + 1`。
3. 如果继续使用文件存储，需要加写锁，但不建议生产使用。

### Low：日志脱敏设计有文档，代码尚未实现

位置：

1. `docs/数据库模型设计.md`
2. 当前 `src` 代码

问题：

当前实现没有访问日志模块，因此没有直接记录明文 IP、完整 query、Cookie 或 Token。

但文档中设计了后续访问日志表，包括：

1. `ip_hash`
2. `user_agent`
3. `referer`

当前代码尚未实现“只记录 domain，不记录完整 query”的日志策略。

建议：

1. 访问日志只记录目标 URL 的 domain，不记录完整 URL query。
2. IP 使用带盐哈希，不保存明文。
3. 不记录 Cookie、Authorization、完整请求头。
4. 限制 `user_agent`、`referer` 长度。
5. 为日志增加保留周期。

## 已满足的安全项

### 只允许 http / https 协议

状态：已实现。

当前允许协议：

```text
http:
https:
```

其他协议会返回 `UNSUPPORTED_URL_SCHEME`。

### 禁止 localhost 和直接内网 IP

状态：部分实现。

已覆盖：

1. `localhost`
2. `127.0.0.1`
3. `10.0.0.0/8`
4. `172.16.0.0/12`
5. `192.168.0.0/16`
6. `169.254.0.0/16`
7. 部分 IPv6 本地地址

未覆盖：

1. 解析到内网 IP 的域名。
2. 内部主机名。
3. 更完整的 IPv6 保留地址范围。

### 短码默认 6 位

状态：部分实现。

默认生成 6 位，但 `generateShortCode(length)` 允许调用方传入小于 6 的长度。

## 建议修复优先级

### P0

1. 给创建接口增加 IP 级限流。
2. 给跳转接口增加 IP 级限流，尤其是 404 请求。
3. 跳转前检查 `status === "active"`。

### P1

1. 将访问接口短码限制为 6 到 8 位。
2. 将短码生成长度限制为 6 到 8 位。
3. 跳转使用 `normalizedUrl`。
4. 增加禁用、枚举、限流相关验证用例。

### P2

1. 增加 DNS 解析到内网 IP 的拦截。
2. 增加风险域名黑名单或审核机制。
3. 增加访问日志脱敏策略，只记录 domain，不记录完整 query。

## 验证

本次 review 期间执行：

```bash
npm run typecheck
npm audit --audit-level=high
```

结果：

1. TypeScript 类型检查通过。
2. `npm audit --audit-level=high` 未发现 high 或 critical 漏洞。

## Review 结论

当前实现适合作为短链接功能原型或本地开发版本，但距离可上线的安全基线还有差距。

上线前建议至少完成：

1. 创建接口和跳转接口限流。
2. 短码长度约束。
3. 禁用状态拦截。
4. 跳转使用 `normalizedUrl`。
5. 日志脱敏策略。
