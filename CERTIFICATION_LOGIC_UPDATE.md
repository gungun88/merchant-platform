# 商家认证逻辑修改总结

## 修改日期
2025-10-31

## 修改原因
根据您的业务逻辑要求：
- **未交押金的商家 = 未认证商家**
- **交了押金的商家 = 已认证商家**（自动认证）
- 不需要单独的商家认证审核流程

## 修改内容

### 1. ✅ 删除商家认证审核模块

#### 删除的文件：
- `app/admin/merchants/certifications/page.tsx` - 商家认证审核页面

#### 删除的函数（lib/actions/merchant.ts）：
- `getPendingCertifications()` - 获取待认证商家列表
- `approveMerchantCertification()` - 批准商家认证
- `rejectMerchantCertification()` - 拒绝商家认证

### 2. ✅ 修改商家入驻逻辑

#### `createMerchant` 函数的变化：

**之前的逻辑：**
```typescript
// 设置 certification_status = "待认证"
// 发送"申请已提交，等待审核"通知
// 不发放积分（等审核通过后发放）
```

**现在的逻辑：**
```typescript
// 不设置 certification_status（由 is_deposit_merchant 决定认证状态）
// 发送"入驻成功"通知
// 立即发放 50 积分入驻奖励
// 商家立即在前台展示，显示"未认证"
```

### 3. ✅ 修改 getMerchants 函数

#### 变化：
- **移除** `certification_status` 参数
- **移除** 认证状态筛选逻辑
- 保留押金商家筛选（`merchant_type`）

### 4. ✅ 修改前端展示逻辑

#### app/page.tsx 的变化：

**移除的筛选器：**
- PC端：删除"认证状态"下拉选择器
- 移动端：删除"认证状态"筛选选项
- `filters` 状态：移除 `certification_status` 字段

**认证Badge显示逻辑：**

之前：
```typescript
{merchant.is_deposit_merchant || merchant.certification_status === "已认证"
  ? "已认证"
  : merchant.certification_status || "待认证"}
```

现在：
```typescript
{merchant.is_deposit_merchant ? "已认证" : "未认证"}
```

### 5. ✅ 更新管理后台

#### components/admin-layout.tsx：
**移除菜单项：**
- "认证审核" (`/admin/merchants/certifications`) 从商家管理子菜单中删除

**保留的菜单：**
```
商家管理
  └─ 商家列表
押金管理
  ├─ 押金申请
  └─ 退还申请
```

#### app/admin/dashboard/page.tsx：
**统计数据变化：**

之前：
- 待审核认证：`pendingCertifications`

现在：
- 押金商家数：`depositMerchants`
- 待审核押金申请：`pendingDeposits`
- 待审核退还申请：`pendingRefunds`

### 6. ✅ 押金申请审核逻辑保持不变

押金申请和退还审核功能**完全保留**：
- `/admin/deposits/applications` - 押金申请审核页面
- `/admin/deposits/refunds` - 押金退还审核页面
- 相关的后端API函数都保留

## 新的业务流程

### 商家入驻流程：
1. 用户填写商家入驻表单
2. 提交后立即创建商家
3. 商家立即显示在前台列表
4. 认证状态显示为：**未认证**
5. 用户获得 50 积分奖励

### 成为已认证商家：
1. 商家申请成为押金商家
2. 管理员审核押金申请
3. 审核通过后：
   - `is_deposit_merchant = true`
   - `deposit_status = "paid"`
   - 认证状态自动变为：**已认证**

### 前台展示：
- **所有商家**都会在前台显示（只要 `is_active = true`）
- **押金商家**显示绿色"已认证"Badge
- **普通商家**显示灰色"未认证"Badge

## 文件修改列表

### 删除的文件：
1. `app/admin/merchants/certifications/page.tsx`

### 修改的文件：
1. `lib/actions/merchant.ts`
   - 修改 `createMerchant` 函数
   - 删除认证审核相关函数
   - 修改 `getMerchants` 函数签名

2. `app/page.tsx`
   - 移除 `certification_status` 筛选器（PC和移动端）
   - 简化认证Badge显示逻辑

3. `components/admin-layout.tsx`
   - 移除"认证审核"菜单项

4. `app/admin/dashboard/page.tsx`
   - 更新统计数据字段
   - 替换"待审核认证"为"押金商家数"和"待审核退还申请"

## 数据库影响

### 不再使用的字段：
- `merchants.certification_status` - 此字段不再被代码使用

### 可选：数据库清理
如果想完全移除 `certification_status` 字段，可以执行：
```sql
-- 可选：移除 certification_status 字段
ALTER TABLE public.merchants
DROP COLUMN IF EXISTS certification_status;
```

**注意：** 目前代码中不再使用此字段，但保留字段也不会影响功能。

## 测试建议

### 1. 测试商家入驻
- [ ] 新用户注册商家
- [ ] 检查是否立即显示在前台
- [ ] 检查是否显示"未认证"Badge
- [ ] 检查是否获得 50 积分

### 2. 测试押金商家
- [ ] 申请成为押金商家
- [ ] 管理员审核通过
- [ ] 检查前台是否显示"已认证"Badge
- [ ] 检查是否可以领取每日奖励

### 3. 测试前端筛选
- [ ] 确认没有"认证状态"筛选器
- [ ] 测试"押金商家/普通商家"筛选
- [ ] 确认所有商家都能正常显示

### 4. 测试管理后台
- [ ] 确认没有"认证审核"菜单
- [ ] 检查押金申请审核页面
- [ ] 检查退还申请审核页面
- [ ] 检查首页统计数据是否正确

## 总结

✅ **已完成所有修改**

新的逻辑更加简洁明了：
- 商家入驻 = 立即上线（未认证）
- 交押金 = 获得认证（已认证）
- 不需要单独的认证审核流程

这样的逻辑符合您的业务需求，同时简化了管理后台的操作流程。
