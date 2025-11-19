# 押金商家页面显示问题排查指南

## 🔍 问题描述

**现象**: 执行数据库修复脚本后，押金商家页面仍然显示"立即申请"按钮，而不是"押金商家"状态卡片。

**预期**: 如果管理员已批准押金申请，商家后台应该显示"押金商家"状态，包含押金金额、缴纳时间等信息。

---

## 📋 排查步骤

### 步骤 1: 运行诊断脚本

1. 登录 **Supabase Dashboard** → 生产环境项目
2. 点击 **SQL Editor** → **New query**
3. 打开文件 `scripts/DEBUG_DEPOSIT_STATUS.sql`
4. 复制所有内容并粘贴到 SQL Editor
5. 点击 **Run** 执行脚本
6. 仔细查看输出结果

#### 诊断脚本会检查以下内容:

- ✅ **第一步**: 当前登录用户信息
- ✅ **第二步**: 该用户的商家信息（重点关注 `is_deposit_merchant` 和 `deposit_status`）
- ✅ **第三步**: 押金申请记录（查看 `application_status`）
- ✅ **第四步**: RLS 策略配置
- ✅ **第五步**: 测试查询商家功能
- ✅ **第六步**: 检查申请表 RLS 策略
- ✅ **第七步**: 数据一致性检查（关键！）
- ✅ **第八步**: 确认 merchants 表字段完整性
- ✅ **第九步**: 查看管理员操作日志
- ✅ **诊断总结**: 自动分析问题原因

---

### 步骤 2: 根据诊断结果采取行动

根据**诊断总结**部分的输出，执行对应的修复操作：

#### 情况 A: "申请已批准但商家状态未更新（数据不一致）"

**原因**:
- 管理员批准了押金申请（`deposit_merchant_applications.application_status = 'approved'`）
- 但 `merchants` 表的状态没有同步更新
- 可能是管理员使用了旧版审核代码，或者审核时出现错误

**解决方法**:

1. 执行修复脚本 `scripts/FIX_DEPOSIT_STATUS_SYNC.sql`:
   ```sql
   -- 在 SQL Editor 中执行此脚本
   -- 它会自动同步所有已批准的申请到 merchants 表
   ```

2. 脚本会显示:
   - 需要修复的记录列表
   - 执行更新操作
   - 验证修复后的状态

3. 确认输出显示 "✓ 状态正确"

#### 情况 B: "已是押金商家（前端仍显示'立即申请'）"

**原因**:
- 数据库状态是正确的
- 问题出在前端查询或缓存上

**解决方法**:

**方法 1: 清除浏览器缓存**
1. 打开浏览器开发者工具（F12）
2. 右键点击刷新按钮 → 选择"清空缓存并硬性重新加载"
3. 或者按 `Ctrl + Shift + Delete` 清除缓存

**方法 2: 退出并重新登录**
1. 点击用户菜单 → 退出登录
2. 清除浏览器 Cookie
3. 重新登录

**方法 3: 检查浏览器控制台错误**
1. 打开浏览器开发者工具（F12）
2. 切换到 **Console** 标签
3. 刷新商家后台页面
4. 查看是否有错误信息，特别是:
   ```
   [getUserMerchant] 查询商家信息, user_id: ...
   [getUserMerchant] 查询成功: 找到商家 ...
   ```
5. 如果看到 `[getUserMerchant] 查询失败` 或 `RLS policy` 相关错误，继续下一步

**方法 4: 检查 RLS 策略**

执行以下 SQL 确认 RLS 策略正确:

```sql
-- 查看 merchants 表的 SELECT 策略
SELECT policyname, qual
FROM pg_policies
WHERE tablename = 'merchants' AND cmd = 'SELECT';
```

预期应该有策略允许:
- ✅ 用户查看自己的商家（`user_id = auth.uid()`）
- ✅ 用户查看激活的商家（`is_active = true`）
- ✅ 管理员查看所有商家

如果缺少策略，执行:
```bash
scripts/013_fix_merchants_rls_policies.sql
```

