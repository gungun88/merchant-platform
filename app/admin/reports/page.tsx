"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AdminLayout } from "@/components/admin-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getAllReports, approveReport, approveReportWithPenalty, rejectReport, getReportStats } from "@/lib/actions/report"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Search, Eye, CheckCircle, XCircle, AlertTriangle, Clock } from "lucide-react"

export default function ReportsManagement() {
  const router = useRouter()
  const [reports, setReports] = useState<any[]>([])
  const [filteredReports, setFilteredReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)

  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")

  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [selectedReport, setSelectedReport] = useState<any>(null)
  const [adminNote, setAdminNote] = useState("")
  const [processing, setProcessing] = useState(false)

  // 新增：处理方式和扣分
  const [approvalType, setApprovalType] = useState<"deactivate" | "penalty">("deactivate")
  const [penaltyPoints, setPenaltyPoints] = useState("10")

  const reportTypes = [
    { value: "欺诈", label: "欺诈", color: "text-red-600" },
    { value: "虚假宣传", label: "虚假宣传", color: "text-orange-600" },
    { value: "服务态度差", label: "服务态度差", color: "text-yellow-600" },
    { value: "质量问题", label: "质量问题", color: "text-blue-600" },
    { value: "其他", label: "其他", color: "text-gray-600" },
  ]

  // 提取数据加载逻辑为可复用函数
  const loadReportsData = async () => {
    const supabase = createClient()

    try {
      const statsData = await getReportStats()
      setStats(statsData)

      const reportsData = await getAllReports()

      if (reportsData && reportsData.length > 0) {
        // 获取所有需要的IDs
        const merchantIds = [...new Set(reportsData.map((r: any) => r.merchant_id))]
        const reporterIds = [...new Set(reportsData.map((r: any) => r.reporter_id))]

        // 获取商家信息
        const { data: merchants } = await supabase
          .from("merchants")
          .select("id, name, logo, credit_score")
          .in("id", merchantIds)

        // 获取举报者信息
        const { data: reporters } = await supabase
          .from("profiles")
          .select("id, username, report_count")
          .in("id", reporterIds)

        // 获取举报者邮箱
        const { getUserEmails } = await import("@/lib/actions/partners")
        const emailResult = await getUserEmails(reporterIds)
        const emailMap = emailResult.success ? emailResult.data : {}

        const enrichedReports = reportsData.map((report: any) => {
          const reporter = reporters?.find((r: any) => r.id === report.reporter_id)
          return {
            ...report,
            merchant: merchants?.find((m: any) => m.id === report.merchant_id),
            reporter: {
              ...reporter,
              email: emailMap?.[report.reporter_id]
            }
          }
        })

        setReports(enrichedReports)
        setFilteredReports(enrichedReports)
      } else {
        setReports([])
        setFilteredReports([])
      }
    } catch (error) {
      console.error("加载数据失败:", error)
      toast.error(error instanceof Error ? error.message : "加载数据失败")
    }
  }

  useEffect(() => {
    async function loadData() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/auth/login")
        return
      }

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

      if (!profile || profile.role !== "admin") {
        router.push("/")
        return
      }

      setLoading(true)
      await loadReportsData()
      setLoading(false)
    }

    loadData()
  }, [router])

  useEffect(() => {
    let filtered = [...reports]

    if (statusFilter !== "all") {
      filtered = filtered.filter((report) => report.status === statusFilter)
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter((report) => report.report_type === typeFilter)
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (report) =>
          report.merchant?.name?.toLowerCase().includes(term) ||
          report.report_reason?.toLowerCase().includes(term)
      )
    }

    setFilteredReports(filtered)
  }, [statusFilter, typeFilter, searchTerm, reports])

  const handleOpenDetail = (report: any) => {
    setSelectedReport(report)
    setDetailDialogOpen(true)
  }

  const handleOpenApprove = (report: any) => {
    setSelectedReport(report)
    setAdminNote("")
    setApproveDialogOpen(true)
  }

  const handleOpenReject = (report: any) => {
    setSelectedReport(report)
    setAdminNote("")
    setRejectDialogOpen(true)
  }

  const handleApprove = async () => {
    if (!selectedReport) return

    setProcessing(true)
    try {
      if (approvalType === "deactivate") {
        // 下架商家
        await approveReport(selectedReport.id, adminNote)
        toast.success(`举报已通过,商家【${selectedReport.merchant?.name}】已下架`)
      } else {
        // 扣除信用分
        const points = parseInt(penaltyPoints)
        if (isNaN(points) || points <= 0 || points > 100) {
          toast.error("扣分数量必须在1-100之间")
          return
        }
        const result = await approveReportWithPenalty(selectedReport.id, points, adminNote)
        toast.success(`举报已通过,商家【${selectedReport.merchant?.name}】已被扣除 ${points} 信用分，当前剩余 ${result.newScore} 分`)
      }

      setApproveDialogOpen(false)
      setAdminNote("")
      setApprovalType("deactivate")
      setPenaltyPoints("10")

      // 使用完整的数据加载函数来刷新数据
      await loadReportsData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败")
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedReport) return

    if (!adminNote || adminNote.trim().length === 0) {
      toast.error("请填写驳回原因")
      return
    }

    setProcessing(true)
    try {
      await rejectReport(selectedReport.id, adminNote)
      toast.success("举报已驳回")
      setRejectDialogOpen(false)

      // 使用完整的数据加载函数来刷新数据
      await loadReportsData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败")
    } finally {
      setProcessing(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />待处理</Badge>
      case "approved":
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />已通过</Badge>
      case "rejected":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />已驳回</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getTypeColor = (type: string) => {
    const typeObj = reportTypes.find((t) => t.value === type)
    return typeObj?.color || "text-gray-600"
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>加载中...</p>
      </div>
    )
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>举报管理</CardTitle>
                <CardDescription>管理和处理用户提交的举报</CardDescription>
              </div>
              {stats && (
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">总数:</span>
                    <span className="font-semibold">{stats.total}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-600">待处理:</span>
                    <span className="font-semibold text-amber-600">{stats.pending}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-600">已通过:</span>
                    <span className="font-semibold text-green-600">{stats.approved}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-red-600">已驳回:</span>
                    <span className="font-semibold text-red-600">{stats.rejected}</span>
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索商家名称、举报原因..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="pending">待处理</SelectItem>
                  <SelectItem value="approved">已通过</SelectItem>
                  <SelectItem value="rejected">已驳回</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  {reportTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-sm text-muted-foreground whitespace-nowrap">
                共 {filteredReports.length} 条
              </div>
            </div>
          </CardContent>

          <CardContent className="p-0">
            {filteredReports.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                暂无举报记录
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        商家
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        举报者
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        举报类型
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        举报原因
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        状态
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        举报时间
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredReports.map((report) => (
                      <tr key={report.id} className="hover:bg-muted/30 transition-colors">
                        {/* 商家列 */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {report.merchant?.logo && (
                              <img
                                src={report.merchant.logo}
                                alt={report.merchant.name}
                                className="h-8 w-8 rounded-full mr-2"
                              />
                            )}
                            <div className="text-sm font-medium">
                              {report.merchant?.name || "未知商家"}
                            </div>
                          </div>
                        </td>
                        {/* 举报者列 */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="text-sm">
                              <div className="font-medium">
                                {report.reporter?.username || "未知用户"}
                              </div>
                              {report.reporter?.email && (
                                <div className="text-xs text-muted-foreground">
                                  {report.reporter.email}
                                </div>
                              )}
                              {report.reporter_contact && (
                                <div className="text-xs text-blue-600 font-medium">
                                  {report.reporter_contact}
                                </div>
                              )}
                              {report.reporter?.report_count !== undefined && (
                                <div className="text-xs text-amber-600 font-medium">
                                  累计举报: {report.reporter.report_count} 次
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        {/* 举报类型列 */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge variant="outline" className={getTypeColor(report.report_type)}>
                            {report.report_type}
                          </Badge>
                        </td>
                        {/* 举报原因列 */}
                        <td className="px-6 py-4">
                          <div className="text-sm text-muted-foreground max-w-xs truncate">
                            {report.report_reason}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(report.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {new Date(report.created_at).toLocaleString("zh-CN")}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDetail(report)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {report.status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => handleOpenApprove(report)}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  通过
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleOpenReject(report)}
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  驳回
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>举报详细信息</DialogTitle>
              <DialogDescription>查看举报的详细信息</DialogDescription>
            </DialogHeader>
            {selectedReport && (
              <div className="space-y-4 py-4">
                {/* 举报者信息 */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">举报者信息</h3>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-base text-amber-900">
                          {selectedReport.reporter?.username || "未知用户"}
                        </p>
                        {selectedReport.reporter?.report_count !== undefined && (
                          <span className="text-xs text-amber-700">
                            (累计举报 {selectedReport.reporter.report_count} 次)
                          </span>
                        )}
                      </div>
                      {selectedReport.reporter?.email && (
                        <p className="text-xs text-amber-700">
                          邮箱: {selectedReport.reporter.email}
                        </p>
                      )}
                      {selectedReport.reporter_contact && (
                        <p className="text-sm text-blue-700 font-medium">
                          {selectedReport.reporter_contact}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 举报基本信息 */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">举报信息</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <Label className="text-muted-foreground">举报商家</Label>
                      <div className="flex items-center gap-2 mt-1">
                        {selectedReport.merchant?.logo && (
                          <img
                            src={selectedReport.merchant.logo}
                            alt={selectedReport.merchant.name}
                            className="h-6 w-6 rounded-full"
                          />
                        )}
                        <p className="font-medium">
                          {selectedReport.merchant?.name || "未知商家"}
                        </p>
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">举报类型</Label>
                      <div className="mt-1">
                        <Badge variant="outline" className={getTypeColor(selectedReport.report_type)}>
                          {selectedReport.report_type}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">举报时间</Label>
                      <p className="font-medium mt-1">
                        {new Date(selectedReport.created_at).toLocaleString("zh-CN")}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">处理状态</Label>
                      <div className="mt-1">{getStatusBadge(selectedReport.status)}</div>
                    </div>
                    {selectedReport.processed_at && (
                      <div className="col-span-2">
                        <Label className="text-muted-foreground">处理时间</Label>
                        <p className="font-medium mt-1">
                          {new Date(selectedReport.processed_at).toLocaleString("zh-CN")}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 举报原因 */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">举报原因</h3>
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-sm whitespace-pre-wrap">
                      {selectedReport.report_reason || "无"}
                    </p>
                  </div>
                </div>

                {/* 证据图片 */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">
                    证据图片
                    {selectedReport.evidence_urls && selectedReport.evidence_urls.length > 0 && (
                      <span className="text-xs ml-1 text-muted-foreground">
                        ({selectedReport.evidence_urls.length}张)
                      </span>
                    )}
                  </h3>
                  {selectedReport.evidence_urls && selectedReport.evidence_urls.length > 0 ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-3">
                        {selectedReport.evidence_urls.map((url: string, index: number) => (
                          <div key={index} className="relative group">
                            <img
                              src={url}
                              alt={`证据${index + 1}`}
                              className="w-full h-48 object-cover rounded border cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(url, '_blank')}
                            />
                            <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                              {index + 1}/{selectedReport.evidence_urls.length}
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground text-center">
                        点击图片在新窗口中查看原图
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">未上传证据图片</p>
                  )}
                </div>

                {/* 管理员备注 */}
                {selectedReport.admin_note && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm">管理员备注</h3>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm whitespace-pre-wrap text-blue-900">
                        {selectedReport.admin_note}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
                关闭
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>通过举报</DialogTitle>
              <DialogDescription>
                请选择处理方式
              </DialogDescription>
            </DialogHeader>
            {selectedReport && (
              <div className="space-y-4">
                {/* 处理方式选择 */}
                <div className="space-y-2">
                  <Label>处理方式 *</Label>
                  <Select value={approvalType} onValueChange={(value: "deactivate" | "penalty") => setApprovalType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deactivate">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                          <span>下架商家（严重违规）</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="penalty">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <span>扣除信用分（轻中度违规）</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 提示信息 */}
                {approvalType === "deactivate" ? (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      商家【{selectedReport.merchant?.name}】将被标记为违规并下架,请谨慎操作。
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <Alert className="border-amber-200 bg-amber-50">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-800">
                        商家【{selectedReport.merchant?.name}】将被扣除信用分。当前信用分：{selectedReport.merchant?.credit_score || 100} 分
                      </AlertDescription>
                    </Alert>

                    {/* 扣分输入 */}
                    <div className="space-y-2">
                      <Label htmlFor="penalty-points">扣除信用分 *</Label>
                      <div className="flex gap-2">
                        <Input
                          id="penalty-points"
                          type="number"
                          min="1"
                          max="100"
                          value={penaltyPoints}
                          onChange={(e) => setPenaltyPoints(e.target.value)}
                          className="flex-1"
                        />
                        <span className="flex items-center text-sm text-muted-foreground">分</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        建议：轻微违规 5-10分 | 中等违规 20-30分 | 严重违规直接下架
                      </p>
                      {selectedReport.merchant?.credit_score && (
                        <p className="text-xs text-amber-600">
                          扣分后剩余：{Math.max(0, (selectedReport.merchant.credit_score || 100) - parseInt(penaltyPoints || "0"))} 分
                          {Math.max(0, (selectedReport.merchant.credit_score || 100) - parseInt(penaltyPoints || "0")) === 0 && (
                            <span className="text-red-600 font-medium"> （将自动下架）</span>
                          )}
                        </p>
                      )}
                    </div>
                  </>
                )}

                {/* 备注 */}
                <div className="space-y-2">
                  <Label htmlFor="approve-note">处理备注{approvalType === "penalty" && " *"}</Label>
                  <Textarea
                    id="approve-note"
                    placeholder={approvalType === "penalty" ? "请详细说明扣分原因..." : "填写处理备注..."}
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    rows={3}
                    className="mt-2"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setApproveDialogOpen(false)} disabled={processing}>
                取消
              </Button>
              <Button
                onClick={handleApprove}
                disabled={processing || (approvalType === "penalty" && !adminNote.trim())}
                className={approvalType === "deactivate" ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"}
              >
                {processing ? "处理中..." : approvalType === "deactivate" ? "确认下架" : "确认扣分"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>驳回举报</DialogTitle>
              <DialogDescription>
                请填写驳回原因,将通知举报人。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="reject-note">驳回原因 *</Label>
                <Textarea
                  id="reject-note"
                  placeholder="请详细说明驳回的原因..."
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={4}
                  className="mt-2"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)} disabled={processing}>
                取消
              </Button>
              <Button onClick={handleReject} disabled={processing} variant="destructive">
                {processing ? "处理中..." : "确认驳回"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  )
}
