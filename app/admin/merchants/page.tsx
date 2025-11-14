"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
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
import { Checkbox } from "@/components/ui/checkbox"
import { CheckCircle, XCircle, Eye, Store, AlertTriangle, ShieldCheck, ShieldX, Pencil, Pin } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import {
  adminGetMerchants,
  adminActivateMerchant,
  adminDeactivateMerchant,
  adminViolateMerchant,
  adminCompleteCompensation,
  adminPinMerchant,
  adminUnpinMerchant,
} from "@/lib/actions/merchant"

interface Merchant {
  id: string
  user_id: string
  name: string
  logo: string | null
  description: string
  short_desc: string | null
  service_types: string[]
  location: string | null
  is_active: boolean
  is_deposit_merchant: boolean
  deposit_amount: number
  deposit_status: string
  credit_score: number
  view_count: number
  favorite_count: number
  is_topped: boolean
  topped_until: string | null
  created_at: string
  profiles: {
    id: string
    username: string
    avatar: string | null
    user_number: number
  }
}

interface Stats {
  total: number
  active: number
  inactive: number
  depositMerchants: number
}

export default function MerchantsPage() {
  const router = useRouter()
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [stats, setStats] = useState<Stats>({
    total: 0,
    active: 0,
    inactive: 0,
    depositMerchants: 0,
  })
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterDepositStatus, setFilterDepositStatus] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)

  // 激活对话框状态
  const [activateDialogOpen, setActivateDialogOpen] = useState(false)
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null)
  const [activateNote, setActivateNote] = useState("")
  const [activating, setActivating] = useState(false)

  // 下架对话框状态
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false)
  const [deactivateReason, setDeactivateReason] = useState("")
  const [deactivating, setDeactivating] = useState(false)

  // 违规处理对话框状态
  const [violateDialogOpen, setViolateDialogOpen] = useState(false)
  const [violationReason, setViolationReason] = useState("")
  const [violating, setViolating] = useState(false)

  // 完成赔付对话框状态
  const [compensationDialogOpen, setCompensationDialogOpen] = useState(false)
  const [compensationAmount, setCompensationAmount] = useState("")
  const [completing, setCompleting] = useState(false)

  // 置顶对话框状态
  const [pinDialogOpen, setPinDialogOpen] = useState(false)
  const [pinDays, setPinDays] = useState("7")
  const [pinning, setPinning] = useState(false)

  // 详情对话框状态
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)

  // 加载商家数据
  useEffect(() => {
    loadMerchants()
    setCurrentPage(1) // 切换筛选时重置到第一页
  }, [filterStatus, filterDepositStatus])

  // 搜索时重置到第一页
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  // 添加 Supabase 实时订阅
  useEffect(() => {
    console.log('🔍 [商家管理页面] useEffect 开始执行')

    try {
      const supabase = createClient()
      console.log('🔌 [商家管理页面] Supabase 客户端已创建')
      console.log('🔌 [商家管理页面] 开始订阅商家表变化')

      // 订阅商家表的变化
      const channel = supabase
        .channel('merchants-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'merchants'
          },
          (payload) => {
            console.log('✅ [商家管理页面] 商家数据变化:', payload)
            // 当数据库有任何变化时，自动重新加载商家列表
            loadMerchants()
          }
        )
        .subscribe((status) => {
          console.log('📡 [商家管理页面] 商家订阅状态:', status)
          if (status === 'SUBSCRIBED') {
            console.log('✅ [商家管理页面] 订阅成功！')
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ [商家管理页面] 订阅错误')
          } else if (status === 'TIMED_OUT') {
            console.error('⏱️ [商家管理页面] 订阅超时')
          }
        })

      console.log('📌 [商家管理页面] 订阅设置完成，channel:', channel)

      // 清理函数：组件卸载时取消订阅
      return () => {
        console.log('🔌 [商家管理页面] 取消商家订阅')
        supabase.removeChannel(channel)
      }
    } catch (error) {
      console.error('❌ [商家管理页面] 订阅设置出错:', error)
    }
  }, [])

  async function loadMerchants() {
    try {
      setLoading(true)

      const result = await adminGetMerchants({
        status: filterStatus === "all" ? undefined : filterStatus,
        depositStatus: filterDepositStatus === "all" ? undefined : filterDepositStatus,
        search: searchTerm || undefined,
      })

      if (!result.success) {
        throw new Error(result.error)
      }

      console.log("Merchants data:", result.data)
      setMerchants(result.data)

      // 计算统计数据
      const total = result.data.length
      const active = result.data.filter((m) => m.is_active).length
      const inactive = result.data.filter((m) => !m.is_active).length
      const depositMerchants = result.data.filter((m) => m.is_deposit_merchant).length

      setStats({ total, active, inactive, depositMerchants })
    } catch (error: any) {
      console.error("Error loading merchants:", error)
      toast.error(error.message || "加载商家列表失败")
    } finally {
      setLoading(false)
    }
  }

  function handleActivateClick(merchant: Merchant) {
    setSelectedMerchant(merchant)
    setActivateNote("")
    setActivateDialogOpen(true)
  }

  async function handleActivate() {
    if (!selectedMerchant) return

    try {
      setActivating(true)
      const result = await adminActivateMerchant(selectedMerchant.id, activateNote || undefined)

      if (!result.success) {
        throw new Error(result.error)
      }

      toast.success(`已上架商家【${selectedMerchant.name}】`)
      setActivateDialogOpen(false)
      setSelectedMerchant(null)
      setActivateNote("")
      router.refresh()
      await loadMerchants()
    } catch (error: any) {
      console.error("Error activating merchant:", error)
      toast.error(error.message || "上架失败")
    } finally {
      setActivating(false)
    }
  }

  function handleDeactivateClick(merchant: Merchant) {
    setSelectedMerchant(merchant)
    setDeactivateReason("")
    setDeactivateDialogOpen(true)
  }

  async function handleDeactivate() {
    if (!selectedMerchant) return

    if (!deactivateReason.trim()) {
      toast.error("请填写下架原因")
      return
    }

    try {
      setDeactivating(true)
      const result = await adminDeactivateMerchant(selectedMerchant.id, deactivateReason)

      if (!result.success) {
        throw new Error(result.error)
      }

      toast.success(`已下架商家【${selectedMerchant.name}】`)
      setDeactivateDialogOpen(false)
      setSelectedMerchant(null)
      setDeactivateReason("")
      router.refresh()
      await loadMerchants()
    } catch (error: any) {
      console.error("Error deactivating merchant:", error)
      toast.error(error.message || "下架失败")
    } finally {
      setDeactivating(false)
    }
  }

  function handleViolateClick(merchant: Merchant) {
    setSelectedMerchant(merchant)
    setViolationReason("")
    setViolateDialogOpen(true)
  }

  function handleCompleteCompensationClick(merchant: Merchant) {
    setSelectedMerchant(merchant)
    setCompensationAmount("")
    setCompensationDialogOpen(true)
  }

  async function handleCompleteCompensation() {
    if (!selectedMerchant) return

    const amount = parseFloat(compensationAmount)

    if (!compensationAmount || isNaN(amount) || amount <= 0) {
      toast.error("请输入有效的赔付金额")
      return
    }

    if (amount > selectedMerchant.deposit_amount) {
      toast.error(`赔付金额不能超过剩余押金 ${selectedMerchant.deposit_amount.toFixed(2)} USDT`)
      return
    }

    try {
      setCompleting(true)
      const result = await adminCompleteCompensation(selectedMerchant.id, amount)

      if (!result.success) {
        throw new Error(result.error)
      }

      if (result.isDepleted) {
        toast.success(`已完成商家【${selectedMerchant.name}】的赔付 ${amount.toFixed(2)} USDT，押金已全部扣完`)
      } else {
        toast.success(`已完成商家【${selectedMerchant.name}】的赔付 ${amount.toFixed(2)} USDT，剩余押金 ${result.remainingDeposit?.toFixed(2)} USDT`)
      }

      setCompensationDialogOpen(false)
      setSelectedMerchant(null)
      setCompensationAmount("")
      router.refresh()
      await loadMerchants()
    } catch (error: any) {
      console.error("Error completing compensation:", error)
      toast.error(error.message || "完成赔付失败")
    } finally {
      setCompleting(false)
    }
  }

  async function handleViolate() {
    if (!selectedMerchant) return

    if (!violationReason.trim()) {
      toast.error("请填写违规原因")
      return
    }

    // 按押金金额的30%计算扣除金额
    const deductAmount = selectedMerchant.deposit_amount * 0.3
    const compensationAmount = selectedMerchant.deposit_amount * 0.7

    try {
      setViolating(true)
      const result = await adminViolateMerchant(selectedMerchant.id, violationReason, deductAmount)

      if (!result.success) {
        throw new Error(result.error)
      }

      toast.success(`已处理商家【${selectedMerchant.name}】的违规，扣除押金 ${deductAmount.toFixed(2)} USDT（30%），赔付金额 ${compensationAmount.toFixed(2)} USDT（70%）`)
      setViolateDialogOpen(false)
      setSelectedMerchant(null)
      setViolationReason("")
      router.refresh()
      await loadMerchants()
    } catch (error: any) {
      console.error("Error violating merchant:", error)
      toast.error(error.message || "违规处理失败")
    } finally {
      setViolating(false)
    }
  }

  function handleViewDetail(merchant: Merchant) {
    setSelectedMerchant(merchant)
    setDetailDialogOpen(true)
  }

  function handlePinClick(merchant: Merchant) {
    setSelectedMerchant(merchant)
    setPinDays("7")
    setPinDialogOpen(true)
  }

  async function handlePin() {
    if (!selectedMerchant) return

    const days = parseInt(pinDays)
    if (!days || days <= 0) {
      toast.error("请输入有效的置顶天数")
      return
    }

    try {
      setPinning(true)
      const result = await adminPinMerchant(selectedMerchant.id, days)

      if (!result.success) {
        throw new Error(result.error)
      }

      toast.success(`已将商家【${selectedMerchant.name}】置顶${days}天`)
      setPinDialogOpen(false)
      setSelectedMerchant(null)
      setPinDays("7")
      router.refresh()
      await loadMerchants()
    } catch (error: any) {
      console.error("Error pinning merchant:", error)
      toast.error(error.message || "置顶失败")
    } finally {
      setPinning(false)
    }
  }

  async function handleUnpin(merchant: Merchant) {
    try {
      const result = await adminUnpinMerchant(merchant.id)

      if (!result.success) {
        throw new Error(result.error)
      }

      toast.success(`已取消商家【${merchant.name}】的置顶`)
      router.refresh()
      await loadMerchants()
    } catch (error: any) {
      console.error("Error unpinning merchant:", error)
      toast.error(error.message || "取消置顶失败")
    }
  }

  // 过滤商家列表
  const filteredMerchants = merchants

  // 分页计算
  const totalPages = Math.ceil(filteredMerchants.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const currentMerchants = filteredMerchants.slice(startIndex, endIndex)

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-3xl font-bold">
            商家管理
          </h1>
          <p className="text-muted-foreground mt-1">管理和审核平台所有商家</p>
        </div>

        {/* 商家列表 */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <CardTitle>商家列表</CardTitle>
              <div className="flex items-center gap-4">
                {/* 统计数据 - 紧凑布局 */}
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">总计:</span>
                    <span className="font-semibold">{stats.total}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">已上架:</span>
                    <span className="font-semibold text-green-600">{stats.active}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">已下架:</span>
                    <span className="font-semibold text-red-600">{stats.inactive}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">押金商家:</span>
                    <span className="font-semibold text-blue-600">{stats.depositMerchants}</span>
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
                      <SelectItem value="active">已上架</SelectItem>
                      <SelectItem value="inactive">已下架</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">商家类型:</span>
                  <Select value={filterDepositStatus} onValueChange={setFilterDepositStatus}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部</SelectItem>
                      <SelectItem value="deposit">押金商家</SelectItem>
                      <SelectItem value="regular">普通商家</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">搜索:</span>
                  <Input
                    placeholder="商家名称、描述或用户编号..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-[220px]"
                  />
                </div>
              </div>
              <Button onClick={loadMerchants} variant="outline" size="sm">
                刷新数据
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">加载中...</p>
              </div>
            ) : merchants.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">暂无商家</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Logo</TableHead>
                        <TableHead>商家名称</TableHead>
                        <TableHead>用户名</TableHead>
                        <TableHead>用户编号</TableHead>
                        <TableHead>类型</TableHead>
                        <TableHead>押金</TableHead>
                        <TableHead>信用分</TableHead>
                        <TableHead>创建时间</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentMerchants.map((merchant) => (
                        <TableRow key={merchant.id}>
                          {/* Logo列 */}
                          <TableCell>
                            <div className="w-12 h-12 rounded border overflow-hidden bg-gray-50 flex items-center justify-center">
                              {merchant.logo ? (
                                <>
                                  <img
                                    src={merchant.logo}
                                    alt={merchant.name}
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
                            <div className="max-w-[200px]">
                              <p className="font-medium truncate">{merchant.name}</p>
                              {merchant.short_desc && (
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  {merchant.short_desc}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          {/* 商家主人列 */}
                          <TableCell>
                            <div className="text-sm">
                              <p className="font-medium">{merchant.profiles.username}</p>
                            </div>
                          </TableCell>
                          {/* 用户编号列 */}
                          <TableCell>
                            <span className="font-mono font-medium text-primary text-xs">
                              NO.{merchant.profiles.user_number}
                            </span>
                          </TableCell>
                          {/* 类型列 */}
                          <TableCell>
                            {merchant.is_deposit_merchant ? (
                              <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-700">
                                <ShieldCheck className="h-3 w-3 mr-1" />
                                押金商家
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-gray-300 bg-gray-50 text-gray-700">
                                <ShieldX className="h-3 w-3 mr-1" />
                                普通商家
                              </Badge>
                            )}
                          </TableCell>
                          {/* 押金列 */}
                          <TableCell>
                            {merchant.is_deposit_merchant ? (
                              <div className="text-sm">
                                <p className="font-medium text-blue-600">
                                  {merchant.deposit_amount.toLocaleString()} USDT
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {merchant.deposit_status === 'paid' ? '已缴纳' :
                                   merchant.deposit_status === 'unpaid' ? '未缴纳' :
                                   merchant.deposit_status === 'frozen' ? '押金冻结' :
                                   merchant.deposit_status === 'refund_requested' ? '申请退还' :
                                   merchant.deposit_status === 'refunded' ? '已退还' :
                                   merchant.deposit_status === 'violated' ? '违规扣除' :
                                   merchant.deposit_status}
                                </p>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          {/* 信用分列 */}
                          <TableCell>
                            <div className="text-sm">
                              <p className={`font-bold text-lg ${
                                merchant.credit_score >= 80 ? 'text-green-600' :
                                merchant.credit_score >= 60 ? 'text-yellow-600' :
                                merchant.credit_score >= 40 ? 'text-orange-600' :
                                'text-red-600'
                              }`}>
                                {merchant.credit_score}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {merchant.credit_score >= 80 ? '信用优秀' :
                                 merchant.credit_score >= 60 ? '信用良好' :
                                 merchant.credit_score >= 40 ? '信用一般' :
                                 '信用较差'}
                              </p>
                            </div>
                          </TableCell>
                          {/* 创建时间列 */}
                          <TableCell>
                            <p className="text-sm whitespace-nowrap">
                              {new Date(merchant.created_at).toLocaleDateString("zh-CN")}
                            </p>
                          </TableCell>
                          {/* 状态列 */}
                          <TableCell>
                            {merchant.is_active ? (
                              <Badge variant="outline" className="border-green-300 bg-green-50 text-green-700">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                已上架
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700">
                                <XCircle className="h-3 w-3 mr-1" />
                                已下架
                              </Badge>
                            )}
                          </TableCell>
                          {/* 操作列 */}
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleViewDetail(merchant)}
                                title="查看详情"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                asChild
                                title="编辑商家"
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              >
                                <Link href={`/merchant/edit/${merchant.id}`} target="_blank" rel="noopener noreferrer">
                                  <Pencil className="h-4 w-4" />
                                </Link>
                              </Button>
                              {merchant.is_active ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleDeactivateClick(merchant)}
                                  title="下架商家"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => handleActivateClick(merchant)}
                                  title="上架商家"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
                              {merchant.is_deposit_merchant && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                  onClick={() => handleViolateClick(merchant)}
                                  title="违规处理"
                                >
                                  <AlertTriangle className="h-4 w-4" />
                                </Button>
                              )}
                              {merchant.deposit_status === 'frozen' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  onClick={() => handleCompleteCompensationClick(merchant)}
                                  title="完成赔付"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
                              {merchant.is_topped ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                  onClick={() => handleUnpin(merchant)}
                                  title="取消置顶"
                                >
                                  <Pin className="h-4 w-4 fill-current" />
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-gray-600 hover:text-gray-700 hover:bg-gray-50"
                                  onClick={() => handlePinClick(merchant)}
                                  title="置顶商家"
                                >
                                  <Pin className="h-4 w-4" />
                                </Button>
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
                      显示 {startIndex + 1} - {Math.min(endIndex, filteredMerchants.length)} 条，共 {filteredMerchants.length} 条
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

      {/* 上架对话框 */}
      <Dialog open={activateDialogOpen} onOpenChange={setActivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>上架商家</DialogTitle>
            <DialogDescription>
              确认上架商家【{selectedMerchant?.name}】?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="activate-note">备注（可选）</Label>
              <Textarea
                id="activate-note"
                placeholder="可以添加一些备注信息，商家将会在通知中看到"
                value={activateNote}
                onChange={(e) => setActivateNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateDialogOpen(false)} disabled={activating}>
              取消
            </Button>
            <Button onClick={handleActivate} disabled={activating} className="bg-green-600 hover:bg-green-700">
              {activating ? "处理中..." : "确认上架"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 下架对话框 */}
      <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>下架商家</DialogTitle>
            <DialogDescription>
              下架商家【{selectedMerchant?.name}】，请填写下架原因
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="deactivate-reason">
                下架原因 <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="deactivate-reason"
                placeholder="请详细说明下架原因，商家将会在通知中看到"
                value={deactivateReason}
                onChange={(e) => setDeactivateReason(e.target.value)}
                rows={4}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateDialogOpen(false)} disabled={deactivating}>
              取消
            </Button>
            <Button
              onClick={handleDeactivate}
              disabled={deactivating || !deactivateReason.trim()}
              variant="destructive"
            >
              {deactivating ? "处理中..." : "确认下架"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 违规处理对话框 */}
      <Dialog open={violateDialogOpen} onOpenChange={setViolateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>违规处理</DialogTitle>
            <DialogDescription>
              处理商家【{selectedMerchant?.name}】的违规行为，按押金30%扣除，70%用于赔付
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedMerchant && (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-900">当前押金余额：</span>
                    <span className="text-lg font-bold text-blue-900">
                      {selectedMerchant.deposit_amount.toLocaleString()} USDT
                    </span>
                  </div>
                  <div className="space-y-2 mt-3 pt-3 border-t border-blue-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-blue-700">平台扣除（30%）</span>
                      <p className="text-base font-bold text-red-600">
                        {(selectedMerchant.deposit_amount * 0.3).toFixed(2)} USDT
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-blue-700">赔付金额（70%）</span>
                      <p className="text-base font-bold text-green-600">
                        {(selectedMerchant.deposit_amount * 0.7).toFixed(2)} USDT
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="violation-reason">
                    违规原因 <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="violation-reason"
                    placeholder="请详细说明违规原因，商家将会在通知中看到"
                    value={violationReason}
                    onChange={(e) => setViolationReason(e.target.value)}
                    rows={4}
                    required
                  />
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
                  <p className="text-sm font-medium text-red-900">违规处理后将执行以下操作：</p>
                  <ul className="text-xs text-red-700 space-y-1 ml-4">
                    <li>• 扣除30%押金作为平台处罚</li>
                    <li>• 70%押金用于赔付受害方</li>
                    <li>• 商家将被自动下架</li>
                    <li>• 系统发送违规处理通知</li>
                    <li>• 记录管理员操作日志</li>
                  </ul>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViolateDialogOpen(false)} disabled={violating}>
              取消
            </Button>
            <Button
              onClick={handleViolate}
              disabled={violating || !violationReason.trim()}
              variant="destructive"
            >
              {violating ? "处理中..." : "确认处理"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 完成赔付对话框 */}
      <Dialog open={compensationDialogOpen} onOpenChange={setCompensationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>完成赔付</DialogTitle>
            <DialogDescription>
              为商家【{selectedMerchant?.name}】处理赔付，请输入实际赔付金额
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedMerchant && (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium text-blue-900">当前押金状态：冻结中</p>
                  <p className="text-sm text-blue-700">
                    剩余押金余额：<span className="font-bold">{selectedMerchant.deposit_amount.toLocaleString()} USDT</span>
                  </p>
                  <div className="pt-2 mt-2 border-t border-blue-200">
                    <p className="text-xs text-blue-700">赔付说明：</p>
                    <ul className="text-xs text-blue-600 space-y-1 mt-1 ml-4">
                      <li>• 输入实际需要赔付的金额</li>
                      <li>• 赔付金额将从剩余押金中扣除</li>
                      <li>• 如果押金扣完，商家将失去押金商家身份</li>
                      <li>• 如有剩余押金，将解除冻结供商家继续使用</li>
                    </ul>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="compensation-amount">
                    赔付金额 (USDT) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="compensation-amount"
                    type="number"
                    placeholder="请输入赔付金额"
                    value={compensationAmount}
                    onChange={(e) => setCompensationAmount(e.target.value)}
                    min="0.01"
                    max={selectedMerchant.deposit_amount}
                    step="0.01"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    最大可赔付金额: {selectedMerchant.deposit_amount.toFixed(2)} USDT
                  </p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-amber-900">
                    赔付后剩余押金：
                    <span className="ml-2 text-lg font-bold text-amber-900">
                      {compensationAmount && !isNaN(parseFloat(compensationAmount))
                        ? Math.max(0, selectedMerchant.deposit_amount - parseFloat(compensationAmount)).toFixed(2)
                        : selectedMerchant.deposit_amount.toFixed(2)} USDT
                    </span>
                  </p>
                  {compensationAmount && !isNaN(parseFloat(compensationAmount)) &&
                   parseFloat(compensationAmount) >= selectedMerchant.deposit_amount && (
                    <p className="text-xs text-red-600 mt-2">
                      ⚠️ 押金将被扣完，商家将失去押金商家身份
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompensationDialogOpen(false)} disabled={completing}>
              取消
            </Button>
            <Button
              onClick={handleCompleteCompensation}
              disabled={completing || !compensationAmount || parseFloat(compensationAmount) <= 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {completing ? "处理中..." : "确认赔付"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 置顶对话框 */}
      <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>置顶商家</DialogTitle>
            <DialogDescription>
              设置商家【{selectedMerchant?.name}】的置顶时长
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pin-days">
                置顶天数 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="pin-days"
                type="number"
                placeholder="请输入置顶天数"
                value={pinDays}
                onChange={(e) => setPinDays(e.target.value)}
                min="1"
                max="365"
                required
              />
              <p className="text-xs text-muted-foreground">
                建议: 7天(一周)、30天(一个月)、90天(一季度)
              </p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <p className="text-sm font-medium text-purple-900">置顶说明:</p>
              <ul className="text-xs text-purple-700 space-y-1 mt-2 ml-4">
                <li>• 置顶商家将在首页优先展示</li>
                <li>• 置顶期间会显示置顶标识</li>
                <li>• 置顶时间到期后将自动取消置顶</li>
                <li>• 可随时手动取消置顶</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPinDialogOpen(false)} disabled={pinning}>
              取消
            </Button>
            <Button
              onClick={handlePin}
              disabled={pinning || !pinDays || parseInt(pinDays) <= 0}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {pinning ? "处理中..." : "确认置顶"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 详情对话框 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>商家详细信息</DialogTitle>
            <DialogDescription>查看商家的详细信息</DialogDescription>
          </DialogHeader>
          {selectedMerchant && (
            <div className="space-y-4 py-4">
              {/* 基本信息 */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">基本信息</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <Label className="text-muted-foreground">商家名称</Label>
                    <p className="font-medium">{selectedMerchant.name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">所在地区</Label>
                    <p className="font-medium">{selectedMerchant.location || "未设置"}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">商家描述</Label>
                    <p className="font-medium whitespace-pre-wrap">{selectedMerchant.description}</p>
                  </div>
                </div>
              </div>

              {/* 商家主人信息 */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <Label className="text-muted-foreground">用户名</Label>
                    <p className="font-medium">{selectedMerchant.profiles.username}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">用户编号</Label>
                    <span className="font-mono font-medium text-primary">
                      NO.{selectedMerchant.profiles.user_number}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">用户ID</Label>
                    <p className="font-mono text-xs bg-muted px-2 py-1 rounded">
                      {selectedMerchant.user_id}
                    </p>
                  </div>
                </div>
              </div>

              {/* 服务类型 */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">服务类型</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedMerchant.service_types.map((type) => (
                    <Badge key={type} variant="secondary">
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* 押金信息 */}
              {selectedMerchant.is_deposit_merchant && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">押金信息</h3>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <Label className="text-muted-foreground">押金金额</Label>
                        <p className="text-xl font-bold text-blue-900">
                          {selectedMerchant.deposit_amount.toLocaleString()} USDT
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">押金状态</Label>
                        <p className="font-medium">
                          {selectedMerchant.deposit_status === 'paid' ? '已缴纳' :
                           selectedMerchant.deposit_status === 'unpaid' ? '未缴纳' :
                           selectedMerchant.deposit_status === 'frozen' ? '押金冻结' :
                           selectedMerchant.deposit_status === 'refund_requested' ? '申请退还' :
                           selectedMerchant.deposit_status === 'refunded' ? '已退还' :
                           selectedMerchant.deposit_status === 'violated' ? '违规扣除' :
                           selectedMerchant.deposit_status}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 信用与状态 */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">信用与状态</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <Label className="text-muted-foreground">信用分数</Label>
                    <p className={`font-bold text-lg ${
                      selectedMerchant.credit_score >= 80 ? 'text-green-600' :
                      selectedMerchant.credit_score >= 60 ? 'text-yellow-600' :
                      selectedMerchant.credit_score >= 40 ? 'text-orange-600' :
                      'text-red-600'
                    }`}>
                      {selectedMerchant.credit_score} 分
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">信用评级</Label>
                    <p className="font-medium">
                      {selectedMerchant.credit_score >= 80 ? '信用优秀' :
                       selectedMerchant.credit_score >= 60 ? '信用良好' :
                       selectedMerchant.credit_score >= 40 ? '信用一般' :
                       '信用较差'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">创建时间</Label>
                    <p className="font-medium">
                      {new Date(selectedMerchant.created_at).toLocaleString("zh-CN")}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">状态</Label>
                    <p className="font-medium">
                      {selectedMerchant.is_active ? "已上架" : "已下架"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              关闭
            </Button>
            {selectedMerchant && (
              <>
                {selectedMerchant.is_active ? (
                  <Button
                    variant="outline"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => {
                      setDetailDialogOpen(false)
                      handleDeactivateClick(selectedMerchant)
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    下架商家
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => {
                      setDetailDialogOpen(false)
                      handleActivateClick(selectedMerchant)
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    上架商家
                  </Button>
                )}
                {selectedMerchant.is_deposit_merchant && (
                  <Button
                    variant="outline"
                    className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                    onClick={() => {
                      setDetailDialogOpen(false)
                      handleViolateClick(selectedMerchant)
                    }}
                  >
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    违规处理
                  </Button>
                )}
                {selectedMerchant.deposit_status === 'frozen' && (
                  <Button
                    variant="outline"
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={() => {
                      setDetailDialogOpen(false)
                      handleCompleteCompensationClick(selectedMerchant)
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    完成赔付
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
