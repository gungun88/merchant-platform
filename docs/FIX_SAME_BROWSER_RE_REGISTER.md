# 同浏览器重新注册修复说明

## 🔍 问题描述

**场景：**
1. 在浏览器中注册了A账号（已验证邮箱）
2. 退出A账号
3. 注册B账号（新邮箱）
4. 点击B账号的验证邮件
5. **问题：登录后显示的是A账号，而不是B账号**

---

## 🎯 根本原因

### 问题 1：注册前没有清除旧 session
```typescript
// ❌ 问题代码（修复前）
const handleRegister = async (e) => {
  const supabase = createClient()
  // 直接注册，没有清除旧 session
  await supabase.auth.signUp({ email, password })
}
```

**问题：**
- 用户退出A账号后，localStorage 可能还有残留数据
- 注册B账号时，这些残留数据没有被清除
- 验证邮件回调时可能读取到旧的缓存

### 问题 2：没有验证登录的邮箱是否正确
```typescript
// ❌ 问题代码（修复前）
const { data } = await supabase.auth.exchangeCodeForSession(code)
// 直接跳转，没有验证 data.user.email 是否是预期的
router.push("/?verified=true")
```

**问题：**
- 没有检查登录的邮箱是否是刚注册的邮箱
- 如果出现问题，用户无法及时发现

---

## ✅ 修复方案

### 修复 1：注册前清除所有认证数据

**文件：** app/auth/register/page.tsx

**修改：**
```typescript
const handleRegister = async (e: React.FormEvent) => {
  e.preventDefault()
  const supabase = createClient()
  setIsLoading(true)
  setError(null)

  // 🔥 关键修复：注册前清除所有可能残留的认证数据
  // 场景：用户退出A账号后立即注册B账号，localStorage 可能还有A的残留
  console.log("[Register] 注册前清除旧 session...")
  await supabase.auth.signOut()
  // 等待确保清理完成
  await new Promise(resolve => setTimeout(resolve, 100))

  // ... 继续注册流程
}
```

### 修复 2：保存预期邮箱到 sessionStorage

**文件：** app/auth/register/page.tsx

**修改：**
```typescript
try {
  // 🔥 保存预期的邮箱到 sessionStorage，用于 callback 验证
  sessionStorage.setItem('pending_verification_email', email.toLowerCase())
  console.log("[Register] 保存预期邮箱到 sessionStorage:", email.toLowerCase())

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
      data: { username },
    },
  })
  // ...
}
```

### 修复 3：Callback 验证登录的邮箱

**文件：** app/auth/callback/page.tsx

**修改：**
```typescript
useEffect(() => {
  const handleCallback = async () => {
    const supabase = createClient()

    const { data, error } = await supabase.auth.exchangeCodeForSession(
      window.location.search.substring(1)
    )

    if (error) {
      console.error("Email verification error:", error)
      router.push("/auth/login?error=verification_failed")
    } else if (data.session) {
      const loggedInEmail = data.user?.email
      console.log("Email verification successful, user logged in:", loggedInEmail)

      // 🔥 额外验证：检查登录的邮箱是否是预期的邮箱
      const expectedEmail = sessionStorage.getItem('pending_verification_email')
      if (expectedEmail && loggedInEmail) {
        if (loggedInEmail.toLowerCase() !== expectedEmail.toLowerCase()) {
          console.warn(`[Callback] 邮箱不匹配！预期: ${expectedEmail}, 实际: ${loggedInEmail}`)
          // 清除错误的 session
          await supabase.auth.signOut()
          router.push("/auth/login?error=email_mismatch")
          return
        } else {
          console.log("[Callback] 邮箱验证通过:", loggedInEmail)
          // 清除 sessionStorage
          sessionStorage.removeItem('pending_verification_email')
        }
      }

      router.push("/?verified=true")
    }
  }

  handleCallback()
}, [router])
```

---

## 🧪 测试验证

### 测试场景

1. **清除浏览器数据**
   - 打开开发者工具 → Application → Clear storage → Clear site data

2. **注册A账号**
   - 邮箱：testA@example.com
   - 验证邮件并登录
   - 确认导航栏显示 testA@example.com

3. **退出A账号**
   - 点击"退出登录"
   - 确认导航栏显示"登录"按钮

