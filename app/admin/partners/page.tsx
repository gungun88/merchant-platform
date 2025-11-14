"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
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
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  Handshake,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  Eye,
  Trash2,
  ArrowUpDown,
  MessageSquare,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Partner {
  id: string
  name: string
  logo_url: string | null
  website_url: string
  description: string | null
  status: "pending" | "approved" | "rejected"
  created_by: string
  created_at: string
  updated_at: string
  approved_at: string | null
  approved_by: string | null
  rejection_reason: string | null
  sort_order: number
  // 订阅相关字段
  duration_years: number
  annual_fee: number
  total_amount: number
  payment_proof_url: string | null
  transaction_hash: string | null
  expires_at: string | null
  // 关联数据
  created_by_profile?: {
    username: string
    id: string
  }
  created_by_email?: string
}

interface Stats {
  total: number
  pending: number
  approved: number
  rejected: number
}

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [stats, setStats] = useState<Stats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  })
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [searchEmail, setSearchEmail] = useState("")

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)

  // 审核对话框
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null)
  const [reviewAction, setReviewAction] = useState<"approve" | "reject">("approve")
  const [rejectionReason, setRejectionReason] = useState("")
  const [sortOrder, setSortOrder] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  // 查看详情对话框
  const [viewDialogOpen, setViewDialogOpen] = useState(false)

  // 备注对话框
  const [notesDialogOpen, setNotesDialogOpen] = useState(false)
  const [currentNotes, setCurrentNotes] = useState("")
  const [savingNotes, setSavingNotes] = useState(false)

  // 加载合作伙伴数据
  useEffect(() => {
    loadPartners()
    setCurrentPage(1) // 切换筛选时重置到第一页
  }, [filterStatus])

  // 邮箱搜索时重置到第一页
  useEffect(() => {
    setCurrentPage(1)
  }, [searchEmail])

  async function loadPartners() {
    try {
      setLoading(true)
      const supabase = createClient()

      // 构建查询 - 不使用外键关联，分别查询
      let query = supabase
        .from("partners")
        .select("*")
        .order("created_at", { ascending: false })

      // 状态筛选
      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus)
      }

      const { data, error } = await query

      if (error) throw error

      console.log("Partners data:", data)

      // 如果有数据，获取创建者信息
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(p => p.created_by).filter(Boolean))]

        console.log("User IDs to fetch:", userIds)

        if (userIds.length > 0) {
          const { data: profiles, error: profileError } = await supabase
            .from("profiles")
            .select("id, username")
            .in("id", userIds)

          if (profileError) {
            console.error("Error fetching profiles:", profileError)
          }

          console.log("Profiles data:", profiles)

          // 获取用户邮箱信息 - 使用服务端action
          const { getUserEmails } = await import("@/lib/actions/partners")
          const emailResult = await getUserEmails(userIds)

          const userEmailMap = emailResult.success ? emailResult.data : {}

          // 将 profile 信息附加到 partner 数据
          const partnersWithProfiles = data.map(partner => {
            const profile = profiles?.find(p => p.id === partner.created_by)
            const email = userEmailMap?.[partner.created_by]
            console.log(`Partner ${partner.name} created_by: ${partner.created_by}, found profile:`, profile, 'email:', email)
            return {
              ...partner,
              created_by_profile: profile,
              created_by_email: email
            }
          })

          setPartners(partnersWithProfiles)
        } else {
          setPartners(data)
        }
      } else {
        setPartners([])
      }

      // 计算统计数据
      const allQuery = await supabase
        .from("partners")
        .select("status", { count: "exact" })

      if (allQuery.data) {
        setStats({
          total: allQuery.data.length,
          pending: allQuery.data.filter((p) => p.status === "pending").length,
          approved: allQuery.data.filter((p) => p.status === "approved").length,
          rejected: allQuery.data.filter((p) => p.status === "rejected").length,
        })
      }
    } catch (error) {
      console.error("Error loading partners:", error)
      toast.error("加载合作伙伴失败")
    } finally {
      setLoading(false)
    }
  }

  // 打开审核对话框
  const openReviewDialog = (partner: Partner, action: "approve" | "reject") => {
    setSelectedPartner(partner)
    setReviewAction(action)
    setRejectionReason("")
    setSortOrder(partner.sort_order || 0)
    setReviewDialogOpen(true)
  }

  // 打开备注对话框
  const openNotesDialog = (partner: Partner) => {
    setSelectedPartner(partner)
    setCurrentNotes(partner.admin_notes || "")
    setNotesDialogOpen(true)
  }

  // 保存备注
  const handleSaveNotes = async () => {
    if (!selectedPartner) return

    try {
      setSavingNotes(true)
      const { updatePartnerNotes } = await import("@/lib/actions/partners")
      const result = await updatePartnerNotes(selectedPartner.id, currentNotes)

      if (result.success) {
        toast.success("备注已保存")
        setNotesDialogOpen(false)
        loadPartners()
      } else {
        toast.error(result.error || "保存失败")
      }
    } catch (error) {
      console.error("Error saving notes:", error)
      toast.error("保存失败")
    } finally {
      setSavingNotes(false)
    }
  }

  // 提交审核
  const handleReview = async () => {
    if (!selectedPartner) return

    if (reviewAction === "reject" && !rejectionReason.trim()) {
      toast.error("请输入拒绝原因")
      return
    }

    try {
      setSubmitting(true)
      const supabase = createClient()

      const updateData: any = {
        status: reviewAction === "approve" ? "approved" : "rejected",
        approved_at: reviewAction === "approve" ? new Date().toISOString() : null,
        approved_by: reviewAction === "approve" ? (await supabase.auth.getUser()).data.user?.id : null,
        rejection_reason: reviewAction === "reject" ? rejectionReason : null,
      }

      if (reviewAction === "approve") {
        updateData.sort_order = sortOrder

        // 设置订阅到期时间: 当前时间 + duration_years 年
        if (selectedPartner.duration_years) {
          const expiresAt = new Date()
          expiresAt.setFullYear(expiresAt.getFullYear() + selectedPartner.duration_years)
          updateData.expires_at = expiresAt.toISOString()
        }
      }

      const { error } = await supabase
        .from("partners")
        .update(updateData)
        .eq("id", selectedPartner.id)

      if (error) throw error

      // 发送通知给申请人
      const { createNotification } = await import("@/lib/actions/notifications")
      const notificationTitle =
        reviewAction === "approve" ? "合作伙伴申请已通过" : "合作伙伴申请被拒绝"
      const notificationContent =
        reviewAction === "approve"
          ? `恭喜!您的合作伙伴申请 "${selectedPartner.name}" 已通过审核,现已在前台展示。`
          : `很遗憾,您的合作伙伴申请 "${selectedPartner.name}" 未通过审核。${
              rejectionReason ? `原因:${rejectionReason}` : ""
            }`

      await createNotification({
        userId: selectedPartner.created_by,
        type: "system",
        category: "partner_review",
        title: notificationTitle,
        content: notificationContent,
      })

      toast.success(reviewAction === "approve" ? "已通过审核" : "已拒绝申请")
      setReviewDialogOpen(false)
      loadPartners()
    } catch (error) {
      console.error("Error reviewing partner:", error)
      toast.error("操作失败")
    } finally {
      setSubmitting(false)
    }
  }

  // 删除合作伙伴
  const handleDelete = async (partner: Partner) => {
    if (!confirm(`确定要删除合作伙伴 "${partner.name}" 吗?`)) return

    try {
      const supabase = createClient()

      const { error } = await supabase.from("partners").delete().eq("id", partner.id)

      if (error) throw error

      toast.success("删除成功")
      loadPartners()
    } catch (error) {
      console.error("Error deleting partner:", error)
      toast.error("删除失败")
    }
  }

  // 状态Badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="border-yellow-300 bg-yellow-50 text-yellow-700">
            <Clock className="h-3 w-3 mr-1" />
            待审核
          </Badge>
        )
      case "approved":
        return (
          <Badge variant="outline" className="border-green-300 bg-green-50 text-green-700">
            <CheckCircle className="h-3 w-3 mr-1" />
            已通过
          </Badge>
        )
      case "rejected":
        return (
          <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700">
            <XCircle className="h-3 w-3 mr-1" />
            已拒绝
          </Badge>
        )
      default:
        return null
    }
  }

  // 过滤合作伙伴列表(根据邮箱搜索)
  const filteredPartners = partners.filter(partner => {
    if (!searchEmail.trim()) return true
    return partner.created_by_email?.toLowerCase().includes(searchEmail.toLowerCase())
  })

  // 分页计算
  const totalPages = Math.ceil(filteredPartners.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const currentPartners = filteredPartners.slice(startIndex, endIndex)

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Handshake className="h-8 w-8" />
            合作伙伴管理
          </h1>
          <p className="text-muted-foreground mt-1">审核和管理合作伙伴申请</p>
        </div>

        {/* 合作伙伴列表 */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <CardTitle>合作伙伴申请列表</CardTitle>
              <div className="flex items-center gap-4">
                {/* 统计数据 - 紧凑布局 */}
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">总计:</span>
                    <span className="font-semibold">{stats.total}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">待审核:</span>
                    <span className="font-semibold text-yellow-600">{stats.pending}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">已通过:</span>
                    <span className="font-semibold text-green-600">{stats.approved}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">已拒绝:</span>
                    <span className="font-semibold text-red-600">{stats.rejected}</span>
                  </div>
                </div>
              </div>
            </div>
            {/* 筛选和操作栏 */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">状态筛选:</span>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部</SelectItem>
                      <SelectItem value="pending">待审核</SelectItem>
                      <SelectItem value="approved">已通过</SelectItem>
                      <SelectItem value="rejected">已拒绝</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">邮箱搜索:</span>
                  <Input
                    placeholder="输入邮箱搜索..."
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    className="w-[200px]"
                  />
                </div>
              </div>
              <Button onClick={loadPartners} variant="outline" size="sm">
                刷新数据
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">加载中...</p>
              </div>
            ) : partners.length === 0 ? (
              <div className="text-center py-12">
                <Handshake className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">暂无合作伙伴申请</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Logo</TableHead>
                        <TableHead>合作伙伴名称</TableHead>
                        <TableHead>官网链接</TableHead>
                        <TableHead>订阅时长</TableHead>
                        <TableHead>订阅金额</TableHead>
                        <TableHead>申请人</TableHead>
                        <TableHead>申请时间</TableHead>
                        <TableHead>到期时间</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead className="text-center">排序</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentPartners.map((partner) => (
                        <TableRow key={partner.id}>
                          <TableCell>
                            <div className="w-12 h-12 rounded border overflow-hidden bg-gray-50 flex items-center justify-center">
                              {partner.logo_url ? (
                                <img
                                  src={partner.logo_url}
                                  alt={partner.name}
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <Handshake className="h-6 w-6 text-gray-400" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{partner.name}</p>
                              {partner.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                                  {partner.description}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <a
                              href={partner.website_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-blue-600 hover:underline text-sm"
                            >
                              <span className="truncate max-w-[200px]">{partner.website_url}</span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm font-medium">{partner.duration_years} 年</p>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p className="font-medium text-amber-600">{partner.total_amount} USDT</p>
                              <p className="text-xs text-muted-foreground">
                                {partner.annual_fee} USDT/年
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p className="font-medium">
                                {partner.created_by_profile?.username || "未知用户"}
                              </p>
                              {partner.created_by_email && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {partner.created_by_email}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm whitespace-nowrap">
                              {new Date(partner.created_at).toLocaleDateString("zh-CN")}
                            </p>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {partner.expires_at ? (
                                <>
                                  <p className="font-medium">
                                    {new Date(partner.expires_at).toLocaleDateString("zh-CN")}
                                  </p>
                                  {partner.status === "approved" && (() => {
                                    const now = new Date()
                                    const expiresAt = new Date(partner.expires_at)
                                    const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

                                    if (daysLeft < 0) {
                                      return <p className="text-xs text-red-600">已过期</p>
                                    } else if (daysLeft <= 7) {
                                      return <p className="text-xs text-orange-600">剩余{daysLeft}天</p>
                                    } else if (daysLeft <= 30) {
                                      return <p className="text-xs text-amber-600">剩余{daysLeft}天</p>
                                    }
                                    return null
                                  })()}
                                </>
                              ) : (
                                <p className="text-muted-foreground">-</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(partner.status)}</TableCell>
                          <TableCell className="text-center">
                            <span className="text-sm font-medium">{partner.sort_order}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedPartner(partner)
                                  setViewDialogOpen(true)
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openNotesDialog(partner)}
                              >
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                              {partner.status === "pending" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => openReviewDialog(partner, "approve")}
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => openReviewDialog(partner, "reject")}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleDelete(partner)}
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
                      显示 {startIndex + 1} - {Math.min(endIndex, filteredPartners.length)} 条，共 {filteredPartners.length} 条
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

      {/* 审核对话框 */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "approve" ? "通过审核" : "拒绝申请"}
            </DialogTitle>
            <DialogDescription>
              {reviewAction === "approve"
                ? "通过后,该合作伙伴将在前台展示"
                : "请输入拒绝原因,申请人将收到通知"}
            </DialogDescription>
          </DialogHeader>

          {selectedPartner && (
            <div className="space-y-4 mt-4">
              {/* 合作伙伴信息 */}
              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-16 h-16 rounded border bg-white flex items-center justify-center shrink-0">
                  {selectedPartner.logo_url ? (
                    <img
                      src={selectedPartner.logo_url}
                      alt={selectedPartner.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <Handshake className="h-8 w-8 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{selectedPartner.name}</p>
                  <p className="text-sm text-muted-foreground break-all">
                    {selectedPartner.website_url}
                  </p>
                </div>
              </div>

              {reviewAction === "approve" ? (
                <div className="space-y-2">
                  <Label htmlFor="sort-order">排序顺序</Label>
                  <Input
                    id="sort-order"
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    数字越小越靠前显示,相同排序按申请时间排序
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="rejection-reason">拒绝原因 *</Label>
                  <Textarea
                    id="rejection-reason"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="请输入拒绝原因..."
                    rows={4}
                    className="w-full resize-none"
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReviewDialogOpen(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button
              onClick={handleReview}
              disabled={submitting}
              className={cn(
                reviewAction === "approve"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              )}
            >
              {submitting ? "处理中..." : reviewAction === "approve" ? "通过" : "拒绝"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 查看详情对话框 */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>合作伙伴详细信息</DialogTitle>
            <DialogDescription>查看合作伙伴申请的详细信息</DialogDescription>
          </DialogHeader>

          {selectedPartner && (
            <div className="space-y-4 py-4">
              {/* 合作伙伴信息 */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">合作伙伴信息</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="col-span-2 flex items-center gap-3">
                    <div className="w-16 h-16 rounded border bg-gray-50 flex items-center justify-center shrink-0">
                      {selectedPartner.logo_url ? (
                        <img
                          src={selectedPartner.logo_url}
                          alt={selectedPartner.name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <Handshake className="h-8 w-8 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-base">{selectedPartner.name}</p>
                      {selectedPartner.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {selectedPartner.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">官网链接</Label>
                    <a
                      href={selectedPartner.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-600 hover:underline font-medium break-all"
                    >
                      <span>{selectedPartner.website_url}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">申请人</Label>
                    <p className="font-medium">{selectedPartner.created_by_profile?.username || "未知用户"}</p>
                    {selectedPartner.created_by_email && (
                      <p className="text-xs text-muted-foreground mt-0.5">{selectedPartner.created_by_email}</p>
                    )}
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">用户ID</Label>
                    <p className="font-mono text-xs bg-muted px-2 py-1 rounded">
                      {selectedPartner.created_by}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">申请时间</Label>
                    <p className="font-medium">
                      {new Date(selectedPartner.created_at).toLocaleString("zh-CN")}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">状态</Label>
                    <div className="mt-1">{getStatusBadge(selectedPartner.status)}</div>
                  </div>
                </div>
              </div>

              {/* 订阅信息 */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">订阅信息</h3>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-amber-900">订阅金额：</span>
                    <span className="text-2xl font-bold text-amber-900">
                      {selectedPartner.total_amount.toLocaleString()} USDT
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-amber-700">
                    <div>订阅时长: {selectedPartner.duration_years} 年</div>
                    <div>年费: {selectedPartner.annual_fee} USDT/年</div>
                  </div>
                  {selectedPartner.expires_at && (
                    <div className="mt-2 pt-2 border-t border-amber-200 text-xs text-amber-700">
                      到期时间: {new Date(selectedPartner.expires_at).toLocaleString("zh-CN")}
                    </div>
                  )}
                </div>
              </div>

              {/* 支付凭证 */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">支付凭证</h3>
                {selectedPartner.payment_proof_url ? (
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      onClick={() => window.open(selectedPartner.payment_proof_url!, "_blank")}
                      className="w-full"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      在新窗口中查看支付凭证
                    </Button>
                    {selectedPartner.payment_proof_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) && (
                      <div className="border rounded-lg overflow-hidden">
                        <img
                          src={selectedPartner.payment_proof_url}
                          alt="支付凭证"
                          className="w-full h-auto"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">未上传支付凭证</p>
                )}
              </div>

              {/* 交易哈希/交易ID */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">交易哈希/交易ID</h3>
                {selectedPartner.transaction_hash ? (
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-sm font-mono break-all">
                      {selectedPartner.transaction_hash}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">未填写交易哈希</p>
                )}
              </div>

              {/* 审核信息 */}
              {(selectedPartner.status === "approved" || selectedPartner.status === "rejected") && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">审核信息</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <Label className="text-muted-foreground">
                        {selectedPartner.status === "approved" ? "审核时间" : "拒绝时间"}
                      </Label>
                      <p className="font-medium">
                        {selectedPartner.approved_at
                          ? new Date(selectedPartner.approved_at).toLocaleString("zh-CN")
                          : "-"}
                      </p>
                    </div>
                    {selectedPartner.status === "approved" && (
                      <div>
                        <Label className="text-muted-foreground">排序顺序</Label>
                        <p className="font-medium">{selectedPartner.sort_order}</p>
                      </div>
                    )}
                  </div>
                  {/* 拒绝原因 */}
                  {selectedPartner.status === "rejected" && selectedPartner.rejection_reason && (
                    <div className="mt-2">
                      <Label className="text-muted-foreground">拒绝原因</Label>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-1">
                        <p className="text-sm text-red-900">{selectedPartner.rejection_reason}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 备注对话框 */}
      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>管理员备注</DialogTitle>
            <DialogDescription>
              仅管理员可见，用于记录内部备注信息
            </DialogDescription>
          </DialogHeader>

          {selectedPartner && (
            <div className="space-y-4 py-4">
              {/* 合作伙伴信息 */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-12 h-12 rounded border bg-white flex items-center justify-center shrink-0">
                  {selectedPartner.logo_url ? (
                    <img
                      src={selectedPartner.logo_url}
                      alt={selectedPartner.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <Handshake className="h-6 w-6 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{selectedPartner.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {selectedPartner.website_url}
                  </p>
                </div>
              </div>

              {/* 备注输入框 */}
              <div className="space-y-2">
                <Label htmlFor="admin-notes">备注内容</Label>
                <Textarea
                  id="admin-notes"
                  value={currentNotes}
                  onChange={(e) => setCurrentNotes(e.target.value)}
                  placeholder="请输入管理员备注..."
                  rows={6}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  此备注仅管理员可见，申请人无法看到
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNotesDialogOpen(false)}
              disabled={savingNotes}
            >
              取消
            </Button>
            <Button
              onClick={handleSaveNotes}
              disabled={savingNotes}
            >
              {savingNotes ? "保存中..." : "保存备注"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
