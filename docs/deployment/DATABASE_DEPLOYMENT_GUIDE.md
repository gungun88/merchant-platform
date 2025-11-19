# ⚠️ 数据库初始化说明

## 📌 重要提醒

**本项目有两种数据库部署方式，请根据情况选择：**

---

## 🆕 方式一：全新数据库（新服务器/新域名）

**适用场景**：
- ✅ 部署到新的服务器
- ✅ 更换新的域名
- ✅ 创建新的 Supabase 项目
- ✅ 完全从零开始

**执行方法**：

### 步骤 1: 使用合并脚本（推荐）

```bash
# 执行这个文件，它包含了所有必要的表、字段、索引、RLS策略
scripts/MERGED_PRODUCTION_INIT.sql
```

**这个脚本包含**：
- ✅ 所有 25 个表的创建
- ✅ 所有字段（包括后来添加的）
- ✅ 所有索引和约束
- ✅ 所有 RLS 策略
- ✅ 所有函数和触发器

### 步骤 2: 验证部署

```bash
# 在 SQL Editor 执行，确认表数量为 25
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
```

### 步骤 3: 创建 Storage 桶

**手动在 Supabase Dashboard → Storage 创建**：

1. **public** 桶
   - Public bucket: ✓ 勾选
   - File size limit: 5242880 (5MB)
   - Allowed MIME types: `image/jpeg, image/png, image/gif, image/webp`

2. **platform-assets** 桶
   - Public bucket: ✓ 勾选
   - File size limit: 2097152 (2MB)
   - Allowed MIME types: `image/jpeg, image/png, image/gif, image/webp`

然后执行 Storage 策略：
```bash
scripts/032.9_setup_storage_policies.sql
```

---

## 🔧 方式二：修复现有数据库（增量更新）

**适用场景**：
- ✅ 生产环境已经在运行，但缺少表或字段
- ✅ 数据库结构过时，需要同步到最新版本
- ✅ 发现数据库有缺失，需要补救

**执行方法**：

### 步骤 1: 诊断问题

```bash
# 先运行诊断脚本，找出缺少什么
scripts/DEBUG_DEPOSIT_STATUS.sql
```

### 步骤 2: 根据问题执行对应的修复脚本

#### 问题 A: 缺少表

```bash
# 添加缺失的表（admin_operation_logs, deposit_top_up_applications）
scripts/production_repair_missing_tables.sql
```

#### 问题 B: 缺少字段

```bash
# 添加 merchants 表缺失的字段
scripts/FIX_MERCHANTS_TABLE_FIELDS.sql
```

#### 问题 C: 数据不一致

```bash
# 同步申请状态和商家状态
scripts/FIX_DEPOSIT_STATUS_SYNC.sql
```

### 步骤 3: 验证修复结果

```bash
scripts/DEBUG_DEPOSIT_STATUS.sql
```

---

## 📋 快速决策表

| 场景 | 使用脚本 | 说明 |
|------|---------|------|
| 🆕 新建 Supabase 项目 | `MERGED_PRODUCTION_INIT.sql` | 一次性完成所有初始化 |
| 🆕 换新服务器 | `MERGED_PRODUCTION_INIT.sql` | 一次性完成所有初始化 |
| 🆕 换新域名（新数据库） | `MERGED_PRODUCTION_INIT.sql` | 一次性完成所有初始化 |
| 🔧 生产环境缺表 | `production_repair_missing_tables.sql` | 仅添加缺失的表 |
| 🔧 生产环境缺字段 | `FIX_MERCHANTS_TABLE_FIELDS.sql` | 仅添加缺失的字段 |
| 🔧 数据状态不一致 | `FIX_DEPOSIT_STATUS_SYNC.sql` | 同步数据 |
| ❓ 不确定缺什么 | `DEBUG_DEPOSIT_STATUS.sql` | 先诊断再决定 |

---

## ⚠️ 常见错误

### ❌ 错误做法：在已有数据的生产环境执行 MERGED_PRODUCTION_INIT.sql

**后果**：
- 可能会尝试重复创建已存在的表（虽然有 IF NOT EXISTS，但可能导致混乱）
- 可能会重置某些配置

**正确做法**：
- 已有数据的生产环境，使用**增量修复脚本**（方式二）
- 只在全新环境使用合并脚本

---

## ✅ 检查清单

### 全新部署（方式一）完成后：

- [ ] 执行了 `MERGED_PRODUCTION_INIT.sql`
- [ ] 表数量为 25 个
- [ ] 创建了 `public` 和 `platform-assets` 两个 Storage 桶
- [ ] 执行了 `032.9_setup_storage_policies.sql`
- [ ] 配置了环境变量（`NEXT_PUBLIC_SUPABASE_URL` 等）
- [ ] 测试注册、登录功能正常
- [ ] 测试商家创建功能正常
- [ ] 测试押金商家功能正常

### 增量修复（方式二）完成后：

- [ ] 执行了必要的修复脚本
- [ ] 运行 `DEBUG_DEPOSIT_STATUS.sql` 显示正常
- [ ] 押金商家页面显示正常
- [ ] 所有功能测试通过

---

## 📞 需要帮助？

**如果不确定该用哪种方式**：

1. 如果是**全新的 Supabase 项目** → 用方式一
2. 如果**已经有用户数据** → 用方式二
3. 如果**不确定** → 先运行 `DEBUG_DEPOSIT_STATUS.sql` 诊断

---

**最后更新**: 2025-01-19

**注意**: 本文档会随着项目演进不断更新，部署前请先查看最新版本。
