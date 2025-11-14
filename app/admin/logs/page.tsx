"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
import {
  FileText,
  Search,
  Filter,
  AlertCircle,
  User,
  Store,
  Shield,
  Settings,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"

interface AdminLog {
  id: string
  admin_id: string
  admin_username: string
  admin_email: string
  action_type: string
  target_type: string | null
  target_id: string | null
  old_data: any
  new_data: any
  description: string | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

// 操作类型配置
const ACTION_TYPES = {
  user_ban: { label: "封禁用户", color: "destructive", icon: AlertCircle },
  user_unban: { label: "解封用户", color: "default", icon: User },
  merchant_approve: { label: "审核通过商家", color: "default", icon: Store },
  merchant_reject: { label: "拒绝商家", color: "destructive", icon: Store },
  deposit_approve: { label: "押金申请通过", color: "default", icon: Shield },
  deposit_reject: { label: "押金申请拒绝", color: "destructive", icon: Shield },
  refund_approve: { label: "退款申请通过", color: "default", icon: Shield },
  refund_reject: { label: "退款申请拒绝", color: "destructive", icon: Shield },
  report_handle: { label: "处理举报", color: "default", icon: AlertCircle },
  partner_approve: { label: "合作伙伴审核通过", color: "default", icon: User },
  partner_reject: { label: "合作伙伴审核拒绝", color: "destructive", icon: User },
  announcement_create: { label: "创建公告", color: "default", icon: FileText },
  announcement_update: { label: "更新公告", color: "default", icon: FileText },
  announcement_delete: { label: "删除公告", color: "destructive", icon: FileText },
  settings_update: { label: "更新系统设置", color: "default", icon: Settings },
} as const

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AdminLog[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [actionFilter, setActionFilter] = useState<string>("all")
  const [targetFilter, setTargetFilter] = useState<string>("all")
  const [selectedLog, setSelectedLog] = useState<AdminLog | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const pageSize = 20

  useEffect(() => {
    loadLogs()
  }, [currentPage, actionFilter, targetFilter, searchQuery])

  async function loadLogs() {
    try {
      setLoading(true)
      const supabase = createClient()

      // 构建查询
      let query = supabase
        .from("admin_logs_with_details")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })

      // 应用筛选条件
      if (actionFilter !== "all") {
        query = query.eq("action_type", actionFilter)
      }

      if (targetFilter !== "all") {
        query = query.eq("target_type", targetFilter)
      }

      if (searchQuery) {
        query = query.or(
          `admin_username.ilike.%${searchQuery}%,admin_email.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`
        )
      }

      // 分页
      const from = (currentPage - 1) * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) {
        console.error("加载日志失败:", error)
        return
      }

      setLogs(data || [])
      setTotalPages(Math.ceil((count || 0) / pageSize))
    } catch (error) {
      console.error("Error loading logs:", error)
    } finally {
      setLoading(false)
    }
  }

  function getActionTypeConfig(actionType: string) {
    return (
      ACTION_TYPES[actionType as keyof typeof ACTION_TYPES] || {
        label: actionType,
        color: "default",
        icon: FileText,
      }
    )
  }

  function formatDateTime(dateString: string) {
    return format(new Date(dateString), "yyyy年MM月dd日 HH:mm:ss", { locale: zhCN })
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-8 w-8" />
            系统日志
          </h1>
          <p className="text-muted-foreground mt-1">查看和审计所有管理员操作记录</p>
        </div>

        {/* 筛选和搜索 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              筛选条件
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              {/* 搜索框 */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索管理员或描述..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="pl-9"
                />
              </div>

              {/* 筛选器组 */}
              <div className="flex gap-2">
                {/* 操作类型筛选 */}
                <Select
                  value={actionFilter}
                  onValueChange={(value) => {
                    setActionFilter(value)
                    setCurrentPage(1)
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="操作类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部操作</SelectItem>
                    <SelectItem value="user_ban">封禁用户</SelectItem>
                    <SelectItem value="user_unban">解封用户</SelectItem>
                    <SelectItem value="merchant_approve">审核通过商家</SelectItem>
                    <SelectItem value="merchant_reject">拒绝商家</SelectItem>
                    <SelectItem value="deposit_approve">押金申请通过</SelectItem>
                    <SelectItem value="deposit_reject">押金申请拒绝</SelectItem>
                    <SelectItem value="refund_approve">退款申请通过</SelectItem>
                    <SelectItem value="refund_reject">退款申请拒绝</SelectItem>
                    <SelectItem value="report_handle">处理举报</SelectItem>
                    <SelectItem value="partner_approve">合作伙伴通过</SelectItem>
                    <SelectItem value="partner_reject">合作伙伴拒绝</SelectItem>
                    <SelectItem value="announcement_create">创建公告</SelectItem>
                    <SelectItem value="announcement_update">更新公告</SelectItem>
                    <SelectItem value="announcement_delete">删除公告</SelectItem>
                    <SelectItem value="settings_update">更新设置</SelectItem>
                  </SelectContent>
                </Select>

                {/* 目标类型筛选 */}
                <Select
                  value={targetFilter}
                  onValueChange={(value) => {
                    setTargetFilter(value)
                    setCurrentPage(1)
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="目标类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部目标</SelectItem>
                    <SelectItem value="user">用户</SelectItem>
                    <SelectItem value="merchant">商家</SelectItem>
                    <SelectItem value="deposit_application">押金申请</SelectItem>
                    <SelectItem value="refund_application">退款申请</SelectItem>
                    <SelectItem value="report">举报</SelectItem>
                    <SelectItem value="partner">合作伙伴</SelectItem>
                    <SelectItem value="announcement">公告</SelectItem>
                    <SelectItem value="settings">系统设置</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 日志列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">操作记录</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">加载中...</div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">暂无日志记录</div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>时间</TableHead>
                        <TableHead>管理员</TableHead>
                        <TableHead>操作类型</TableHead>
                        <TableHead>目标类型</TableHead>
                        <TableHead>描述</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => {
                        const config = getActionTypeConfig(log.action_type)
                        const Icon = config.icon
                        return (
                          <TableRow key={log.id}>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {formatDateTime(log.created_at)}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium text-sm">
                                  {log.admin_username || "未知"}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {log.admin_email}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={config.color as any} className="flex items-center gap-1 w-fit">
                                <Icon className="h-3 w-3" />
                                {config.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {log.target_type || "-"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm line-clamp-2">
                                {log.description || "-"}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedLog(log)}
                              >
                                查看详情
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* 分页 */}
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    第 {currentPage} 页,共 {totalPages} 页
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      下一页
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 日志详情弹窗 */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>日志详情</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">时间</label>
                  <p className="text-sm mt-1">{formatDateTime(selectedLog.created_at)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">管理员</label>
                  <p className="text-sm mt-1">
                    {selectedLog.admin_username} ({selectedLog.admin_email})
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">操作类型</label>
                  <p className="text-sm mt-1">
                    <Badge variant={getActionTypeConfig(selectedLog.action_type).color as any}>
                      {getActionTypeConfig(selectedLog.action_type).label}
                    </Badge>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">目标类型</label>
                  <p className="text-sm mt-1">{selectedLog.target_type || "-"}</p>
                </div>
                {selectedLog.target_id && (
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">目标ID</label>
                    <p className="text-sm mt-1 font-mono bg-muted p-2 rounded">
                      {selectedLog.target_id}
                    </p>
                  </div>
                )}
                {selectedLog.ip_address && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">IP地址</label>
                    <p className="text-sm mt-1">{selectedLog.ip_address}</p>
                  </div>
                )}
              </div>

              {/* 描述 */}
              {selectedLog.description && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">操作描述</label>
                  <p className="text-sm mt-1 bg-muted p-3 rounded">{selectedLog.description}</p>
                </div>
              )}

              {/* 操作前数据 */}
              {selectedLog.old_data && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">操作前数据</label>
                  <pre className="text-xs mt-1 bg-muted p-3 rounded overflow-x-auto">
                    {JSON.stringify(selectedLog.old_data, null, 2)}
                  </pre>
                </div>
              )}

              {/* 操作后数据 */}
              {selectedLog.new_data && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">操作后数据</label>
                  <pre className="text-xs mt-1 bg-muted p-3 rounded overflow-x-auto">
                    {JSON.stringify(selectedLog.new_data, null, 2)}
                  </pre>
                </div>
              )}

              {/* User Agent */}
              {selectedLog.user_agent && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">浏览器信息</label>
                  <p className="text-xs mt-1 bg-muted p-3 rounded break-all">
                    {selectedLog.user_agent}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
