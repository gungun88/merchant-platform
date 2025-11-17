"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { AlertCircle, CheckCircle2 } from "lucide-react"

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isValidToken, setIsValidToken] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // 检查是否有有效的重置密码 token
    const checkSession = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        setIsValidToken(true)
      } else {
        setError("重置链接无效或已过期，请重新申请密码重置")
      }
    }

    checkSession()
  }, [])

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()

    // 验证密码
    if (password.length < 6) {
      setError("密码长度至少为 6 个字符")
      return
    }

    if (password !== confirmPassword) {
      setError("两次输入的密码不一致")
      return
    }

    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })

      if (updateError) {
        setError("密码重置失败，请重试")
        setIsLoading(false)
        return
      }

      setSuccess(true)
      setIsLoading(false)

      // 3 秒后跳转到登录页
      setTimeout(() => {
        router.push("/auth/login")
      }, 3000)
    } catch (error: unknown) {
      console.error("Reset password error:", error)
      setError("密码重置失败，请稍后重试")
      setIsLoading(false)
    }
  }

  if (!isValidToken && error) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-sm">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">重置密码</CardTitle>
              <CardDescription>设置您的新密码</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-md bg-red-50 p-4 border border-red-200">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                </div>
                <div className="text-center">
                  <Link href="/auth/forgot-password" className="text-sm text-blue-600 hover:underline">
                    重新申请密码重置
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">重置密码</CardTitle>
            <CardDescription>设置您的新密码</CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="space-y-4">
                <div className="rounded-md bg-green-50 p-4 border border-green-200">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-green-800">密码重置成功！</p>
                      <p className="text-sm text-green-700 mt-1">
                        您的密码已成功重置，即将跳转到登录页面...
                      </p>
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <Link href="/auth/login" className="text-sm text-blue-600 hover:underline">
                    立即登录
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleResetPassword}>
                <div className="flex flex-col gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="password">新密码</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="至少 6 个字符"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="confirmPassword">确认新密码</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="再次输入密码"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                  {error && (
                    <div className="rounded-md bg-red-50 p-3 border border-red-200">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-red-600">{error}</p>
                      </div>
                    </div>
                  )}
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "重置中..." : "重置密码"}
                  </Button>
                </div>
                <div className="mt-4 text-center text-sm">
                  <Link href="/auth/login" className="text-blue-600 hover:underline">
                    返回登录
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
