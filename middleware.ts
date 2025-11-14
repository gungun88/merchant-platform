import { updateSession } from "@/lib/supabase/middleware"
import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

export async function middleware(request: NextRequest) {
  // 先更新 session
  let response = await updateSession(request)

  // 创建 Supabase 客户端
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 如果用户已登录，检查封禁状态（除了登录页和公开页面）
  if (
    user &&
    !request.nextUrl.pathname.startsWith("/auth/login") &&
    !request.nextUrl.pathname.startsWith("/banned")
  ) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_banned, banned_reason")
      .eq("id", user.id)
      .single()

    // 如果用户被封禁，跳转到封禁提示页
    if (profile?.is_banned) {
      const bannedUrl = new URL("/banned", request.url)
      bannedUrl.searchParams.set("reason", profile.banned_reason || "您的账户已被封禁")
      return NextResponse.redirect(bannedUrl)
    }
  }

  // 检查是否是管理后台路由
  if (request.nextUrl.pathname.startsWith("/admin")) {
    // 如果是登录页面,允许访问
    if (request.nextUrl.pathname === "/admin/login") {
      return response
    }

    try {
      if (!user) {
        // 未登录,跳转到管理员登录页
        return NextResponse.redirect(new URL("/admin/login", request.url))
      }

      // 检查用户角色和封禁状态
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_banned")
        .eq("id", user.id)
        .single()

      if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
        // 不是管理员,跳转到首页
        return NextResponse.redirect(new URL("/", request.url))
      }

      return response
    } catch (error) {
      console.error("Middleware error:", error)
      return NextResponse.redirect(new URL("/admin/login", request.url))
    }
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