4. **检查浏览器存储**
   - Application → Local Storage
   - 确认没有 sb-xxx-auth-token
   - 如果有，删除它

5. **注册B账号**
   - 邮箱：testB@example.com
   - 填写注册表单
   - **观察 Console:** 应该看到 "[Register] 注册前清除旧 session..."
   - **观察 Console:** 应该看到 "[Register] 保存预期邮箱到 sessionStorage: testb@example.com"

6. **点击验证邮件**
   - 打开 testB@example.com 的邮箱
   - 点击验证链接
   - **观察 Console:** 应该看到 "Email verification successful, user logged in: testB@example.com"
   - **观察 Console:** 应该看到 "[Callback] 邮箱验证通过: testb@example.com"

7. **验证结果**
   - ✅ 导航栏显示: testB@example.com
   - ✅ **不是** testA@example.com

### 异常场景测试

**如果出现邮箱不匹配：**
- Console 会显示: "[Callback] 邮箱不匹配！预期: testb@example.com, 实际: testa@example.com"
- 自动清除错误的 session
- 跳转到登录页，显示错误提示
- 这样用户可以立即发现问题

---

## 📊 修复效果对比

### 修复前 ❌

| 步骤 | 结果 |
|------|------|
| 1. 注册A账号并登录 | ✅ 成功 |
| 2. 退出A账号 | ✅ 成功 |
| 3. 注册B账号 | ✅ 成功 |
| 4. 点击B的验证邮件 | ❌ 登录成A账号 |

### 修复后 ✅

| 步骤 | 结果 |
|------|------|
| 1. 注册A账号并登录 | ✅ 成功 |
| 2. 退出A账号 | ✅ 成功（清除 session）|
| 3. 注册B账号 | ✅ 成功（清除旧 session + 保存预期邮箱）|
| 4. 点击B的验证邮件 | ✅ 登录B账号（验证邮箱匹配）|

---

## 🔍 调试技巧

### 1. 查看 localStorage

```javascript
// 浏览器 Console 中运行
Object.keys(localStorage).forEach(key => {
  if (key.includes('supabase')) {
    console.log(key, localStorage.getItem(key))
  }
})
```

### 2. 查看 sessionStorage

```javascript
// 浏览器 Console 中运行
console.log('pending_verification_email:', sessionStorage.getItem('pending_verification_email'))
```

### 3. 解析 JWT Token

```javascript
// 浏览器 Console 中运行
const token = localStorage.getItem('sb-xxx-auth-token')
if (token) {
  const parsed = JSON.parse(token)
  const payload = JSON.parse(atob(parsed.access_token.split('.')[1]))
  console.log('Token email:', payload.email)
}
```

---

## 💡 关键要点

### sessionStorage vs localStorage

| 特性 | sessionStorage | localStorage |
|------|----------------|--------------|
| 生命周期 | 标签页关闭时清除 | 永久保存（直到手动清除）|
| 跨标签页 | ❌ 不共享 | ✅ 共享 |
| 适用场景 | 临时数据、单次流程 | 长期数据、用户偏好 |

**为什么用 sessionStorage 保存预期邮箱？**
- 预期邮箱只在注册验证流程中使用
- 标签页关闭后自动清除，不会残留
- 不会跨标签页共享，避免混乱

### signOut 的时机

| 场景 | 是否需要 signOut |
|------|-----------------|
| 用户点击"退出登录" | ✅ 需要 |
| 注册新账号前 | ✅ 需要（清除残留）|
| 邮箱验证回调 | ❌ 不需要（除非邮箱不匹配）|
| 登录失败 | ❌ 不需要 |

---

## 📝 后续建议

1. **监控 Console 日志**
   - 检查是否有 "[Callback] 邮箱不匹配" 的警告
   - 如果频繁出现，说明还有其他问题

2. **用户反馈**
   - 如果用户反馈还是出现账号混乱
   - 让用户提供 Console 日志截图
   - 检查 localStorage 和 sessionStorage 的内容

3. **添加更多日志**
   - 可以在关键步骤添加更多 console.log
   - 方便问题追踪和调试

---

**最后更新:** 2025-11-28
**维护者:** Development Team
