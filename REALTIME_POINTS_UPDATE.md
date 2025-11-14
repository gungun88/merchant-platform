# 实时积分更新功能说明

## 问题描述

**原问题**: 当注册用户点击"立即咨询"按钮查看商家联系方式时:
- ✅ 用户方的积分实时扣除（正常）
- ❌ 商家方的积分需要刷新浏览器才能看到变化（有延迟）

## 解决方案

使用 **Supabase Realtime** 功能,实时订阅 `profiles` 表的变化,当积分发生变化时自动更新导航栏显示。

## 技术实现

### 1. 启用 Realtime 复制
在 Supabase SQL Editor 中执行 `scripts/021_enable_realtime_for_profiles.sql`:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
```

### 2. 前端订阅实时更新
修改了 `components/navigation.tsx`,添加了 Realtime 订阅:

```typescript
// 订阅当前用户的 profile 变化
realtimeChannel = supabase
  .channel(`profile-${user.id}`)
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'profiles',
      filter: `id=eq.${user.id}`,
    },
    (payload) => {
      console.log('[Realtime] Profile updated:', payload)
      // 实时更新 profile 数据
      if (payload.new) {
        setProfile(payload.new as any)
      }
    }
  )
  .subscribe()
```

## 工作流程

### 场景：用户查看商家联系方式

1. **用户A** 点击"立即咨询"查看 **商家B** 的联系方式

2. **后端处理**:
   ```typescript
   // lib/actions/contact.ts

   // 扣除用户积分
   await updateUserPoints(user.id, -10)

   // 扣除商家积分
   await updateUserPoints(merchantProfile.id, -10)
   ```

3. **数据库更新**:
   - `profiles` 表中用户A的积分 -10
   - `profiles` 表中商家B的积分 -10

4. **Realtime 推送**:
   - Supabase Realtime 检测到 profiles 表更新
   - 向订阅了该用户ID的客户端推送更新事件

5. **前端实时更新**:
   - 用户A的浏览器: 收到 profile 更新 → 导航栏积分立即变化
   - 商家B的浏览器: 收到 profile 更新 → 导航栏积分立即变化

## 优势

### 之前（使用前端事件）:
❌ 只能更新当前浏览器的积分
❌ 商家在另一个设备上看不到变化
❌ 需要手动刷新页面

### 现在（使用 Realtime）:
✅ 多设备实时同步
✅ 商家立即看到积分变化
✅ 无需刷新页面
✅ 数据完全由数据库驱动,更可靠

## 部署步骤

### 1. 在 Supabase 启用 Realtime

在 Supabase SQL Editor 中执行:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
```

### 2. 验证是否启用成功

```sql
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
```

应该能看到 `profiles` 表在列表中。

### 3. 测试实时更新

1. 用两个浏览器分别登录:
   - 浏览器A: 登录用户账号
   - 浏览器B: 登录商家账号

2. 在浏览器A中查看商家的联系方式

3. 观察两个浏览器:
   - 浏览器A: 积分立即 -10
   - 浏览器B: 积分也立即 -10（无需刷新）

4. 打开浏览器控制台,应该能看到:
   ```
   [Realtime] Profile updated: {...}
   ```

## 兼容性说明

代码保留了旧的事件触发方式 (`triggerPointsUpdate()`),以保证兼容性:
- Realtime 订阅: 用于跨设备/跨浏览器的实时更新
- 事件触发: 用于同一浏览器内的立即更新

两种方式可以同时工作,互不影响。

## 注意事项

1. **网络要求**: Realtime 需要 WebSocket 连接,确保网络支持
2. **性能**: Realtime 订阅会保持长连接,但资源消耗很小
3. **清理**: 组件卸载时会自动清理订阅,避免内存泄漏
4. **安全**: RLS 策略仍然生效,用户只能收到自己的数据变化

## 相关文件

- [components/navigation.tsx](../components/navigation.tsx) - 导航栏组件（添加了 Realtime 订阅）
- [scripts/021_enable_realtime_for_profiles.sql](../scripts/021_enable_realtime_for_profiles.sql) - 启用 Realtime 的 SQL 脚本
- [lib/actions/contact.ts](../lib/actions/contact.ts) - 联系方式查看逻辑（触发积分扣除）

## Supabase Realtime 文档

官方文档: https://supabase.com/docs/guides/realtime
