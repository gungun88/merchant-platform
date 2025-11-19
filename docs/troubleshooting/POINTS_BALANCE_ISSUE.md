# 积分记录余额显示异常排查指南

## 问题描述

在生产环境 https://merchant.doingfb.com/user/points-history 页面中,积分记录的"余额"列显示不正确或为空。

## 问题分析

根据代码分析,页面显示的余额来自 `point_transactions` 表的 `balance_after` 字段:
- 前端代码位置: `app/user/points-history/page.tsx:363`
- 数据源: `point_transactions.balance_after`

可能的原因:
1. ❌ **生产环境缺少 `balance_after` 字段** (最可能)
2. ❌ `balance_after` 值计算错误
3. ❌ 数据未正确同步

## 快速诊断

### 方法1: 使用诊断脚本(推荐)

```bash
node scripts/check_point_transactions_table.js
```

这个脚本会:
- ✅ 检查 `point_transactions` 表是否存在 `balance_after` 字段
- ✅ 显示所有字段列表
- ✅ 显示示例数据
- ✅ 给出具体的修复建议

### 方法2: 手动在 Supabase SQL 编辑器检查

```sql
-- 1. 检查表结构
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'point_transactions'
ORDER BY ordinal_position;

-- 2. 检查是否有 balance_after 字段
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'point_transactions'
  AND column_name = 'balance_after';

-- 3. 查看最近的数据
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

## 修复方案

### 情况1: 缺少 `balance_after` 字段

**修复步骤:**

1. 在生产环境 Supabase Dashboard 的 SQL 编辑器中执行:

   ```
   scripts/088_add_balance_after_field.sql
   ```

   这个脚本会:
   - ✅ 添加 `balance_after` 字段(如果不存在)
   - ✅ 重新计算所有现有记录的余额
   - ✅ 验证数据正确性
   - ✅ 显示修复结果

2. 刷新积分记录页面,确认余额显示正常

### 情况2: 字段存在但值不正确

**修复步骤:**

在 Supabase SQL 编辑器中执行:

```
scripts/029_fix_point_balance_simple.sql
```

这个脚本会重新计算所有用户的 `balance_after` 值。

## 验证修复

修复后,在 SQL 编辑器执行以下查询验证:

```sql
-- 验证最近的交易记录
SELECT
  pt.created_at AS "时间",
  pt.type AS "类型",
  pt.amount AS "积分变动",
  pt.balance_after AS "交易后余额",
  p.points AS "当前积分",
  CASE
    WHEN pt.id = (
      SELECT id FROM point_transactions
      WHERE user_id = pt.user_id
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    ) AND pt.balance_after = p.points THEN '✅ 一致'
    ELSE '❌ 不一致'
  END AS "状态"
FROM point_transactions pt
INNER JOIN profiles p ON pt.user_id = p.id
ORDER BY pt.created_at DESC
LIMIT 20;
```

预期结果:
- ✅ 每条记录的 `balance_after` 都有正确的值
- ✅ 最后一条交易记录的 `balance_after` 应该等于用户当前积分 `profiles.points`

## 相关文件

- 前端页面: `app/user/points-history/page.tsx`
- 后端API: `lib/actions/points.ts`
- 表创建脚本: `scripts/022_create_point_transactions_table.sql`
- 余额修复脚本: `scripts/029_fix_point_balance_simple.sql`
- 字段添加脚本: `scripts/088_add_balance_after_field.sql`
- 诊断脚本: `scripts/check_point_transactions_table.js`

## 预防措施

1. **数据库迁移管理**
   - 确保所有迁移脚本都在生产环境执行
   - 使用版本号管理,按顺序执行

2. **字段完整性检查**
   - 定期运行诊断脚本检查表结构
   - 开发和生产环境保持一致

3. **数据一致性**
   - 使用数据库函数 `record_point_transaction()` 记录积分变动
   - 避免直接修改 `profiles.points` 而不记录交易

## 常见问题

### Q: 为什么生产环境会缺少字段?

A: 可能的原因:
- 生产环境初始化时使用了旧版本的脚本
- 某些迁移脚本没有在生产环境执行
- 表结构被意外修改或回滚

### Q: 重新计算 balance_after 会影响用户吗?

A: 不会。这个操作:
- ✅ 只修改 `point_transactions` 表的显示字段
- ✅ 不修改用户的实际积分 (`profiles.points`)
- ✅ 不影响任何业务逻辑
- ✅ 执行速度很快(通常几秒钟)

### Q: 如何避免以后出现类似问题?

A: 建议:
1. 使用统一的数据库初始化脚本(如 `MERGED_PRODUCTION_INIT.sql`)
2. 记录所有已执行的迁移脚本编号
3. 定期对比开发和生产环境的表结构
4. 使用自动化部署工具管理数据库迁移

## 联系支持

如果按照上述步骤操作后问题仍未解决,请提供:
- 诊断脚本的完整输出
- Supabase SQL 查询的截图
- 错误信息(如有)
