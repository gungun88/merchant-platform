"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { getPointTransactions, getPointsStatistics, type PointTransaction, type PointsStatistics } from "@/lib/actions/points"
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  UserPlus,
  Award,
  Users,
  Eye,
  ArrowUp,
  ArrowLeft,
  Settings,
  ChevronLeft,
  ChevronRight,
  History,
  Home
} from "lucide-react"
import { cn } from "@/lib/utils"

// 交易类型配置
const TRANSACTION_TYPES = {
  registration: { label: "注册奖励", icon: UserPlus, color: "text-green-600" },
  checkin: { label: "每日签到", icon: Calendar, color: "text-blue-600" },
  daily_login: { label: "每日登录奖励", icon: Calendar, color: "text-blue-600" },
  merchant_cert: { label: "商家认证", icon: Award, color: "text-purple-600" },
  merchant_register: { label: "商家入驻", icon: Award, color: "text-purple-600" },
  merchant_edit: { label: "编辑商家信息", icon: Settings, color: "text-gray-600" },
  invitation: { label: "邀请好友", icon: Users, color: "text-orange-600" },
  invitation_reward: { label: "邀请好友", icon: Users, color: "text-orange-600" },
  invited_reward: { label: "受邀注册", icon: Users, color: "text-green-600" },
  merchant_top: { label: "商家置顶", icon: ArrowUp, color: "text-red-600" },
  view_contact: { label: "查看联系方式", icon: Eye, color: "text-gray-600" },
  contact_viewed: { label: "联系方式被查看", icon: Eye, color: "text-orange-600" },
  topped_promotion: { label: "置顶推广", icon: ArrowUp, color: "text-red-600" },
  profile_complete: { label: "完善资料", icon: Settings, color: "text-blue-600" },
  points_reward: { label: "积分奖励", icon: Award, color: "text-yellow-600" },
  system_adjustment: { label: "系统调整", icon: Settings, color: "text-gray-600" },
  group_reward: { label: "用户组奖励", icon: Users, color: "text-green-600" },
  coin_exchange: { label: "硬币兑换积分", icon: History, color: "text-emerald-600" },
}

