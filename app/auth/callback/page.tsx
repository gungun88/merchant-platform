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

      // 首先检查当前是否已经有 session
      // Supabase PKCE 流程会在重定向前自动创建 session
      const { data: { session: currentSession } } = await supabase.auth.getSession()

      if (currentSession) {
        // 清理 sessionStorage
        sessionStorage.removeItem('pending_verification_email')

        // 直接跳转到首页
        router.push("/?verified=true")
        return
      }

      // 如果没有 session，尝试从 URL 参数创建
      const urlParams = new URL(window.location.href).searchParams
      const token_hash = urlParams.get('token_hash') || urlParams.get('token')
      const type = urlParams.get('type')
      const code = urlParams.get('code')

      // 邮箱验证流程（token + type）
      if (token_hash && type) {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash,
          type: type as any,
        })

        if (error) {
          console.error("[Callback] Email verification error:", error)
          router.push("/auth/login?error=verification_failed")
          return
        }

        if (data.session) {
          sessionStorage.removeItem('pending_verification_email')
          router.push("/?verified=true")
          return
        }
      }

      // OAuth 流程（code 参数）
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)

        if (error) {
          console.error("[Callback] OAuth error:", error)

          // 即使报错，也检查 session 是否已创建
          const { data: { session: finalSession } } = await supabase.auth.getSession()
          if (finalSession) {
            sessionStorage.removeItem('pending_verification_email')
            router.push("/?verified=true")
            return
          }

          router.push("/auth/login?error=verification_failed")
          return
        }

        if (data.session) {
          sessionStorage.removeItem('pending_verification_email')
          router.push("/?verified=true")
          return
        }
      }

      // 如果没有任何验证参数
      console.error('[Callback] No verification parameters found')
      router.push("/auth/login?error=no_code")
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
