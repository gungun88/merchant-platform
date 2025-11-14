# 积分记录功能实现文档

## 功能概述

实现了完整的积分记录功能,用户可以查看所有积分的获取和消费历史,包括筛选、分页等功能。

## 实现内容

### 1. 数据库层面

#### 新增表: `point_transactions`
存储所有用户的积分变动记录

**字段说明**:
- `id`: 主键
- `user_id`: 用户ID (外键)
- `amount`: 积分变动数量 (正数为收入,负数为支出)
- `balance_after`: 交易后的积分余额
- `type`: 交易类型
  - `registration`: 注册奖励
  - `checkin`: 每日签到
  - `merchant_cert`: 商家认证
  - `invitation`: 邀请好友
  - `view_contact`: 查看联系方式
  - `topped_promotion`: 置顶推广
  - `system_adjustment`: 系统调整
- `description`: 详细描述
- `related_user_id`: 相关用户ID (可选,如邀请人ID)
- `related_merchant_id`: 相关商家ID (可选)
- `metadata`: JSON字段存储额外信息
- `created_at`: 创建时间

#### 新增函数: `record_point_transaction`
数据库函数,用于记录积分变动并自动计算交易后余额

**参数**:
- `p_user_id`: 用户ID
- `p_amount`: 积分变动数量
- `p_type`: 交易类型
- `p_description`: 描述
- `p_related_user_id`: 相关用户ID (可选)
- `p_related_merchant_id`: 相关商家ID (可选)
- `p_metadata`: 额外信息 (可选)

#### RLS策略
- 用户只能查看自己的积分记录
- 只允许通过服务端函数插入记录

#### Realtime支持
启用了Realtime订阅,支持积分记录实时更新

### 2. 后端API

**文件**: `lib/actions/points.ts`

#### 新增函数

##### `getPointTransactions(params)`
获取用户的积分交易记录

**参数**:
```typescript
{
  page?: number          // 页码,默认1
  limit?: number         // 每页数量,默认20
  type?: string | null   // 筛选类型: 'income' | 'expense' | 具体交易类型
  startDate?: string     // 开始日期
  endDate?: string       // 结束日期
}
```

**返回**:
```typescript
{
  success: boolean
  data?: PointTransaction[]
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  error?: string
}
```

##### `getPointsStatistics()`
获取积分统计信息

**返回**:
```typescript
{
  success: boolean
  data?: {
    current_points: number  // 当前积分
    total_earned: number    // 累计获得
    total_spent: number     // 累计消耗
  }
  error?: string
}
```

##### `recordPointTransaction(...)`
记录积分变动(内部函数,供其他actions调用)

**参数**:
- `userId`: 用户ID
- `amount`: 积分变动数量
- `type`: 交易类型
- `description`: 描述
- `relatedUserId`: 相关用户ID (可选)
- `relatedMerchantId`: 相关商家ID (可选)
- `metadata`: 额外信息 (可选)

#### 兼容性函数

##### `updateUserPoints(userId, pointsDelta)`
更新用户积分 (保留用于兼容旧代码)

##### `addPointsLog(...)`
添加积分日志 (现在调用 `recordPointTransaction`)

##### `checkIn(userId)` 和 `getCheckInStatus(userId)`
签到相关函数,现已集成积分记录功能

### 3. 前端页面

**文件**: `app/user/points-history/page.tsx`

#### 页面功能

1. **积分概览卡片**
   - 显示当前总积分
   - 显示累计获得积分
   - 显示累计消耗积分

2. **筛选功能**
   - 交易方向: 全部/收入/支出
   - 交易类型: 全部类型/注册奖励/每日签到/商家认证等
   - 时间范围: 全部时间/最近7天/最近30天/最近3个月

3. **交易记录列表**
   - 显示交易类型图标和名称
   - 显示详细描述
   - 显示积分变动 (绿色显示收入,红色显示支出)
   - 显示交易后余额
   - 显示交易时间

4. **分页功能**
   - 每页显示20条记录
   - 显示总记录数和页码
   - 上一页/下一页按钮

5. **空状态**
   - 当没有记录时显示友好提示
   - 引导用户去赚取积分

#### 交易类型图标配置
```typescript
const TRANSACTION_TYPES = {
  registration: { label: "注册奖励", icon: UserPlus, color: "text-green-600" },
  checkin: { label: "每日签到", icon: Calendar, color: "text-blue-600" },
  merchant_cert: { label: "商家认证", icon: Award, color: "text-purple-600" },
  invitation: { label: "邀请好友", icon: Users, color: "text-orange-600" },
  view_contact: { label: "查看联系方式", icon: Eye, color: "text-gray-600" },
  topped_promotion: { label: "置顶推广", icon: ArrowUp, color: "text-red-600" },
  system_adjustment: { label: "系统调整", icon: Settings, color: "text-gray-600" },
}
```

### 4. 导航集成

**文件**: `components/navigation.tsx`

在用户下拉菜单中添加了"积分记录"入口:
- 图标: History
- 链接: `/user/points-history`
- 位置: 在"邀请好友"和"社区交流"之间

## 部署步骤

### 1. 执行数据库脚本

在Supabase SQL Editor中执行:

```bash
scripts/022_create_point_transactions_table.sql
```

这将:
- 创建 `point_transactions` 表
- 创建索引优化查询性能
- 设置RLS策略
- 创建 `record_point_transaction` 函数
- 启用Realtime

### 2. 验证数据库

执行以下SQL验证表和函数是否创建成功:

```sql
-- 检查表是否存在
SELECT * FROM information_schema.tables
WHERE table_name = 'point_transactions';

-- 检查函数是否存在
SELECT * FROM information_schema.routines
WHERE routine_name = 'record_point_transaction';

-- 检查RLS是否启用
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'point_transactions';
```

