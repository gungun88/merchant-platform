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

      // 处理邮箱验证回调
      const urlParams = new URL(window.location.href).searchParams
      const token_hash = urlParams.get('token_hash') || urlParams.get('token')
      const type = urlParams.get('type')
      const code = urlParams.get('code')

      console.log('[Callback] URL:', window.location.href)
      console.log('[Callback] Params:', {
        token_hash: urlParams.get('token_hash'),
        token: urlParams.get('token'),
        type,
        code
      })

      // 邮箱验证使用 token_hash/token + type
      if (token_hash && type) {
        console.log('[Callback] Using verifyOtp for email verification')
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash,
          type: type as any,
        })

        if (error) {
          console.error("Email verification error:", error)
          router.push("/auth/login?error=verification_failed")
          return
        }

        if (data.session) {
          const loggedInEmail = data.user?.email
          console.log("Email verification successful, user logged in:", loggedInEmail)

          // 验证邮箱是否匹配
          const expectedEmail = sessionStorage.getItem('pending_verification_email')
          if (expectedEmail && loggedInEmail) {
            if (loggedInEmail.toLowerCase() !== expectedEmail.toLowerCase()) {
              console.warn(`[Callback] 邮箱不匹配！预期: ${expectedEmail}, 实际: ${loggedInEmail}`)
              await supabase.auth.signOut()
              router.push("/auth/login?error=email_mismatch")
              return
            } else {
              console.log("[Callback] 邮箱验证通过:", loggedInEmail)
              sessionStorage.removeItem('pending_verification_email')
            }
          }

          router.push("/?verified=true")
          return
        }
      }

      // OAuth 流程使用 code
      if (code) {
        console.log('[Callback] Using exchangeCodeForSession for OAuth')
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)

        if (error) {
          console.error("OAuth verification error:", error)
          router.push("/auth/login?error=verification_failed")
          return
        }

        if (data.session) {
          const loggedInEmail = data.user?.email
          console.log("OAuth verification successful, user logged in:", loggedInEmail)

          const expectedEmail = sessionStorage.getItem('pending_verification_email')
          if (expectedEmail && loggedInEmail) {
            if (loggedInEmail.toLowerCase() !== expectedEmail.toLowerCase()) {
              console.warn(`[Callback] 邮箱不匹配！预期: ${expectedEmail}, 实际: ${loggedInEmail}`)
              await supabase.auth.signOut()
              router.push("/auth/login?error=email_mismatch")
              return
            } else {
              console.log("[Callback] 邮箱验证通过:", loggedInEmail)
              sessionStorage.removeItem('pending_verification_email')
            }
          }

          router.push("/?verified=true")
          return
        }
      }

      // 如果没有任何验证参数
      console.error('No verification parameters found')
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