#### 情况 C: "申请待审核中"

**状态**: 押金申请还在 pending 状态，等待管理员审核

**操作**:
1. 通知管理员审核申请
2. 或者以管理员身份登录，访问 `/admin/deposits/applications`
3. 批准申请

#### 情况 D: "未找到商家记录"

**原因**: 用户账户下没有商家记录

**解决方法**:
1. 确认用户是否已注册商家（访问 `/merchant/register`）
2. 如果已注册，检查 RLS 策略是否阻止了查询

---

### 步骤 3: 前端调试（如果数据库正确但前端仍有问题）

#### 3.1 检查前端日志

打开浏览器控制台，查找这些关键日志:

```javascript
// 商家信息加载
[getUserMerchant] 查询商家信息, user_id: xxx
[getUserMerchant] 查询成功: 找到商家 xxx

// 押金商家信息加载
✅ [押金申请] 已更新押金商家信息
✅ [商家表] 已更新商家数据: { depositStatus: 'paid', ... }

// 实时订阅状态
📡 [商家表] 订阅状态: SUBSCRIBED
✅ [商家表] 订阅成功！监听商家ID: xxx
```

#### 3.2 检查前端状态

在浏览器控制台执行以下代码，检查前端状态:

```javascript
// 查看 depositInfo 状态
console.log('depositInfo:', window.__NEXT_DATA__);

// 或者在 React DevTools 中查看组件状态
// 找到 MerchantDashboard 组件
// 查看 depositInfo state 的值
```

预期 `depositInfo` 应该包含:
```javascript
{
  is_deposit_merchant: true,
  deposit_status: "paid",
  deposit_amount: 500,
  deposit_paid_at: "2025-01-19T...",
  deposit_bonus_claimed: false,
  last_daily_login_reward_at: null
}
```

#### 3.3 检查条件渲染逻辑

