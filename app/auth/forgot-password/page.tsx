"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useState } from "react"
import { AlertCircle, CheckCircle2 } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()

    const supabase = createClient()
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (resetError) {
        setError("发送重置邮件失败，请检查邮箱是否正确")
        setIsLoading(false)
        return
      }

      setSuccess(true)
      setIsLoading(false)
    } catch (error: unknown) {
      console.error("Reset password error:", error)
      setError("发送重置邮件失败，请稍后重试")
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">忘记密码</CardTitle>
            <CardDescription>输入您的邮箱地址，我们将发送密码重置链接</CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="space-y-4">
                <div className="rounded-md bg-green-50 p-4 border border-green-200">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-green-800">重置邮件已发送！</p>
                      <p className="text-sm text-green-700 mt-1">
                        请检查您的邮箱 <span className="font-medium">{email}</span>，点击邮件中的链接重置密码。
                      </p>
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <Link href="/auth/login" className="text-sm text-blue-600 hover:underline">
                    返回登录
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleResetPassword}>
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
                  {error && (
                    <div className="rounded-md bg-red-50 p-3 border border-red-200">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-red-600">{error}</p>
                      </div>
                    </div>
                  )}
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "发送中..." : "发送重置链接"}
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
