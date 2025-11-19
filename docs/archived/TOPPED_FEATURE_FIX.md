# 置顶推广功能修复说明

## 修复的问题

### 1. ✅ 续费时间叠加问题
**问题**: 之前续费时会直接覆盖到期时间,而不是叠加
**修复**: 现在续费会从当前到期时间开始叠加天数

#### 修复逻辑:
- 如果商家当前未置顶或已过期:从当前时间开始计算
- 如果商家当前已置顶且未过期:从原到期时间开始叠加

**示例**:
- 商家A在2025-01-01置顶7天,到期时间是2025-01-08
- 在2025-01-05续费7天,新到期时间是2025-01-15(而不是2025-01-12)

### 2. ✅ 自动下架过期置顶
**问题**: 过期的置顶不会自动下架
**修复**: 创建了自动下架功能

#### 实现方式:
1. 创建了数据库函数 `expire_topped_merchants()`
2. 使用 pg_cron 每小时自动执行一次检查
3. 自动将过期的置顶商家状态设置为未置顶

### 3. ✅ 商家后台显示优化
**问题**: 到期时间只显示日期,不够精确
**修复**: 现在显示完整的日期和时间

**显示格式**: 2025/01/08 14:30

## 修改的文件

### 1. lib/actions/merchant.ts
修改了 `topMerchant` 函数:
- 添加了获取当前置顶信息的逻辑
- 实现了时间叠加算法
- 从当前到期时间开始叠加新的天数

### 2. app/merchant/dashboard/page.tsx
优化了置顶状态显示:
- 修改时间显示格式,包含日期和时间
- 使用 `toLocaleString` 格式化为中文日期时间

### 3. scripts/020_auto_expire_topped_merchants.sql (新文件)
创建了自动下架功能:
- 定义了 `expire_topped_merchants()` 函数
- 配置了定时任务说明

## 部署步骤

### 1. 在 Supabase 执行 SQL 脚本
在 Supabase SQL Editor 中执行:
```sql
-- 先执行脚本 020_auto_expire_topped_merchants.sql 中的内容
```

### 2. 启用 pg_cron 扩展
1. 打开 Supabase Dashboard
2. 进入 Database > Extensions
3. 搜索 `pg_cron` 并启用

### 3. 配置定时任务
在 SQL Editor 中执行:
```sql
SELECT cron.schedule(
  'expire-topped-merchants',
  '0 * * * *',
  $$SELECT expire_topped_merchants();$$
);
```

### 4. 验证定时任务
查看已创建的定时任务:
```sql
SELECT * FROM cron.job;
```

## 功能测试流程

### 测试场景1: 首次置顶
1. 商家使用积分置顶7天
2. 确认"置顶状态"卡片显示"已置顶"
3. 确认显示正确的到期时间(年/月/日 时:分)
4. 确认积分正确扣除(7天 × 100 = 700积分)

### 测试场景2: 续费叠加
1. 商家已置顶,到期时间为2025-01-08 14:30
2. 在2025-01-05续费7天
3. 确认新到期时间为2025-01-15 14:30(叠加了7天)
4. 确认积分再次扣除700分

### 测试场景3: 过期自动下架
1. 等待置顶到期(或手动修改数据库中的到期时间为过去时间)
2. 执行 `SELECT expire_topped_merchants();` 或等待定时任务执行
3. 确认商家状态变为"未置顶"
4. 确认在首页列表中商家不再显示在置顶位置

## 注意事项

1. **pg_cron 扩展**: 确保在 Supabase 中启用了 pg_cron 扩展
2. **定时任务**: 定时任务每小时执行一次,不是实时下架
3. **时区**: 所有时间都使用 UTC 时区存储,显示时会转换为本地时区
4. **续费提醒**: 建议未来可以添加到期前提醒功能

## 积分消耗规则

- 置顶推广: **100积分/天**
- 最少购买: 1天(100积分)
- 可选天数: 1天、3天、7天、15天、30天
- 续费: 从当前到期时间叠加,不浪费

## 相关文件

- [lib/actions/merchant.ts](../lib/actions/merchant.ts) - 置顶推广逻辑
- [app/merchant/dashboard/page.tsx](../app/merchant/dashboard/page.tsx) - 商家后台页面
- [scripts/020_auto_expire_topped_merchants.sql](../scripts/020_auto_expire_topped_merchants.sql) - 自动下架SQL脚本
