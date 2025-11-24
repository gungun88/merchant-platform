"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AdminLayout } from "@/components/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import {
  Image as ImageIcon,
  Plus,
  Edit,
  Trash2,
  Eye,
  LayoutGrid,
  ArrowUpDown,
} from "lucide-react"
import { toast } from "sonner"
import {
  getAllBanners,
  getBannerStats,
  createBanner,
  updateBanner,
  deleteBanner,
  disableExpiredBanners,
  type CreateBannerData,
  type UpdateBannerData,
} from "@/lib/actions/banners"
import { uploadBannerImage } from "@/lib/actions/upload"
import type { Banner, BannerPosition } from "@/lib/types/database"
import { createClient } from "@/lib/supabase/client"
import Image from "next/image"

const POSITION_LABELS = {
  left: "左侧轮播",
  middle: "中间栏",
  right: "右侧轮播",
}

export default function BannersPage() {
  const router = useRouter()
  const [banners, setBanners] = useState<Banner[]>([])
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    byPosition: {
      left: 0,
      middle_top: 0,
      middle_bottom: 0,
      right: 0,
    },
  })
  const [loading, setLoading] = useState(true)
  const [filterPosition, setFilterPosition] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")

  // 对话框状态
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [selectedBanner, setSelectedBanner] = useState<Banner | null>(null)

  // 表单状态
  const [formData, setFormData] = useState<CreateBannerData>({
    position: "left",
    image_url: "",
    link_url: "",
    sort_order: 0,
    is_active: true,
    expires_at: null,
  })
  const [processing, setProcessing] = useState(false)
  const [uploading, setUploading] = useState(false)

  // 获取当前时间的最小日期时间（用于日期选择器的min属性）
  const getMinDateTime = () => {
    const now = new Date()
    // 转换为本地时间字符串格式 YYYY-MM-DDTHH:mm
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  // 将UTC时间转换为本地datetime-local格式
  const toLocalDateTimeString = (isoString: string) => {
    const date = new Date(isoString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  // 将本地datetime-local值转换为UTC ISO字符串
  const toUTCISOString = (localString: string) => {
    if (!localString) return null
    // datetime-local的值被当作本地时间，直接创建Date对象会自动转换为UTC
    const localDate = new Date(localString)
    return localDate.toISOString()
  }

  useEffect(() => {
    checkAuth()
    // 定期检查过期广告
    const interval = setInterval(async () => {
      await disableExpiredBanners()
    }, 60000) // 每分钟检查一次

    return () => clearInterval(interval)
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

    if (!profile || profile.role !== "admin") {
      router.push("/")
      return
    }

    loadData()
  }

  async function loadData() {
    try {
      setLoading(true)
      const [bannersResult, statsData] = await Promise.all([
        getAllBanners(),
        getBannerStats(),
      ])

      if (!bannersResult.success) {
        throw new Error(bannersResult.error)
      }

      setBanners(bannersResult.data)
      setStats(statsData)
    } catch (error: any) {
      console.error("Error loading data:", error)
      toast.error(error.message || "加载数据失败")
    } finally {
      setLoading(false)
    }
  }

  // 筛选Banner
  const filteredBanners = banners.filter((banner) => {
    if (filterPosition !== "all" && banner.position !== filterPosition) return false
    if (filterStatus === "active" && !banner.is_active) return false
    if (filterStatus === "inactive" && banner.is_active) return false
    return true
  })

  // 打开创建对话框
  function openCreateDialog() {
    setFormData({
      position: "left",
      image_url: "",
      link_url: "",
      sort_order: 0,
      is_active: true,
      expires_at: null,
    })
    setCreateDialogOpen(true)
  }

  // 打开编辑对话框
  function openEditDialog(banner: Banner) {
    setSelectedBanner(banner)
    setFormData({
      position: banner.position,
      image_url: banner.image_url,
      link_url: banner.link_url || "",
      sort_order: banner.sort_order,
      is_active: banner.is_active,
      expires_at: banner.expires_at,
    })
    setEditDialogOpen(true)
  }

  // 打开删除确认对话框
  function openDeleteDialog(banner: Banner) {
    setSelectedBanner(banner)
    setDeleteDialogOpen(true)
  }

  // 打开预览对话框
  function openPreviewDialog(banner: Banner) {
    setSelectedBanner(banner)
    setPreviewDialogOpen(true)
  }

  // 创建Banner
  async function handleCreate() {
    if (!formData.image_url) {
      toast.error("请输入图片URL")
      return
    }

    setProcessing(true)
    try {
      const result = await createBanner(formData)

      if (!result.success) {
        throw new Error(result.error)
      }

      toast.success("创建成功")
      setCreateDialogOpen(false)
      loadData()
    } catch (error: any) {
      console.error("Error creating banner:", error)
      toast.error(error.message || "创建失败")
    } finally {
      setProcessing(false)
    }
  }

  // 更新Banner
  async function handleUpdate() {
    if (!selectedBanner) return

    if (!formData.image_url) {
      toast.error("请输入图片URL")
      return
    }

    setProcessing(true)
    try {
      const updateData: UpdateBannerData = {
        id: selectedBanner.id,
        ...formData,
      }

      const result = await updateBanner(updateData)

      if (!result.success) {
        throw new Error(result.error)
      }

      toast.success("更新成功")
      setEditDialogOpen(false)
      loadData()
    } catch (error: any) {
      console.error("Error updating banner:", error)
      toast.error(error.message || "更新失败")
    } finally {
      setProcessing(false)
    }
  }

  // 删除Banner
  async function handleDelete() {
    if (!selectedBanner) return

    setProcessing(true)
    try {
      const result = await deleteBanner(selectedBanner.id)

      if (!result.success) {
        throw new Error(result.error)
      }

      toast.success("删除成功")
      setDeleteDialogOpen(false)
      loadData()
    } catch (error: any) {
      console.error("Error deleting banner:", error)
      toast.error(error.message || "删除失败")
    } finally {
      setProcessing(false)
    }
  }

  // 快速切换激活状态
  async function toggleActive(banner: Banner) {
    try {
      const result = await updateBanner({
        id: banner.id,
        is_active: !banner.is_active,
      })

      if (!result.success) {
        throw new Error(result.error)
      }

      toast.success(banner.is_active ? "已禁用" : "已激活")
      loadData()
    } catch (error: any) {
      console.error("Error toggling active:", error)
      toast.error(error.message || "操作失败")
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* 页头 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">广告图管理</h1>
            <p className="text-muted-foreground mt-1">管理首页广告Banner图片</p>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            新增广告图
          </Button>
        </div>

        {/* 统计卡片 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总广告数</CardTitle>
              <LayoutGrid className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">激活中</CardTitle>
              <Eye className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">已禁用</CardTitle>
              <Eye className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">{stats.inactive}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">左侧轮播</CardTitle>
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.byPosition.left}</div>
            </CardContent>
          </Card>
        </div>

        {/* Banner列表 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>广告列表</CardTitle>
              <div className="flex items-center gap-4">
                {/* 筛选器 */}
                <div className="flex items-center gap-2">
                  <Select value={filterPosition} onValueChange={setFilterPosition}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="位置筛选" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部位置</SelectItem>
                      <SelectItem value="left">左侧轮播</SelectItem>
                      <SelectItem value="middle">中间栏</SelectItem>
                      <SelectItem value="right">右侧轮播</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="状态筛选" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部状态</SelectItem>
                      <SelectItem value="active">激活中</SelectItem>
                      <SelectItem value="inactive">已禁用</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* 全局启用/关闭按钮 */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const allActive = banners.every((b) => b.is_active)
                    const updates = banners.map((b) =>
                      updateBanner({ id: b.id, is_active: !allActive })
                    )
                    await Promise.all(updates)
                    loadData()
                    toast.success(allActive ? "已全部禁用" : "已全部启用")
                  }}
                >
                  {banners.every((b) => b.is_active) ? "全部禁用" : "全部启用"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">加载中...</div>
            ) : filteredBanners.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                暂无广告数据
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>预览</TableHead>
                    <TableHead>位置</TableHead>
                    <TableHead>链接</TableHead>
                    <TableHead>排序</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>到期时间</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBanners.map((banner) => (
                    <TableRow key={banner.id}>
                      <TableCell>
                        <div
                          className="w-20 h-12 relative rounded overflow-hidden cursor-pointer hover:opacity-80"
                          onClick={() => openPreviewDialog(banner)}
                        >
                          <Image
                            src={banner.image_url}
                            alt="Banner"
                            fill
                            className="object-cover"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {POSITION_LABELS[banner.position]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {banner.link_url ? (
                          <a
                            href={banner.link_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-sm truncate max-w-[200px] block"
                          >
                            {banner.link_url}
                          </a>
                        ) : (
                          <span className="text-gray-400 text-sm">未设置</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{banner.sort_order}</Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={banner.is_active}
                          onCheckedChange={() => toggleActive(banner)}
                        />
                      </TableCell>
                      <TableCell>
                        {banner.expires_at ? (
                          <div className="text-sm">
                            {new Date(banner.expires_at).toLocaleDateString("zh-CN")}
                            {new Date(banner.expires_at) < new Date() && (
                              <Badge variant="destructive" className="ml-2">
                                已过期
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">永久</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(banner.created_at).toLocaleDateString("zh-CN")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openPreviewDialog(banner)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(banner)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openDeleteDialog(banner)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* 创建对话框 */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>新增广告图</DialogTitle>
              <DialogDescription>
                添加新的广告Banner图片
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>位置 *</Label>
                <Select
                  value={formData.position}
                  onValueChange={(value) =>
                    setFormData({ ...formData, position: value as BannerPosition })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">左侧轮播</SelectItem>
                    <SelectItem value="middle">中间栏</SelectItem>
                    <SelectItem value="right">右侧轮播</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>图片上传 *</Label>
                <Input
                  type="file"
                  accept="image/*"
                  disabled={uploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return

                    setUploading(true)
                    try {
                      // 读取文件为base64
                      const reader = new FileReader()
                      reader.onload = async (event) => {
                        const base64Data = event.target?.result as string

                        // 上传到Supabase Storage
                        const result = await uploadBannerImage(base64Data, file.name)

                        if (result.success && result.url) {
                          setFormData({ ...formData, image_url: result.url })
                          toast.success("图片上传成功")
                        } else {
                          toast.error(result.error || "图片上传失败")
                        }
                        setUploading(false)
                      }
                      reader.readAsDataURL(file)
                    } catch (error: any) {
                      toast.error(error.message || "图片上传失败")
                      setUploading(false)
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {uploading ? "上传中..." : (
                    <>
                      推荐尺寸：
                      {formData.position === 'left' && '左侧轮播 800×400 或更高分辨率'}
                      {formData.position === 'middle' && '中间栏 400×180 或更高分辨率'}
                      {formData.position === 'right' && '右侧轮播 600×400 或更高分辨率'}
                    </>
                  )}
                </p>
                {formData.image_url && !uploading && (
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                    <p className="text-xs text-green-700">✓ 图片已上传</p>
                  </div>
                )}
              </div>
              <div>
                <Label>跳转链接</Label>
                <Input
                  value={formData.link_url}
                  onChange={(e) =>
                    setFormData({ ...formData, link_url: e.target.value })
                  }
                  placeholder="https://example.com"
                />
              </div>
              <div>
                <Label>到期时间</Label>
                <Input
                  type="datetime-local"
                  min={getMinDateTime()}
                  value={
                    formData.expires_at
                      ? toLocalDateTimeString(formData.expires_at)
                      : ""
                  }
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      expires_at: toUTCISOString(e.target.value),
                    })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  留空则永久有效，到期后广告将自动禁用
                </p>
              </div>
              <div>
                <Label>排序顺序</Label>
                <Input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      sort_order: parseInt(e.target.value) || 0,
                    })
                  }
                  placeholder="0"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
                <Label>立即激活</Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
              >
                取消
              </Button>
              <Button onClick={handleCreate} disabled={processing}>
                {processing ? "创建中..." : "创建"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 编辑对话框 */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>编辑广告图</DialogTitle>
              <DialogDescription>
                修改广告Banner信息
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>位置 *</Label>
                <Select
                  value={formData.position}
                  onValueChange={(value) =>
                    setFormData({ ...formData, position: value as BannerPosition })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">左侧轮播</SelectItem>
                    <SelectItem value="middle">中间栏</SelectItem>
                    <SelectItem value="right">右侧轮播</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>图片上传 *</Label>
                <Input
                  type="file"
                  accept="image/*"
                  disabled={uploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return

                    setUploading(true)
                    try {
                      // 读取文件为base64
                      const reader = new FileReader()
                      reader.onload = async (event) => {
                        const base64Data = event.target?.result as string

                        // 上传到Supabase Storage
                        const result = await uploadBannerImage(base64Data, file.name)

                        if (result.success && result.url) {
                          setFormData({ ...formData, image_url: result.url })
                          toast.success("图片上传成功")
                        } else {
                          toast.error(result.error || "图片上传失败")
                        }
                        setUploading(false)
                      }
                      reader.readAsDataURL(file)
                    } catch (error: any) {
                      toast.error(error.message || "图片上传失败")
                      setUploading(false)
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {uploading ? "上传中..." : (
                    <>
                      推荐尺寸：
                      {formData.position === 'left' && '左侧轮播 800×400 或更高分辨率'}
                      {formData.position === 'middle' && '中间栏 400×180 或更高分辨率'}
                      {formData.position === 'right' && '右侧轮播 600×400 或更高分辨率'}
                    </>
                  )}
                </p>
                {formData.image_url && !uploading && (
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                    <p className="text-xs text-green-700">✓ 图片已上传</p>
                  </div>
                )}
              </div>
              <div>
                <Label>跳转链接</Label>
                <Input
                  value={formData.link_url}
                  onChange={(e) =>
                    setFormData({ ...formData, link_url: e.target.value })
                  }
                  placeholder="https://example.com"
                />
              </div>
              <div>
                <Label>到期时间</Label>
                <Input
                  type="datetime-local"
                  min={getMinDateTime()}
                  value={
                    formData.expires_at
                      ? toLocalDateTimeString(formData.expires_at)
                      : ""
                  }
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      expires_at: toUTCISOString(e.target.value),
                    })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  留空则永久有效，到期后广告将自动禁用
                </p>
              </div>
              <div>
                <Label>排序顺序</Label>
                <Input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      sort_order: parseInt(e.target.value) || 0,
                    })
                  }
                  placeholder="0"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
                <Label>激活显示</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleUpdate} disabled={processing}>
                {processing ? "更新中..." : "更新"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 删除确认对话框 */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>确认删除</DialogTitle>
              <DialogDescription>
                确定要删除这个广告图吗？此操作无法撤销。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={processing}
              >
                {processing ? "删除中..." : "删除"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 预览对话框 */}
        <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>广告预览</DialogTitle>
            </DialogHeader>
            {selectedBanner && (
              <div className="space-y-4">
                <div className="relative w-full h-96 rounded-lg overflow-hidden">
                  <Image
                    src={selectedBanner.image_url}
                    alt={selectedBanner.title || "Banner"}
                    fill
                    className="object-contain"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">位置：</span>
                    {POSITION_LABELS[selectedBanner.position]}
                  </div>
                  <div>
                    <span className="font-medium">状态：</span>
                    {selectedBanner.is_active ? "激活中" : "已禁用"}
                  </div>
                  {selectedBanner.title && (
                    <div className="col-span-2">
                      <span className="font-medium">标题：</span>
                      {selectedBanner.title}
                    </div>
                  )}
                  {selectedBanner.description && (
                    <div className="col-span-2">
                      <span className="font-medium">描述：</span>
                      {selectedBanner.description}
                    </div>
                  )}
                  {selectedBanner.link_url && (
                    <div className="col-span-2">
                      <span className="font-medium">链接：</span>
                      <a
                        href={selectedBanner.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline ml-2"
                      >
                        {selectedBanner.link_url}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setPreviewDialogOpen(false)}>关闭</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  )
}