export default function PointsHistoryPage() {
  const [transactions, setTransactions] = useState<PointTransaction[]>([])
  const [statistics, setStatistics] = useState<PointsStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)

  // 筛选和分页状态
  const [filterType, setFilterType] = useState<string>("all")
  const [filterCategory, setFilterCategory] = useState<string>("all")
  const [timeRange, setTimeRange] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // 加载统计信息
  async function loadStats() {
    setStatsLoading(true)
    const result = await getPointsStatistics()
    if (result.success) {
      setStatistics(result.data)
    }
    setStatsLoading(false)
  }

  // 初始加载统计信息
  useEffect(() => {
    loadStats()
  }, [])

  // 加载交易记录
  useEffect(() => {
    async function loadTransactions() {
      setLoading(true)

      // 计算时间范围
      let startDate: string | null = null
      let endDate: string | null = null
      const now = new Date()

      if (timeRange === "7days") {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      } else if (timeRange === "30days") {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
      } else if (timeRange === "3months") {
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
      }

      // 确定筛选类型
      let type: string | null = null
      if (filterType === "income" || filterType === "expense") {
        type = filterType
      } else if (filterCategory !== "all") {
        type = filterCategory
      }

      const result = await getPointTransactions({
        page: currentPage,
        limit: 20,
        type,
        startDate,
        endDate,
      })

      if (result.success && result.data && result.pagination) {
        setTransactions(result.data)
        setTotalPages(result.pagination.totalPages)
        setTotal(result.pagination.total)
      }

      setLoading(false)

      // 每次加载交易记录后，也刷新统计信息
      loadStats()
    }

    loadTransactions()
  }, [currentPage, filterType, filterCategory, timeRange])

  // 获取交易类型信息
  const getTypeInfo = (type: string) => {
    return TRANSACTION_TYPES[type as keyof typeof TRANSACTION_TYPES] || {
      label: type,
      icon: History,
      color: "text-gray-600",
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 max-w-5xl">
      <div className="mb-8">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回首页
          </Button>
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold mb-2">积分记录</h1>
        <p className="text-muted-foreground text-sm md:text-base">查看您的积分获取和消费记录</p>
      </div>

      {/* 统一的大表格 */}
      <Card>
        <CardContent className="p-3 md:p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm">
              <tbody>
                {/* 筛选条件行 - 调整到顶部 */}
                <tr className="border-b bg-muted/50">
                  <td colSpan={5} className="py-2 md:py-3 px-2 md:px-4">
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-6">
                      <div className="flex items-center gap-2 w-full md:w-auto">
                        <span className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">交易方向:</span>
                        <Select value={filterType} onValueChange={setFilterType}>
                          <SelectTrigger className="h-8 md:h-9 w-full md:w-[140px] text-xs md:text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">全部</SelectItem>
                            <SelectItem value="income">收入</SelectItem>
                            <SelectItem value="expense">支出</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="hidden md:block h-5 w-px bg-border"></div>
                      <div className="flex items-center gap-2 w-full md:w-auto">
                        <span className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">交易类型:</span>
                        <Select value={filterCategory} onValueChange={setFilterCategory}>
                          <SelectTrigger className="h-8 md:h-9 w-full md:w-[140px] text-xs md:text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">全部类型</SelectItem>
                            <SelectItem value="registration">注册奖励</SelectItem>
                            <SelectItem value="checkin">每日签到</SelectItem>
                            <SelectItem value="merchant_cert">商家认证</SelectItem>
                            <SelectItem value="invitation">邀请好友</SelectItem>
                            <SelectItem value="view_contact">查看联系方式</SelectItem>
                            <SelectItem value="contact_viewed">联系方式被查看</SelectItem>
                            <SelectItem value="topped_promotion">置顶推广</SelectItem>
                            <SelectItem value="points_reward">积分奖励</SelectItem>
                            <SelectItem value="system_adjustment">系统调整</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="hidden md:block h-5 w-px bg-border"></div>
                      <div className="flex items-center gap-2 w-full md:w-auto">
                        <span className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">时间范围:</span>
                        <Select value={timeRange} onValueChange={setTimeRange}>
                          <SelectTrigger className="h-8 md:h-9 w-full md:w-[140px] text-xs md:text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">全部时间</SelectItem>
                            <SelectItem value="7days">最近7天</SelectItem>
                            <SelectItem value="30days">最近30天</SelectItem>
                            <SelectItem value="3months">最近3个月</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </td>
                </tr>

                {/* 统计数据行 - 左对齐紧凑布局 */}
                <tr className="border-b">
                  <td colSpan={5} className="py-2 md:py-3 px-2 md:px-4">
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-6">
                      <div className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                        <span className="text-muted-foreground">当前积分:</span>
                        {statsLoading ? (
                          <Skeleton className="h-6 w-16" />
                        ) : (
                          <span className="text-lg md:text-xl font-bold text-blue-600">
                            {statistics?.current_points || 0}
                          </span>
                        )}
                      </div>
                      <div className="hidden md:block h-5 w-px bg-border"></div>
                      <div className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                        <span className="text-muted-foreground">累计获得:</span>
                        {statsLoading ? (
                          <Skeleton className="h-6 w-16" />
                        ) : (
                          <span className="text-lg md:text-xl font-bold text-green-600">
                            +{statistics?.total_earned || 0}
                          </span>
                        )}
                      </div>
                      <div className="hidden md:block h-5 w-px bg-border"></div>
                      <div className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                        <span className="text-muted-foreground">累计消耗:</span>
                        {statsLoading ? (
                          <Skeleton className="h-6 w-16" />
                        ) : (
                          <span className="text-lg md:text-xl font-bold text-red-600">
                            -{statistics?.total_spent || 0}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>

                {/* 交易记录标题行 - 优化列宽 */}
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-2 md:py-3 px-2 md:px-4 font-medium text-xs md:text-sm text-muted-foreground w-[120px] md:w-[180px]">类型</th>
                  <th className="text-left py-2 md:py-3 px-2 md:px-4 font-medium text-xs md:text-sm text-muted-foreground">描述</th>
                  <th className="text-left py-2 md:py-3 px-2 md:px-4 font-medium text-xs md:text-sm text-muted-foreground w-[100px] md:w-[160px]">时间</th>
                  <th className="text-right py-2 md:py-3 px-2 md:px-4 font-medium text-xs md:text-sm text-muted-foreground w-[80px] md:w-[120px]">积分变动</th>
                  <th className="text-right py-2 md:py-3 px-2 md:px-4 font-medium text-xs md:text-sm text-muted-foreground w-[80px] md:w-[120px]">余额</th>
                </tr>
              </tbody>

              {/* 交易记录数据 */}
              <tbody>
                {loading ? (
                  // 加载状态
                  <>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <tr key={i} className="border-b">
                        <td colSpan={5} className="py-3 md:py-4 px-2 md:px-4">
                          <Skeleton className="h-12 w-full" />
                        </td>
                      </tr>
                    ))}
                  </>
                ) : transactions.length === 0 ? (
                  // 空状态
                  <tr>
                    <td colSpan={5} className="py-12">
                      <div className="text-center">
                        <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground mb-4">暂无积分记录</p>
                        <Link href="/">
                          <Button variant="outline">去赚取积分</Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                  // 交易记录
                  <>
                    {transactions.map((transaction) => {
                      const typeInfo = getTypeInfo(transaction.type)
                      const TypeIcon = typeInfo.icon
                      const isIncome = transaction.amount > 0

                      return (
                        <tr
                          key={transaction.id}
                          className="border-b hover:bg-accent/50 transition-colors"
                        >
                          {/* 类型列 */}
                          <td className="py-3 md:py-4 px-2 md:px-4">
                            <div className="flex items-center gap-2">
                              <div
                                className={cn(
                                  "h-8 md:h-10 w-8 md:w-10 rounded-full flex items-center justify-center shrink-0",
                                  isIncome ? "bg-green-100" : "bg-red-100"
                                )}
                              >
                                <TypeIcon
                                  className={cn("h-4 md:h-5 w-4 md:w-5", isIncome ? "text-green-600" : "text-red-600")}
                                />
                              </div>
                              <div className="hidden md:block">
                                <div className="font-medium text-xs md:text-sm">{typeInfo.label}</div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  {isIncome ? (
                                    <>
                                      <TrendingUp className="h-3 w-3 text-green-600" />
                                      <span className="text-green-600">收入</span>
                                    </>
                                  ) : (
                                    <>
                                      <TrendingDown className="h-3 w-3 text-red-600" />
                                      <span className="text-red-600">支出</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 描述列 */}
                          <td className="py-3 md:py-4 px-2 md:px-4">
                            <p className="text-xs md:text-sm text-muted-foreground max-w-md line-clamp-2">
                              {transaction.description}
                            </p>
                          </td>

                          {/* 时间列 */}
                          <td className="py-3 md:py-4 px-2 md:px-4">
                            <p className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">
                              {new Date(transaction.created_at).toLocaleString("zh-CN", {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </td>

                          {/* 积分变动列 */}
                          <td className="py-3 md:py-4 px-2 md:px-4 text-right">
                            <p
                              className={cn(
                                "text-sm md:text-base font-bold whitespace-nowrap",
                                isIncome ? "text-green-600" : "text-red-600"
                              )}
                            >
                              {isIncome ? "+" : ""}
                              {transaction.amount}
                            </p>
                          </td>

                          {/* 余额列 */}
                          <td className="py-3 md:py-4 px-2 md:px-4 text-right">
                            <p className="text-xs md:text-sm font-medium whitespace-nowrap">
                              {transaction.balance_after}
                            </p>
                          </td>
                        </tr>
                      )
                    })}
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          {!loading && transactions.length > 0 && totalPages > 1 && (
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between px-2 md:px-4 py-3 md:py-4 border-t gap-3">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  下一页
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground">
                第 {currentPage} / {totalPages} 页，共 {total} 条记录
              </p>
            </div>
          )}

          {/* 当没有分页时也显示记录数 */}
          {!loading && transactions.length > 0 && totalPages <= 1 && (
            <div className="flex items-center justify-end px-2 md:px-4 py-3 md:py-4 border-t">
              <p className="text-xs md:text-sm text-muted-foreground">
                共 {total} 条记录
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