查看 [app/merchant/dashboard/page.tsx:705-763](app/merchant/dashboard/page.tsx#L705-L763) 的条件:

```typescript
// 显示"立即申请"卡片的条件:
{!depositInfo?.is_deposit_merchant &&
  !(depositApplication && depositApplication.application_status === "pending") && (
  // ... 显示"立即申请"卡片
)}

// 显示"押金商家"卡片的条件:
{depositInfo?.is_deposit_merchant && depositInfo?.deposit_status === "paid" && (
  // ... 显示"押金商家"卡片
)}
```

如果 `depositInfo` 为 `null` 或 `undefined`，会显示"立即申请"。

#### 3.4 强制刷新数据

在浏览器控制台执行:

```javascript
// 清除 localStorage
localStorage.clear();

// 清除 sessionStorage
sessionStorage.clear();

// 刷新页面
window.location.reload(true);
```

---

### 步骤 4: 检查 Service Worker 缓存（Next.js）

如果使用了 Next.js 的静态优化，可能存在缓存问题:

```bash
# 在开发环境
npm run dev

# 清除 .next 缓存
rm -rf .next
# 或在 Windows 上
rmdir /s /q .next

# 重新构建
npm run build

# 重新启动
npm run start
```

---

## 🛠️ 常见修复方法总结

### 修复方法 1: 数据同步修复（最常见）

```sql
-- 执行此脚本修复数据不一致
-- scripts/FIX_DEPOSIT_STATUS_SYNC.sql

UPDATE merchants m
SET
  is_deposit_merchant = true,
  deposit_status = 'paid',
  deposit_amount = dma.deposit_amount,
  deposit_paid_at = COALESCE(dma.approved_at, NOW())
FROM deposit_merchant_applications dma
WHERE m.id = dma.merchant_id
  AND dma.application_status = 'approved'
  AND m.is_deposit_merchant = false;
```

### 修复方法 2: RLS 策略修复

```sql
-- 确保用户可以查看自己的商家
DROP POLICY IF EXISTS "merchants_select_policy" ON merchants;

CREATE POLICY "merchants_select_policy"
  ON merchants FOR SELECT
  USING (is_active = true OR auth.uid() = user_id);
```

### 修复方法 3: 手动更新特定商家

如果知道商家 ID，可以手动更新:

```sql
-- 替换 'your-merchant-id' 为实际的商家 ID
UPDATE merchants
SET
  is_deposit_merchant = true,
  deposit_status = 'paid',
  deposit_amount = 500,  -- 押金金额
  deposit_paid_at = NOW()
WHERE id = 'your-merchant-id';
```

---

## 📊 验证修复成功的标准

修复完成后，应该满足以下所有条件:

### 数据库层面:
- ✅ `merchants.is_deposit_merchant = true`
- ✅ `merchants.deposit_status = 'paid'`
- ✅ `merchants.deposit_amount > 0`
- ✅ `merchants.deposit_paid_at` 有值
- ✅ `deposit_merchant_applications.application_status = 'approved'`

### 前端层面:
- ✅ 商家后台页面显示"押金商家"绿色卡片
- ✅ 卡片显示押金金额和缴纳时间
- ✅ 显示"已认证"徽章
- ✅ 显示"领取今日奖励"按钮
- ✅ 显示"追加押金"和"申请退还"按钮
- ✅ 不显示"立即申请"按钮

### 浏览器控制台:
- ✅ 无 RLS 错误
- ✅ 实时订阅连接成功
- ✅ 商家信息查询成功

---

## 🚨 紧急调试命令

如果上述方法都不行，在 SQL Editor 执行以下命令快速定位问题:

```sql
-- 快速检查当前用户的完整状态
WITH current_user_info AS (
  SELECT auth.uid() AS user_id
)
SELECT
  '用户信息' AS category,
  (SELECT email FROM auth.users WHERE id = cui.user_id) AS detail
FROM current_user_info cui
UNION ALL
SELECT
  '商家ID' AS category,
  m.id::text AS detail
FROM merchants m, current_user_info cui
WHERE m.user_id = cui.user_id
UNION ALL
SELECT
  '押金商家状态' AS category,
  m.is_deposit_merchant::text AS detail
FROM merchants m, current_user_info cui
WHERE m.user_id = cui.user_id
UNION ALL
SELECT
  '押金状态' AS category,
  COALESCE(m.deposit_status, 'NULL') AS detail
FROM merchants m, current_user_info cui
WHERE m.user_id = cui.user_id
UNION ALL
SELECT
  '押金金额' AS category,
  COALESCE(m.deposit_amount::text, 'NULL') AS detail
FROM merchants m, current_user_info cui
WHERE m.user_id = cui.user_id
UNION ALL
SELECT
  '申请状态' AS category,
  COALESCE(dma.application_status, 'NULL') AS detail
FROM deposit_merchant_applications dma, current_user_info cui
WHERE dma.user_id = cui.user_id
ORDER BY category DESC
LIMIT 10;
```

---

## 📞 还是无法解决？

如果执行了所有步骤后问题仍未解决，请收集以下信息:

1. **诊断脚本的完整输出** (`DEBUG_DEPOSIT_STATUS.sql`)
2. **浏览器控制台的完整日志**（包括错误信息）
3. **Network 标签中的 API 请求** (特别是 Supabase 请求)
4. **当前用户的 email** 和 **商家 ID**
5. **截图**:
   - 商家后台页面
   - 浏览器控制台
   - SQL 执行结果

提供这些信息后，我可以进一步分析具体原因。

---

## ✅ 成功案例检查清单

修复成功后，请确认:

- [ ] 执行了 `DEBUG_DEPOSIT_STATUS.sql` 诊断脚本
- [ ] 诊断结果显示数据一致性正常
- [ ] 执行了必要的修复脚本（如 `FIX_DEPOSIT_STATUS_SYNC.sql`）
- [ ] 清除了浏览器缓存
- [ ] 退出并重新登录
- [ ] 商家后台正确显示"押金商家"状态
- [ ] 所有押金商家功能可以正常使用（每日奖励、追加押金等）
- [ ] 浏览器控制台无错误

全部完成后，问题解决！🎉
