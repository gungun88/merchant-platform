"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Gift, HelpCircle, Eye, EyeOff } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { validateInvitationCode, processInvitationReward } from "@/lib/actions/invitation"
import { validateEmailAction } from "@/lib/actions/email-validation"
import { getSystemSettings } from "@/lib/actions/settings"
import { createUserProfile } from "@/lib/actions/profile"
import { toast } from "sonner"

export default function RegisterPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [username, setUsername] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [invitationCode, setInvitationCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [invitationValid, setInvitationValid] = useState<{
    valid: boolean
    type?: 'beta' | 'user'
  } | null>(null)
  const [passwordStrength, setPasswordStrength] = useState<{
    score: number
    feedback: string[]
  }>({ score: 0, feedback: [] })
  const [invitationCodeRequired, setInvitationCodeRequired] = useState(false)
  const [emailExists, setEmailExists] = useState(false)
  const [checkingEmail, setCheckingEmail] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  // 密码强度检查函数
  const checkPasswordStrength = (pwd: string) => {
    const feedback: string[] = []
    let score = 0

    if (pwd.length < 8) {
      feedback.push("密码长度至少8位")
    } else {
      score += 1
    }

    if (!/[a-z]/.test(pwd)) {
      feedback.push("至少包含一个小写字母")
    } else {
      score += 1
    }

    if (!/[A-Z]/.test(pwd)) {
      feedback.push("至少包含一个大写字母")
    } else {
      score += 1
    }

    if (!/[0-9]/.test(pwd)) {
      feedback.push("至少包含一个数字")
    } else {
      score += 1
    }

    if (!/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~]/.test(pwd)) {
      feedback.push("至少包含一个特殊字符(!@#$%^&*等)")
    } else {
      score += 1
    }

    return { score, feedback }
  }

  // 监听密码变化，实时显示强度
  useEffect(() => {
    if (password) {
      const strength = checkPasswordStrength(password)
      setPasswordStrength(strength)
    } else {
      setPasswordStrength({ score: 0, feedback: [] })
    }
  }, [password])

  // 加载系统设置
  useEffect(() => {
    async function loadSettings() {
      const result = await getSystemSettings()
      if (result.success && result.data) {
        setInvitationCodeRequired(result.data.invitation_code_required ?? false)
      }
    }
    loadSettings()
  }, [])

  // 实时检查邮箱是否已被注册
  useEffect(() => {
    const checkEmail = async () => {
      if (!email || email.length < 3) {
        setEmailExists(false)
        return
      }

      setCheckingEmail(true)
      const supabase = createClient()
      const { data: existingUsers } = await supabase
        .from('profiles')
        .select('email')
        .eq('email', email.toLowerCase())
        .limit(1)

      setEmailExists(existingUsers && existingUsers.length > 0)
      setCheckingEmail(false)
    }

    const timer = setTimeout(() => {
      checkEmail()
    }, 500) // 延迟500ms，避免频繁查询

    return () => clearTimeout(timer)
  }, [email])

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

    // 1. 检查邮箱是否已被注册
    const { data: existingUsers, error: checkError } = await supabase
      .from('profiles')
      .select('email')
      .eq('email', email.toLowerCase())
      .limit(1)

    if (checkError) {
      console.error('检查邮箱时出错:', checkError)
    }

    if (existingUsers && existingUsers.length > 0) {
      setError("该邮箱已被注册，请使用其他邮箱或直接登录")
      setIsLoading(false)
      return
    }

    // 2. 验证邀请码（如果必填）
    if (invitationCodeRequired && !invitationCode) {
      setError("邀请码为必填项，请输入邀请码")
      setIsLoading(false)
      return
    }

    // 3. 如果填写了邀请码，验证其有效性
    if (invitationCode && invitationValid?.valid === false) {
      setError("邀请码无效或已使用，请检查后重试")
      setIsLoading(false)
      return
    }

    // 4. 验证邮箱格式和域名（使用数据库配置）
    const emailValidation = await validateEmailAction(email)
    if (!emailValidation.valid) {
      setError(emailValidation.reason || '邮箱验证失败')
      setIsLoading(false)
      return
    }

    // 5. 验证密码强度
    if (passwordStrength.score < 5) {
      setError(`密码强度不足: ${passwordStrength.feedback.join('、')}`)
      setIsLoading(false)
      return
    }

    // 6. 验证密码一致性
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

      // 关键修复: 手动创建 profile (因为数据库触发器不可靠)
      if (data.user) {
        console.log("注册成功，开始创建 profile...")

        const profileResult = await createUserProfile({
          userId: data.user.id,
          username: username,
          email: email,
          createdAt: data.user.created_at,
        })

        if (!profileResult.success) {
          console.error("创建 profile 失败:", profileResult.error)

          // 🔥 重要修复: profile 创建失败时，删除已创建的 auth 用户，防止孤立用户
          try {
            console.log("正在回滚注册，删除 auth 用户...")
            const { error: signOutError } = await supabase.auth.signOut()
            if (signOutError) {
              console.error("登出失败:", signOutError)
            }
          } catch (cleanupError) {
            console.error("清理失败:", cleanupError)
          }

          // 阻断流程，不让用户继续
          setError(`注册失败: ${profileResult.error || "创建用户资料失败"}，请重试或联系管理员`)
          setIsLoading(false)
          return
        }

        console.log("Profile 创建成功:", profileResult)
      }

      // 如果注册成功且有有效的邀请码,处理邀请奖励
      console.log("检查邀请码:", {
        hasUser: !!data.user,
        invitationCode,
        invitationValid: invitationValid?.valid,
        invitationType: invitationValid?.type,
      })

      if (data.user && invitationCode && invitationValid?.valid) {
        try {
          console.log("开始处理邀请奖励...")
          const result = await processInvitationReward(invitationCode, data.user.id)
          console.log("邀请奖励处理结果:", result)

          if (result) {
            if (result.type === 'beta') {
              console.log("内测码使用成功")
            } else {
              console.log("邀请奖励处理成功,双方各获得积分")
            }
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
          isValid: invitationValid?.valid,
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
              {invitationCode && invitationValid?.valid && invitationValid.type !== 'beta' && "，使用邀请码额外获得积分"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister}>
              <div className="flex flex-col gap-6">
                {/* 密码要求提示 */}
                <Alert className="bg-blue-50 border-blue-200">
                  <HelpCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-700 text-xs">
                    <strong>密码要求：</strong>至少8位，包含大小写字母、数字和特殊字符
                  </AlertDescription>
                </Alert>

                {invitationCode && invitationValid?.valid && (
                  <Alert className="bg-green-50 border-green-200">
                    <Gift className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700">
                      {invitationValid.type === 'beta' ? (
                        <>您正在使用 <strong>内测邀请码</strong> 注册</>
                      ) : (
                        <>您正在使用邀请码注册，完成后您和邀请人都将获得 <strong>积分</strong> 奖励</>
                      )}
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
                    className={emailExists ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  />
                  {checkingEmail && email && (
                    <p className="text-xs text-muted-foreground">检查邮箱...</p>
                  )}
                  {!checkingEmail && emailExists && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      该邮箱已被注册，请
                      <Link href="/auth/login" className="underline font-medium">
                        直接登录
                      </Link>
                    </p>
                  )}
                  {!checkingEmail && email && !emailExists && email.includes('@') && (
                    <p className="text-sm text-green-600">该邮箱可以使用</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">密码</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {password && (
                    <div className="space-y-2">
                      {/* 密码强度进度条 */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600">密码强度:</span>
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              passwordStrength.score <= 2
                                ? "bg-red-500"
                                : passwordStrength.score === 3
                                  ? "bg-yellow-500"
                                  : passwordStrength.score === 4
                                    ? "bg-blue-500"
                                    : "bg-green-500"
                            }`}
                            style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                          />
                        </div>
                        <span
                          className={`text-xs font-medium ${
                            passwordStrength.score <= 2
                              ? "text-red-600"
                              : passwordStrength.score === 3
                                ? "text-yellow-600"
                                : passwordStrength.score === 4
                                  ? "text-blue-600"
                                  : "text-green-600"
                          }`}
                        >
                          {passwordStrength.score}/5
                        </span>
                      </div>
                      {/* 密码要求反馈 */}
                      {passwordStrength.feedback.length > 0 && (
                        <div className="space-y-1">
                          {passwordStrength.feedback.map((item, index) => (
                            <p key={index} className="text-xs text-red-600 flex items-center gap-1">
                              <span className="inline-block w-1 h-1 bg-red-600 rounded-full" />
                              {item}
                            </p>
                          ))}
                        </div>
                      )}
                      {passwordStrength.score === 5 && (
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <span className="inline-block w-1 h-1 bg-green-600 rounded-full" />
                          密码强度符合要求
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirm-password">确认密码</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="invitation-code">
                    邀请码{invitationCodeRequired && <span className="text-red-500 ml-1">*</span>}
                    {!invitationCodeRequired && <span className="text-muted-foreground text-xs ml-1">(选填)</span>}
                  </Label>
                  <Input
                    id="invitation-code"
                    type="text"
                    placeholder={invitationCodeRequired ? "请输入邀请码（必填）" : "如果有邀请码请输入"}
                    value={invitationCode}
                    onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
                    required={invitationCodeRequired}
                  />
                  {invitationCode && invitationValid?.valid === false && (
                    <p className="text-sm text-red-500">邀请码无效或已使用</p>
                  )}
                  {invitationCode && invitationValid?.valid === true && (
                    <p className="text-sm text-green-600">
                      邀请码有效 {invitationValid.type === 'beta' && '(内测码)'}
                    </p>
                  )}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                    <p className="text-sm text-yellow-800 text-center">
                      没有邀请码？
                      <a
                        href="https://doingfb.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-yellow-900 underline font-medium ml-1 hover:text-yellow-700"
                      >
                        点击这里获取
                      </a>
                    </p>
                  </div>
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
