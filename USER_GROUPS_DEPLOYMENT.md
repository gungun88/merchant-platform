# 用户组定期积分发放系统 - 部署说明

## 功能概述

该系统允许管理员创建用户组,并为每个组设置定期积分发放规则。系统会自动在指定时间向组内所有成员发放积分,并发送通知。

### 主要功能
- ✅ 创建和管理用户组
- ✅ 按邮箱添加/移除组成员(支持批量添加)
- ✅ 设置灵活的发放规则(每日/每周/每月/自定义日期)
- ✅ 自动定时发放积分
- ✅ 发放成功后自动通知用户
- ✅ 完整的发放历史记录
- ✅ 手动触发发放功能(用于测试)

## 部署步骤

### 1. 运行数据库迁移

首先执行数据库迁移脚本来创建所需的表和函数:

```bash
# 在Supabase SQL Editor中依次执行以下文件:

1. scripts/090_create_user_groups_system.sql
   - 创建用户组表(user_groups)
   - 创建用户组成员表(user_group_members)
   - 创建发放规则表(group_reward_rules)
   - 创建发放日志表(group_reward_logs)
   - 创建RLS策略
   - 创建自动发放处理函数(process_group_rewards)
   - 创建手动触发发放函数(trigger_group_reward)

2. scripts/091_setup_group_rewards_cron.sql
   - 创建定时任务配置(参考文件中的说明选择合适的方法)
```

### 2. 部署 Edge Function

```bash
# 部署自动发放处理的Edge Function
supabase functions deploy process-group-rewards

# 如果还没有登录Supabase CLI,先登录
supabase login

# 如果还没有关联项目,先关联
supabase link --project-ref your-project-ref
```

### 3. 设置定时任务

有三种方法可以设置定时任务,推荐使用方法一:

#### 方法一: Supabase Edge Functions Cron (推荐)

