# 管理后台系统 - 第一阶段完成文档

## ✅ 已完成功能

### 1. 数据库层面
- ✅ 在 `profiles` 表添加 `role` 字段 (user/admin/super_admin)
- ✅ 创建 `admin_operation_logs` 表 - 记录管理员操作
- ✅ 创建辅助函数 `is_admin()` 和 `log_admin_operation()`
- ✅ 配置 RLS 策略保护管理员数据

### 2. 后端 API
- ✅ `lib/actions/admin.ts` - 管理员相关的 Server Actions
  - `isAdmin()` - 检查当前用户是否是管理员
  - `getUserRole()` - 获取用户角色
  - `logAdminOperation()` - 记录管理员操作
  - `getAdminLogs()` - 获取操作日志

### 3. 前端页面
- ✅ `/admin/login` - 管理员登录页面
  - 独立的登录入口
  - 验证管理员权限
  - 非管理员自动拒绝
- ✅ `/admin/dashboard` - 管理后台首页
  - 数据统计概览
  - 快捷操作入口
  - 系统状态显示

### 4. 布局组件
- ✅ `components/admin-layout.tsx` - 管理后台布局
  - 侧边栏导航菜单
  - 移动端适配
  - 用户信息显示
  - 退出登录功能

### 5. 路由保护
- ✅ 中间件保护 `/admin/*` 路由
  - 未登录跳转到登录页
  - 非管理员跳转到首页
  - 登录页允许访问

### 6. 前台集成
- ✅ 导航栏添加管理后台入口
  - 仅管理员可见
  - 显示 Shield 图标
  - 高亮显示

---

## 📂 新增文件清单

### 数据库脚本
```
scripts/032_add_admin_role_system.sql   - 管理员角色系统数据库迁移
scripts/set_admin_user.sql               - 设置管理员用户的辅助脚本
```

### 后端文件
```
lib/actions/admin.ts                     - 管理员相关 Server Actions
```

### 前端文件
```
app/admin/login/page.tsx                 - 管理员登录页面
app/admin/dashboard/page.tsx            - 管理后台首页
components/admin-layout.tsx              - 管理后台布局组件
```

### 修改的文件
```
middleware.ts                            - 添加管理后台路由保护
components/navigation.tsx                - 添加管理后台入口
```

---

## 🚀 使用步骤

### 步骤1: 执行数据库迁移

1. 登录 Supabase 项目
2. 进入 SQL Editor
3. 执行脚本: `scripts/032_add_admin_role_system.sql`

### 步骤2: 设置管理员账号

**方式一: 通过用户ID设置**
```sql
UPDATE public.profiles
SET role = 'admin'
WHERE id = 'YOUR_USER_ID_HERE';
```

**方式二: 通过邮箱设置**
```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'admin@example.com';
```

### 步骤3: 验证设置

查询所有管理员:
```sql
SELECT id, username, email, role, created_at
FROM public.profiles
WHERE role IN ('admin', 'super_admin')
ORDER BY created_at DESC;
```

### 步骤4: 登录管理后台

1. 访问: `http://localhost:3000/admin/login`
2. 使用管理员账号登录
3. 自动跳转到: `/admin/dashboard`

---

## 🎯 管理后台菜单结构

```
📊 概览                    /admin/dashboard
├── 📈 数据统计
├── ⚡ 快捷操作
└── 💡 系统状态

👥 商家管理
├── 📋 商家列表            /admin/merchants
└── ✅ 认证审核            /admin/merchants/certifications

💳 押金管理
├── 💰 押金申请            /admin/deposits/applications
└── ❌ 退还申请            /admin/deposits/refunds

⚠️ 举报管理                /admin/reports

👤 用户管理                /admin/users

📢 公告管理                /admin/announcements

📄 操作日志                /admin/logs
```

---

## 🔐 权限说明

### 角色类型
- `user` - 普通用户 (默认)
- `admin` - 管理员
- `super_admin` - 超级管理员 (预留)

### 访问控制
- ✅ 管理员可以访问所有 `/admin/*` 路由
- ❌ 普通用户访问 `/admin/*` 自动跳转到首页
- ❌ 未登录用户访问 `/admin/*` 跳转到管理员登录页

---

## 📊 统计数据

管理后台首页显示以下数据:
- 总用户数
- 总商家数
- 待审核认证数 (有待处理标识)
- 待审核押金数 (有待处理标识)
- 待处理举报数 (有待处理标识)
- 押金总额 (USDT)

---

## 🎨 界面特点

### 管理员登录页
- 简洁的登录表单
- Shield 图标标识
- 安全提示信息
- 错误提示
- 返回首页链接

### 管理后台布局
- 固定侧边栏导航
- 响应式设计
- 移动端 Sheet 侧边栏
- 顶部面包屑
- 用户信息显示

### 前台集成
- 导航栏用户菜单
- 管理后台入口 (仅管理员可见)
- Shield 图标标识
- 主色调高亮

---

## 🔧 技术实现

### 路由保护
使用 Next.js 中间件 (middleware.ts):
```typescript
- 检查路径是否以 /admin 开头
- 获取当前用户
- 查询用户角色
- 验证管理员权限
- 重定向非授权用户
```

### 权限检查
Server Actions 中的权限验证:
```typescript
const adminStatus = await isAdmin()
if (!adminStatus) {
  throw new Error("只有管理员可以执行此操作")
}
```

### 实时更新
导航栏实时检测用户角色:
```typescript
setIsAdmin(profileData.role === "admin" || profileData.role === "super_admin")
```

---

## ⚠️ 安全注意事项

1. **管理员账号保护**
   - 使用强密码
   - 定期更换密码
   - 不要共享管理员账号

2. **操作日志**
   - 所有管理员操作都会记录
   - 包含操作人、时间、目标
   - 可用于审计和溯源

3. **访问控制**
   - 中间件层面验证
   - Server Actions 层面验证
   - 双重保护机制

4. **登录安全**
   - 所有登录尝试都会记录
   - 登录页面显示安全提示
   - 建议添加验证码 (后续)

---

## 📝 下一步开发计划

### 第二阶段: 核心审核功能 (2-3天)
1. ⏳ 商家认证审核页面
2. ⏳ 押金申请审核页面
3. ⏳ 押金退还审核页面

### 第三阶段: 举报和违规 (1-2天)
4. ⏳ 举报处理系统
5. ⏳ 违规处理和押金扣除

### 第四阶段: 增强功能 (按需)
6. ⏳ 数据统计看板
7. ⏳ 系统公告管理
8. ⏳ 其他管理功能

---

## 🐛 已知问题

暂无

---

## 📞 支持

如有问题,请检查:
1. 数据库迁移是否成功执行
2. 管理员账号是否正确设置
3. 用户角色字段是否正确
4. 浏览器控制台是否有错误信息

---

**版本**: v1.0.0
**更新日期**: 2025-10-31
**状态**: ✅ 第一阶段完成
