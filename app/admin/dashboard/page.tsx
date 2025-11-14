"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AdminLayout } from "@/components/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { Users, Store, AlertCircle, Coins, TrendingUp, CheckCircle, Handshake, ArrowUpCircle } from "lucide-react"

interface Stats {
  totalUsers: number
  totalMerchants: number
  pendingReports: number
  pendingDeposits: number
  totalDepositAmount: number
  depositMerchants: number
  pendingRefunds: number
  pendingPartners: number
  pendingTopUps: number
}

export default function AdminDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalMerchants: 0,
    pendingReports: 0,
    pendingDeposits: 0,
    totalDepositAmount: 0,
    depositMerchants: 0,
    pendingRefunds: 0,
    pendingPartners: 0,
    pendingTopUps: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      try {
        const supabase = createClient()

        // 获取总用户数
        const { count: usersCount } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })

        // 获取总商家数
        const { count: merchantsCount } = await supabase
          .from("merchants")
          .select("*", { count: "exact", head: true })

        // 获取待处理举报数
        const { count: reportsCount } = await supabase
          .from("merchant_reports")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending")

        // 获取待审核押金申请数
        const { count: depositsCount } = await supabase
          .from("deposit_merchant_applications")
          .select("*", { count: "exact", head: true })
          .eq("application_status", "pending")

        // 获取押金总额
        const { data: depositData } = await supabase
          .from("merchants")
          .select("deposit_amount")
          .eq("is_deposit_merchant", true)

        const totalDepositAmount = depositData?.reduce((sum, item) => sum + (item.deposit_amount || 0), 0) || 0

        // 获取押金商家数
        const { count: depositMerchantsCount } = await supabase
          .from("merchants")
          .select("*", { count: "exact", head: true })
          .eq("is_deposit_merchant", true)

        // 获取待审核退还申请数
        const { count: refundsCount } = await supabase
          .from("deposit_refund_applications")
          .select("*", { count: "exact", head: true })
          .eq("application_status", "pending")

        // 获取待审核合作伙伴申请数
        const { count: partnersCount } = await supabase
          .from("partners")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending")

        // 获取待审核追加押金申请数
        const { count: topUpsCount } = await supabase
          .from("deposit_top_up_applications")
          .select("*", { count: "exact", head: true })
          .eq("application_status", "pending")

        setStats({
          totalUsers: usersCount || 0,
          totalMerchants: merchantsCount || 0,
          pendingReports: reportsCount || 0,
          pendingDeposits: depositsCount || 0,
          totalDepositAmount,
          depositMerchants: depositMerchantsCount || 0,
          pendingRefunds: refundsCount || 0,
          pendingPartners: partnersCount || 0,
          pendingTopUps: topUpsCount || 0,
        })
      } catch (error) {
        console.error("Error loading stats:", error)
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [])

  const statCards = [
    {
      title: "总用户数",
      value: stats.totalUsers,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      href: "/admin/users",
    },
    {
      title: "总商家数",
      value: stats.totalMerchants,
      icon: Store,
      color: "text-green-600",
      bgColor: "bg-green-50",
      href: "/admin/merchants",
    },
    {
      title: "押金商家数",
      value: stats.depositMerchants,
      icon: CheckCircle,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      href: "/admin/merchants",
    },
    {
      title: "待审核押金申请",
      value: stats.pendingDeposits,
      icon: Coins,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      alert: stats.pendingDeposits > 0,
      href: "/admin/deposits/applications",
    },
    {
      title: "待审核退还申请",
      value: stats.pendingRefunds,
      icon: AlertCircle,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      alert: stats.pendingRefunds > 0,
      href: "/admin/deposits/refunds",
    },
    {
      title: "待审核追加押金",
      value: stats.pendingTopUps,
      icon: ArrowUpCircle,
      color: "text-cyan-600",
      bgColor: "bg-cyan-50",
      alert: stats.pendingTopUps > 0,
      href: "/admin/deposits/top-ups",
    },
    {
      title: "待审核合作伙伴",
      value: stats.pendingPartners,
      icon: Handshake,
      color: "text-teal-600",
      bgColor: "bg-teal-50",
      alert: stats.pendingPartners > 0,
      href: "/admin/partners",
    },
    {
      title: "待处理举报",
      value: stats.pendingReports,
      icon: AlertCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
      alert: stats.pendingReports > 0,
      href: "/admin/reports",
    },
    {
      title: "押金总额",
      value: `${stats.totalDepositAmount.toLocaleString()} USDT`,
      icon: TrendingUp,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
      href: "/admin/deposits/applications",
    },
  ]

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-3xl font-bold">管理后台概览</h1>
          <p className="text-muted-foreground mt-1">跨境服务商平台管理系统</p>
        </div>

        {/* 统计卡片 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {statCards.map((card) => (
            <Card
              key={card.title}
              className={`cursor-pointer hover:shadow-lg transition-shadow ${card.alert ? "border-red-200" : ""}`}
              onClick={() => router.push(card.href)}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline justify-between">
                  <div className="text-2xl font-bold">
                    {loading ? "..." : card.value}
                  </div>
                  {card.alert && (
                    <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded">
                      待处理
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 快捷操作 */}
        <div>
          <h2 className="text-xl font-semibold mb-4">快捷操作</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => router.push('/admin/merchants')}
            >
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-purple-600" />
                  商家认证审核
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  审核商家认证申请
                </p>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => router.push('/admin/deposits/applications')}
            >
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Coins className="h-5 w-5 text-amber-600" />
                  押金申请审核
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  审核押金商家申请
                </p>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => router.push('/admin/deposits/top-ups')}
            >
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowUpCircle className="h-5 w-5 text-cyan-600" />
                  追加押金审核
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  审核商家追加押金申请
                </p>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => router.push('/admin/reports')}
            >
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  举报处理
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  处理用户举报
                </p>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => router.push('/admin/merchants')}
            >
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Store className="h-5 w-5 text-green-600" />
                  商家管理
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  管理所有商家
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 最近活动 */}
        <div>
          <h2 className="text-xl font-semibold mb-4">系统状态</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">系统运行状态</span>
                  <span className="text-sm font-medium text-green-600">正常</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">数据库连接</span>
                  <span className="text-sm font-medium text-green-600">正常</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">待处理任务</span>
                  <span className="text-sm font-medium">
                    {stats.pendingDeposits + stats.pendingRefunds + stats.pendingTopUps + stats.pendingPartners + stats.pendingReports} 项
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}
