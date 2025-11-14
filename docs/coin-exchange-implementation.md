# 硬币兑换积分功能 - 商家平台端

## 功能概述

此功能允许论坛（Flarum）用户将论坛硬币兑换为商家平台积分，实现两个平台之间的虚拟货币互通。

**兑换比例：** 1 积分 = 10 硬币

**每日限额：** 1000 硬币/用户/天（= 100 积分/天）

---

## 已完成的工作

### 1. 数据库设计

✅ **文件：** `scripts/052_create_coin_exchange_records_table.sql`

创建了 `coin_exchange_records` 表，用于记录所有兑换交易：

- 用户信息（user_id, user_email）
- 论坛信息（forum_user_id, forum_transaction_id）
- 兑换信息（coin_amount, points_amount, exchange_rate）
- 安全信息（request_signature, request_timestamp, request_ip）
- 状态追踪（status, failure_reason, completed_at）
- 自动索引（提高查询性能）
- RLS 策略（行级安全）

### 2. 签名验证工具

✅ **文件：** `lib/utils/signature-verification.ts`

实现了安全的 API 签名验证机制：

- SHA256 哈希算法
- 时间戳验证（防重放攻击，5分钟有效期）
- 时序安全的签名比对
- 完整的请求验证流程
- 测试工具函数

### 3. API 接口

✅ **文件：** `app/api/exchange/coins-to-points/route.ts`

实现了 POST /api/exchange/coins-to-points 接口：

**功能特性：**
- ✅ 签名验证
- ✅ 时间戳验证（防重放）
- ✅ 交易ID唯一性检查（防重复）
- ✅ 用户邮箱关联
- ✅ 每日限额检查
- ✅ 参数验证（最小10硬币，必须是10的倍数）
- ✅ 事务处理（确保数据一致性）
- ✅ 积分记录创建
- ✅ 详细的错误处理
- ✅ IP 记录（安全审计）

**请求格式：**
```json
{
  "forum_user_id": "123",
  "forum_transaction_id": "tx_20250101_123456",
  "user_email": "user@example.com",
  "coin_amount": 100,
  "timestamp": 1704067200000
}
```

**Headers:**
```
Content-Type: application/json
X-Signature: <SHA256签名>
```

### 4. 测试脚本

✅ **文件：** `scripts/test_coin_exchange_api.js`

提供了完整的测试脚本，包含：
- 正常兑换测试
- 最小兑换测试
- 错误场景测试（数量不足、用户不存在等）
- 签名生成示例

### 5. 文档

✅ **文件：** `docs/coin-exchange-api.md`

完整的 API 文档，包含：
- API 端点说明
- 请求/响应格式
- 签名算法详解（JavaScript 和 PHP 示例）
- 所有错误代码说明
- 安全机制说明
- 配置步骤
- 测试方法
- 常见问题解答
- Flarum 开发建议

### 6. 环境配置

✅ **文件：** `.env.example`

添加了 API 密钥配置示例：
```bash
COIN_EXCHANGE_API_SECRET=your_api_secret_here
```

---

## 待完成的任务

### 1. ⏳ 数据库迁移执行

**需要手动操作：**

1. 登录 Supabase Dashboard
2. 进入 SQL Editor
3. 打开文件：`scripts/052_create_coin_exchange_records_table.sql`
4. 复制全部内容
5. 粘贴到 SQL Editor 并执行

**或使用 Supabase CLI：**

```bash
supabase db push
```

### 2. ⏳ 环境变量配置

在 `.env.local` 文件中添加：

```bash
COIN_EXCHANGE_API_SECRET=<你的强随机密钥>
```

生成强随机密钥：

```bash
# Linux/Mac
openssl rand -hex 32

# Windows (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

### 3. ⏳ API 测试

数据库迁移和环境变量配置完成后，运行测试：

```bash
# 设置环境变量
set COIN_EXCHANGE_API_SECRET=your_secret_here

