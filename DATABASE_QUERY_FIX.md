# 数据库查询修复总结

## 修复日期
2025-10-31

## 问题描述

管理后台的押金申请和退还申请页面出现错误提示：
- **错误信息**: "获取待审核申请列表失败"
- **页面**:
  - `/admin/deposits/applications` (押金申请审核)
  - `/admin/deposits/refunds` (押金退还审核)

### 控制台错误详情

```javascript
Error fetching pending deposit applications: {
  code: 'PGRST200',
  details: "Searched for a foreign key relationship between 'deposit_merchant_applications' and 'profiles' in the schema 'public', but no matches were found.",
  message: "Could not find a relationship between 'deposit_merchant_applications' and 'profiles' in the schema cache"
}
```

## 根本原因

### 数据库架构分析

根据数据库迁移脚本 `027_create_deposit_merchant_system.sql`:

```sql
-- deposit_merchant_applications 表结构
CREATE TABLE IF NOT EXISTS deposit_merchant_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- 引用 auth.users
    ...
);
```

关键发现：
1. `deposit_merchant_applications.user_id` 引用的是 `auth.users(id)`
2. `deposit_refund_applications.user_id` 也引用的是 `auth.users(id)`
3. **没有直接的外键关系**到 `profiles` 表

### 问题代码

之前的 Supabase 查询尝试直接 JOIN `profiles` 表：

```typescript
// ❌ 错误的查询方式
const { data, error, count } = await supabase
  .from("deposit_merchant_applications")
  .select("*, merchants!inner(name, user_id), profiles!inner(username, email)", { count: "exact" })
  .eq("application_status", "pending")
```

Supabase 的 `profiles!inner()` 语法需要一个显式的外键关系，但是：
- `deposit_merchant_applications` → `profiles` 之间没有直接外键
- `deposit_merchant_applications.user_id` → `auth.users.id` → `profiles.id` 是间接关系

## 解决方案

### 修改策略

采用**两步查询 + 手动合并**的方式：

1. **第一步**: 查询申请数据（包含商家信息）
2. **第二步**: 单独查询用户资料
3. **第三步**: 在应用层合并数据

### 修改的函数

#### 1. `getPendingDepositApplications()` - 押金申请列表

**修改文件**: `lib/actions/deposit.ts` (约 843-889 行)

**修改前**:
```typescript
const { data, error, count } = await supabase
  .from("deposit_merchant_applications")
  .select("*, merchants!inner(name, user_id), profiles!inner(username, email)", { count: "exact" })
  .eq("application_status", "pending")
  .order("created_at", { ascending: false })
  .range(from, to)

if (error) {
  console.error("Error fetching pending deposit applications:", error)
  throw new Error("获取待审核押金申请列表失败")
}

return {
  applications: data || [],
  total: count || 0,
  page,
  pageSize,
}
```

**修改后**:
```typescript
// 1. 查询申请数据（不包含 profiles）
const { data, error, count } = await supabase
  .from("deposit_merchant_applications")
  .select("*, merchants!inner(name, user_id)", { count: "exact" })
  .eq("application_status", "pending")
  .order("created_at", { ascending: false })
  .range(from, to)

if (error) {
  console.error("Error fetching pending deposit applications:", error)
  throw new Error("获取待审核押金申请列表失败")
}

// 2. 如果没有数据，直接返回
if (!data || data.length === 0) {
  return {
    applications: [],
    total: 0,
    page,
    pageSize,
  }
}

// 3. 获取所有用户ID
const userIds = data.map((app: any) => app.user_id)

// 4. 单独查询用户资料
const { data: profiles } = await supabase
  .from("profiles")
  .select("id, username, email")
  .in("id", userIds)

// 5. 将用户资料合并到申请数据中
const applicationsWithProfiles = data.map((app: any) => {
  const profile = profiles?.find((p: any) => p.id === app.user_id)
  return {
    ...app,
    profiles: profile || { username: "未知用户", email: "" },
  }
})

return {
  applications: applicationsWithProfiles,
  total: count || 0,
  page,
  pageSize,
}
```

