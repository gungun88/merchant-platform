"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { checkAccountLocked, recordLoginFailure, resetLoginAttempts } from "@/lib/actions/login-security"
import { AlertCircle, Lock } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      // 1. 先检查账号是否被锁定
      const lockStatus = await checkAccountLocked(email)
      if (lockStatus.locked) {
        setError(`账号已被锁定，请在 ${lockStatus.remainingMinutes} 分钟后重试`)
        setIsLoading(false)
        return
      }

      // 2. 尝试登录
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (loginError) {
        // 登录失败 - 记录失败次数
        const failureResult = await recordLoginFailure(email)

        if (failureResult.success && failureResult.locked) {
          setError(`连续登录失败次数过多，账号已被锁定 ${failureResult.lockoutMinutes} 分钟`)
        } else if (failureResult.success && !failureResult.locked) {
          setError(`邮箱或密码错误，还可以尝试 ${failureResult.remainingAttempts} 次`)
        } else {
          setError("邮箱或密码错误，请检查后重试")
        }
        setIsLoading(false)
        return
      }

      // 3. 登录成功 - 重置失败次数
      if (data.user) {
        await resetLoginAttempts(data.user.id)
        window.location.href = "/"
      }
    } catch (error: unknown) {
      console.error("Login error:", error)
      setError("登录失败，请稍后重试")
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">登录</CardTitle>
            <CardDescription>输入您的邮箱和密码登录账号</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">邮箱</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">密码</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                {error && (
                  <div className="rounded-md bg-red-50 p-3 border border-red-200">
                    <div className="flex items-start gap-2">
                      {error.includes("锁定") ? (
                        <Lock className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                      )}
                      <p className="text-sm text-red-600">{error}</p>
                    </div>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "登录中..." : "登录"}
                </Button>
              </div>
              <div className="mt-4 text-center text-sm">
                还没有账号？{" "}
                <Link href="/auth/register" className="underline underline-offset-4">
                  立即注册
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
