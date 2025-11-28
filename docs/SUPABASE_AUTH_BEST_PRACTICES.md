# Supabase 认证最佳实践指南

> 本文档总结了在 Next.js App Router 中使用 Supabase 认证的最佳实践，避免常见的 session 管理问题。

---

## 📋 目录

1. [核心原则](#核心原则)
2. [Session 管理机制](#session-管理机制)
3. [邮箱验证流程](#邮箱验证流程)
4. [常见错误与解决方案](#常见错误与解决方案)
5. [完整示例代码](#完整示例代码)

---

## 核心原则

### ✅ 应该做的事

1. **信任 Supabase 的自动 session 管理**
   - `exchangeCodeForSession` 会自动创建和存储 session
   - 不需要手动清除或设置 session

2. **使用正确的 Supabase 客户端**
   - 客户端组件：使用 `createBrowserClient` (from `@supabase/ssr`)
   - 服务端组件：使用 `createServerClient` (from `@supabase/ssr`)
   - Middleware：使用 `createServerClient` 配合 cookies

3. **理解 localStorage vs sessionStorage**
   - `createBrowserClient` 默认使用 `localStorage`（跨标签页共享）
   - 同一域名下的所有标签页会自动同步 session
   - 如需标签页隔离，配置使用 `sessionStorage`

### ❌ 不应该做的事

1. **不要在 callback 页面清除 session**
   ```typescript
   // ❌ 错误：会导致跨用户 session 混乱
   await supabase.auth.signOut({ scope: 'local' })
   await supabase.auth.exchangeCodeForSession(code)
   ```

2. **不要过度使用 signOut**
   - 只在用户主动登出或遇到认证错误时使用
   - 不要在正常的认证流程中使用

3. **不要手动操作 localStorage 中的 session**
   - 让 Supabase SDK 自动管理
   - 手动操作会导致状态不一致

---

## Session 管理机制

### localStorage 的跨标签页同步

```
┌─────────────────────────────────────────────────────────┐
│                  Browser (同一域名)                      │
│                                                         │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐       │
│  │  Tab 1   │     │  Tab 2   │     │  Tab 3   │       │
│  └────┬─────┘     └────┬─────┘     └────┬─────┘       │
│       │                │                │              │
│       └────────────────┼────────────────┘              │
│                        │                               │
│                  ┌─────▼─────┐                         │
│                  │localStorage│ ← 所有标签页共享        │
│                  │  session   │                        │
│                  └───────────┘                         │
└─────────────────────────────────────────────────────────┘
```

**关键点：**
- 任何一个标签页修改 session，所有标签页都会立即同步
- `signOut` 会清除整个 localStorage 的 session，影响所有标签页
- 这就是为什么在 callback 中调用 `signOut` 会导致其他用户的 session 被清除

---

## 邮箱验证流程

### 正确的流程图

```
┌─────────────┐
│  用户注册    │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│  Supabase 发送      │
│  验证邮件           │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  用户点击邮件链接   │
│  ↓                  │
│  /auth/callback?    │
│  code=xxx           │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  exchangeCodeForSession(code)       │
│  ↓                                  │
│  1. 验证 code                        │
│  2. 创建 session                     │
│  3. 自动存储到 localStorage          │
│  4. 返回 user 和 session            │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────┐
│  跳转到首页         │
│  用户已登录         │
└─────────────────────┘
```

### ✅ 正确的 Callback 实现

```typescript
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = createClient()

      // 处理邮箱验证回调 - 交换 code 换取 session
      const { data, error } = await supabase.auth.exchangeCodeForSession(
        window.location.search.substring(1)
      )

      if (error) {
        console.error("Email verification error:", error)
        // 验证失败时跳转到登录页
        router.push("/auth/login?error=verification_failed")
      } else if (data.session) {
        // 验证成功，session 已自动设置
        console.log("Email verification successful")
        router.push("/?verified=true")
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>正在验证您的邮箱...</p>
    </div>
  )
}
```

### ❌ 错误的实现（导致 session 混乱）

```typescript
// ❌ 错误示例 - 不要这样做！
const handleCallback = async () => {
  const supabase = createClient()

  // ❌ 错误：清除了所有标签页的 session
  await supabase.auth.signOut({ scope: 'local' })

  // 此时如果有其他用户在其他标签页登录着，
  // 他们的 session 也会被清除！

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  // 新用户的 session 被写入 localStorage
  // 其他标签页会自动同步到这个新 session
  // 结果：用户A的标签页显示了用户B的账号 😱
}
```

---

## 常见错误与解决方案

### 问题 1：用户A登录了用户B的账号

**症状：**
- 用户A在浏览器中一直保持登录
- 当用户B注册并验证邮箱时
- 用户A的浏览器突然显示了用户B的账号信息

**原因：**
```typescript
// callback 页面中有这样的代码
await supabase.auth.signOut({ scope: 'local' })
```

**解决方案：**
删除所有 callback 页面中的 `signOut` 调用，让 `exchangeCodeForSession` 自己处理。

---

### 问题 2：导航栏状态不一致

**症状：**
- 在登录页面时，导航栏有时显示已登录状态
- 刷新后状态才正常

**错误做法：**
```typescript
// ❌ 在导航栏中强制清除认证页面的 session
const isAuthPage = pathname.startsWith('/auth/')
if (isAuthPage) {
  setIsLoggedIn(false)
  setUser(null)
  return
}
```

**正确做法：**
信任 Supabase 的 session 管理，不要强制覆盖。如果需要在特定页面隐藏导航栏元素，使用 CSS 或条件渲染，而不是清除 session 状态。

---

### 问题 3：邮箱验证后无法自动登录

**症状：**
- 用户点击邮件验证链接
- 跳转回网站后没有登录，还需要手动输入密码

**可能原因：**
1. callback 页面中调用了 `signOut`
2. `exchangeCodeForSession` 执行失败但没有正确处理
3. 重定向 URL 配置错误

**检查清单：**
```typescript
// 1. 确保注册时配置了正确的 emailRedirectTo
await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: `${window.location.origin}/auth/callback`
  }
})

// 2. 确保 callback 页面正确处理 code
const { data, error } = await supabase.auth.exchangeCodeForSession(
  window.location.search.substring(1)
)

// 3. 确保 Supabase Dashboard 中配置了 Redirect URLs
// Site URL: https://yourdomain.com
// Redirect URLs: https://yourdomain.com/auth/callback
```

---

## 完整示例代码

### 1. Supabase 客户端配置

**lib/supabase/client.ts**
```typescript
import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**lib/supabase/server.ts**
```typescript
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component 中的 setAll 可以忽略
          }
        },
      },
    }
  )
}
```

### 2. 注册页面

**app/auth/register/page.tsx**
```typescript
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function RegisterPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const router = useRouter()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // 重要：配置验证邮件的回调 URL
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      return
    }

    if (data.user) {
      // 跳转到提示页面，告知用户查收邮件
      router.push("/auth/verify-email")
    }
  }

  return (
    <form onSubmit={handleRegister}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="邮箱"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="密码"
        required
      />
      {error && <p className="text-red-500">{error}</p>}
      <button type="submit">注册</button>
    </form>
  )
}
```

### 3. 登录页面

**app/auth/login/page.tsx**
```typescript
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      // 检查是否是邮箱未确认
      if (error.message.includes('Email not confirmed')) {
        setError("您的邮箱尚未确认，请先前往邮箱查收确认邮件")
        return
      }
      setError(error.message)
      return
    }

    if (data.user) {
      // 登录成功，跳转到首页
      router.push("/")
    }
  }

  return (
    <form onSubmit={handleLogin}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="邮箱"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="密码"
        required
      />
      {error && <p className="text-red-500">{error}</p>}
      <button type="submit">登录</button>
    </form>
  )
}
```

### 4. Callback 页面（核心）

**app/auth/callback/page.tsx**
```typescript
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = createClient()

      // 核心：交换 code 换取 session
      // Supabase 会自动处理一切，不需要手动清除或设置 session
      const { data, error } = await supabase.auth.exchangeCodeForSession(
        window.location.search.substring(1)
      )

      if (error) {
        console.error("Email verification error:", error)
        // 验证失败，跳转到登录页
        router.push("/auth/login?error=verification_failed")
      } else if (data.session) {
        // 验证成功，session 已自动设置
        console.log("Email verification successful, user:", data.user?.email)
        router.push("/?verified=true")
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p>正在验证您的邮箱...</p>
      </div>
    </div>
  )
}
```

### 5. Middleware（Session 刷新）

**middleware.ts**
```typescript
import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 刷新 session（重要：保持 session 有效）
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
```

### 6. 导航栏组件（Session 监听）

**components/navigation.tsx**
```typescript
"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { User } from "@supabase/supabase-js"

