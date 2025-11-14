# 硬币兑换积分 API 文档

## 概述

此 API 用于论坛（Flarum）向商家平台发起硬币兑换积分请求。

**兑换比例：** 1 积分 = 10 硬币

**每日限额：** 1000 硬币/用户/天（= 100 积分/天）

---

## API 端点

```
POST /api/exchange/coins-to-points
```

---

## 请求格式

### Headers

| Header Name | Required | Description |
|-------------|----------|-------------|
| Content-Type | ✅ | application/json |
| X-Signature | ✅ | 请求签名（SHA256） |

### Body (JSON)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| forum_user_id | string | ✅ | 论坛用户ID |
| forum_transaction_id | string | ✅ | 论坛交易ID（唯一，防重放） |
| user_email | string | ✅ | 用户邮箱（用于关联账户） |
| coin_amount | number | ✅ | 硬币数量（必须≥10且为10的倍数） |
| timestamp | number | ✅ | 时间戳（毫秒） |

### 请求示例

```json
{
  "forum_user_id": "123",
  "forum_transaction_id": "tx_20250101_123456",
  "user_email": "user@example.com",
  "coin_amount": 100,
  "timestamp": 1704067200000
}
```

---

## 签名生成算法

### 步骤

1. **按 key 排序**：将所有请求参数按字母顺序排序
2. **拼接字符串**：格式为 `key1=value1&key2=value2&key3=value3`
3. **添加密钥**：在末尾添加 `&secret=YOUR_API_SECRET`
4. **SHA256 哈希**：对整个字符串进行 SHA256 哈希，得到签名

### JavaScript 示例

```javascript
const crypto = require('crypto')

function generateSignature(data, secret) {
  // 1. 按 key 排序
  const sortedKeys = Object.keys(data).sort()

  // 2. 拼接字符串
  const signString = sortedKeys
    .map(key => `${key}=${data[key]}`)
    .join('&')

  // 3. 添加密钥
  const stringToSign = `${signString}&secret=${secret}`

  // 4. SHA256 哈希
  return crypto
    .createHash('sha256')
    .update(stringToSign, 'utf8')
    .digest('hex')
}

// 使用示例
const requestData = {
  forum_user_id: '123',
  forum_transaction_id: 'tx_20250101_123456',
  user_email: 'user@example.com',
  coin_amount: 100,
  timestamp: Date.now()
}

const signature = generateSignature(requestData, 'YOUR_API_SECRET')
```

### PHP 示例（用于 Flarum）

```php
<?php

function generateSignature($data, $secret) {
    // 1. 按 key 排序
    ksort($data);

    // 2. 拼接字符串
    $pairs = [];
    foreach ($data as $key => $value) {
        $pairs[] = "$key=$value";
    }
    $signString = implode('&', $pairs);

    // 3. 添加密钥
    $stringToSign = "$signString&secret=$secret";

    // 4. SHA256 哈希
    return hash('sha256', $stringToSign);
}

// 使用示例
$requestData = [
    'forum_user_id' => '123',
    'forum_transaction_id' => 'tx_20250101_123456',
    'user_email' => 'user@example.com',
    'coin_amount' => 100,
    'timestamp' => round(microtime(true) * 1000)
];

$signature = generateSignature($requestData, 'YOUR_API_SECRET');
```

---

## 响应格式

### 成功响应 (200)

```json
{
  "success": true,
  "message": "成功兑换 100 硬币为 10 积分",
  "data": {
    "transaction_id": "uuid-here",
    "coin_amount": 100,
    "points_amount": 10,
    "user_points_balance": 1234
  }
}
```

### 错误响应

#### 签名验证失败 (401)

```json
{
  "success": false,
  "error": "INVALID_SIGNATURE"
}
```

#### 缺少必需参数 (400)

```json
{
  "success": false,
  "error": "MISSING_REQUIRED_PARAMETERS"
}
```

#### 硬币数量不足 (400)

```json
{
  "success": false,
  "error": "COIN_AMOUNT_TOO_SMALL",
  "message": "最少需要兑换 10 硬币"
}
```

#### 硬币数量无效 (400)

```json
{
  "success": false,
  "error": "COIN_AMOUNT_INVALID",
  "message": "硬币数量必须是10的倍数"
}
```

#### 用户不存在 (404)

```json
{
  "success": false,
  "error": "USER_NOT_FOUND",
  "message": "未找到该邮箱对应的用户，请确保已在商家平台注册"
}
```

#### 超出每日限额 (429)

```json
{
  "success": false,
  "error": "DAILY_LIMIT_EXCEEDED",
  "message": "每日兑换限额为 1000 硬币，您今日已兑换 900 硬币"
}
```

#### 交易已处理 (409)

```json
{
  "success": false,
  "error": "TRANSACTION_ALREADY_PROCESSED",
  "message": "此交易已处理过"
}
```