### 3. 测试积分记录功能

无需重启服务器,Next.js会自动热更新代码。

## 测试清单

### 基本功能测试

- [ ] **访问积分记录页面**
  - 登录后,点击用户下拉菜单中的"积分记录"
  - 页面应正常加载并显示积分概览

- [ ] **查看统计信息**
  - 检查当前积分是否正确
  - 检查累计获得/消耗是否准确

- [ ] **筛选功能**
  - [ ] 测试交易方向筛选 (全部/收入/支出)
  - [ ] 测试交易类型筛选 (各种类型)
  - [ ] 测试时间范围筛选 (各个时间段)

- [ ] **分页功能**
  - 如果记录超过20条,测试上一页/下一页按钮
  - 检查页码显示是否正确

- [ ] **空状态显示**
  - 用新用户登录,应显示"暂无积分记录"提示

### 积分变动测试

#### 1. 每日签到
- [ ] 点击签到按钮
- [ ] 刷新积分记录页面
- [ ] 应显示签到记录,包含正确的积分数量和描述

#### 2. 邀请好友
- [ ] 使用邀请链接注册新用户
- [ ] 邀请人查看积分记录
- [ ] 应显示"邀请好友"记录 +100积分
- [ ] 被邀请人查看积分记录
- [ ] 应显示"通过邀请注册奖励" +100积分

#### 3. 商家认证
- [ ] 注册新商家
- [ ] 查看积分记录
- [ ] 应显示"商家认证"记录 +50积分

#### 4. 查看联系方式

**注册用户查看商家**:
- [ ] 用注册用户(非商家)查看商家联系方式
- [ ] 用户积分记录应显示 -10积分
- [ ] 商家积分记录应显示 -10积分 (联系方式被注册用户查看)

**商家查看商家**:
- [ ] 用商家账号查看其他商家联系方式
- [ ] 查看方积分记录应显示 -50积分
- [ ] 被查看方积分记录不应有变化(不扣分)

**商家查看自己**:
- [ ] 商家查看自己的联系方式
- [ ] 不扣积分,免费查看

#### 5. 置顶推广
- [ ] 商家购买置顶推广
- [ ] 查看积分记录
- [ ] 应显示对应天数的积分扣除记录

### 实时更新测试

- [ ] **跨设备同步**
  - 用同一账号在两个浏览器登录
  - 在一个浏览器进行积分变动操作
  - 另一个浏览器的积分记录页面应自动更新 (刷新页面查看)

### UI/UX测试

- [ ] **响应式设计**
  - 在桌面端测试布局
  - 在移动端测试布局
  - 检查各个元素是否正常显示

- [ ] **加载状态**
  - 刷新页面,检查骨架屏是否正常显示
  - 筛选时检查加载状态

- [ ] **颜色和图标**
  - 收入显示绿色,支出显示红色
  - 各类交易显示正确的图标
  - 箭头图标方向正确 (收入↑,支出↓)

## 已知问题和注意事项

### 1. 历史记录迁移

**问题**: 在实现此功能之前的积分变动没有记录

**解决方案** (可选):
可以创建一个迁移脚本,为现有用户创建历史记录:

```sql
-- 为所有现有用户创建注册奖励记录
INSERT INTO public.point_transactions (
  user_id,
  amount,
  balance_after,
  type,
  description,
  created_at
)
SELECT
  id,
  100,
  points,  -- 假设注册时获得100积分
  'registration',
  '注册奖励 +100积分',
  created_at
FROM public.profiles
WHERE NOT EXISTS (
  SELECT 1 FROM public.point_transactions
  WHERE user_id = profiles.id AND type = 'registration'
);
```

**注意**: 这只会创建注册记录,其他历史操作无法追溯。

### 2. 性能优化

当积分记录数量很大时(>10000条):
- 已添加数据库索引优化查询性能
- 使用分页减少单次查询数据量
- 考虑添加缓存机制(可选)

### 3. 数据一致性

**重要**: 所有积分变动必须同时:
1. 更新 `profiles.points`
2. 调用 `recordPointTransaction` 记录交易

建议使用数据库函数 `record_point_transaction` 来确保一致性。

## 文件清单

### 新增文件
- `scripts/022_create_point_transactions_table.sql` - 数据库建表脚本
- `app/user/points-history/page.tsx` - 积分记录页面
- `POINTS_HISTORY_FEATURE.md` - 本文档

### 修改文件
- `lib/actions/points.ts` - 添加积分记录相关函数
- `components/navigation.tsx` - 添加积分记录入口

## 未来扩展建议

1. **导出功能**
   - 允许用户导出积分记录为CSV或PDF

2. **统计图表**
   - 添加积分变化趋势图
   - 月度/年度积分统计

3. **积分有效期**
   - 设置积分有效期
   - 显示即将过期的积分

4. **积分转赠**
   - 允许用户之间转赠积分
   - 添加转赠记录

5. **积分商城**
   - 使用积分兑换商品或服务
   - 记录兑换历史

## 技术栈

- **前端**: Next.js 15.5.6, React, TypeScript, Tailwind CSS
- **UI组件**: shadcn/ui
- **后端**: Next.js Server Actions
- **数据库**: Supabase (PostgreSQL)
- **实时通信**: Supabase Realtime
- **图标**: lucide-react

## 支持和反馈

如遇到问题:
1. 检查浏览器控制台错误信息
2. 检查Supabase日志
3. 验证数据库脚本是否正确执行
4. 确认用户已登录并有积分记录

---

**版本**: 1.0.0
**更新日期**: 2025-01-05
**作者**: Claude Code
