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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getAllTopUpApplications,
  approveTopUpApplication,
  rejectTopUpApplication,
  getTopUpApplicationsStats,
  type DepositTopUpApplication,
} from "@/lib/actions/deposit-top-up"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  PlusCircle,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  ExternalLink,
  ArrowUpCircle,
  Store,
} from "lucide-react"

export default function DepositTopUpsPage() {
  const router = useRouter()
  const [applications, setApplications] = useState<DepositTopUpApplication[]>([])
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 })
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [searchEmail, setSearchEmail] = useState("")

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)

  // 对话框状态
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [selectedApplication, setSelectedApplication] = useState<DepositTopUpApplication | null>(null)
  const [adminNote, setAdminNote] = useState("")
  const [rejectionReason, setRejectionReason] = useState("")
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    loadApplications()
    setCurrentPage(1)
  }, [filterStatus])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchEmail])

  async function loadApplications() {
    try {
      setLoading(true)
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

      // 加载统计数据
      const statsData = await getTopUpApplicationsStats()
      setStats(statsData)

      // 加载申请列表
      const status = filterStatus === "all" ? undefined : (filterStatus as any)
      const result = await getAllTopUpApplications(status)

      if (result.success && result.data) {
        setApplications(result.data)
      } else {
        toast.error(result.error || "加载失败")
      }
    } catch (error) {
      console.error("Error loading applications:", error)
      toast.error("加载失败")
    } finally {
      setLoading(false)
    }
  }

  const handleViewDetail = (application: DepositTopUpApplication) => {
    setSelectedApplication(application)
    setDetailDialogOpen(true)
  }

  const handleApproveClick = (application: DepositTopUpApplication) => {
    setSelectedApplication(application)
    setAdminNote("")
    setApproveDialogOpen(true)
  }

  const handleRejectClick = (application: DepositTopUpApplication) => {
    setSelectedApplication(application)
    setRejectionReason("")
    setRejectDialogOpen(true)
  }

  const handleApprove = async () => {
    if (!selectedApplication) return

    try {
      setProcessing(true)
      const result = await approveTopUpApplication(selectedApplication.id, adminNote)

      if (result.success) {
        toast.success("已通过追加申请,押金金额已更新")
        setApproveDialogOpen(false)
        loadApplications()
      } else {
        toast.error(result.error || "操作失败")
      }
    } catch (error) {
      console.error("Error approving application:", error)
      toast.error("操作失败")
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedApplication) return

    if (!rejectionReason.trim()) {
      toast.error("请填写拒绝原因")
      return
    }

    try {
      setProcessing(true)
      const result = await rejectTopUpApplication(selectedApplication.id, rejectionReason)

      if (result.success) {
        toast.success("已拒绝追加申请")
        setRejectDialogOpen(false)
        loadApplications()
      } else {
        toast.error(result.error || "操作失败")
      }
    } catch (error) {
      console.error("Error rejecting application:", error)
      toast.error("操作失败")
    } finally {
      setProcessing(false)
    }
  }

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

  // 过滤申请列表
  const filteredApplications = applications.filter((app) => {
    if (!searchEmail.trim()) return true
    return app.applicant_email?.toLowerCase().includes(searchEmail.toLowerCase())
  })

  // 分页计算
  const totalPages = Math.ceil(filteredApplications.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const currentApplications = filteredApplications.slice(startIndex, endIndex)

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ArrowUpCircle className="h-8 w-8" />
            押金追加管理
          </h1>
          <p className="text-muted-foreground mt-1">审核和管理商家追加押金申请</p>
        </div>

        {/* 申请列表 */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <CardTitle>追加押金申请列表</CardTitle>
              <div className="flex items-center gap-4">
                {/* 统计数据 */}
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
              <Button onClick={loadApplications} variant="outline" size="sm">
                刷新数据
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">加载中...</p>
              </div>
            ) : applications.length === 0 ? (
              <div className="text-center py-12">
                <PlusCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">暂无追加申请</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Logo</TableHead>
                        <TableHead>商家名称</TableHead>
                        <TableHead>申请人</TableHead>
                        <TableHead>原有押金</TableHead>
                        <TableHead>追加金额</TableHead>
                        <TableHead>追加后总额</TableHead>
                        <TableHead>申请时间</TableHead>
                        {filterStatus !== "pending" && <TableHead>审核时间</TableHead>}
                        <TableHead>状态</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentApplications.map((application) => (
                        <TableRow key={application.id}>
                          {/* Logo列 */}
                          <TableCell>
                            <div className="w-12 h-12 rounded border overflow-hidden bg-gray-50 flex items-center justify-center">
                              {application.merchant_logo ? (
                                <img
                                  src={application.merchant_logo}
                                  alt={application.merchant_name || ""}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Store className="h-6 w-6 text-gray-400" />
                              )}
                            </div>
                          </TableCell>
                          {/* 商家名称列 */}
                          <TableCell>
                            <span className="font-medium">{application.merchant_name || "未知商家"}</span>
                          </TableCell>
                          {/* 申请人列 */}
                          <TableCell>
                            <div className="text-sm">
                              <p className="font-medium">{application.applicant_username || "未知用户"}</p>
                              {application.applicant_email && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {application.applicant_email}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          {/* 原有押金列 */}
                          <TableCell>
                            <p className="text-sm font-medium text-gray-600">
                              {application.original_amount.toLocaleString()} USDT
                            </p>
                          </TableCell>
                          {/* 追加金额列 */}
                          <TableCell>
                            <p className="text-sm font-medium text-blue-600">
                              +{application.top_up_amount.toLocaleString()} USDT
                            </p>
                          </TableCell>
                          {/* 追加后总额列 */}
                          <TableCell>
                            <p className="text-sm font-bold text-green-600">
                              {application.total_amount.toLocaleString()} USDT
                            </p>
                          </TableCell>
                          {/* 申请时间列 */}
                          <TableCell>
                            <p className="text-sm whitespace-nowrap">
                              {new Date(application.created_at).toLocaleDateString("zh-CN")}
                            </p>
                          </TableCell>
                          {/* 审核时间列 */}
                          {filterStatus !== "pending" && (
                            <TableCell>
                              <p className="text-sm whitespace-nowrap">
                                {application.approved_at
                                  ? new Date(application.approved_at).toLocaleDateString("zh-CN")
                                  : "-"}
                              </p>
                            </TableCell>
                          )}
                          {/* 状态列 */}
                          <TableCell>{getStatusBadge(application.application_status)}</TableCell>
                          {/* 操作列 */}
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleViewDetail(application)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {application.application_status === "pending" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => handleApproveClick(application)}
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => handleRejectClick(application)}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
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
                      显示 {startIndex + 1} - {Math.min(endIndex, filteredApplications.length)} 条，共{" "}
                      {filteredApplications.length} 条
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

      {/* 详情对话框 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>追加押金详细信息</DialogTitle>
            <DialogDescription>查看商家追加押金申请的详细信息</DialogDescription>
          </DialogHeader>

          {selectedApplication && (
            <div className="space-y-4 py-4">
              {/* 商家信息 */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">商家信息</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="col-span-2 flex items-center gap-3">
                    <div className="w-16 h-16 rounded border bg-gray-50 flex items-center justify-center shrink-0">
                      {selectedApplication.merchant_logo ? (
                        <img
                          src={selectedApplication.merchant_logo}
                          alt={selectedApplication.merchant_name || ""}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Store className="h-8 w-8 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-base">{selectedApplication.merchant_name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        当前押金: {selectedApplication.merchant_current_deposit?.toLocaleString() || 0} USDT
                      </p>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">申请人</Label>
                    <p className="font-medium">{selectedApplication.applicant_username || "未知用户"}</p>
                    {selectedApplication.applicant_email && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {selectedApplication.applicant_email}
                      </p>
                    )}
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">用户ID</Label>
                    <p className="font-mono text-xs bg-muted px-2 py-1 rounded">
                      {selectedApplication.user_id}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">申请时间</Label>
                    <p className="font-medium">
                      {new Date(selectedApplication.created_at).toLocaleString("zh-CN")}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">状态</Label>
                    <div className="mt-1">{getStatusBadge(selectedApplication.application_status)}</div>
                  </div>
                </div>
              </div>

              {/* 押金信息 */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">押金信息</h3>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-amber-900">原有押金：</span>
                      <span className="text-lg font-medium text-amber-900">
                        {selectedApplication.original_amount.toLocaleString()} USDT
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-amber-200 pt-3">
                      <span className="text-sm text-amber-900">追加金额：</span>
                      <span className="text-lg font-bold text-blue-600">
                        +{selectedApplication.top_up_amount.toLocaleString()} USDT
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-amber-200 pt-3">
                      <span className="text-sm font-medium text-amber-900">追加后总额：</span>
                      <span className="text-2xl font-bold text-green-600">
                        {selectedApplication.total_amount.toLocaleString()} USDT
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 支付凭证 */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">支付凭证</h3>
                {selectedApplication.payment_proof_url ? (
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      onClick={() => window.open(selectedApplication.payment_proof_url!, "_blank")}
                      className="w-full"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      在新窗口中查看支付凭证
                    </Button>
                    {selectedApplication.payment_proof_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) && (
                      <div className="border rounded-lg overflow-hidden">
                        <img
                          src={selectedApplication.payment_proof_url}
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
                {selectedApplication.transaction_hash ? (
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-sm font-mono break-all">{selectedApplication.transaction_hash}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">未填写交易哈希</p>
                )}
              </div>

              {/* 审核信息 */}
              {(selectedApplication.application_status === "approved" ||
                selectedApplication.application_status === "rejected") && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">审核信息</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <Label className="text-muted-foreground">审核人</Label>
                      <p className="font-medium">{selectedApplication.approver_username || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">审核时间</Label>
                      <p className="font-medium">
                        {selectedApplication.approved_at
                          ? new Date(selectedApplication.approved_at).toLocaleString("zh-CN")
                          : "-"}
                      </p>
                    </div>
                  </div>
                  {/* 拒绝原因 */}
                  {selectedApplication.application_status === "rejected" &&
                    selectedApplication.rejection_reason && (
                      <div className="mt-2">
                        <Label className="text-muted-foreground">拒绝原因</Label>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-1">
                          <p className="text-sm text-red-900">{selectedApplication.rejection_reason}</p>
                        </div>
                      </div>
                    )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              关闭
            </Button>
            {selectedApplication && selectedApplication.application_status === "pending" && (
              <>
                <Button
                  variant="outline"
                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                  onClick={() => {
                    setDetailDialogOpen(false)
                    handleApproveClick(selectedApplication)
                  }}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  通过申请
                </Button>
                <Button
                  variant="outline"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => {
                    setDetailDialogOpen(false)
                    handleRejectClick(selectedApplication)
                  }}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  拒绝申请
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 通过对话框 */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>通过追加申请</DialogTitle>
            <DialogDescription>
              通过后,商家押金将累加至 {selectedApplication?.total_amount.toLocaleString()} USDT
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedApplication && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-green-900">商家:</span>
                    <span className="font-medium">{selectedApplication.merchant_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-900">原有押金:</span>
                    <span className="font-medium">{selectedApplication.original_amount.toLocaleString()} USDT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-900">追加金额:</span>
                    <span className="font-bold text-blue-600">
                      +{selectedApplication.top_up_amount.toLocaleString()} USDT
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-green-200 pt-2">
                    <span className="text-green-900 font-medium">追加后:</span>
                    <span className="text-lg font-bold text-green-600">
                      {selectedApplication.total_amount.toLocaleString()} USDT
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="approve-note">管理员备注(可选)</Label>
              <Textarea
                id="approve-note"
                placeholder="可以添加一些备注信息..."
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)} disabled={processing}>
              取消
            </Button>
            <Button onClick={handleApprove} disabled={processing} className="bg-green-600 hover:bg-green-700">
              {processing ? "处理中..." : "确认通过"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 拒绝对话框 */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>拒绝追加申请</DialogTitle>
            <DialogDescription>拒绝商家的押金追加申请,请填写拒绝原因</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reject-reason">
                拒绝原因 <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="reject-reason"
                placeholder="请详细说明拒绝原因,用户将会在通知中看到"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                required
              />
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
              <p className="text-sm font-medium text-red-900">拒绝后将执行以下操作:</p>
              <ul className="text-xs text-red-700 space-y-1 ml-4">
                <li>• 申请状态更新为"已拒绝"</li>
                <li>• 系统发送拒绝通知(包含拒绝原因)</li>
                <li>• 商家押金金额不变</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)} disabled={processing}>
              取消
            </Button>
            <Button
              onClick={handleReject}
              disabled={processing || !rejectionReason.trim()}
              variant="destructive"
            >
              {processing ? "处理中..." : "确认拒绝"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
