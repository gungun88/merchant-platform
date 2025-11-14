"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AdminLayout } from "@/components/admin-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Settings, Save, RotateCcw, Upload, X, Image as ImageIcon, Mail, ShieldCheck, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { SensitiveWordsManager } from "@/components/admin/sensitive-words-manager"
import {
  getSystemSettings,
  updateSystemSettings,
  resetSystemSettings,
  type SystemSettings,
  type UpdateSettingsData,
} from "@/lib/actions/settings"
import { createClient } from "@/lib/supabase/client"
import { ImageCropper } from "@/components/image-cropper"

export default function SystemSettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<SystemSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingFavicon, setUploadingFavicon] = useState(false)
  const [cropperOpen, setCropperOpen] = useState(false)
  const [faviconCropperOpen, setFaviconCropperOpen] = useState(false)
  const [imageToCrop, setImageToCrop] = useState<string>("")
  const [faviconToCrop, setFaviconToCrop] = useState<string>("")

  // 表单数据
  const [formData, setFormData] = useState<UpdateSettingsData>({})

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push("/auth/login")
      return
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
      router.push("/")
      return
    }

    loadSettings()
  }

  async function loadSettings() {
    try {
      setLoading(true)
      const result = await getSystemSettings()

      if (!result.success || !result.data) {
        throw new Error(result.error || "加载设置失败")
      }

      setSettings(result.data)
      setFormData(result.data)
    } catch (error: any) {
      console.error("Error loading settings:", error)
      toast.error(error.message || "加载设置失败")
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    try {
      setSaving(true)

      // 数据验证
      if (formData.deposit_violation_platform_rate !== undefined && formData.deposit_violation_compensation_rate !== undefined) {
        const total = Number(formData.deposit_violation_platform_rate) + Number(formData.deposit_violation_compensation_rate)
        if (total !== 100) {
          toast.error("违规处罚比例之和必须等于 100%")
          return
        }
      }

      const result = await updateSystemSettings(formData)

      if (!result.success) {
        throw new Error(result.error)
      }

      toast.success("设置已保存")
      loadSettings()
    } catch (error: any) {
      console.error("Error saving settings:", error)
      toast.error(error.message || "保存失败")
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    try {
      setSaving(true)
      const result = await resetSystemSettings()

      if (!result.success) {
        throw new Error(result.error)
      }

      toast.success("已重置为默认设置")
      setResetDialogOpen(false)
      loadSettings()
    } catch (error: any) {
      console.error("Error resetting settings:", error)
      toast.error(error.message || "重置失败")
    } finally {
      setSaving(false)
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
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

    // 读取文件并打开裁剪器
    const reader = new FileReader()
    reader.onload = () => {
      setImageToCrop(reader.result as string)
      setCropperOpen(true)
    }
    reader.readAsDataURL(file)

    // 重置input以允许选择同一文件
    e.target.value = ""
  }

  async function handleCropComplete(croppedImageBlob: Blob) {
    try {
      setUploadingLogo(true)
      const supabase = createClient()

      // 生成唯一文件名
      const fileName = `logo-${Date.now()}.png`
      const filePath = `public/${fileName}`

      // 上传裁剪后的图片到 Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("platform-assets")
        .upload(filePath, croppedImageBlob, {
          cacheControl: "3600",
          upsert: false,
          contentType: "image/png",
        })

      if (uploadError) {
        throw uploadError
      }

      // 获取公开 URL
      const { data: urlData } = supabase.storage.from("platform-assets").getPublicUrl(filePath)

      if (!urlData.publicUrl) {
        throw new Error("获取图片URL失败")
      }

      // 更新表单数据
      setFormData({ ...formData, platform_logo_url: urlData.publicUrl })
      toast.success("Logo上传成功")
    } catch (error: any) {
      console.error("Error uploading logo:", error)
      toast.error(error.message || "上传失败")
    } finally {
      setUploadingLogo(false)
    }
  }

  function handleRemoveLogo() {
    setFormData({ ...formData, platform_logo_url: "" })
    toast.success("已移除Logo")
  }

  async function handleFaviconUpload(e: React.ChangeEvent<HTMLInputElement>) {
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

    // 读取文件并打开裁剪器
    const reader = new FileReader()
    reader.onload = () => {
      setFaviconToCrop(reader.result as string)
      setFaviconCropperOpen(true)
    }
    reader.readAsDataURL(file)

    // 重置input以允许选择同一文件
    e.target.value = ""
  }

  async function handleFaviconCropComplete(croppedImageBlob: Blob) {
    try {
      setUploadingFavicon(true)
      const supabase = createClient()

      // 生成唯一文件名
      const fileName = `favicon-${Date.now()}.png`
      const filePath = `public/${fileName}`

      // 上传裁剪后的图片到 Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("platform-assets")
        .upload(filePath, croppedImageBlob, {
          cacheControl: "3600",
          upsert: false,
          contentType: "image/png",
        })

      if (uploadError) {
        throw uploadError
      }

      // 获取公开 URL
      const { data: urlData } = supabase.storage.from("platform-assets").getPublicUrl(filePath)

      if (!urlData.publicUrl) {
        throw new Error("获取图片URL失败")
      }

      // 更新表单数据
      setFormData({ ...formData, site_favicon_url: urlData.publicUrl })
      toast.success("站点图标上传成功")
    } catch (error: any) {
      console.error("Error uploading favicon:", error)
      toast.error(error.message || "上传失败")
    } finally {
      setUploadingFavicon(false)
    }
  }

  function handleRemoveFavicon() {
    setFormData({ ...formData, site_favicon_url: "" })
    toast.success("已移除站点图标")
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Settings className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">加载中...</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (!settings) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">加载设置失败</p>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-4">
        {/* 页头 */}
        <div className="flex items-center justify-between pb-4 border-b">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Settings className="h-6 w-6" />
              系统设置
            </h1>
            <p className="text-sm text-muted-foreground mt-1">管理平台的全局配置和规则</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setResetDialogOpen(true)} disabled={saving}>
              <RotateCcw className="h-4 w-4 mr-2" />
              重置
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {/* 基本配置 */}
          <div>
            <h3 className="text-sm font-semibold mb-3 px-1">基本配置</h3>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">配置项</TableHead>
                    <TableHead>配置值</TableHead>
                    <TableHead className="w-[300px]">说明</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">平台名称</TableCell>
                    <TableCell>
                      <Input
                        value={formData.platform_name || ""}
                        onChange={(e) => setFormData({ ...formData, platform_name: e.target.value })}
                        className="max-w-md"
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">显示在网站标题和页面顶部</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">平台描述</TableCell>
                    <TableCell>
                      <Textarea
                        value={formData.platform_description || ""}
                        onChange={(e) => setFormData({ ...formData, platform_description: e.target.value })}
                        className="max-w-md"
                        rows={2}
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">显示在首页和关于页面</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Logo URL</TableCell>
                    <TableCell>
                      <div className="space-y-3">
                        {/* Logo预览 */}
                        {formData.platform_logo_url && (
                          <div className="flex items-center gap-3">
                            <div className="relative group">
                              <img
                                src={formData.platform_logo_url}
                                alt="Platform Logo"
                                className="h-16 w-16 object-contain border rounded-lg"
                              />
                              <button
                                type="button"
                                onClick={handleRemoveLogo}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                            <span className="text-sm text-muted-foreground">已上传</span>
                          </div>
                        )}

                        {/* 上传按钮 */}
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={uploadingLogo}
                            onClick={() => document.getElementById("logo-upload")?.click()}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            {uploadingLogo ? "上传中..." : "上传图片"}
                          </Button>
                          <input
                            id="logo-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleLogoUpload}
                          />
                          <span className="text-xs text-muted-foreground self-center">
                            支持 JPG、PNG、GIF,最大 2MB
                          </span>
                        </div>

                        {/* 或者输入URL */}
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">或输入图片URL</label>
                          <Input
                            value={formData.platform_logo_url || ""}
                            onChange={(e) => setFormData({ ...formData, platform_logo_url: e.target.value })}
                            placeholder="https://example.com/logo.png"
                            className="max-w-md"
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">平台 Logo 图片(可选)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">站点图标 (Favicon)</TableCell>
                    <TableCell>
                      <div className="space-y-3">
                        {/* Favicon 预览 */}
                        {formData.site_favicon_url && (
                          <div className="flex items-center gap-3">
                            <div className="relative group">
                              <img
                                src={formData.site_favicon_url}
                                alt="Site Favicon"
                                className="h-12 w-12 object-contain border rounded-lg"
                              />
                              <button
                                type="button"
                                onClick={handleRemoveFavicon}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                            <span className="text-sm text-muted-foreground">已上传</span>
                          </div>
                        )}

                        {/* 上传按钮 */}
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={uploadingFavicon}
                            onClick={() => document.getElementById("favicon-upload")?.click()}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            {uploadingFavicon ? "上传中..." : "上传图标"}
                          </Button>
                          <input
                            id="favicon-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFaviconUpload}
                          />
                          <span className="text-xs text-muted-foreground self-center">
                            支持 PNG、ICO、SVG，推荐 32x32 或 64x64 像素
                          </span>
                        </div>

                        {/* 或者输入URL */}
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">或输入图片URL</label>
                          <Input
                            value={formData.site_favicon_url || ""}
                            onChange={(e) => setFormData({ ...formData, site_favicon_url: e.target.value })}
                            placeholder="https://example.com/favicon.ico"
                            className="max-w-md"
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      显示在浏览器标签页、搜索引擎结果、书签等位置
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* 积分奖励规则 */}
          <div>
            <h3 className="text-sm font-semibold mb-3 px-1">积分奖励规则</h3>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">配置项</TableHead>
                    <TableHead>配置值（积分）</TableHead>
                    <TableHead className="w-[300px]">说明</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">用户注册奖励</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={formData.register_points || 0}
                        onChange={(e) => setFormData({ ...formData, register_points: Number(e.target.value) })}
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">新用户注册成功后获得的积分</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">邀请好友奖励</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={formData.invitation_points || 0}
                        onChange={(e) => setFormData({ ...formData, invitation_points: Number(e.target.value) })}
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">邀请人和被邀请人各获得的积分</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">每日签到奖励</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={formData.checkin_points || 0}
                        onChange={(e) => setFormData({ ...formData, checkin_points: Number(e.target.value) })}
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">每天签到获得的基础积分</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">连续签到 7 天奖励</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={formData.checkin_7days_bonus || 0}
                        onChange={(e) => setFormData({ ...formData, checkin_7days_bonus: Number(e.target.value) })}
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">连续签到 7 天额外奖励</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">连续签到 30 天奖励</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={formData.checkin_30days_bonus || 0}
                        onChange={(e) => setFormData({ ...formData, checkin_30days_bonus: Number(e.target.value) })}
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">连续签到 30 天额外奖励</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">商家入驻奖励</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={formData.merchant_register_points || 0}
                        onChange={(e) => setFormData({ ...formData, merchant_register_points: Number(e.target.value) })}
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">商家成功入驻后获得的积分</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">首次上传头像奖励</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={formData.upload_avatar_reward || 0}
                        onChange={(e) => setFormData({ ...formData, upload_avatar_reward: Number(e.target.value) })}
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">用户首次上传头像获得的积分</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">押金商家每日登录奖励</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={formData.deposit_merchant_daily_reward || 0}
                        onChange={(e) => setFormData({ ...formData, deposit_merchant_daily_reward: Number(e.target.value) })}
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">押金商家每天登录可领取的积分</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">押金商家审核通过奖励</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={formData.deposit_merchant_apply_reward || 0}
                        onChange={(e) => setFormData({ ...formData, deposit_merchant_apply_reward: Number(e.target.value) })}
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">押金商家审核通过后一次性奖励积分</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* 积分消耗规则 */}
          <div>
            <h3 className="text-sm font-semibold mb-3 px-1">积分消耗规则</h3>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">配置项</TableHead>
                    <TableHead>配置值（积分）</TableHead>
                    <TableHead className="w-[300px]">说明</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">用户查看联系方式</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={formData.view_contact_customer_cost || 0}
                        onChange={(e) => setFormData({ ...formData, view_contact_customer_cost: Number(e.target.value) })}
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">普通用户查看商家联系方式扣除</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">商家查看联系方式</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={formData.view_contact_merchant_cost || 0}
                        onChange={(e) => setFormData({ ...formData, view_contact_merchant_cost: Number(e.target.value) })}
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">商家查看其他商家联系方式扣除</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">被查看商家扣除</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={formData.view_contact_merchant_deduct || 0}
                        onChange={(e) => setFormData({ ...formData, view_contact_merchant_deduct: Number(e.target.value) })}
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">被查看的商家扣除的积分</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">编辑商家信息</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={formData.edit_merchant_cost || 0}
                        onChange={(e) => setFormData({ ...formData, edit_merchant_cost: Number(e.target.value) })}
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">每次修改商家信息扣除的积分</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">商家置顶费用</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={formData.merchant_top_cost_per_day || 0}
                        onChange={(e) => setFormData({ ...formData, merchant_top_cost_per_day: Number(e.target.value) })}
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">商家置顶每天消耗的积分</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* 安全配置 */}
          <div>
            <h3 className="text-sm font-semibold mb-3 px-1">安全配置</h3>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">配置项</TableHead>
                    <TableHead>配置值</TableHead>
                    <TableHead className="w-[300px]">说明</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">最大登录尝试次数</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={formData.max_login_attempts || 0}
                        onChange={(e) => setFormData({ ...formData, max_login_attempts: Number(e.target.value) })}
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">超过此次数将锁定账号</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">登录锁定时长（分钟）</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={formData.login_lockout_minutes || 0}
                        onChange={(e) => setFormData({ ...formData, login_lockout_minutes: Number(e.target.value) })}
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">账号锁定后的解锁时间</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">会话超时（小时）</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={formData.session_timeout_hours || 0}
                        onChange={(e) => setFormData({ ...formData, session_timeout_hours: Number(e.target.value) })}
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">用户登录后多久自动退出</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* 邮箱验证配置 */}
          <div>
            <h3 className="text-sm font-semibold mb-3 px-1 flex items-center gap-2">
              <Mail className="h-4 w-4" />
              邮箱验证配置
            </h3>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">配置项</TableHead>
                    <TableHead>配置值</TableHead>
                    <TableHead className="w-[300px]">说明</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">启用邮箱验证</TableCell>
                    <TableCell>
                      <Switch
                        checked={formData.email_validation_enabled ?? true}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, email_validation_enabled: checked })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      开启后将验证注册时的邮箱域名
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">验证模式</TableCell>
                    <TableCell>
                      <Select
                        value={formData.email_validation_mode || 'both'}
                        onValueChange={(value) =>
                          setFormData({ ...formData, email_validation_mode: value as any })
                        }
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="选择验证模式" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="whitelist">白名单模式</SelectItem>
                          <SelectItem value="blacklist">黑名单模式</SelectItem>
                          <SelectItem value="both">混合模式（推荐）</SelectItem>
                          <SelectItem value="disabled">禁用验证</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      whitelist=仅白名单，blacklist=仅黑名单，both=同时检查
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium align-top pt-4">
                      允许的邮箱域名
                      <br />
                      <span className="text-xs text-muted-foreground">(白名单)</span>
                    </TableCell>
                    <TableCell>
                      <Textarea
                        value={
                          Array.isArray(formData.email_allowed_domains)
                            ? formData.email_allowed_domains.join('\n')
                            : ''
                        }
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            email_allowed_domains: e.target.value.split('\n').filter((d) => d.trim()),
                          })
                        }
                        className="font-mono text-sm h-32"
                        placeholder="gmail.com&#10;qq.com&#10;163.com"
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground align-top pt-4">
                      每行一个域名，如 gmail.com
                      <br />
                      仅在白名单或混合模式下生效
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium align-top pt-4">
                      禁止的邮箱域名
                      <br />
                      <span className="text-xs text-muted-foreground">(黑名单)</span>
                    </TableCell>
                    <TableCell>
                      <Textarea
                        value={
                          Array.isArray(formData.email_blocked_domains)
                            ? formData.email_blocked_domains.join('\n')
                            : ''
                        }
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            email_blocked_domains: e.target.value.split('\n').filter((d) => d.trim()),
                          })
                        }
                        className="font-mono text-sm h-32"
                        placeholder="tempmail.com&#10;10minutemail.com&#10;guerrillamail.com"
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground align-top pt-4">
                      每行一个域名，用于阻止临时邮箱
                      <br />
                      仅在黑名单或混合模式下生效
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* 联系方式配置 */}
          <div>
            <h3 className="text-sm font-semibold mb-3 px-1">平台联系方式</h3>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">配置项</TableHead>
                    <TableHead>配置值</TableHead>
                    <TableHead className="w-[300px]">说明</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">客服邮箱</TableCell>
                    <TableCell>
                      <Input
                        type="email"
                        value={formData.support_email || ""}
                        onChange={(e) => setFormData({ ...formData, support_email: e.target.value })}
                        placeholder="support@example.com"
                        className="max-w-md"
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">用户可通过邮箱联系客服</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">客服微信</TableCell>
                    <TableCell>
                      <Input
                        value={formData.support_wechat || ""}
                        onChange={(e) => setFormData({ ...formData, support_wechat: e.target.value })}
                        placeholder="WeChat ID"
                        className="max-w-md"
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">微信号或二维码链接</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">客服 Telegram</TableCell>
                    <TableCell>
                      <Input
                        value={formData.support_telegram || ""}
                        onChange={(e) => setFormData({ ...formData, support_telegram: e.target.value })}
                        placeholder="@telegram_username"
                        className="max-w-md"
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">Telegram 用户名或链接</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">客服 WhatsApp</TableCell>
                    <TableCell>
                      <Input
                        value={formData.support_whatsapp || ""}
                        onChange={(e) => setFormData({ ...formData, support_whatsapp: e.target.value })}
                        placeholder="+86 123 4567 8900"
                        className="max-w-md"
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">WhatsApp 号码</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* 敏感词管理 */}
          <div>
            <div className="flex items-center gap-2 mb-3 px-1">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <h3 className="text-sm font-semibold">敏感词过滤</h3>
            </div>
            <div className="border rounded-lg p-4">
              <SensitiveWordsManager
                initialWords={formData.sensitive_words || []}
                onUpdate={loadSettings}
              />
            </div>
          </div>
        </div>

        {/* 底部保存按钮 */}
        <div className="flex justify-end gap-2 pt-4 border-t sticky bottom-0 bg-background">
          <Button variant="outline" onClick={() => setResetDialogOpen(true)} disabled={saving}>
            <RotateCcw className="h-4 w-4 mr-2" />
            重置默认
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "保存中..." : "保存所有设置"}
          </Button>
        </div>
      </div>

      {/* 重置确认对话框 */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认重置设置？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将把所有设置恢复为默认值，包括积分规则、押金配置等。此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset} disabled={saving}>
              {saving ? "重置中..." : "确认重置"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 图片裁剪器 - Logo */}
      <ImageCropper
        image={imageToCrop}
        open={cropperOpen}
        onClose={() => setCropperOpen(false)}
        onCropComplete={handleCropComplete}
        aspectRatio={1}
      />

      {/* 图片裁剪器 - Favicon */}
      <ImageCropper
        image={faviconToCrop}
        open={faviconCropperOpen}
        onClose={() => setFaviconCropperOpen(false)}
        onCropComplete={handleFaviconCropComplete}
        aspectRatio={1}
      />
    </AdminLayout>
  )
}
