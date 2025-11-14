"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AdminLayout } from "@/components/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CheckCircle, XCircle, Eye, Store, Clock } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import {
  getPendingDepositRefundApplications,
  approveDepositRefundApplication,
  rejectDepositRefundApplication,
} from "@/lib/actions/deposit"

interface DepositRefundApplication {
  id: string
  merchant_id: string
  user_id: string
  deposit_amount: number
  refund_amount: number
  fee_amount: number
  fee_rate: number
  reason: string
  wallet_address: string
  wallet_network: "TRC20" | "ERC20" | "BEP20"
  deposit_paid_at: string
  created_at: string
  application_status: "pending" | "approved" | "rejected"
  merchants: {
    name: string
    user_id: string
    logo: string | null
  }
  profiles: {
    username: string
  }
  user_email: string | null
  reviewed_by?: string | null
  reviewed_at?: string | null
  reviewed_by_profile?: {
    username: string
    id: string
  }
  reviewed_by_email?: string
}

interface Stats {
  total: number
  pending: number
  approved: number
  rejected: number
}

export default function DepositRefundsPage() {
  const router = useRouter()
  const [applications, setApplications] = useState<DepositRefundApplication[]>([])
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

  // Approve dialog state
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [selectedApplication, setSelectedApplication] = useState<DepositRefundApplication | null>(null)
  const [transactionHash, setTransactionHash] = useState("")
  const [adminNote, setAdminNote] = useState("")
  const [approving, setApproving] = useState(false)

  // Reject dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [rejecting, setRejecting] = useState(false)

  // Detail dialog state
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)

  // 加载申请数据
  useEffect(() => {
    loadApplications()
    setCurrentPage(1) // 切换筛选时重置到第一页
  }, [filterStatus])

  // 邮箱搜索时重置到第一页
  useEffect(() => {
    setCurrentPage(1)
  }, [searchEmail])

  // 添加 Supabase 实时订阅
  useEffect(() => {
    console.log('🔍 [管理员退还页面] useEffect 开始执行')

    try {
      const supabase = createClient()
      console.log('🔌 [管理员退还页面] Supabase 客户端已创建')
      console.log('🔌 [管理员退还页面] 开始订阅押金退还申请表变化')

      // 订阅押金退还申请表的变化
      const channel = supabase
        .channel('deposit-refund-applications-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'deposit_refund_applications'
          },
          (payload) => {
            console.log('✅ [管理员退还页面] 押金退还申请数据变化:', payload)
            // 当数据库有任何变化时，自动重新加载申请列表
            loadApplications()
          }
        )
        .subscribe((status) => {
          console.log('📡 [管理员退还页面] 押金退还申请订阅状态:', status)
          if (status === 'SUBSCRIBED') {
            console.log('✅ [管理员退还页面] 订阅成功！')
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ [管理员退还页面] 订阅错误')
          } else if (status === 'TIMED_OUT') {
            console.error('⏱️ [管理员退还页面] 订阅超时')
          }
        })

      console.log('📌 [管理员退还页面] 订阅设置完成，channel:', channel)

      // 清理函数：组件卸载时取消订阅
      return () => {
        console.log('🔌 [管理员退还页面] 取消押金退还申请订阅')
        supabase.removeChannel(channel)
      }
    } catch (error) {
      console.error('❌ [管理员退还页面] 订阅设置出错:', error)
    }
  }, [])

  async function loadApplications() {
    try {
      setLoading(true)
      const supabase = createClient()

      // 构建查询 - 根据筛选状态加载数据
      let query = supabase
        .from("deposit_refund_applications")
        .select(`
          *,
          merchants!inner(name, user_id, logo)
        `)
        .order("created_at", { ascending: false })

      // 状态筛选
      if (filterStatus === "pending") {
        query = query.eq("application_status", "pending")
      } else if (filterStatus === "approved") {
        query = query.eq("application_status", "approved")
      } else if (filterStatus === "rejected") {
        query = query.eq("application_status", "rejected")
      }

      const { data, error } = await query

      if (error) throw error

      console.log("Refund applications data:", data)

      // 如果有数据,获取申请人和审核人的 profiles 信息
      if (data && data.length > 0) {
        // 获取所有需要查询的用户ID
        const userIds = [...new Set(data.map(app => app.user_id))]
        const reviewedByIds = [
          ...new Set(
            data
              .map(app => app.reviewed_by)
              .filter(Boolean) as string[]
          )
        ]
        const allUserIds = [...new Set([...userIds, ...reviewedByIds])]

        console.log("User IDs:", userIds)
        console.log("Reviewed by IDs:", reviewedByIds)
        console.log("All User IDs:", allUserIds)

        // 获取所有用户的 profiles 信息
        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("id, username")
          .in("id", allUserIds)

        if (profileError) {
          console.error("Error fetching profiles:", profileError)
        }

        console.log("Profiles data:", profiles)
        console.log("Profiles count:", profiles?.length)

        // 获取用户邮箱信息 - 使用服务端action
        const { getUserEmails } = await import("@/lib/actions/partners")
        const emailResult = await getUserEmails(allUserIds)
        const emailMap = emailResult.success ? emailResult.data : {}

        // 将用户信息附加到申请数据
        const applicationsWithUserInfo = data.map(app => {
          const userProfile = profiles?.find(p => p.id === app.user_id)
          const reviewerProfile = profiles?.find(p => p.id === app.reviewed_by)
          const userEmail = emailMap?.[app.user_id]
          const reviewerEmail = emailMap?.[app.reviewed_by || ""]

          // 调试日志
          if (app.reviewed_by) {
            console.log(`Application ${app.id}:`, {
              reviewed_by: app.reviewed_by,
              reviewerProfile,
              reviewerEmail
            })
          }

          return {
            ...app,
            profiles: userProfile,
            user_email: userEmail,
            reviewed_by_profile: reviewerProfile,
            reviewed_by_email: reviewerEmail
          }
        })

        console.log("Applications with user info:", applicationsWithUserInfo)
        setApplications(applicationsWithUserInfo)
      } else {
        setApplications([])
      }

      // 计算统计数据 - 获取全部数据进行统计
      const allQuery = await supabase
        .from("deposit_refund_applications")
        .select("application_status", { count: "exact" })

      if (allQuery.data) {
        setStats({
          total: allQuery.data.length,
          pending: allQuery.data.filter((a) => a.application_status === "pending").length,
          approved: allQuery.data.filter((a) => a.application_status === "approved").length,
          rejected: allQuery.data.filter((a) => a.application_status === "rejected").length,
        })
      }
    } catch (error: any) {
      console.error("Error loading applications:", error)
      toast.error(error.message || "加载申请列表失败")
    } finally {
      setLoading(false)
    }
  }

  function handleApproveClick(application: DepositRefundApplication) {
    setSelectedApplication(application)
    setTransactionHash("")
    setAdminNote("")
    setApproveDialogOpen(true)
  }

  async function handleApprove() {
    if (!selectedApplication) return

    if (!transactionHash.trim()) {
      toast.error("请填写退款交易哈希")
      return
    }

    try {
      setApproving(true)
      const result = await approveDepositRefundApplication(
        selectedApplication.id,
        transactionHash,
        adminNote || undefined
      )

      if (!result.success) {
        throw new Error(result.error)
      }

      toast.success(`已批准商家【${selectedApplication.merchants.name}】的退还申请`)
      setApproveDialogOpen(false)
      setSelectedApplication(null)
      setTransactionHash("")
      setAdminNote("")
      router.refresh()
      await loadApplications()
    } catch (error: any) {
      console.error("Error approving application:", error)
      toast.error(error.message || "批准失败")
    } finally {
      setApproving(false)
    }
  }

  function handleRejectClick(application: DepositRefundApplication) {
    setSelectedApplication(application)
    setRejectReason("")
    setRejectDialogOpen(true)
  }

  async function handleReject() {
    if (!selectedApplication) return

    if (!rejectReason.trim()) {
      toast.error("请填写拒绝原因")
      return
    }

    try {
      setRejecting(true)
      const result = await rejectDepositRefundApplication(selectedApplication.id, rejectReason)

      if (!result.success) {
        throw new Error(result.error)
      }

      toast.success(`已拒绝商家【${selectedApplication.merchants.name}】的退还申请`)
      setRejectDialogOpen(false)
      setSelectedApplication(null)
      setRejectReason("")
      router.refresh()
      await loadApplications()
    } catch (error: any) {
      console.error("Error rejecting application:", error)
      toast.error(error.message || "拒绝失败")
    } finally {
      setRejecting(false)
    }
  }

  function handleViewDetail(application: DepositRefundApplication) {
    setSelectedApplication(application)
    setDetailDialogOpen(true)
  }

  function calculateHoldingDays(depositPaidAt: string): number {
    const paidDate = new Date(depositPaidAt)
    const now = new Date()
    return Math.floor((now.getTime() - paidDate.getTime()) / (1000 * 60 * 60 * 24))
  }

  // 过滤申请列表(根据邮箱搜索)
  const filteredApplications = applications.filter(app => {
    if (!searchEmail.trim()) return true
    return app.user_email?.toLowerCase().includes(searchEmail.toLowerCase())
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
          <h1 className="text-3xl font-bold">
            押金退还审核
          </h1>
          <p className="text-muted-foreground mt-1">审核和管理商家押金退还申请</p>
        </div>

        {/* 申请列表 */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <CardTitle>退还申请列表</CardTitle>
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
                <p className="text-muted-foreground">暂无退还申请</p>
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
                        <TableHead>押金金额</TableHead>
                        <TableHead>退还金额</TableHead>
                        <TableHead>手续费</TableHead>
                        <TableHead>持有天数</TableHead>
                        <TableHead>申请时间</TableHead>
                        {filterStatus !== "pending" && <TableHead>审核人</TableHead>}
                        <TableHead>状态</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentApplications.map((application) => {
                        const holdingDays = calculateHoldingDays(application.deposit_paid_at)
                        return (
                          <TableRow key={application.id}>
                            {/* Logo列 */}
                            <TableCell>
                              <div className="w-12 h-12 rounded border overflow-hidden bg-gray-50 flex items-center justify-center">
                                {application.merchants.logo ? (
                                  <>
                                    <img
                                      src={application.merchants.logo}
                                      alt={application.merchants.name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        // 隐藏失败的图片，显示默认图标
                                        e.currentTarget.style.display = 'none';
                                        const sibling = e.currentTarget.nextElementSibling;
                                        if (sibling) {
                                          (sibling as HTMLElement).style.display = 'block';
                                        }
                                      }}
                                    />
                                    <Store className="h-6 w-6 text-gray-400" style={{ display: 'none' }} />
                                  </>
                                ) : (
                                  <Store className="h-6 w-6 text-gray-400" />
                                )}
                              </div>
                            </TableCell>
                            {/* 商家名称列 */}
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{application.merchants.name}</span>
                              </div>
                            </TableCell>
                            {/* 申请人列 */}
                            <TableCell>
                              <div className="text-sm">
                                <p className="font-medium">
                                  {application.profiles?.username || "未知用户"}
                                </p>
                                {application.user_email && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {application.user_email}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            {/* 押金金额列 */}
                            <TableCell>
                              <div className="text-sm">
                                <p className="font-medium text-blue-600">
                                  {application.deposit_amount.toLocaleString()} USDT
                                </p>
                              </div>
                            </TableCell>
                            {/* 退还金额列 */}
                            <TableCell>
                              <div className="text-sm">
                                <p className="font-medium text-green-600">
                                  {application.refund_amount.toLocaleString()} USDT
                                </p>
                              </div>
                            </TableCell>
                            {/* 手续费列 */}
                            <TableCell>
                              <div className="text-sm">
                                <p className="font-medium text-red-600">
                                  {application.fee_amount.toLocaleString()} USDT
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  ({application.fee_rate}%)
                                </p>
                              </div>
                            </TableCell>
                            {/* 持有天数列 */}
                            <TableCell>
                              <p className="text-sm">{holdingDays} 天</p>
                            </TableCell>
                            {/* 申请时间列 */}
                            <TableCell>
                              <p className="text-sm whitespace-nowrap">
                                {new Date(application.created_at).toLocaleDateString("zh-CN")}
                              </p>
                            </TableCell>
                            {/* 审核人列(仅非待审核状态显示) */}
                            {filterStatus !== "pending" && (
                              <TableCell>
                                <div className="text-sm">
                                  {application.reviewed_by_profile ? (
                                    <>
                                      <p className="font-medium">
                                        {application.reviewed_by_profile.username}
                                      </p>
                                      {application.reviewed_by_email && (
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                          {application.reviewed_by_email}
                                        </p>
                                      )}
                                    </>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </div>
                              </TableCell>
                            )}
                            {/* 状态列 */}
                            <TableCell>
                              {application.application_status === "pending" && (
                                <Badge variant="outline" className="border-yellow-300 bg-yellow-50 text-yellow-700">
                                  <Clock className="h-3 w-3 mr-1" />
                                  待审核
                                </Badge>
                              )}
                              {application.application_status === "approved" && (
                                <Badge variant="outline" className="border-green-300 bg-green-50 text-green-700">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  已通过
                                </Badge>
                              )}
                              {application.application_status === "rejected" && (
                                <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700">
                                  <XCircle className="h-3 w-3 mr-1" />
                                  已拒绝
                                </Badge>
                              )}
                            </TableCell>
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
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* 分页控件 */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      显示 {startIndex + 1} - {Math.min(endIndex, filteredApplications.length)} 条，共 {filteredApplications.length} 条
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

      {/* 批准对话框 */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>批准押金退还申请</DialogTitle>
            <DialogDescription>
              确认批准商家【{selectedApplication?.merchants.name}】的押金退还申请?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedApplication && (
              <>
                {/* 退还信息概览 */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="text-xs text-blue-700 mb-1">押金金额</div>
                    <div className="text-lg font-bold text-blue-900">
                      {selectedApplication.deposit_amount.toLocaleString()} USDT
                    </div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="text-xs text-red-700 mb-1">手续费 ({selectedApplication.fee_rate}%)</div>
                    <div className="text-lg font-bold text-red-900">
                      -{selectedApplication.fee_amount.toLocaleString()} USDT
                    </div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="text-xs text-green-700 mb-1">实际退还</div>
                    <div className="text-lg font-bold text-green-900">
                      {selectedApplication.refund_amount.toLocaleString()} USDT
                    </div>
                  </div>
                </div>

                {/* 收款信息 */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="text-sm font-medium">
                    收款信息
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">网络：</span>
                      <Badge variant="outline" className="ml-1">{selectedApplication.wallet_network}</Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">持有：</span>
                      <span className="font-medium">{calculateHoldingDays(selectedApplication.deposit_paid_at)} 天</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">钱包地址：</span>
                    <p className="font-mono text-xs mt-1 break-all bg-white p-2 rounded border">
                      {selectedApplication.wallet_address}
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* 退款交易哈希 */}
            <div className="space-y-2">
              <Label htmlFor="transaction-hash">
                退款交易哈希 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="transaction-hash"
                placeholder="请输入区块链交易哈希（TxHash）"
                value={transactionHash}
                onChange={(e) => setTransactionHash(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                完成链上转账后，请填写交易哈希作为退款凭证
              </p>
            </div>

            {/* 管理员备注 */}
            <div className="space-y-2">
              <Label htmlFor="admin-note">管理员备注（可选）</Label>
              <Textarea
                id="admin-note"
                placeholder="可以添加一些备注信息，用户将会在通知中看到"
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={2}
              />
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-1">
              <p className="text-sm font-medium text-green-900">批准后将执行以下操作：</p>
              <ul className="text-xs text-green-700 space-y-1 ml-4">
                <li>• 押金状态更新为"已退还"</li>
                <li>• 商家将不再是押金商家</li>
                <li>• 系统发送退还完成通知（包含交易哈希）</li>
                <li>• 记录管理员操作日志</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)} disabled={approving}>
              取消
            </Button>
            <Button
              onClick={handleApprove}
              disabled={approving || !transactionHash.trim()}
              className="bg-green-600 hover:bg-green-700"
            >
              {approving ? "批准中..." : "确认批准并退款"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 拒绝对话框 */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>拒绝押金退还申请</DialogTitle>
            <DialogDescription>
              拒绝商家【{selectedApplication?.merchants.name}】的押金退还申请，请填写拒绝原因
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reject-reason">
                拒绝原因 <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="reject-reason"
                placeholder="请详细说明拒绝原因，用户将会在通知中看到"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                required
              />
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
              <p className="text-sm font-medium text-red-900">拒绝后将执行以下操作：</p>
              <ul className="text-xs text-red-700 space-y-1 ml-4">
                <li>• 申请状态更新为"已拒绝"</li>
                <li>• 押金状态保持不变</li>
                <li>• 系统发送拒绝通知（包含拒绝原因）</li>
                <li>• 记录管理员操作日志</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)} disabled={rejecting}>
              取消
            </Button>
            <Button
              onClick={handleReject}
              disabled={rejecting || !rejectReason.trim()}
              variant="destructive"
            >
              {rejecting ? "拒绝中..." : "确认拒绝"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 详情对话框 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>押金退还申请详情</DialogTitle>
            <DialogDescription>查看商家押金退还申请的详细信息</DialogDescription>
          </DialogHeader>
          {selectedApplication && (
            <div className="space-y-4 py-4">
              {/* 商家信息 */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">商家信息</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <Label className="text-muted-foreground">商家名称</Label>
                    <p className="font-medium">{selectedApplication.merchants.name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">用户名</Label>
                    <p className="font-medium">{selectedApplication.profiles.username}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">登录邮箱</Label>
                    <p className="font-medium">{selectedApplication.user_email || "未设置"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">申请时间</Label>
                    <p className="font-medium">
                      {new Date(selectedApplication.created_at).toLocaleString("zh-CN")}
                    </p>
                  </div>
                </div>
              </div>

              {/* 退还金额信息 */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">退还金额</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="text-xs text-blue-700 mb-1">原押金</div>
                    <div className="text-xl font-bold text-blue-900">
                      {selectedApplication.deposit_amount.toLocaleString()} USDT
                    </div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="text-xs text-red-700 mb-1">手续费</div>
                    <div className="text-xl font-bold text-red-900">
                      -{selectedApplication.fee_amount.toLocaleString()} USDT
                    </div>
                    <div className="text-xs text-red-600 mt-1">({selectedApplication.fee_rate}%)</div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="text-xs text-green-700 mb-1">实际退还</div>
                    <div className="text-xl font-bold text-green-900">
                      {selectedApplication.refund_amount.toLocaleString()} USDT
                    </div>
                  </div>
                </div>
              </div>

              {/* 押金持有时间 */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">押金持有时间</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <Label className="text-muted-foreground">支付时间</Label>
                    <p className="font-medium">
                      {new Date(selectedApplication.deposit_paid_at).toLocaleString("zh-CN")}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">持有天数</Label>
                    <p className="font-medium">
                      {calculateHoldingDays(selectedApplication.deposit_paid_at)} 天
                    </p>
                  </div>
                </div>
              </div>

              {/* 收款信息 */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">收款信息</h3>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                  <div>
                    <Label className="text-muted-foreground">收款网络</Label>
                    <Badge variant="outline" className="ml-2">{selectedApplication.wallet_network}</Badge>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">收款地址</Label>
                    <p className="font-mono text-sm mt-1 break-all bg-white p-2 rounded border">
                      {selectedApplication.wallet_address}
                    </p>
                  </div>
                </div>
              </div>

              {/* 申请原因 */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">申请原因</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-slate-50 p-3 rounded border">
                  {selectedApplication.reason}
                </p>
              </div>
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
                  批准退还
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
                  拒绝退还
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
