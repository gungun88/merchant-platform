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

      // 处理邮箱验证回调 - 交换 code 换取 session
      // 注意：不需要传参数，Supabase 会自动从 URL 读取
      const { data, error } = await supabase.auth.exchangeCodeForSession()

      if (error) {
        console.error("Email verification error:", error)
        // 验证失败时跳转到登录页并显示错误信息
        router.push("/auth/login?error=verification_failed")
      } else if (data.session) {
        // 验证成功，session 已自动设置
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">正在验证您的邮箱...</p>
      </div>
    </div>
  )
}
