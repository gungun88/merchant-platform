"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { updateProfile, getProfile } from "@/lib/actions/profile"
import { getSystemSettings } from "@/lib/actions/settings"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { ArrowLeft, Gift, Upload, X, Loader2, User, Eye, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { triggerPointsUpdate } from "@/lib/utils/points-update"

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [username, setUsername] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [currentPoints, setCurrentPoints] = useState(0)
  const [hasAvatar, setHasAvatar] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState("")
  const [showPreview, setShowPreview] = useState(false)
  const [systemSettings, setSystemSettings] = useState<any>(null)

  useEffect(() => {
    loadProfile()
    loadSystemSettings()
  }, [])

  async function loadSystemSettings() {
    const result = await getSystemSettings()
    if (result.success && result.data) {
      setSystemSettings(result.data)
    }
  }

  async function loadProfile() {
    setPageLoading(true)
    const result = await getProfile()

    if (result.success && result.profile) {
      setUsername(result.profile.username || "")
      setAvatarUrl(result.profile.avatar || "")
      setAvatarPreview(result.profile.avatar || "")
      setCurrentPoints(result.profile.points || 0)
      setHasAvatar(!!result.profile.avatar)
    } else {
      toast.error(result.error || "加载失败")
      router.push("/auth/login")
    }
    setPageLoading(false)
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件类型
    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件")
      return
    }

    // 验证文件大小 (最大 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("图片大小不能超过 2MB")
      return
    }

    setUploading(true)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        toast.error("请先登录")
        return
      }

      // 生成唯一文件名
      const fileExt = file.name.split(".").pop()
      const fileName = `${user.id}-${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      // 上传到 Supabase Storage
      const { error: uploadError } = await supabase.storage.from("merchant-assets").upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      })

      if (uploadError) {
        console.error("Upload error:", uploadError)
        toast.error("上传失败：" + uploadError.message)
        return
      }

      // 获取公开URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("merchant-assets").getPublicUrl(filePath)

      setAvatarPreview(publicUrl)
      setAvatarUrl(publicUrl)
      toast.success("头像上传成功")
    } catch (error) {
      console.error("Upload error:", error)
      toast.error("上传失败")
    } finally {
      setUploading(false)
    }
  }

  function handleRemoveAvatar() {
    setAvatarPreview("")
    setAvatarUrl("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!username.trim()) {
      toast.error("用户名不能为空")
      return
    }

    if (username.length > 20) {
      toast.error("用户名不能超过20个字符")
      return
    }

    setLoading(true)

    try {
      const result = await updateProfile({
        username: username.trim(),
        avatar: avatarUrl || undefined,
      })

      if (result.success) {
        if (result.isFirstAvatarUpload && result.bonusPoints) {
          toast.success(`资料更新成功！首次上传头像获得 ${result.bonusPoints} 积分奖励`)
          // 触发积分更新
          triggerPointsUpdate()
        } else {
          toast.success("资料更新成功")
        }

        // 重新加载资料
        await loadProfile()
      } else {
        toast.error(result.error || "更新失败")
      }
    } catch (error) {
      toast.error("更新失败，请稍后重试")
    } finally {
      setLoading(false)
    }
  }

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="text-center py-12 text-muted-foreground">加载中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Link href="/">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回首页
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              个人设置
            </CardTitle>
            <CardDescription>修改您的个人资料信息</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 头像上传奖励提示 */}
              {!hasAvatar && (
                <Alert className="bg-gray-50 border-gray-200">
                  <Gift className="h-4 w-4 text-gray-700" />
                  <AlertDescription className="text-gray-700">
                    首次上传头像可获得 <strong>{systemSettings?.upload_avatar_reward || 30} 积分</strong> 奖励!
                  </AlertDescription>
                </Alert>
              )}

              {/* 当前积分显示 */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <p className="text-sm text-gray-600">当前积分</p>
                  <p className="text-2xl font-bold text-gray-900">{currentPoints.toLocaleString()}</p>
                </div>
                <Gift className="h-8 w-8 text-gray-400" />
              </div>

              {/* 头像上传 - 参考UI设计 */}
              <div className="space-y-3">
                <Label>头像</Label>

                {!avatarPreview ? (
                  /* 上传前状态 - 虚线边框上传区域 */
                  <div className="relative">
                    <input
                      type="file"
                      id="avatar-upload"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarUpload}
                      disabled={uploading}
                    />
                    <div
                      onClick={() => !uploading && document.getElementById("avatar-upload")?.click()}
                      className="border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-gray-400 transition-colors cursor-pointer bg-gray-50/30"
                    >
                      <div className="flex flex-col items-center justify-center text-center">
                        {uploading ? (
                          <>
                            <Loader2 className="h-12 w-12 text-gray-400 mb-3 animate-spin" />
                            <p className="text-sm text-gray-600 font-medium">上传中...</p>
                          </>
                        ) : (
                          <>
                            <Upload className="h-12 w-12 text-gray-400 mb-3" />
                            <p className="text-sm text-gray-700 font-medium mb-1">点击上传图片</p>
                            <p className="text-xs text-gray-500">支持 JPG、PNG、GIF 格式,大小不超过 2MB</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 上传后状态 - 显示成功提示和操作按钮 */
                  <div className="border-2 border-green-200 rounded-lg p-4 bg-green-50/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <span className="text-sm font-medium text-green-700">上传成功</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowPreview(true)}
                          className="gap-2 h-8 text-gray-700 hover:text-gray-900"
                        >
                          <Eye className="h-4 w-4" />
                          预览
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => document.getElementById("avatar-upload")?.click()}
                          disabled={uploading}
                          className="gap-2 h-8 text-gray-700 hover:text-gray-900"
                        >
                          <Upload className="h-4 w-4" />
                          重新上传
                        </Button>
                      </div>
                    </div>
                    <input
                      type="file"
                      id="avatar-upload"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarUpload}
                      disabled={uploading}
                    />
                  </div>
                )}
              </div>

              {/* 头像预览对话框 */}
              {showPreview && avatarPreview && (
                <div
                  className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                  onClick={() => setShowPreview(false)}
                >
                  <div
                    className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">头像预览</h3>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPreview(false)}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex justify-center mb-4">
                      <Avatar className="h-48 w-48 ring-2 ring-gray-200">
                        <AvatarImage src={avatarPreview} alt="头像预览" />
                        <AvatarFallback className="text-4xl bg-gray-100 text-gray-600">
                          {username?.substring(0, 2) || "头"}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowPreview(false)}
                        className="flex-1"
                      >
                        关闭
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          handleRemoveAvatar()
                          setShowPreview(false)
                        }}
                        className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        删除头像
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* 用户名 */}
              <div className="space-y-2">
                <Label htmlFor="username">
                  用户名 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.slice(0, 20))}
                  placeholder="请输入用户名"
                  maxLength={20}
                  required
                />
                <p className="text-xs text-muted-foreground">{username.length}/20</p>
              </div>

              {/* 提交按钮 */}
              <div className="flex gap-3 pt-4">
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? "保存中..." : "保存修改"}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.push("/")} disabled={loading}>
                  取消
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* 其他说明 */}
        <Card className="mt-6 bg-gray-50 border-gray-200">
          <CardContent className="p-4">
            <h4 className="font-semibold text-sm mb-2">温馨提示</h4>
            <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
              <li>用户名将在平台各处显示,请谨慎设置</li>
              <li>首次上传头像可获得 {systemSettings?.upload_avatar_reward || 30} 积分奖励</li>
              <li>请勿上传违规或不当内容</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
