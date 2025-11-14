"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AdminLayout } from "@/components/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  Megaphone,
  Plus,
  Edit,
  Trash2,
  Eye,
  Pin,
  Users,
  Info,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react"
import { toast } from "sonner"
import {
  getAllAnnouncements,
  getAnnouncementStats,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  type Announcement,
  type CreateAnnouncementData,
} from "@/lib/actions/announcements"
import { createClient } from "@/lib/supabase/client"

export default function AnnouncementsPage() {
  const router = useRouter()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    pinned: 0,
  })
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)

  // 对话框状态
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null)

  // 表单状态
  const [formData, setFormData] = useState<CreateAnnouncementData>({
    title: "",
    content: "",
    type: "info",
    priority: 0,
    is_active: true,
    is_pinned: false,
    target_audience: "all",
    start_date: "",
    end_date: "",
  })
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [filterStatus, searchTerm])

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
      const [announcementsResult, statsData] = await Promise.all([
        getAllAnnouncements(),
        getAnnouncementStats(),
      ])

      if (!announcementsResult.success) {
        throw new Error(announcementsResult.error)
      }

      setAnnouncements(announcementsResult.data)
      setStats(statsData)
    } catch (error: any) {
      console.error("Error loading data:", error)
      toast.error(error.message || "加载数据失败")
    } finally {
      setLoading(false)
    }
  }

  function handleCreate() {
    setFormData({
      title: "",
      content: "",
      type: "info",
      priority: 0,
      is_active: true,
      is_pinned: false,
      target_audience: "all",
      start_date: "",
      end_date: "",
    })
    setCreateDialogOpen(true)
  }

  function handleEdit(announcement: Announcement) {
    setSelectedAnnouncement(announcement)
    setFormData({
      title: announcement.title,
      content: announcement.content,
      type: announcement.type,
      priority: announcement.priority,
      is_active: announcement.is_active,
      is_pinned: announcement.is_pinned,
      target_audience: announcement.target_audience,
      start_date: announcement.start_date ? announcement.start_date.split("T")[0] : "",
      end_date: announcement.end_date ? announcement.end_date.split("T")[0] : "",
    })
    setEditDialogOpen(true)
  }

  function handleDeleteClick(announcement: Announcement) {
    setSelectedAnnouncement(announcement)
    setDeleteDialogOpen(true)
  }

  function handleViewDetail(announcement: Announcement) {
    setSelectedAnnouncement(announcement)
    setDetailDialogOpen(true)
  }

  async function handleSubmitCreate() {
    if (!formData.title.trim()) {
      toast.error("请填写公告标题")
      return
    }

    if (!formData.content.trim()) {
      toast.error("请填写公告内容")
      return
    }

    try {
      setProcessing(true)
      const result = await createAnnouncement(formData)

      if (!result.success) {
        throw new Error(result.error)
      }

      toast.success("公告创建成功")
      setCreateDialogOpen(false)
      await loadData()
    } catch (error: any) {
      console.error("Error creating announcement:", error)
      toast.error(error.message || "创建失败")
    } finally {
      setProcessing(false)
    }
  }

  async function handleSubmitEdit() {
    if (!selectedAnnouncement) return

    if (!formData.title.trim()) {
      toast.error("请填写公告标题")
      return
    }

    if (!formData.content.trim()) {
      toast.error("请填写公告内容")
      return
    }

    try {
      setProcessing(true)
      const result = await updateAnnouncement({
        id: selectedAnnouncement.id,
        ...formData,
      })

      if (!result.success) {
        throw new Error(result.error)
      }

      toast.success("公告更新成功")
      setEditDialogOpen(false)
      await loadData()
    } catch (error: any) {
      console.error("Error updating announcement:", error)
      toast.error(error.message || "更新失败")
    } finally {
      setProcessing(false)
    }
  }

  async function handleDelete() {
    if (!selectedAnnouncement) return

    try {
      setProcessing(true)
      const result = await deleteAnnouncement(selectedAnnouncement.id)

      if (!result.success) {
        throw new Error(result.error)
      }

      toast.success("公告删除成功")
      setDeleteDialogOpen(false)
      await loadData()
    } catch (error: any) {
      console.error("Error deleting announcement:", error)
      toast.error(error.message || "删除失败")
    } finally {
      setProcessing(false)
    }
  }

  // 过滤公告列表
  const filteredAnnouncements = announcements.filter((announcement) => {
    if (filterStatus === "active" && !announcement.is_active) return false
    if (filterStatus === "inactive" && announcement.is_active) return false
    if (filterStatus === "pinned" && !announcement.is_pinned) return false

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      return (
        announcement.title.toLowerCase().includes(term) ||
        announcement.content.toLowerCase().includes(term)
      )
    }

    return true
  })

  // 分页计算
  const totalPages = Math.ceil(filteredAnnouncements.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const currentAnnouncements = filteredAnnouncements.slice(startIndex, endIndex)

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "info":
        return <Info className="h-3 w-3" />
      case "warning":
        return <AlertTriangle className="h-3 w-3" />
      case "success":
        return <CheckCircle className="h-3 w-3" />
      case "error":
        return <XCircle className="h-3 w-3" />
      case "update":
        return <Clock className="h-3 w-3" />
      default:
        return <Info className="h-3 w-3" />
    }
  }

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case "info":
        return "border-blue-300 bg-blue-50 text-blue-700"
      case "warning":
        return "border-amber-300 bg-amber-50 text-amber-700"
      case "success":
        return "border-green-300 bg-green-50 text-green-700"
      case "error":
        return "border-red-300 bg-red-50 text-red-700"
      case "update":
        return "border-purple-300 bg-purple-50 text-purple-700"
      default:
        return "border-gray-300 bg-gray-50 text-gray-700"
    }
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      info: "信息",
      warning: "警告",
      success: "成功",
      error: "错误",
      update: "更新",
    }
    return labels[type] || type
  }

  const getAudienceLabel = (audience: string) => {
    const labels: Record<string, string> = {
      all: "所有人",
      users: "普通用户",
      merchants: "商家",
      partners: "合作伙伴",
    }
    return labels[audience] || audience
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-3xl font-bold">公告管理</h1>
          <p className="text-muted-foreground mt-1">创建和管理系统公告</p>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                总公告数
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                激活中
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                未激活
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">{stats.inactive}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                已置顶
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.pinned}</div>
            </CardContent>
          </Card>
        </div>

        {/* 公告列表 */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <CardTitle>公告列表</CardTitle>
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                创建公告
              </Button>
            </div>
            {/* 筛选和搜索 */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">状态:</span>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部</SelectItem>
                      <SelectItem value="active">激活中</SelectItem>
                      <SelectItem value="inactive">未激活</SelectItem>
                      <SelectItem value="pinned">已置顶</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">搜索:</span>
                  <Input
                    placeholder="标题或内容..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-[200px]"
                  />
                </div>
              </div>
              <Button onClick={loadData} variant="outline" size="sm">
                刷新数据
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">加载中...</p>
              </div>
            ) : currentAnnouncements.length === 0 ? (
              <div className="text-center py-12">
                <Megaphone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">暂无公告</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>标题</TableHead>
                        <TableHead>类型</TableHead>
                        <TableHead>目标受众</TableHead>
                        <TableHead>优先级</TableHead>
                        <TableHead>点击量</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>创建时间</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentAnnouncements.map((announcement) => (
                        <TableRow key={announcement.id}>
                          {/* 标题列 */}
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {announcement.is_pinned && (
                                <Pin className="h-4 w-4 text-purple-600" />
                              )}
                              <span className="font-medium">
                                {announcement.title}
                              </span>
                            </div>
                          </TableCell>
                          {/* 类型列 */}
                          <TableCell>
                            <Badge variant="outline" className={getTypeBadgeClass(announcement.type)}>
                              {getTypeIcon(announcement.type)}
                              <span className="ml-1">{getTypeLabel(announcement.type)}</span>
                            </Badge>
                          </TableCell>
                          {/* 目标受众列 */}
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{getAudienceLabel(announcement.target_audience)}</span>
                            </div>
                          </TableCell>
                          {/* 优先级列 */}
                          <TableCell>
                            <Badge variant="outline">{announcement.priority}</Badge>
                          </TableCell>
                          {/* 点击量列 */}
                          <TableCell>
                            <span className="text-sm">{announcement.click_count}</span>
                          </TableCell>
                          {/* 状态列 */}
                          <TableCell>
                            {announcement.is_active ? (
                              <Badge variant="outline" className="border-green-300 bg-green-50 text-green-700">
                                激活中
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-gray-300 bg-gray-50 text-gray-700">
                                未激活
                              </Badge>
                            )}
                          </TableCell>
                          {/* 创建时间列 */}
                          <TableCell>
                            <p className="text-sm whitespace-nowrap">
                              {new Date(announcement.created_at).toLocaleDateString("zh-CN")}
                            </p>
                          </TableCell>
                          {/* 操作列 */}
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleViewDetail(announcement)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEdit(announcement)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleDeleteClick(announcement)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* 分页控件 */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      显示 {startIndex + 1} - {Math.min(endIndex, filteredAnnouncements.length)} 条，共{" "}
                      {filteredAnnouncements.length} 条
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        上一页
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className="w-9"
                          >
                            {page}
                          </Button>
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        下一页
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 创建公告对话框 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>创建公告</DialogTitle>
            <DialogDescription>填写公告信息</DialogDescription>
          </DialogHeader>
          <AnnouncementForm
            formData={formData}
            setFormData={setFormData}
            getTypeLabel={getTypeLabel}
            getAudienceLabel={getAudienceLabel}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={processing}>
              取消
            </Button>
            <Button onClick={handleSubmitCreate} disabled={processing}>
              {processing ? "创建中..." : "确认创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑公告对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑公告</DialogTitle>
            <DialogDescription>修改公告信息</DialogDescription>
          </DialogHeader>
          <AnnouncementForm
            formData={formData}
            setFormData={setFormData}
            getTypeLabel={getTypeLabel}
            getAudienceLabel={getAudienceLabel}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={processing}>
              取消
            </Button>
            <Button onClick={handleSubmitEdit} disabled={processing}>
              {processing ? "保存中..." : "确认保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除公告</DialogTitle>
            <DialogDescription>
              确认要删除公告【{selectedAnnouncement?.title}】吗？此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={processing}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={processing}>
              {processing ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 详情对话框 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>公告详情</DialogTitle>
          </DialogHeader>
          {selectedAnnouncement && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">标题</Label>
                <p className="font-medium mt-1">{selectedAnnouncement.title}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">内容</Label>
                <p className="mt-1 whitespace-pre-wrap">{selectedAnnouncement.content}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">类型</Label>
                  <p className="mt-1">{getTypeLabel(selectedAnnouncement.type)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">目标受众</Label>
                  <p className="mt-1">{getAudienceLabel(selectedAnnouncement.target_audience)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">优先级</Label>
                  <p className="mt-1">{selectedAnnouncement.priority}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">点击次数</Label>
                  <p className="mt-1">{selectedAnnouncement.click_count}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">激活状态</Label>
                  <p className="mt-1">{selectedAnnouncement.is_active ? "已激活" : "未激活"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">置顶状态</Label>
                  <p className="mt-1">{selectedAnnouncement.is_pinned ? "已置顶" : "未置顶"}</p>
                </div>
                {selectedAnnouncement.start_date && (
                  <div>
                    <Label className="text-muted-foreground">开始时间</Label>
                    <p className="mt-1">
                      {new Date(selectedAnnouncement.start_date).toLocaleString("zh-CN")}
                    </p>
                  </div>
                )}
                {selectedAnnouncement.end_date && (
                  <div>
                    <Label className="text-muted-foreground">结束时间</Label>
                    <p className="mt-1">
                      {new Date(selectedAnnouncement.end_date).toLocaleString("zh-CN")}
                    </p>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground">创建时间</Label>
                  <p className="mt-1">
                    {new Date(selectedAnnouncement.created_at).toLocaleString("zh-CN")}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">更新时间</Label>
                  <p className="mt-1">
                    {new Date(selectedAnnouncement.updated_at).toLocaleString("zh-CN")}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}

// 公告表单组件
function AnnouncementForm({
  formData,
  setFormData,
  getTypeLabel,
  getAudienceLabel,
}: {
  formData: CreateAnnouncementData
  setFormData: (data: CreateAnnouncementData) => void
  getTypeLabel: (type: string) => string
  getAudienceLabel: (audience: string) => string
}) {
  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="title">
          标题 <span className="text-red-500">*</span>
        </Label>
        <Input
          id="title"
          placeholder="请输入公告标题"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="content">
          内容 <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="content"
          placeholder="请输入公告内容"
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          rows={6}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type">类型</Label>
          <Select
            value={formData.type}
            onValueChange={(value: any) => setFormData({ ...formData, type: value })}
          >
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="info">{getTypeLabel("info")}</SelectItem>
              <SelectItem value="warning">{getTypeLabel("warning")}</SelectItem>
              <SelectItem value="success">{getTypeLabel("success")}</SelectItem>
              <SelectItem value="error">{getTypeLabel("error")}</SelectItem>
              <SelectItem value="update">{getTypeLabel("update")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="target_audience">目标受众</Label>
          <Select
            value={formData.target_audience}
            onValueChange={(value: any) => setFormData({ ...formData, target_audience: value })}
          >
            <SelectTrigger id="target_audience">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{getAudienceLabel("all")}</SelectItem>
              <SelectItem value="users">{getAudienceLabel("users")}</SelectItem>
              <SelectItem value="merchants">{getAudienceLabel("merchants")}</SelectItem>
              <SelectItem value="partners">{getAudienceLabel("partners")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="priority">优先级 (0-10)</Label>
        <Input
          id="priority"
          type="number"
          min="0"
          max="10"
          value={formData.priority}
          onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start_date">开始显示时间（可选）</Label>
          <Input
            id="start_date"
            type="date"
            value={formData.start_date}
            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="end_date">结束显示时间（可选）</Label>
          <Input
            id="end_date"
            type="date"
            value={formData.end_date}
            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Switch
            id="is_active"
            checked={formData.is_active}
            onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
          />
          <Label htmlFor="is_active">激活公告</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="is_pinned"
            checked={formData.is_pinned}
            onCheckedChange={(checked) => setFormData({ ...formData, is_pinned: checked })}
          />
          <Label htmlFor="is_pinned">置顶公告</Label>
        </div>
      </div>
    </div>
  )
}