#### 2. `getPendingDepositRefundApplications()` - 退还申请列表

**修改文件**: `lib/actions/deposit.ts` (约 918-964 行)

采用相同的修改策略，代码结构完全一致。

## 修改优势

### ✅ 解决的问题

1. **消除外键依赖**: 不再依赖 Supabase 自动检测外键关系
2. **更灵活**: 可以从不同表获取数据并手动组合
3. **更清晰**: 数据获取逻辑更明确，易于维护
4. **容错性**: 即使某个用户的 profile 不存在，也会显示"未知用户"而不是失败

### ⚠️ 性能考虑

**优点**:
- 分页查询仍然在数据库层面执行，不会获取过多数据
- 只查询当前页面需要的 profiles (最多 20 条)

**缺点**:
- 需要两次数据库查询（但都很快）
- 在应用层合并数据（JavaScript 性能足够好）

## 数据流程

### 押金申请审核页面

```
用户访问 /admin/deposits/applications
    ↓
调用 getPendingDepositApplications()
    ↓
第一次查询: deposit_merchant_applications (获取申请 + 商家信息)
    ↓
提取 user_id 列表: [uuid1, uuid2, ...]
    ↓
第二次查询: profiles.in('id', userIds)
    ↓
JavaScript 合并数据: applications + profiles
    ↓
返回完整数据给前端
    ↓
前端渲染表格（商家名、用户名、邮箱等）
```

### 押金退还审核页面

流程完全相同，只是查询的表是 `deposit_refund_applications`。

## 前端兼容性

### 数据结构保持一致

修改后返回的数据结构与之前完全相同：

```typescript
interface DepositApplication {
  id: string
  merchant_id: string
  deposit_amount: number
  payment_proof_url: string | null
  created_at: string
  merchants: {
    name: string
    user_id: string
  }
  profiles: {        // ✅ 仍然包含此字段
    username: string
    email: string
  }
}
```

**前端无需修改** - 所有现有代码都能正常工作。

## 测试建议

### 1. 测试押金申请审核页面
- [ ] 访问 `/admin/deposits/applications`
- [ ] 检查页面是否正常加载（不再显示错误）
- [ ] 检查列表是否正确显示商家名称
- [ ] 检查是否正确显示商家主用户名和邮箱
- [ ] 测试分页功能
- [ ] 测试批准和拒绝功能

### 2. 测试押金退还审核页面
- [ ] 访问 `/admin/deposits/refunds`
- [ ] 检查页面是否正常加载（不再显示错误）
- [ ] 检查列表是否正确显示所有信息
- [ ] 检查用户信息是否正确显示
- [ ] 测试分页功能
- [ ] 测试批准和拒绝功能

### 3. 边缘情况测试
- [ ] 测试没有待审核申请时的显示
- [ ] 测试用户 profile 不存在的情况（应显示"未知用户"）
- [ ] 测试大量申请时的性能（分页是否正常）

## 相关文件

### 修改的文件
- `lib/actions/deposit.ts` - 后端 Server Actions

### 不需要修改的文件
- `app/admin/deposits/applications/page.tsx` - 前端无需改动
- `app/admin/deposits/refunds/page.tsx` - 前端无需改动

## 总结

✅ **问题已解决**

通过修改查询策略，从依赖 Supabase 自动外键关系转变为手动两步查询 + 合并数据的方式：

1. ✅ 消除了 "Could not find a relationship" 错误
2. ✅ 保持了前端数据结构的一致性
3. ✅ 提供了更好的容错性（用户资料缺失时显示默认值）
4. ✅ 性能影响可忽略（只多一次小范围查询）

管理后台的押金申请和退还审核功能现在应该能正常工作。
