# 积分系统全局修复报告

## 问题描述

用户积分显示不一致的根本原因是:**多处代码在调用 `addPointsLog` 后又调用了 `updateUserPoints`**,导致积分更新冲突或失败。

### 问题根源

1. `addPointsLog` 函数内部调用 `recordPointTransaction` RPC 函数
2. `recordPointTransaction` **已经会自动更新** `profiles` 表的 `points` 字段
3. 但代码中又调用了 `updateUserPoints` 再次更新积分
4. 导致积分更新冲突,profiles 表的积分没有正确更新

## 修复的文件

### 1. lib/actions/contact.ts ✅
**问题**: 查看联系方式功能

```typescript
// ❌ 修复前
await addPointsLog(...)  // 已经更新了积分
await updateUserPoints(user.id, -pointsToDeduct)  // 又更新一次,导致冲突

// ✅ 修复后
await addPointsLog(...)  // 只调用一次,自动完成积分更新
```

**影响操作**:
- 商家查看商家联系方式 (-50积分)
- 普通用户查看商家联系方式 (-10积分)

### 2. lib/actions/merchant.ts ✅
**问题**: 商家相关积分操作

```typescript
// ❌ 修复前 (3处)
await addPointsLog(...)
await updateUserPoints(...)  // 重复更新

// ✅ 修复后
await addPointsLog(...)  // 只调用一次
```

**影响操作**:
- 商家入驻奖励 (+50积分)
- 商家置顶 (-10/-2000积分)
- 编辑商家信息 (-100积分)

### 3. lib/actions/invitation.ts ✅
**问题**: 邀请奖励功能

```typescript
// ❌ 修复前 (2处)
await addPointsLog(inviter, ...)
await updateUserPoints(inviter, ...)  // 重复更新

await addPointsLog(invitee, ...)
await updateUserPoints(invitee, ...)  // 重复更新

// ✅ 修复后
await addPointsLog(inviter, ...)  // 只调用一次
await addPointsLog(invitee, ...)  // 只调用一次
```

**影响操作**:
- 邀请人奖励 (+100积分)
- 被邀请人奖励 (+100积分)

### 4. app/api/exchange/coins-to-points/route.ts ✅
**问题**: 硬币兑换积分 API

```typescript
// ❌ 修复前
await supabase.from('profiles').update({ points: ... })  // 直接更新
await supabase.from('point_transactions').insert({ ... })  // 手动插入记录

// ✅ 修复后
await supabase.rpc('record_point_transaction', { ... })  // 使用统一的RPC函数
```

**影响操作**:
- 论坛硬币兑换积分 (+N积分)

### 5. 其他已正确的操作 ✅
以下操作从一开始就使用了正确的方式:
- **每日签到** (lib/actions/points.ts) - 使用 `recordPointTransaction`
- **用户组手动发放积分** (通过数据库函数) - 使用 `record_point_transaction`

## 数据库修复

### 脚本: scripts/118_check_and_fix_points_function.sql

1. 重新创建 `record_point_transaction` 函数,确保逻辑正确
2. 添加更详细的错误检查和日志
3. 自动修复所有用户的历史积分数据

### 脚本: scripts/fix_all_user_points.js

快速修复所有用户的当前积分,重新计算 `point_transactions` 表的累计值并更新到 `profiles` 表。

## 修复结果

### 修复前的问题
- Profile 中的积分: 972
- 交易记录累计: 1072
- **差异: -100积分**

### 修复后
- Profile 中的积分: 1072 ✅
- 交易记录累计: 1072 ✅
- **差异: 0** ✅

## 正确的积分更新方式

### ✅ 推荐方式 (Server Actions)

```typescript
import { addPointsLog } from "./points"

// 只需调用一次,自动完成:
// 1. 更新 profiles.points
// 2. 插入 point_transactions 记录
await addPointsLog(
  userId,
  amount,      // 正数为增加,负数为扣除
  "type",
  "description",
  relatedUserId,
  relatedMerchantId
)
```

### ✅ 推荐方式 (API Routes / 数据库函数)

```typescript
// 调用数据库的 RPC 函数
const { data, error } = await supabase.rpc('record_point_transaction', {
  p_user_id: userId,
  p_amount: amount,
  p_type: 'type',
  p_description: 'description',
  p_related_user_id: null,
  p_related_merchant_id: null,
  p_metadata: { ... }
})
```

### ❌ 错误方式

```typescript
// ❌ 不要这样做!
await addPointsLog(...)
await updateUserPoints(...)  // 重复更新,会导致问题

// ❌ 也不要这样做!
await supabase.from('profiles').update({ points: ... })  // 直接更新
await supabase.from('point_transactions').insert({ ... })  // 分开操作
```

## 验证方法

使用以下脚本验证积分一致性:

```bash
# 检查指定用户的积分
node scripts/check_user_7c3af6cd.js

# 修复所有用户的积分
node scripts/fix_all_user_points.js

# 调试积分不一致问题
node scripts/debug_points_mismatch.js
```

## 预防措施

1. **使用统一的积分更新函数**: 所有积分变动必须通过 `addPointsLog` 或 `record_point_transaction`
2. **废弃危险函数**: `updateUserPoints` 已标记为 `@deprecated`,不应再使用
3. **代码审查**: 在 PR 中检查是否有直接操作 `profiles.points` 的代码
4. **定期验证**: 可以添加定时任务,检查积分一致性

## 相关文件

- 数据库函数: `scripts/092_fix_balance_after_calculation.sql`
- 验证脚本: `scripts/118_check_and_fix_points_function.sql`
- 修复脚本: `scripts/fix_all_user_points.js`
- 检查脚本: `scripts/debug_points_mismatch.js`

---

**修复时间**: 2025-11-21
**修复人员**: Claude Code
**影响用户数**: 42 (其中3个用户的积分被修复)
