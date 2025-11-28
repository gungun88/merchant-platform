"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"

export default function AuthCallbackPage() {
  const router = useRouter()
  const [debugInfo, setDebugInfo] = useState<string[]>([])

  useEffect(() => {
    const handleCallback = async () => {
      const logs: string[] = []
      const supabase = createClient()

      // 获取 URL 参数
      const urlParams = new URL(window.location.href).searchParams
      const allParams = Object.fromEntries(urlParams.entries())

      logs.push(`URL: ${window.location.href}`)
      logs.push(`All Params: ${JSON.stringify(allParams, null, 2)}`)
      console.log('[Callback] URL:', window.location.href)
      console.log('[Callback] All Params:', allParams)

      // 首先检查当前是否已经有 session
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      logs.push(`Current session: ${currentSession ? 'EXISTS' : 'NONE'}`)

      if (currentSession) {
        logs.push(`Logged in as: ${currentSession.user.email}`)
        console.log('[Callback] Already have session:', currentSession.user.email)

        // 如果已经有 session，直接跳转到首页
        setDebugInfo(logs)
        setTimeout(() => {
          router.push("/?verified=true")
        }, 2000)
        return
      }

      // 如果没有 session，尝试从 URL 获取
      const token_hash = urlParams.get('token_hash') || urlParams.get('token')
      const type = urlParams.get('type')
      const code = urlParams.get('code')

      logs.push(`token_hash: ${token_hash || 'null'}`)
      logs.push(`type: ${type || 'null'}`)
      logs.push(`code: ${code || 'null'}`)
      setDebugInfo(logs)

      // 邮箱验证流程（token + type）
      if (token_hash && type) {
        console.log('[Callback] Using verifyOtp')
        logs.push('Using verifyOtp...')

        const { data, error } = await supabase.auth.verifyOtp({
          token_hash,
          type: type as any,
        })

        if (error) {
          logs.push(`Error: ${error.message}`)
          console.error("[Callback] verifyOtp error:", error)
          setDebugInfo(logs)
          setTimeout(() => router.push("/auth/login?error=verification_failed"), 2000)
          return
        }

        if (data.session) {
          logs.push(`Success! Logged in as: ${data.user?.email}`)
          console.log("[Callback] verifyOtp success:", data.user?.email)
          setDebugInfo(logs)

          // 清理 sessionStorage
          sessionStorage.removeItem('pending_verification_email')

          setTimeout(() => router.push("/?verified=true"), 2000)
          return
        }
      }

      // OAuth 流程（code 参数）
      if (code) {
        console.log('[Callback] Using exchangeCodeForSession')
        logs.push('Using exchangeCodeForSession...')

        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)

          if (error) {
            logs.push(`Error: ${error.message}`)
            console.error("[Callback] exchangeCodeForSession error:", error)
            setDebugInfo(logs)

            // 再次检查是否有 session（可能在后台已经创建了）
            const { data: { session: finalSession } } = await supabase.auth.getSession()
            if (finalSession) {
              logs.push(`But session exists! Logged in as: ${finalSession.user.email}`)
              console.log('[Callback] Session exists despite error:', finalSession.user.email)
              setDebugInfo(logs)
              setTimeout(() => router.push("/?verified=true"), 2000)
              return
            }

            setTimeout(() => router.push("/auth/login?error=verification_failed"), 2000)
            return
          }

          if (data.session) {
            logs.push(`Success! Logged in as: ${data.user?.email}`)
            console.log("[Callback] exchangeCodeForSession success:", data.user?.email)
            setDebugInfo(logs)

            sessionStorage.removeItem('pending_verification_email')
            setTimeout(() => router.push("/?verified=true"), 2000)
            return
          }
        } catch (err: any) {
          logs.push(`Exception: ${err.message}`)
          console.error("[Callback] Exception:", err)
          setDebugInfo(logs)
        }
      }

      // 如果没有任何验证参数
      logs.push('No verification parameters found')
      console.error('[Callback] No verification parameters')
      setDebugInfo(logs)
      setTimeout(() => router.push("/auth/login?error=no_code"), 2000)
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center space-y-4 mb-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">正在验证您的邮箱...</p>
        </div>

        {debugInfo.length > 0 && (
          <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-xs overflow-auto max-h-96">
            <div className="font-bold mb-2">Debug Info:</div>
            {debugInfo.map((log, i) => (
              <div key={i} className="mb-1">{log}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
