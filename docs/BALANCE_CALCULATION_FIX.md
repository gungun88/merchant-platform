# 积分余额计算错误修复

## 问题描述

在所有积分操作中（签到、邀请、查看联系方式、商家操作等），积分记录的 `balance_after` 字段计算错误。

### 错误示例
- 原余额: 105 积分
- 签到奖励: +5 积分
- 期望余额: 110 积分
- **实际显示**: 115 积分 ❌

## 根本原因

**错误的执行顺序**导致 `balance_after` 计算错误:

```typescript
// ❌ 错误顺序
await updateUserPoints(userId, amount)    // 1. 更新积分 (105 + 5 = 110)
await addPointsLog(userId, amount, ...)   // 2. 记录交易
  └─> recordPointTransaction(...)         // 读取到已更新的积分 110
      └─> balance_after = 110 + 5 = 115  // 错误！重复加了一次
```

### 为什么会这样？

`recordPointTransaction` 函数的逻辑:
```sql
-- 读取当前积分
SELECT points INTO v_current_points FROM profiles WHERE id = p_user_id;

-- 计算交易后余额
balance_after = v_current_points + p_amount;

-- 插入交易记录（不更新积分）
INSERT INTO point_transactions (...) VALUES (...);
```

如果先调用 `updateUserPoints` 更新了积分，`recordPointTransaction` 读取到的就是**已更新后的积分**，导致 `balance_after = (原值 + 增量) + 增量`。

## 修复方案

**正确的执行顺序**: 先记录交易，再更新积分

```typescript
// ✅ 正确顺序
await addPointsLog(userId, amount, ...)   // 1. 记录交易
  └─> recordPointTransaction(...)         // 读取原始积分 105
      └─> balance_after = 105 + 5 = 110  // 正确！

await updateUserPoints(userId, amount)    // 2. 更新积分 (105 + 5 = 110)
```

## 修复的文件

### 1. lib/actions/points.ts
**checkIn 函数** (每日签到):
```typescript
// 修复前
await recordPointTransaction(...)  // 已经是正确顺序
const { error } = await supabase.from("profiles").update({...})

// 无需修改，已经是正确顺序
```

### 2. lib/actions/merchant.ts
修复了 3 处:

#### (1) 商家入驻奖励
```typescript
// 修复前
await updateUserPoints(user.id, merchantRegisterPoints)
await addPointsLog(user.id, merchantRegisterPoints, ...)

// 修复后
await addPointsLog(user.id, merchantRegisterPoints, ...)
await updateUserPoints(user.id, merchantRegisterPoints)
```

#### (2) 商家置顶扣积分
```typescript
// 修复前
await updateUserPoints(user.id, -requiredPoints)
await addPointsLog(user.id, -requiredPoints, ...)

// 修复后
await addPointsLog(user.id, -requiredPoints, ...)
await updateUserPoints(user.id, -requiredPoints)
```

#### (3) 编辑商家信息扣积分
```typescript
// 修复前
await updateUserPoints(user.id, -editMerchantCost)
await addPointsLog(user.id, -editMerchantCost, ...)

// 修复后
await addPointsLog(user.id, -editMerchantCost, ...)
await updateUserPoints(user.id, -editMerchantCost)
```

### 3. lib/actions/invitation.ts
修复了 2 处:

#### (1) 邀请人奖励
```typescript
// 修复前
await updateUserPoints(inviterProfile.id, invitationPoints)
await addPointsLog(inviterProfile.id, invitationPoints, ...)

// 修复后
await addPointsLog(inviterProfile.id, invitationPoints, ...)
await updateUserPoints(inviterProfile.id, invitationPoints)
```

#### (2) 被邀请人奖励
```typescript
// 修复前
await updateUserPoints(inviteeId, invitationPoints)
await addPointsLog(inviteeId, invitationPoints, ...)

// 修复后
await addPointsLog(inviteeId, invitationPoints, ...)
await updateUserPoints(inviteeId, invitationPoints)
```