# 运行测试
node scripts/test_coin_exchange_api.js
```

**注意：** 需要先在 `test_coin_exchange_api.js` 中将测试邮箱替换为实际存在的用户邮箱。

### 4. ⏳ Flarum 插件开发

这是下一阶段的工作，包括：

1. 创建 Flarum 扩展骨架
2. 设计用户界面（兑换表单）
3. 实现签名生成逻辑（PHP）
4. 调用商家平台 API
5. 处理响应和错误
6. 显示今日配额和兑换记录
7. 测试和部署

参考文档：`docs/coin-exchange-api.md` 中的 Flarum 开发建议章节

---

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                     论坛 (Flarum)                            │
│                                                              │
│  1. 用户发起兑换请求                                         │
│  2. 扣除硬币（待确认）                                        │
│  3. 生成签名                                                 │
│  4. 调用商家平台 API  ─────────────────┐                     │
│  5. 处理响应                          │                      │
│     - 成功：确认扣币                  │                      │
│     - 失败：退还硬币                  │                      │
└───────────────────────────────────────┼──────────────────────┘
                                        │
                                        │ HTTPS + Signature
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────┐
│                  商家平台 (Next.js)                          │
│                                                              │
│  POST /api/exchange/coins-to-points                         │
│                                                              │
│  1. 验证签名 ✅                                              │
│  2. 验证时间戳（5分钟） ✅                                   │
│  3. 检查交易ID唯一性 ✅                                      │
│  4. 查找用户（通过邮箱） ✅                                  │
│  5. 检查每日限额 ✅                                          │
│  6. 创建兑换记录 ✅                                          │
│  7. 增加用户积分 ✅                                          │
│  8. 记录积分变动 ✅                                          │
│  9. 返回响应 ✅                                              │
│                                                              │
│  数据库表：                                                  │
│  - coin_exchange_records (兑换记录)                         │
│  - profiles (用户信息，积分)                                 │
│  - point_transactions (积分流水)                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 安全机制

### 1. 签名验证
- 使用 SHA256 算法
- 密钥只在双方系统中保密存储
- 防止请求被中间人篡改

### 2. 时间戳验证
- 请求有效期 5 分钟
- 防止重放攻击

### 3. 交易ID唯一性
- `forum_transaction_id` 必须全局唯一
- 防止重复提交导致重复扣币/加分

### 4. 每日限额
- 每个用户每天最多兑换 1000 硬币
- 防止滥用和异常行为

### 5. 用户验证
- 通过邮箱关联账户
- 确保只有注册用户才能兑换

### 6. 数据库事务
- 使用事务保证数据一致性
- 失败自动回滚

### 7. IP 记录
- 记录请求 IP
- 用于安全审计和异常追踪

---

## 错误处理

API 返回详细的错误信息：

| 错误代码 | HTTP 状态 | 说明 |
|---------|-----------|------|
| INVALID_SIGNATURE | 401 | 签名验证失败 |
| TIMESTAMP_EXPIRED | 401 | 时间戳过期 |
| MISSING_REQUIRED_PARAMETERS | 400 | 缺少必需参数 |
| COIN_AMOUNT_TOO_SMALL | 400 | 硬币数量太少 |
| COIN_AMOUNT_INVALID | 400 | 硬币数量无效（不是10的倍数） |
| USER_NOT_FOUND | 404 | 用户不存在 |
| DAILY_LIMIT_EXCEEDED | 429 | 超出每日限额 |
| TRANSACTION_ALREADY_PROCESSED | 409 | 交易重复 |
| DATABASE_ERROR | 500 | 数据库错误 |
| POINTS_UPDATE_FAILED | 500 | 积分更新失败 |

---

## 下一步计划

### Phase 2: Flarum 插件开发 (预计 5-7 天)

1. **扩展骨架创建** (1天)
   - 初始化 Flarum 扩展
   - 配置依赖和路由

2. **用户界面** (2天)
   - 兑换页面设计
   - 表单验证
   - 余额显示
   - 配额提示

3. **API 集成** (2天)
   - PHP 签名生成
   - HTTP 请求封装
   - 响应处理
   - 错误处理

4. **测试优化** (1-2天)
   - 功能测试
   - 边界测试
   - 用户体验优化

### Phase 3: 联调测试 (预计 2-3 天)

1. 两个系统联合测试
2. 压力测试
3. 安全测试
4. 用户验收测试

---

## 相关文件

### 核心文件
- `app/api/exchange/coins-to-points/route.ts` - API 路由
- `lib/utils/signature-verification.ts` - 签名验证工具
- `scripts/052_create_coin_exchange_records_table.sql` - 数据库迁移

### 配置文件
- `.env.example` - 环境变量示例
- `.env.local` - 实际配置（需手动添加 API 密钥）

### 测试文件
- `scripts/test_coin_exchange_api.js` - API 测试脚本
- `scripts/run_coin_exchange_migration.js` - 迁移执行脚本

### 文档
- `docs/coin-exchange-api.md` - 完整 API 文档

---

## 常见问题

**Q: 为什么用户必须在两个平台使用相同邮箱？**

A: 邮箱是唯一的账户关联标识。用户需要确保在论坛和商家平台使用相同的邮箱注册。

**Q: 如果用户在商家平台没有账户会怎样？**

A: API 会返回 `USER_NOT_FOUND` 错误，论坛应该提示用户先去商家平台注册。

**Q: 兑换失败后硬币会退还吗？**

A: 这取决于 Flarum 的实现。建议先调用 API 确认成功后再扣除硬币。

**Q: 如何查看兑换记录？**

A: 用户可以在商家平台的"积分明细"中看到兑换记录（类型：coin_exchange）。

**Q: API 密钥泄露了怎么办？**

A: 立即更换 API 密钥，重新部署两个系统，并检查是否有异常兑换记录。

---

## 联系方式

如有问题或需要帮助，请联系：
- 📧 Email: info@doingfb.com
- 🌐 Website: https://doingfb.com