1. 进入 [Supabase Dashboard](https://app.supabase.com)
2. 选择你的项目
3. 进入 **Edge Functions** 页面
4. 找到 `process-group-rewards` 函数
5. 点击 **Add Trigger**
6. 选择 **Cron Schedule**
7. 输入 Cron 表达式: `0 9 * * *` (每天早上9点执行)
8. 保存设置

#### 方法二: pg_cron (需要超级用户权限)

```sql
-- 在Supabase SQL Editor中执行
SELECT cron.schedule(
  'process-group-rewards-daily',
  '0 9 * * *',
  $$SELECT invoke_process_group_rewards()$$
);

-- 查看定时任务
SELECT * FROM cron.job;
```

注意: 这个方法需要先在Supabase Dashboard中启用 `pg_cron` 扩展。

#### 方法三: 外部Cron服务

如果以上方法都不可行,可以使用外部服务(如GitHub Actions、Vercel Cron等)定期调用Edge Function:

```bash
# 使用curl调用Edge Function
curl -X POST \
  https://your-project-ref.supabase.co/functions/v1/process-group-rewards \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

### 4. 测试系统

#### 4.1 创建测试用户组

1. 访问管理后台: `http://localhost:3000/admin/user-groups`
2. 点击"创建用户组"
3. 输入组名(如"测试组")和描述
4. 创建成功后进入该组详情页面

#### 4.2 添加成员

1. 在"成员管理"标签页中
2. 点击"添加成员"
3. 输入测试用户的邮箱地址
4. 也可以使用"批量添加"功能测试批量导入

#### 4.3 设置发放规则

1. 切换到"发放规则"标签页
2. 设置发放积分数量(如100)
3. 选择发放周期(建议先选"每日"进行测试)
4. 设置下次发放日期为明天
5. 确保"启用规则"开关为开启状态
6. 点击"保存规则"

#### 4.4 手动触发测试

1. 回到用户组列表页
2. 找到刚创建的测试组
3. 点击右侧的"播放"按钮(▶️图标)
4. 系统会立即执行一次发放
5. 检查:
   - 组成员的积分是否增加
   - 是否收到通知
   - "发放历史"标签页是否有记录

#### 4.5 验证定时任务

- 等待到设置的发放时间(如果设置了明天,需要等到明天)
- 或者修改定时任务时间为几分钟后,观察是否自动执行
- 检查发放历史记录

## 使用说明

### 创建用户组

1. 进入 `/admin/user-groups`
2. 点击"创建用户组"按钮
3. 填写组名和描述
4. 提交创建

### 管理组成员

**单个添加:**
1. 进入用户组详情页 → 成员管理
2. 点击"添加成员"
3. 输入用户邮箱
4. 系统会自动查找该邮箱对应的用户并添加

**批量添加:**
1. 点击"批量添加"
2. 每行输入一个邮箱地址
3. 提交后系统会自动处理所有邮箱
4. 会显示成功和失败的数量

### 设置发放规则

每个用户组只能有一个发放规则。

**发放周期类型:**
- **每日**: 每天固定时间发放
- **每周**: 每周的某一天发放(可选择星期几)
- **每月**: 每月的某一天发放(可选择1-31号)
- **自定义**: 自定义发放周期

**重要字段说明:**
- **积分数量**: 每次发放时,组内每个成员都会收到这个数量的积分
- **下次发放日期**: 系统会在这个日期执行发放,之后会根据周期自动计算下次发放日期
- **启用规则**: 只有启用的规则才会被自动执行

### 查看发放历史

1. 进入用户组详情页 → 发放历史
2. 可以看到:
   - 发放统计(总次数、总积分、成员数)
   - 详细的发放记录(包括用户、积分数、时间)

### 手动触发发放

在用户组列表页,点击用户组卡片上的"播放"按钮可以立即执行一次发放。

**注意:** 手动发放不会更改"下次发放日期",只是额外执行一次。

## 数据库表结构

### user_groups (用户组)
- id: UUID (主键)
- name: 组名(唯一)
- description: 描述
- created_at, updated_at: 时间戳

### user_group_members (组成员)
- id: UUID (主键)
- group_id: 关联用户组
- user_id: 关联用户
- added_at: 添加时间
- added_by: 添加者

### group_reward_rules (发放规则)
- id: UUID (主键)
- group_id: 关联用户组
- coins_amount: 发放积分数
- reward_type: 发放周期类型
- custom_day_of_month: 每月第几天(1-31)
- custom_day_of_week: 每周第几天(0-6)
- next_reward_date: 下次发放日期
- is_active: 是否启用

### group_reward_logs (发放日志)
- id: UUID (主键)
- group_id: 关联用户组
- user_id: 关联用户
- coins_amount: 发放积分数
- reward_date: 计划发放日期
- executed_at: 实际执行时间
- transaction_id: 关联的积分交易记录

## 常见问题

### Q: 如何修改定时任务的执行时间?

**A:**
- 如果使用Edge Functions Cron: 在Dashboard中修改Cron表达式
- 如果使用pg_cron: 先删除旧任务,再创建新任务
  ```sql
  SELECT cron.unschedule('process-group-rewards-daily');
  SELECT cron.schedule('process-group-rewards-daily', '0 10 * * *', ...);
  ```

### Q: 发放失败了怎么办?

**A:**
1. 检查Edge Function日志: Dashboard → Edge Functions → Logs
2. 检查数据库日志: Dashboard → Database → Logs
3. 手动调用函数测试:
   ```sql
   SELECT * FROM process_group_rewards();
   ```

### Q: 如何查看某个用户收到了多少次发放?

**A:**
```sql
SELECT
  COUNT(*) as reward_count,
  SUM(coins_amount) as total_coins
FROM group_reward_logs
WHERE user_id = 'user-id-here';
```

### Q: 可以暂停某个组的发放吗?

**A:** 可以,在该组的"发放规则"页面,关闭"启用规则"开关即可。

### Q: 用户退出组后,历史发放记录会消失吗?

**A:** 不会。发放日志会永久保存,移除成员只是停止未来的发放。

### Q: 可以设置不同组在不同时间发放吗?

**A:** 目前所有组都是在同一时间检查和执行。但可以通过设置不同的"下次发放日期"来错开发放时间。

### Q: 如何防止重复发放?

**A:** 系统内置了防重复机制,会检查 `group_reward_logs` 表,如果某个用户在某个日期已经发放过,就不会重复发放。

## 监控和维护

### 定期检查

建议定期检查以下内容:

1. **Edge Function执行状态**
   - Dashboard → Edge Functions → process-group-rewards → Logs
   - 确保没有错误日志

2. **发放记录完整性**
   ```sql
   -- 检查最近的发放记录
   SELECT * FROM group_reward_logs
   ORDER BY executed_at DESC
   LIMIT 20;
   ```

3. **规则启用状态**
   ```sql
   -- 检查所有启用的规则
   SELECT g.name, r.*
   FROM group_reward_rules r
   JOIN user_groups g ON g.id = r.group_id
   WHERE r.is_active = true;
   ```

### 性能优化

如果用户组和成员数量很大,可以考虑:

1. 在 `group_reward_logs` 表上添加分区(按日期)
2. 定期归档旧的发放日志
3. 调整定时任务执行时间,避开高峰期

## 安全注意事项

1. ✅ 所有表都启用了RLS,只有管理员可以管理
2. ✅ Edge Function需要Service Role Key才能调用
3. ✅ 所有发放操作都有日志记录
4. ✅ 防止重复发放机制

## 技术栈

- **前端**: Next.js 14 + React + TypeScript + Tailwind CSS + shadcn/ui
- **后端**: Supabase (PostgreSQL + Edge Functions)
- **定时任务**: Supabase Cron / pg_cron
- **通知系统**: 集成现有的 user_notifications 表

## 支持

如有问题,请检查:
1. Supabase Dashboard 的日志
2. 浏览器开发者工具的 Console
3. 数据库表中的数据是否正确

祝使用愉快! 🎉