export function Navigation() {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const supabase = createClient()

    // 加载当前用户
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
    })

    // 监听认证状态变化
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <nav>
      {user ? (
        <div>
          <span>欢迎, {user.email}</span>
          <button onClick={handleLogout}>退出</button>
        </div>
      ) : (
        <div>
          <a href="/auth/login">登录</a>
          <a href="/auth/register">注册</a>
        </div>
      )}
    </nav>
  )
}
```

---

## Supabase Dashboard 配置

### Authentication Settings

1. **Site URL**
   ```
   https://yourdomain.com
   ```

2. **Redirect URLs**（允许的回调地址）
   ```
   https://yourdomain.com/auth/callback
   http://localhost:3000/auth/callback  # 开发环境
   ```

3. **Email Templates**
   - 确保 "Confirm signup" 邮件模板中的链接指向正确的回调 URL
   - 默认模板：`{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email`

---

## 调试技巧

### 1. 查看 localStorage 中的 session

```javascript
// 在浏览器 Console 中运行
Object.keys(localStorage).forEach(key => {
  if (key.includes('supabase')) {
    console.log(key, localStorage.getItem(key))
  }
})
```

### 2. 监听 auth 状态变化

```typescript
const supabase = createClient()

supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth event:', event)
  console.log('Session:', session)
})
```

### 3. 检查 callback 参数

```typescript
// 在 callback 页面中
console.log('Full URL:', window.location.href)
console.log('Search params:', window.location.search)
```

---

## 总结

### 黄金法则

1. **不要在 callback 页面调用 signOut**
2. **信任 exchangeCodeForSession 的自动 session 管理**
3. **理解 localStorage 的跨标签页同步特性**
4. **不要在正常认证流程中强制清除 session**
5. **使用 middleware 自动刷新 session**

### 如果遇到 session 问题

1. 检查是否在 callback 中调用了 `signOut`
2. 检查 `emailRedirectTo` 配置是否正确
3. 检查 Supabase Dashboard 的 Redirect URLs 配置
4. 查看浏览器 Console 和 Network 面板的错误信息
5. 确认 middleware 正常运行并刷新 session

---

**最后更新：** 2025-11-28
**维护者：** Development Team