#### 时间戳过期 (401)

```json
{
  "success": false,
  "error": "TIMESTAMP_EXPIRED"
}
```

---

## 错误代码说明

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| API_SECRET_NOT_CONFIGURED | 401 | API 密钥未配置 |
| MISSING_TIMESTAMP | 401 | 缺少时间戳 |
| INVALID_TIMESTAMP_FORMAT | 401 | 时间戳格式无效 |
| TIMESTAMP_EXPIRED | 401 | 时间戳已过期（超过5分钟） |
| INVALID_SIGNATURE | 401 | 签名验证失败 |
| SIGNATURE_VERIFICATION_FAILED | 401 | 签名验证过程失败 |
| MISSING_REQUIRED_PARAMETERS | 400 | 缺少必需参数 |
| COIN_AMOUNT_TOO_SMALL | 400 | 硬币数量太少 |
| COIN_AMOUNT_INVALID | 400 | 硬币数量无效 |
| POINTS_AMOUNT_INVALID | 400 | 计算的积分数量无效 |
| USER_NOT_FOUND | 404 | 用户不存在 |
| DAILY_LIMIT_EXCEEDED | 429 | 超出每日限额 |
| TRANSACTION_ALREADY_PROCESSED | 409 | 交易重复 |
| DATABASE_ERROR | 500 | 数据库错误 |
| POINTS_UPDATE_FAILED | 500 | 积分更新失败 |
| INTERNAL_SERVER_ERROR | 500 | 服务器内部错误 |

---

## 安全机制

### 1. 签名验证
- 使用 SHA256 算法
- 密钥需在双方系统中保密配置
- 防止请求被篡改

### 2. 时间戳验证
- 请求时间戳有效期为 5 分钟
- 防止重放攻击

### 3. 交易ID唯一性
- `forum_transaction_id` 必须唯一
- 防止重复提交

### 4. 每日限额
- 每个用户每天最多兑换 1000 硬币
- 防止滥用

### 5. 数据库事务
- 使用事务保证数据一致性
- 失败时自动回滚

---

## 配置步骤

### 1. 商家平台配置

在 `.env.local` 文件中添加：

```bash
COIN_EXCHANGE_API_SECRET=your_strong_random_secret_here
```

建议使用强随机字符串：

```bash
# Linux/Mac
openssl rand -hex 32

# 或使用在线生成器
https://www.random.org/strings/
```

### 2. 论坛（Flarum）配置

在 Flarum 扩展的配置中添加相同的 API 密钥。

---

## 测试

### 使用测试脚本

```bash
# 1. 设置环境变量
export COIN_EXCHANGE_API_SECRET=your_secret_here

# 2. 运行测试脚本
node scripts/test_coin_exchange_api.js
```

### 使用 cURL

```bash
# 生成签名后执行
curl -X POST http://localhost:3000/api/exchange/coins-to-points \
  -H "Content-Type: application/json" \
  -H "X-Signature: YOUR_SIGNATURE_HERE" \
  -d '{
    "forum_user_id": "123",
    "forum_transaction_id": "tx_20250101_123456",
    "user_email": "user@example.com",
    "coin_amount": 100,
    "timestamp": 1704067200000
  }'
```

---

## 常见问题

### Q1: 用户在商家平台没有账户怎么办？

A: API 会返回 `USER_NOT_FOUND` 错误。论坛应该提示用户先在商家平台注册账户。

### Q2: 如何确保用户在两个平台的账户一致？

A: 通过邮箱关联。用户需要在两个平台使用相同的邮箱地址。

### Q3: 兑换失败后硬币会退还吗？

A: 这取决于论坛的实现。建议论坛在扣除硬币前先调用 API，根据响应决定是否扣除。

### Q4: 如何查看兑换记录？

A: 商家平台的用户可以在个人中心查看积分明细，管理员可以在后台查看所有兑换记录。

### Q5: 时间戳为什么会过期？

A: 5分钟的有效期是为了防止重放攻击。如果请求失败，应该用新的时间戳重新生成签名。

---

## 开发建议

### Flarum 扩展开发要点

1. **用户体验**：
   - 显示当前可兑换的硬币余额
   - 显示今日已兑换数量和剩余配额
   - 提供输入验证（10的倍数，不超过余额）

2. **错误处理**：
   - 友好的错误提示
   - 自动重试机制（网络错误时）
   - 记录失败日志

3. **安全性**：
   - 密钥存储在配置文件而非代码
   - 使用 HTTPS
   - 记录所有交易日志

4. **测试**：
   - 单元测试签名生成
   - 集成测试 API 调用
   - 边界条件测试

---

## 更新日志

- **2025-01-01**: 初始版本
  - 实现基础兑换功能
  - 添加签名验证
  - 添加每日限额
  - 添加防重放机制
