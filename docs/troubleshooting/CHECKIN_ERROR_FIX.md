# 每日签到功能错误排查

## 错误现象

在生产环境 https://merchant.doingfb.com 点击"每日签到"按钮时,出现以下错误:

```
An error occurred in the Server Components render.
The specific message is omitted in production builds to avoid leaking sensitive details.
```

控制台显示 500 Internal Server Error。

## 根本原因

生产环境数据库缺少签到功能所需的两个RPC函数:

1. **`public.now()`** - 获取数据库服务器时间
   - 用途: 防止客户端时间不准确导致的签到作弊
   - 位置: `lib/actions/points.ts:395`

2. **`public.record_point_transaction()`** - 记录积分交易
   - 用途: 原子性地更新积分和记录交易
   - 位置: `lib/actions/points.ts:182`

## 为什么会缺少这些函数?

这些函数在 **085_production_hotfix.sql** 脚本中定义,但该脚本可能未在生产环境执行。

## 快速修复

在生产环境 Supabase Dashboard 的 SQL 编辑器中执行:

📄 **[scripts/089_fix_checkin_missing_functions.sql](../scripts/089_fix_checkin_missing_functions.sql)**

这个脚本会:
- ✅ 创建 `now()` 函数
- ✅ 创建 `record_point_transaction()` 函数
- ✅ 授予必要的权限
- ✅ 验证函数创建成功

## 验证修复

1. **执行脚本后**,刷新生产环境页面
2. **点击"每日签到"按钮**
3. **预期结果**:
   - ✅ 显示"签到成功"提示
   - ✅ 获得积分(默认5分)
   - ✅ 按钮变为"已签到"状态

## 手动检查函数是否存在

在 Supabase SQL 编辑器中运行:

```sql
-- 检查 now() 函数
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'now';

-- 检查 record_point_transaction 函数
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'record_point_transaction';
```

**如果返回空结果**,说明函数不存在,需要执行修复脚本。

## 其他相关功能

以下功能也依赖这两个函数,修复后这些功能也会恢复正常:

- ✅ 每日签到
- ✅ 邀请好友奖励
- ✅ 商家入驻奖励
- ✅ 查看联系方式扣分
- ✅ 所有涉及积分变动的操作

## 预防措施

1. **数据库版本管理**
   - 记录所有已执行的迁移脚本编号
   - 使用统一的初始化脚本(如 `MERGED_PRODUCTION_INIT.sql`)

2. **功能测试清单**
   - 部署后测试核心功能(签到、积分等)
   - 检查是否有 500 错误

3. **监控告警**
   - 设置错误日志监控
   - 及时发现和修复问题

## 常见问题

### Q: 为什么开发环境正常,生产环境报错?

A: 开发环境可能执行了所有迁移脚本,但生产环境可能:
- 使用了旧版本的初始化脚本
- 某些迁移脚本没有执行
- 数据库被意外修改或回滚

### Q: 执行脚本会影响现有数据吗?

A: 不会。该脚本只创建函数,不修改任何数据表或现有数据。

### Q: 如果执行脚本后仍然报错怎么办?

A: 请检查:
1. 脚本是否执行成功(看输出日志)
2. 函数是否有权限(已包含在脚本中)
3. 浏览器控制台是否有其他错误信息
4. Supabase 日志中的详细错误信息

## 相关文件

- 签到组件: [components/check-in-button.tsx](../components/check-in-button.tsx)
- 积分逻辑: [lib/actions/points.ts](../lib/actions/points.ts)
- 修复脚本: [scripts/089_fix_checkin_missing_functions.sql](../scripts/089_fix_checkin_missing_functions.sql)
- 原始脚本: [scripts/085_production_hotfix.sql](../scripts/085_production_hotfix.sql)
