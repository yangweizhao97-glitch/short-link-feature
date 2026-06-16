# 手工接口测试命令

先启动服务：

```bash
npm run build
npm start
```

## 健康检查

```bash
curl -i http://localhost:3000/health
```

## 创建短链接

```bash
curl -i -X POST http://localhost:3000/api/short-links \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com/articles/abc"}'
```

## 访问短链接

```bash
curl -i http://localhost:3000/替换成响应里的shortCode
```

## 非法协议返回 400

```bash
curl -i -X POST http://localhost:3000/api/short-links \
  -H 'Content-Type: application/json' \
  -d '{"url":"javascript:alert(1)"}'
```

## localhost 目标返回 400

```bash
curl -i -X POST http://localhost:3000/api/short-links \
  -H 'Content-Type: application/json' \
  -d '{"url":"http://localhost:3000/health"}'
```

## 不存在短码返回 404

```bash
curl -i http://localhost:3000/notExist123
```
