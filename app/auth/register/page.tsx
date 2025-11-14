"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Gift } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { validateInvitationCode, processInvitationReward } from "@/lib/actions/invitation"
import { validateEmailAction } from "@/lib/actions/email-validation"
import { toast } from "sonner"

export default function RegisterPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [username, setUsername] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [invitationCode, setInvitationCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [invitationValid, setInvitationValid] = useState<boolean | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  // 检查URL中的邀请码
  useEffect(() => {
    const code = searchParams.get("invitation_code")
    if (code) {
      setInvitationCode(code)
      // 验证邀请码
      validateInvitationCode(code).then((valid) => {
        setInvitationValid(valid)
      })
    }
  }, [searchParams])

  // 当邀请码改变时验证
  useEffect(() => {
    if (invitationCode) {
      validateInvitationCode(invitationCode).then((valid) => {
        setInvitationValid(valid)
      })
    } else {
      setInvitationValid(null)
    }
  }, [invitationCode])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    // 1. 验证邮箱格式和域名（使用数据库配置）
    const emailValidation = await validateEmailAction(email)
    if (!emailValidation.valid) {
      setError(emailValidation.reason || '邮箱验证失败')
      setIsLoading(false)
      return
    }

    // 2. 验证密码一致性
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致")
      setIsLoading(false)
      return
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // 使用当前窗口的 origin，确保重定向到正确的端口
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            username,
          },
        },
      })
      if (error) throw error

      // 如果注册成功且有有效的邀请码,处理邀请奖励
      console.log("注册成功，检查邀请码:", {
        hasUser: !!data.user,
        invitationCode,
        invitationValid,
      })

      if (data.user && invitationCode && invitationValid) {
        try {
          console.log("开始处理邀请奖励...")
          const result = await processInvitationReward(invitationCode, data.user.id)
          console.log("邀请奖励处理结果:", result)

          if (result) {
            console.log("邀请奖励处理成功,双方各获得积分")
          } else {
            console.log("邀请奖励处理返回null，可能被邀请过或邀请码无效")
          }
        } catch (invitationError) {
          console.error("处理邀请奖励失败:", invitationError)
          // 即使邀请奖励处理失败,也不影响注册流程
        }
      } else {
        console.log("跳过邀请奖励处理，条件不满足:", {
          hasUser: !!data.user,
          hasCode: !!invitationCode,
          isValid: invitationValid,
        })
      }

      // 确保邀请奖励处理完成后再跳转
      console.log("准备跳转到注册成功页面...")
      router.push("/auth/register-success")
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "注册失败")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">注册</CardTitle>
            <CardDescription>
              创建新账号，注册即送积分
              {invitationCode && invitationValid && "，使用邀请码额外获得积分"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister}>
              <div className="flex flex-col gap-6">
                {invitationCode && invitationValid && (
                  <Alert className="bg-green-50 border-green-200">
                    <Gift className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700">
                      您正在使用邀请码注册，完成后您和邀请人都将获得 <strong>积分</strong> 奖励
                    </AlertDescription>
                  </Alert>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="username">用户名</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="请输入用户名"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
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
                <div className="grid gap-2">
                  <Label htmlFor="confirm-password">确认密码</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="invitation-code">邀请码（选填）</Label>
                  <Input
                    id="invitation-code"
                    type="text"
                    placeholder="如果有邀请码请输入"
                    value={invitationCode}
                    onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
                  />
                  {invitationCode && invitationValid === false && (
                    <p className="text-sm text-red-500">邀请码无效或已使用</p>
                  )}
                  {invitationCode && invitationValid === true && (
                    <p className="text-sm text-green-600">邀请码有效</p>
                  )}
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "注册中..." : "注册"}
                </Button>
              </div>
              <div className="mt-4 text-center text-sm">
                已有账号？{" "}
                <Link href="/auth/login" className="underline underline-offset-4">
                  立即登录
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
