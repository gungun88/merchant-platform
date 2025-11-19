# 如何在生产环境使用诊断脚本

## 问题
诊断脚本 `scripts/check_point_transactions_table.js` 默认连接开发环境。如何在生产环境使用?

## 解决方案

### 方法1: 修改脚本连接(推荐)

1. **备份原脚本**
   ```bash
   copy scripts\check_point_transactions_table.js scripts\check_point_transactions_table.js.backup
   ```

2. **临时修改脚本**

   打开 `scripts/check_point_transactions_table.js`,找到这几行:

   ```javascript
   // 读取 .env.local 文件
   const envPath = path.join(__dirname, '..', '.env.local')
   ```

   修改为:

   ```javascript
   // 读取 .env.production 文件 (或你的生产环境配置文件)
   const envPath = path.join(__dirname, '..', '.env.production')
   ```

3. **运行脚本**
   ```bash
   node scripts/check_point_transactions_table.js
   ```

4. **恢复原脚本**
   ```bash
   move scripts\check_point_transactions_table.js.backup scripts\check_point_transactions_table.js
   ```

### 方法2: 创建生产环境配置文件

1. **创建 `.env.production` 文件**

   在项目根目录创建 `.env.production`:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://你的生产环境URL.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=你的生产环境service_role密钥
   ```

2. **修改脚本读取生产配置**

   按照方法1的步骤2修改脚本

3. **运行脚本**
   ```bash
   node scripts/check_point_transactions_table.js
   ```

### 方法3: 手动在 Supabase SQL 编辑器中查询(最简单)

如果你觉得修改脚本麻烦,可以直接在 Supabase Dashboard 的 SQL 编辑器中运行以下SQL:

```sql
-- 1. 检查 balance_after 字段是否存在
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'point_transactions'
ORDER BY ordinal_position;

-- 2. 查看最近的数据
SELECT
  created_at,
  type,
  amount,
  balance_after,
  description
FROM point_transactions
ORDER BY created_at DESC
LIMIT 10;
```

**如果第一个查询的结果中没有 `balance_after` 字段**,就说明确实缺少这个字段,需要执行修复脚本。

## 快速判断

最快的方式:
1. 打开生产环境 Supabase Dashboard
2. 进入 SQL Editor
3. 运行:
   ```sql
   SELECT column_name
   FROM information_schema.columns
   WHERE table_name = 'point_transactions'
     AND column_name = 'balance_after';
   ```
4. 如果返回结果为空 → 缺少字段,需要执行 `088_add_balance_after_field.sql`
5. 如果返回 `balance_after` → 字段存在,可能是数据问题,需要执行 `029_fix_point_balance_simple.sql`

## 注意事项

⚠️ **不要将生产环境密钥提交到 Git!**
- 如果创建了 `.env.production`,请确保它在 `.gitignore` 中
- 使用完后立即删除或移到安全位置
