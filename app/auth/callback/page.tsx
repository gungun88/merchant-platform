"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = createClient()

      // 🔥 关键修复: 先清除任何现有的 session，确保验证邮箱后登录的是新注册的账号
      await supabase.auth.signOut({ scope: 'local' })

      // 处理邮箱验证回调
      const { error } = await supabase.auth.exchangeCodeForSession(
        window.location.search.substring(1)
      )

      if (error) {
        console.error("Email verification error:", error)
        router.push("/auth/login?error=verification_failed")
      } else {
        // 验证成功，重定向到首页，此时登录的应该是刚验证的新账号
        router.push("/?verified=true")
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">正在验证您的邮箱...</p>
      </div>
    </div>
  )
}
