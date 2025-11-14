"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createClient } from "@/lib/supabase/client"
import { Shield, AlertCircle, Lock, Mail } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const supabase = createClient()

      // 登录
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        throw authError
      }

      if (!authData.user) {
        throw new Error("登录失败")
      }

      // 检查是否是管理员
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", authData.user.id)
        .single()

      if (profileError) {
        throw profileError
      }

      if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
        // 不是管理员,退出登录
        await supabase.auth.signOut()
        throw new Error("您没有管理员权限")
      }

      toast.success("登录成功")

      // 跳转到管理后台
      router.push("/admin/dashboard")
      router.refresh()
    } catch (error: any) {
      console.error("Login error:", error)

      // 翻译 Supabase 的英文错误信息为中文
      let errorMessage = error.message || "登录失败，请检查邮箱和密码"

      if (error.message === "Invalid login credentials") {
        errorMessage = "邮箱或密码错误，请检查后重试"
      } else if (error.message.includes("Email not confirmed")) {
        errorMessage = "邮箱未验证，请先验证邮箱"
      } else if (error.message.includes("User not found")) {
        errorMessage = "用户不存在"
      } else if (error.message.includes("Invalid email")) {
        errorMessage = "邮箱格式不正确"
      }

      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo 和标题 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4">
            <Shield className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">管理后台</h1>
          <p className="text-sm text-slate-600 mt-2">跨境服务商平台 - 管理员登录</p>
        </div>

        {/* 登录卡片 */}
        <Card>
          <CardHeader>
            <CardTitle>管理员登录</CardTitle>
            <CardDescription>请使用管理员账号登录</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {/* 错误提示 */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* 邮箱输入 */}
              <div className="space-y-2">
                <Label htmlFor="email">邮箱</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {/* 密码输入 */}
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {/* 登录按钮 */}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "登录中..." : "登录"}
              </Button>
            </form>

            {/* 底部链接 */}
            <div className="mt-6 text-center text-sm">
              <Link href="/" className="text-slate-600 hover:text-primary">
                返回首页
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* 安全提示 */}
        <div className="mt-6 text-center">
          <Alert className="bg-amber-50 border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-xs text-amber-800">
              此页面仅供管理员使用。所有登录尝试都会被记录。
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  )
}