### 4. lib/actions/contact.ts
修复了 2 处:

#### (1) 查看者扣积分
```typescript
// 修复前
await updateUserPoints(user.id, -pointsToDeduct)
await addPointsLog(user.id, -pointsToDeduct, ...)

// 修复后
await addPointsLog(user.id, -pointsToDeduct, ...)
await updateUserPoints(user.id, -pointsToDeduct)
```

#### (2) 商家扣积分（被查看）
```typescript
// 修复前
await updateUserPoints(merchantProfile.id, -merchantDeduct)
await addPointsLog(merchantProfile.id, -merchantDeduct, ...)

// 修复后
await addPointsLog(merchantProfile.id, -merchantDeduct, ...)
await updateUserPoints(merchantProfile.id, -merchantDeduct)
```

## 验证修复

### 开发环境测试
1. 清空积分记录表: `TRUNCATE point_transactions RESTART IDENTITY CASCADE;`
2. 重置用户积分为初始值（如 100）
3. 执行各项积分操作:
   - 每日签到 (+5 积分)
   - 邀请好友 (+100 积分)
   - 商家入驻 (+50 积分)
   - 查看联系方式 (-10 积分)
   - 商家置顶 (-100 积分)
4. 检查积分记录的 `balance_after` 字段是否正确

### 生产环境修复步骤
1. **执行 SQL 脚本**: 已执行 `089_fix_checkin_missing_functions_v2.sql`
2. **部署代码修复**: 部署包含本次修复的代码
3. **重新计算历史余额**:
   ```sql
   -- 备份旧数据
   CREATE TABLE point_transactions_backup AS SELECT * FROM point_transactions;

   -- 重新计算所有余额
   WITH RECURSIVE balance_calc AS (
     -- 初始余额（第一笔交易）
     SELECT
       id, user_id, amount, created_at,
       amount as balance_after,
       ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) as rn
     FROM point_transactions
     WHERE ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) = 1

     UNION ALL

     -- 累积计算后续交易
     SELECT
       pt.id, pt.user_id, pt.amount, pt.created_at,
       bc.balance_after + pt.amount as balance_after,
       ROW_NUMBER() OVER (PARTITION BY pt.user_id ORDER BY pt.created_at)
     FROM point_transactions pt
     INNER JOIN balance_calc bc ON pt.user_id = bc.user_id
     WHERE pt.created_at > bc.created_at
   )
   UPDATE point_transactions pt
   SET balance_after = bc.balance_after
   FROM balance_calc bc
   WHERE pt.id = bc.id;
   ```

## 影响范围

修复后，以下功能的积分记录将显示正确的余额:
- ✅ 每日签到
- ✅ 邀请好友奖励（邀请人和被邀请人）
- ✅ 商家入驻奖励
- ✅ 商家置顶扣积分
- ✅ 编辑商家信息扣积分
- ✅ 查看联系方式扣积分（查看者和商家）

## 预防措施

### 代码规范
1. **永远使用正确的顺序**:
   ```typescript
   // ✅ 正确
   await addPointsLog(...)          // 先记录
   await updateUserPoints(...)      // 后更新

   // ❌ 错误
   await updateUserPoints(...)      // 不要先更新
   await addPointsLog(...)          // 再记录
   ```

2. **推荐使用新的 API** (如果后续实现):
   ```typescript
   // 原子操作，自动保证顺序
   await addPoints(userId, amount, type, description)
   await deductPoints(userId, amount, type, description)
   ```

### Code Review 检查项
- [ ] 所有 `updateUserPoints` 调用都在 `addPointsLog` **之后**
- [ ] 积分变动的交易记录和余额更新保持原子性
- [ ] 测试积分记录的 `balance_after` 字段是否正确

## 相关问题

- Issue: 积分记录余额不对（签到、邀请等所有操作）
- 相关脚本: `089_fix_checkin_missing_functions_v2.sql`
- 相关函数: `recordPointTransaction`, `updateUserPoints`, `addPointsLog`
