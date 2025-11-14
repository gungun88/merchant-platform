# 积分记录功能 - 更新总结

## 更新内容

### 查看联系方式积分规则澄清

根据实际业务需求,明确了查看联系方式的积分扣除规则:

#### ✅ 正确的规则

1. **注册用户查看商家**:
   - 用户扣 -10 积分
   - 商家扣 -10 积分

2. **商家查看商家**:
   - 查看方扣 -50 积分
   - 被查看方不扣分

3. **商家查看自己**:
   - 完全免费,0 积分

### 代码确认

检查了 `lib/actions/contact.ts` 文件,确认代码逻辑已经正确实现了上述规则。

### 更新的文件

1. **lib/actions/contact.ts**
   - ✅ 更新了积分记录描述,使其更加清晰
   - ✅ 添加商家名称到描述中
   - ✅ 明确区分"联系方式被注册用户查看"

2. **app/user/points-history/page.tsx**
   - ✅ 添加了 `contact_viewed` 交易类型配置
   - ✅ 在筛选器中添加"联系方式被查看"选项
   - ✅ 使用橙色图标区分此类型

3. **POINTS_HISTORY_FEATURE.md**
   - ✅ 更新测试清单,详细说明三种查看场景

4. **CONTACT_POINTS_RULES.md** (新文件)
   - ✅ 创建专门的查看联系方式积分规则文档
   - ✅ 包含详细的规则说明
   - ✅ 包含6个测试场景
   - ✅ 包含常见问题解答
   - ✅ 包含设计理念说明

## 积分交易类型完整列表

| 类型代码 | 类型名称 | 图标颜色 | 收入/支出 |
|---------|---------|---------|---------|
| `registration` | 注册奖励 | 绿色 | +100 |
| `checkin` | 每日签到 | 蓝色 | +5起 |
| `merchant_cert` | 商家认证 | 紫色 | +50 |
| `invitation` | 邀请好友 | 橙色 | +100 |
| `view_contact` | 查看联系方式 | 灰色 | -10/-50 |
| `contact_viewed` | 联系方式被查看 | 橙色 | -10 |
| `topped_promotion` | 置顶推广 | 红色 | 按天计算 |
| `system_adjustment` | 系统调整 | 灰色 | 可变 |

## 部署检查清单

- [x] 数据库脚本: `022_create_point_transactions_table.sql`
- [x] 后端API: `lib/actions/points.ts`
- [x] 查看联系方式逻辑: `lib/actions/contact.ts`
- [x] 前端页面: `app/user/points-history/page.tsx`
- [x] 导航集成: `components/navigation.tsx`
- [x] 文档: `POINTS_HISTORY_FEATURE.md`
- [x] 规则文档: `CONTACT_POINTS_RULES.md`

## 下一步操作

### 1. 执行数据库脚本

在 Supabase SQL Editor 中执行:

```sql
-- 文件: scripts/022_create_point_transactions_table.sql
-- 这将创建 point_transactions 表和相关函数
```

### 2. 测试功能

参考 [POINTS_HISTORY_FEATURE.md](./POINTS_HISTORY_FEATURE.md) 中的测试清单进行完整测试。

特别关注查看联系方式的三种场景:
1. ✅ 注册用户查看商家 (双方各扣10分)
2. ✅ 商家查看商家 (查看方扣50分)
3. ✅ 商家查看自己 (免费)

### 3. 验证积分记录

- 访问 `/user/points-history` 页面
- 检查所有交易类型是否正确显示
- 测试筛选功能
- 验证分页功能

## 相关文档

- **[POINTS_HISTORY_FEATURE.md](./POINTS_HISTORY_FEATURE.md)** - 积分记录功能完整文档
- **[CONTACT_POINTS_RULES.md](./CONTACT_POINTS_RULES.md)** - 查看联系方式积分规则详解
- **[REALTIME_POINTS_UPDATE.md](./REALTIME_POINTS_UPDATE.md)** - 实时积分更新文档
- **[TOPPED_FEATURE_FIX.md](./TOPPED_FEATURE_FIX.md)** - 置顶功能修复文档

## 技术要点

### 数据库函数使用

所有积分变动都通过 `record_point_transaction` 函数记录:

```typescript
await recordPointTransaction(
  userId,           // 用户ID
  amount,          // 积分变动(正数=收入,负数=支出)
  type,            // 交易类型
  description,     // 描述
  relatedUserId,   // 相关用户ID(可选)
  relatedMerchantId, // 相关商家ID(可选)
  metadata         // 额外信息(可选)
)
```

### 兼容性

为保持与现有代码的兼容性,保留了以下函数:
- `updateUserPoints()` - 更新积分
- `addPointsLog()` - 现在内部调用 `recordPointTransaction()`

### 实时更新

积分记录表已启用 Supabase Realtime,支持实时订阅更新。

## 已知问题

### 历史记录缺失

在本功能上线之前的积分变动没有记录。

**解决方案**: 可选地运行迁移脚本创建历史记录(仅能创建注册记录)。

### 性能优化

- 已添加数据库索引
- 使用分页限制单次查询数量
- 考虑未来添加缓存

## 总结

✅ **积分记录功能已完整实现**
✅ **查看联系方式规则已明确并正确实现**
✅ **文档齐全,包含测试场景和常见问题**
✅ **代码质量良好,有注释和类型定义**

---

**版本**: 1.0.0
**完成日期**: 2025-01-05
**开发者**: Claude Code
