"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { PointsConfirmDialog } from "@/components/points-confirm-dialog"
import { ImageUpload } from "@/components/image-upload"
import { DepositApplyDialog } from "@/components/deposit-apply-dialog"
import { DepositRefundDialog } from "@/components/deposit-refund-dialog"
import { DepositTopUpDialog } from "@/components/deposit-top-up-dialog"
import { getUserMerchant, updateMerchant, topMerchant, editMerchant } from "@/lib/actions/merchant"
import { getUserPoints } from "@/lib/actions/points"
import { checkDepositApplication, getDepositMerchantInfo, claimDailyLoginReward, checkDailyRewardStatus, getDepositRefundApplication, claimDepositBonus } from "@/lib/actions/deposit"
import { getMerchantTopUpApplications } from "@/lib/actions/deposit-top-up"
import { getSystemSettings, detectSensitiveWords } from "@/lib/actions/settings"
import { createClient, createRealtimeClient } from "@/lib/supabase/client"
import { triggerPointsUpdate } from "@/lib/utils/points-update"
import { toast } from "sonner"
import { ArrowLeft, Edit, TrendingUp, Coins, AlertCircle, Shield, CreditCard, Gift, Clock, AlertTriangle, ExternalLink } from "lucide-react"
import Link from "next/link"

export default function MerchantDashboard() {
  const router = useRouter()
  const [merchant, setMerchant] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editConfirmOpen, setEditConfirmOpen] = useState(false)
  const [topDialogOpen, setTopDialogOpen] = useState(false)
  const [topConfirmOpen, setTopConfirmOpen] = useState(false)
  const [topDays, setTopDays] = useState(7)
  const [userPoints, setUserPoints] = useState(0)
  const [depositApplyOpen, setDepositApplyOpen] = useState(false)
  const [depositApplication, setDepositApplication] = useState<any>(null)
  const [depositInfo, setDepositInfo] = useState<any>(null)
  const [canClaimDailyReward, setCanClaimDailyReward] = useState(false)
  const [claimingReward, setClaimingReward] = useState(false)
  const [claimingBonus, setClaimingBonus] = useState(false)
  const [depositRefundOpen, setDepositRefundOpen] = useState(false)
  const [depositRefundApplication, setDepositRefundApplication] = useState<any>(null)
  const [depositTopUpOpen, setDepositTopUpOpen] = useState(false)
  const [depositTopUpApplication, setDepositTopUpApplication] = useState<any>(null)
  const [systemSettings, setSystemSettings] = useState<any>(null)

  const [logoUrl, setLogoUrl] = useState("")
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price_range: "",
    location: "全国",
    response_time: 5,
    stock_status: "现货充足",
    contact_phone: "",
    contact_wechat: "",
    contact_telegram: "",
    contact_whatsapp: "",
    contact_email: "",
  })

  const [serviceTypes, setServiceTypes] = useState<string[]>([])
  const [warranties, setWarranties] = useState<string[]>([])
  const [paymentMethods, setPaymentMethods] = useState<string[]>([])

  const serviceTypeOptions = [
    "Facebook开户",
    "TikTok开户",
    "Google开户",
    "账号商",
    "虚拟卡",
    "斗篷服务",
    "Shopify建站",
    "WordPress建站",
  ]

  const responseTimeOptions = [
    { label: "5分钟", value: 5 },
    { label: "10分钟", value: 10 },
    { label: "1小时", value: 60 },
    { label: "2小时", value: 120 },
    { label: "工作日", value: 480 },
  ]

  const warrantyOptions = ["7天包换", "不过包退", "终身售后", "死号包赔", "余额保障", "包售后", "24小时客服"]
  const paymentMethodOptions = ["支付宝", "微信", "USDT", "PayPal", "银行转账", "对公转账"]
  const stockOptions = ["现货充足", "库存紧张", "需预订", "500+现货", "1000+现货"]

  const cityOptions = [
    "全国", "广州", "深圳", "杭州", "上海", "北京", "成都", "重庆",
    "武汉", "西安", "南京", "苏州", "东莞", "佛山", "厦门", "福州",
    "长沙", "郑州", "济南", "青岛",
  ]

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

      const merchantData = await getUserMerchant()
      if (!merchantData) {
        router.push("/merchant/register")
        return
      }

      setMerchant(merchantData)
      setLogoUrl(merchantData.logo || "")
      setFormData({
        name: merchantData.name || "",
        description: merchantData.description || "",
        price_range: merchantData.price_range || "",
        location: merchantData.location || "全国",
        response_time: merchantData.response_time || 5,
        stock_status: merchantData.stock_status || "现货充足",
        contact_phone: merchantData.contact_phone || "",
        contact_wechat: merchantData.contact_wechat || "",
        contact_telegram: merchantData.contact_telegram || "",
        contact_whatsapp: merchantData.contact_whatsapp || "",
        contact_email: merchantData.contact_email || "",
      })
      setServiceTypes(merchantData.service_types || [])
      setWarranties(merchantData.warranties || [])
      setPaymentMethods(merchantData.payment_methods || [])

      const points = await getUserPoints(user.id)
      setUserPoints(points)

      // 加载押金商家信息
      const depositInfoResult = await getDepositMerchantInfo(merchantData.id)
      if (depositInfoResult.success) {
        setDepositInfo(depositInfoResult.data)
      }

      // 加载押金申请记录(只在不是押金商家且有pending申请时加载)
      const depositAppResult = await checkDepositApplication(merchantData.id)
      if (depositAppResult.success && depositAppResult.data) {
        // 只在以下情况保存申请记录:
        // 1. 申请状态为pending
        // 2. 当前不是押金商家
        if (
          depositAppResult.data.application_status === 'pending' &&
          (!depositInfoResult.success || !depositInfoResult.data?.is_deposit_merchant)
        ) {
          setDepositApplication(depositAppResult.data)
        } else {
          setDepositApplication(null)
        }
      }

      // 检查每日奖励状态
      const rewardStatus = await checkDailyRewardStatus()
      if (rewardStatus.success && rewardStatus.canClaim) {
        setCanClaimDailyReward(true)
      }

      // 加载押金退还申请记录
      if (depositInfoResult.success && depositInfoResult.data?.is_deposit_merchant) {
        const refundAppResult = await getDepositRefundApplication(merchantData.id)
        if (refundAppResult.success && refundAppResult.data) {
          setDepositRefundApplication(refundAppResult.data)
        }
      }

      // 加载追加押金申请记录
      if (depositInfoResult.success && depositInfoResult.data?.is_deposit_merchant) {
        const topUpAppResult = await getMerchantTopUpApplications(merchantData.id)
        if (topUpAppResult.success && topUpAppResult.data && topUpAppResult.data.length > 0) {
          // 获取最新的pending申请
          const pendingTopUp = topUpAppResult.data.find((app: any) => app.application_status === 'pending')
          if (pendingTopUp) {
            setDepositTopUpApplication(pendingTopUp)
          }
        }
      }

      // 加载系统设置
      const settingsResult = await getSystemSettings()
      if (settingsResult.success) {
        setSystemSettings(settingsResult.data)
      }

      setLoading(false)
    }

    loadData()
  }, [router])

  // 添加 Supabase 实时订阅 - 监听押金申请状态变化
  useEffect(() => {
    if (!merchant) {
      console.log('⚠️ merchant 为空，跳过实时订阅设置')
      return
    }

    console.log('🔌 [实时订阅] 开始设置实时订阅，商家ID:', merchant.id)
    const supabase = createClient() // 改用普通客户端，它也支持 Realtime
    console.log('🔌 [实时订阅] Supabase 客户端已创建')

    // 订阅押金申请表的变化
    console.log('🔌 [实时订阅] 设置押金申请表订阅...')
    const applicationsChannel = supabase
      .channel('merchant-deposit-applications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deposit_merchant_applications',
          filter: `merchant_id=eq.${merchant.id}`
        },
        async (payload) => {
          console.log('✅ [押金申请] 押金申请状态变化:', payload)
          // 重新加载押金商家信息和申请记录
          const depositInfoResult = await getDepositMerchantInfo(merchant.id)
          const depositAppResult = await checkDepositApplication(merchant.id)

          // 更新押金商家信息
          if (depositInfoResult.success) {
            setDepositInfo(depositInfoResult.data)
          }

          // 只在pending状态且不是押金商家时保存申请记录
          if (depositAppResult.success && depositAppResult.data) {
            if (
              depositAppResult.data.application_status === 'pending' &&
              (!depositInfoResult.success || !depositInfoResult.data?.is_deposit_merchant)
            ) {
              setDepositApplication(depositAppResult.data)
              console.log('✅ [押金申请] 已更新押金申请数据')
            } else {
              setDepositApplication(null)
              console.log('✅ [押金申请] 申请非pending或已是押金商家，清除申请数据')
            }
          } else {
            setDepositApplication(null)
            console.log('✅ [押金申请] 无申请记录，清除押金申请数据')
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 [押金申请] 订阅状态:', status)
        if (status === 'SUBSCRIBED') {
          console.log('✅ [押金申请] 订阅成功！')
        }
      })

    // 订阅商家表的变化（押金状态）
    console.log('🔌 [实时订阅] 设置商家表订阅，Channel ID:', `merchant-status-${merchant.id}`)
    const merchantsChannel = supabase
      .channel(`merchant-status-${merchant.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'merchants',
          filter: `id=eq.${merchant.id}`
        },
        async (payload) => {
          console.log('✅ [商家表] 商家押金状态变化:', payload)
          console.log('📊 [商家表] 变化详情:', {
            old: payload.old,
            new: payload.new,
            eventType: payload.eventType
          })

          // 重新加载完整的商家信息
          const updatedMerchant = await getUserMerchant()
          if (updatedMerchant) {
            setMerchant(updatedMerchant)
            console.log('✅ [商家表] 已更新商家数据:', {
              depositStatus: updatedMerchant.deposit_status,
              depositAmount: updatedMerchant.deposit_amount,
              isDepositMerchant: updatedMerchant.is_deposit_merchant
            })
          }

          // 重新加载押金商家信息
          const depositInfoResult = await getDepositMerchantInfo(merchant.id)
          if (depositInfoResult.success) {
            setDepositInfo(depositInfoResult.data)
            console.log('✅ [商家表] 已更新押金商家信息:', depositInfoResult.data)
          }
        }
      )
      .subscribe((status, error) => {
        console.log('📡 [商家表] 订阅状态:', status)
        if (status === 'SUBSCRIBED') {
          console.log('✅ [商家表] 订阅成功！监听商家ID:', merchant.id)
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [商家表] 订阅错误:', error)
        } else if (status === 'TIMED_OUT') {
          console.error('⏱️ [商家表] 订阅超时')
        } else if (status === 'CLOSED') {
          console.warn('⚠️ [商家表] 订阅已关闭')
        }
      })

    // 订阅押金退还申请表的变化
    console.log('🔌 [实时订阅] 设置退还申请表订阅...')
    const refundChannel = supabase
      .channel('merchant-deposit-refunds')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deposit_refund_applications',
          filter: `merchant_id=eq.${merchant.id}`
        },
        async (payload) => {
          console.log('✅ [退还申请] 押金退还申请状态变化:', payload)

          // 重新加载押金商家信息(退款批准后商家状态会变化)
          const depositInfoResult = await getDepositMerchantInfo(merchant.id)
          if (depositInfoResult.success) {
            setDepositInfo(depositInfoResult.data)
            console.log('✅ [退还申请] 已更新押金商家信息(退款后)')
          }

          // 重新加载押金退还申请记录
          const refundAppResult = await getDepositRefundApplication(merchant.id)
          if (refundAppResult.success && refundAppResult.data) {
            setDepositRefundApplication(refundAppResult.data)
            console.log('✅ [退还申请] 已更新退还申请数据')
          } else {
            setDepositRefundApplication(null)
            console.log('✅ [退还申请] 清除退还申请数据')
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 [退还申请] 订阅状态:', status)
        if (status === 'SUBSCRIBED') {
          console.log('✅ [退还申请] 订阅成功！')
        }
      })

    // 订阅押金追加申请表的变化
    console.log('🔌 [实时订阅] 设置追加申请表订阅...')
    const topUpChannel = supabase
      .channel('merchant-deposit-top-ups')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deposit_top_up_applications',
          filter: `merchant_id=eq.${merchant.id}`
        },
        async (payload) => {
          console.log('✅ [追加申请] 押金追加申请状态变化:', payload)

          // 重新加载押金商家信息(追加批准后商家押金会增加)
          const depositInfoResult = await getDepositMerchantInfo(merchant.id)
          if (depositInfoResult.success) {
            setDepositInfo(depositInfoResult.data)
            console.log('✅ [追加申请] 已更新押金商家信息(追加后)')
          }

          // 重新加载押金追加申请记录
          const topUpAppResult = await getMerchantTopUpApplications(merchant.id)
          if (topUpAppResult.success && topUpAppResult.data && topUpAppResult.data.length > 0) {
            // 获取最新的pending申请
            const pendingTopUp = topUpAppResult.data.find((app: any) => app.application_status === 'pending')
            if (pendingTopUp) {
              setDepositTopUpApplication(pendingTopUp)
              console.log('✅ [追加申请] 已更新追加申请数据')
            } else {
              setDepositTopUpApplication(null)
              console.log('✅ [追加申请] 无pending申请，清除追加申请数据')
            }
          } else {
            setDepositTopUpApplication(null)
            console.log('✅ [追加申请] 清除追加申请数据')
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 [追加申请] 订阅状态:', status)
        if (status === 'SUBSCRIBED') {
          console.log('✅ [追加申请] 订阅成功！')
        }
      })

    console.log('🎉 [实时订阅] 所有订阅设置完成！')

    // 清理函数：组件卸载时取消所有订阅
    return () => {
      console.log('🔌 [实时订阅] 取消所有订阅')
      supabase.removeChannel(applicationsChannel)
      supabase.removeChannel(merchantsChannel)
      supabase.removeChannel(refundChannel)
      supabase.removeChannel(topUpChannel)
    }
  }, [merchant])

  const handleOpenEditDialog = () => {
    setEditConfirmOpen(true)
  }

  const handleConfirmEdit = async () => {
    setEditConfirmOpen(false)
    try {
      await editMerchant(merchant.id, {})
      // 重新获取积分
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const points = await getUserPoints(user.id)
        setUserPoints(points)
      }
      // 导航到编辑页面
      router.push(`/merchant/edit/${merchant.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败")
    }
  }

  const handleUpdateMerchant = async () => {
    // 表单验证
    if (!formData.name || formData.name.length > 7) {
      toast.error("商家名称必填，且不超过7个字符")
      return
    }

    if (!formData.description || formData.description.length > 100) {
      toast.error("详情描述必填，且不超过100个字符")
      return
    }

    // 检测敏感词
    const sensitiveCheck = await detectSensitiveWords(formData.description)
    if (sensitiveCheck.found) {
      toast.error(`描述中包含敏感词：${sensitiveCheck.detected.join("、")}，请修改后重试`)
      return
    }

    if (!formData.price_range) {
      toast.error("请填写价格区间")
      return
    }

    if (serviceTypes.length === 0) {
      toast.error("请至少选择一个服务类型")
      return
    }

    if (warranties.length === 0) {
      toast.error("请至少选择一个售后保障")
      return
    }

    if (paymentMethods.length === 0) {
      toast.error("请至少选择一个支付方式")
      return
    }

    const hasContact =
      formData.contact_phone ||
      formData.contact_wechat ||
      formData.contact_telegram ||
      formData.contact_whatsapp ||
      formData.contact_email

    if (!hasContact) {
      toast.error("请至少填写一种联系方式")
      return
    }

    try {
      await updateMerchant(merchant.id, {
        ...formData,
        logo: logoUrl || undefined,
        service_types: serviceTypes,
        warranties,
        payment_methods: paymentMethods,
      })
      toast.success("更新成功")
      setEditDialogOpen(false)
      const updatedMerchant = await getUserMerchant()
      setMerchant(updatedMerchant)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新失败")
    }
  }

  const handleTopMerchant = async () => {
    setTopConfirmOpen(false)
    setTopDialogOpen(false)
    try {
      await topMerchant(merchant.id, topDays)
      toast.success(`置顶成功，有效期${topDays}天`)
      const updatedMerchant = await getUserMerchant()
      setMerchant(updatedMerchant)
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const points = await getUserPoints(user.id)
        setUserPoints(points)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "置顶失败")
    }
  }

  const handleOpenTopDialog = () => {
    setTopDialogOpen(false)
    setTopConfirmOpen(true)
  }

  const toggleArrayItem = (array: string[], setArray: (arr: string[]) => void, item: string) => {
    if (array.includes(item)) {
      setArray(array.filter((i) => i !== item))
    } else {
      setArray([...array, item])
    }
  }

  // 格式化价格显示：如果没有货币符号，自动添加$
  const formatPrice = (priceRange: string | null) => {
    if (!priceRange) return "面议"
    // 检查是否已经包含美元符号
    if (priceRange.includes("$")) {
      return priceRange
    }
    // 如果没有货币符号，添加美元符号
    return `$${priceRange}`
  }

  const handleDepositApplySuccess = async () => {
    // 强制刷新路由缓存
    router.refresh()

    // 重新加载申请记录
    const depositAppResult = await checkDepositApplication(merchant.id)
    if (depositAppResult.success && depositAppResult.data) {
      setDepositApplication(depositAppResult.data)
    }
  }

  const handleClaimDailyReward = async () => {
    setClaimingReward(true)
    try {
      const result = await claimDailyLoginReward()
      if (result.success) {
        toast.success(`领取成功！获得 ${result.rewardPoints} 积分`)
        setCanClaimDailyReward(false)
        // 刷新积分
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          const points = await getUserPoints(user.id)
          setUserPoints(points)
          // 触发全局积分更新事件，通知导航栏刷新
          triggerPointsUpdate()
        }
      } else {
        if (result.alreadyClaimed) {
          toast.info("今天已经领取过奖励了")
          setCanClaimDailyReward(false)
        } else {
          toast.error(result.error || "领取失败")
        }
      }
    } catch (error) {
      toast.error("领取失败，请稍后重试")
    } finally {
      setClaimingReward(false)
    }
  }

  const handleClaimDepositBonus = async () => {
    setClaimingBonus(true)
    try {
      const result = await claimDepositBonus()
      if (result.success) {
        toast.success(`领取成功！获得 ${result.bonusPoints} 积分`)
        // 刷新押金商家信息
        if (merchant) {
          const depositInfoResult = await getDepositMerchantInfo(merchant.id)
          if (depositInfoResult.success) {
            setDepositInfo(depositInfoResult.data)
          }
        }
        // 刷新积分
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          const points = await getUserPoints(user.id)
          setUserPoints(points)
          // 触发全局积分更新事件，通知导航栏刷新
          triggerPointsUpdate()
        }
      } else {
        if (result.alreadyClaimed) {
          toast.info("您已经领取过此奖励")
        } else {
          toast.error(result.error || "领取失败")
        }
      }
    } catch (error) {
      toast.error("领取失败，请稍后重试")
    } finally {
      setClaimingBonus(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>加载中...</p>
      </div>
    )
  }

  if (!merchant) {
    return null
  }

  const isTopped = merchant.is_topped && new Date(merchant.topped_until) > new Date()
  const requiredPoints = topDays * (systemSettings?.merchant_top_cost_per_day || 1000)

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 max-w-5xl">
        {/* 页面标题和导航 */}
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回首页
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">商家后台</h1>
          <p className="text-muted-foreground mt-1">管理您的商家信息和服务</p>
        </div>

        <div className="space-y-6">
          {/* 数据统计 - 表格式 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">数据统计</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                <div className="text-center border-r border-b md:border-b-0 pb-4 md:pb-0">
                  <div className="text-xs md:text-sm text-muted-foreground mb-2">浏览量</div>
                  <div className="text-2xl md:text-3xl font-bold">{merchant.views || 0}</div>
                </div>
                <div className="text-center border-r border-b md:border-b-0 pb-4 md:pb-0">
                  <div className="text-xs md:text-sm text-muted-foreground mb-2">收藏数</div>
                  <div className="text-2xl md:text-3xl font-bold">{merchant.favorite_count || 0}</div>
                </div>
                <div className="text-center border-r border-b md:border-b-0 pb-4 md:pb-0">
                  <div className="text-xs md:text-sm text-muted-foreground mb-2">置顶状态</div>
                  {isTopped ? (
                    <>
                      <div className="text-xl md:text-2xl font-bold text-green-600">已置顶</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        到期: {new Date(merchant.topped_until).toLocaleDateString('zh-CN')}
                      </p>
                    </>
                  ) : (
                    <div className="text-xl md:text-2xl font-bold text-gray-400">未置顶</div>
                  )}
                </div>
                <div className="text-center">
                  <div className="text-xs md:text-sm text-muted-foreground mb-2">上架状态</div>
                  {merchant.is_active ? (
                    <>
                      <div className="text-xl md:text-2xl font-bold text-green-600">已上架</div>
                      <p className="text-xs text-muted-foreground mt-1">您的服务正在展示中</p>
                    </>
                  ) : (
                    <div className="text-xl md:text-2xl font-bold text-orange-600">已下架</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 押金商家状态卡片 */}
          {!depositInfo?.is_deposit_merchant &&
            !(depositApplication && depositApplication.application_status === "pending") && (
            <Card className="border-2 border-dashed border-primary/50 bg-gradient-to-r from-primary/5 to-purple/5">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Shield className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">成为押金商家</CardTitle>
                      <CardDescription className="mt-1">
                        缴纳押金，获得认证徽章，提升买家信任度
                      </CardDescription>
                    </div>
                  </div>
                  <Button onClick={() => setDepositApplyOpen(true)}>
                    立即申请
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="flex items-start gap-2">
                    <Shield className="h-4 w-4 text-green-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">认证徽章</p>
                      <p className="text-xs text-muted-foreground">提升买家信任度</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Gift className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">每日奖励</p>
                      <p className="text-xs text-muted-foreground">
                        每天登录得{systemSettings?.deposit_merchant_daily_reward || 50}积分
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <TrendingUp className="h-4 w-4 text-purple-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">申请奖励</p>
                      <p className="text-xs text-muted-foreground">
                        审核通过立得{systemSettings?.deposit_merchant_apply_reward || 1000}积分（一次性）
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Coins className="h-4 w-4 text-amber-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">押金：500 USDT起</p>
                      <p className="text-xs text-muted-foreground">可自定义金额</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 押金申请审核中状态 - 只在pending状态且不是押金商家时显示 */}
          {depositApplication && depositApplication.application_status === "pending" && !depositInfo?.is_deposit_merchant && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100">
                    <Clock className="h-6 w-6 text-amber-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">押金商家申请审核中</CardTitle>
                    <CardDescription className="mt-1">
                      您的申请正在审核中，预计1-3个工作日内完成
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">申请时间</p>
                    <p className="font-medium">
                      {new Date(depositApplication.created_at).toLocaleString("zh-CN")}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">押金金额</p>
                    <p className="font-medium">{depositApplication.deposit_amount} USDT</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">审核状态</p>
                    <Badge variant="secondary">待审核</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 押金冻结状态 */}
          {depositInfo?.is_deposit_merchant && depositInfo?.deposit_status === "frozen" && (
            <Card className="border-red-300 bg-red-50/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-100">
                      <AlertTriangle className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-red-900">押金冻结中</CardTitle>
                      <CardDescription className="mt-1 text-red-700">
                        您的押金因违规处理已被冻结
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="destructive" className="bg-red-600">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    冻结中
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
                  <div>
                    <p className="text-muted-foreground mb-1">剩余押金</p>
                    <p className="font-medium text-lg">{depositInfo.deposit_amount} USDT</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">押金状态</p>
                    <Badge variant="destructive">冻结中</Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">商家状态</p>
                    <Badge variant="secondary">已下架</Badge>
                  </div>
                </div>
                <Alert variant="destructive" className="border-red-300 bg-red-100">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>押金冻结说明</AlertTitle>
                  <AlertDescription className="text-sm space-y-2">
                    <p>您的押金因违规已被冻结，相关说明如下：</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>平台已扣除30%押金作为处罚</li>
                      <li>70%押金用于赔付受害方</li>
                      <li>赔付完成前，押金处于冻结状态</li>
                      <li>冻结期间无法申请退还押金</li>
                      <li>等待平台完成赔付后，可申请退还剩余押金</li>
                    </ul>
                    <p className="mt-2 font-medium">
                      如有疑问，请联系平台客服了解详情。
                    </p>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}

          {/* 押金商家已激活状态 */}
          {depositInfo?.is_deposit_merchant && depositInfo?.deposit_status === "paid" && (
            <Card className="border-green-200 bg-green-50/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100">
                      <Shield className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">押金商家</CardTitle>
                      <CardDescription className="mt-1">
                        您已成为押金商家，享受专属权益
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" className="bg-green-600 hover:bg-green-700">
                      已认证
                    </Button>
                    <Button
                      onClick={() => setDepositTopUpOpen(true)}
                      size="sm"
                      variant="outline"
                      className="border-blue-500 text-blue-600 hover:bg-blue-50"
                    >
                      追加押金
                    </Button>
                    <Button
                      onClick={() => setDepositRefundOpen(true)}
                      size="sm"
                      variant="outline"
                      className="border-orange-500 text-orange-600 hover:bg-orange-50"
                    >
                      申请退还
                    </Button>
                    <Button
                      onClick={handleClaimDailyReward}
                      disabled={!canClaimDailyReward || claimingReward}
                      size="sm"
                      className={
                        canClaimDailyReward
                          ? "bg-blue-600 hover:bg-blue-700"
                          : "bg-gray-400 cursor-not-allowed"
                      }
                    >
                      <Gift className="h-4 w-4 mr-1" />
                      {claimingReward
                        ? "领取中..."
                        : canClaimDailyReward
                          ? "领取今日奖励"
                          : "已领取"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">押金金额</p>
                    <p className="font-medium">{depositInfo.deposit_amount} USDT</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">缴纳时间</p>
                    <p className="font-medium">
                      {new Date(depositInfo.deposit_paid_at).toLocaleDateString("zh-CN")}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">押金状态</p>
                    <Badge variant="default">已缴纳</Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">每日奖励</p>
                    <p className="font-medium text-blue-600">{systemSettings?.deposit_merchant_daily_reward || 50}积分/天</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">申请奖励</p>
                    {depositInfo.deposit_bonus_claimed ? (
                      <Badge variant="secondary">已领取</Badge>
                    ) : (
                      <Button
                        onClick={handleClaimDepositBonus}
                        disabled={claimingBonus}
                        size="sm"
                        className="bg-orange-600 hover:bg-orange-700 h-7"
                      >
                        {claimingBonus ? "领取中..." : `领取${systemSettings?.deposit_merchant_apply_reward || 1000}积分`}
                      </Button>
                    )}
                  </div>
                </div>
                <Alert className="mt-4">
                  <Gift className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {canClaimDailyReward
                      ? `今日奖励未领取，点击上方按钮立即领取${systemSettings?.deposit_merchant_daily_reward || 50}积分！`
                      : "今日奖励已领取，明天再来领取吧！"}
                    {depositTopUpApplication?.application_status === "pending" && (
                      <span className="text-blue-600"> 押金追加申请审核中（追加金额: {depositTopUpApplication.top_up_amount} USDT），请耐心等待...</span>
                    )}
                    {depositRefundApplication?.application_status === "pending" ? (
                      <span className="text-amber-600"> 押金退还申请审核中，请耐心等待...</span>
                    ) : (
                      <> 如需退还押金，请<Button
                          variant="link"
                          onClick={() => setDepositRefundOpen(true)}
                          className="h-auto p-0 mx-1 text-primary hover:underline font-medium inline-flex"
                        >申请退还</Button></>
                    )}
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}

          {/* 商家信息 - 表格式 */}
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">商家信息</CardTitle>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                  <Button variant="outline" size="sm" onClick={handleOpenEditDialog} className="w-full sm:w-auto">
                    <Edit className="h-4 w-4 mr-2" />
                    编辑信息
                  </Button>
                  <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
                    <Link href={`/merchant/${merchant.id}`}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      查看前台展示
                    </Link>
                  </Button>
                  <Button size="sm" onClick={() => setTopDialogOpen(true)} className="w-full sm:w-auto">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    置顶推广
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full">
                <tbody className="divide-y">
                  <tr className="hover:bg-muted/50">
                    <td className="px-6 py-4 text-sm font-medium text-muted-foreground w-48">商家名称</td>
                    <td className="px-6 py-4 text-sm">{merchant.name}</td>
                  </tr>
                  <tr className="hover:bg-muted/50">
                    <td className="px-6 py-4 text-sm font-medium text-muted-foreground">认证状态</td>
                    <td className="px-6 py-4 text-sm">
                      <Badge
                        variant={
                          merchant.certification_status === "已认证"
                            ? "default"
                            : merchant.certification_status === "待认证"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {merchant.certification_status || "待认证"}
                      </Badge>
                    </td>
                  </tr>
                  <tr className="hover:bg-muted/50">
                    <td className="px-6 py-4 text-sm font-medium text-muted-foreground">价格区间</td>
                    <td className="px-6 py-4 text-sm">{formatPrice(merchant.price_range)}</td>
                  </tr>
                  <tr className="hover:bg-muted/50">
                    <td className="px-6 py-4 text-sm font-medium text-muted-foreground">地区</td>
                    <td className="px-6 py-4 text-sm">{merchant.location || "未知"}</td>
                  </tr>
                  <tr className="hover:bg-muted/50">
                    <td className="px-6 py-4 text-sm font-medium text-muted-foreground">响应速度</td>
                    <td className="px-6 py-4 text-sm">{merchant.response_time} 分钟</td>
                  </tr>
                  <tr className="hover:bg-muted/50">
                    <td className="px-6 py-4 text-sm font-medium text-muted-foreground">库存状态</td>
                    <td className="px-6 py-4 text-sm">{merchant.stock_status}</td>
                  </tr>
                  <tr className="hover:bg-muted/50">
                    <td className="px-6 py-4 text-sm font-medium text-muted-foreground align-top">详情描述</td>
                    <td className="px-6 py-4 text-sm whitespace-pre-wrap">{merchant.description}</td>
                  </tr>
                  <tr className="hover:bg-muted/50">
                    <td className="px-6 py-4 text-sm font-medium text-muted-foreground align-top">服务类型</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex flex-wrap gap-2">
                        {merchant.service_types?.map((type: string) => (
                          <Badge key={type} variant="secondary">
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                  <tr className="hover:bg-muted/50">
                    <td className="px-6 py-4 text-sm font-medium text-muted-foreground align-top">售后保障</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex flex-wrap gap-2">
                        {merchant.warranties?.map((warranty: string) => (
                          <Badge key={warranty} variant="outline">
                            {warranty}
                          </Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                  <tr className="hover:bg-muted/50">
                    <td className="px-6 py-4 text-sm font-medium text-muted-foreground align-top">支付方式</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex flex-wrap gap-2">
                        {merchant.payment_methods?.map((method: string) => (
                          <Badge key={method} variant="outline">
                            {method}
                          </Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                  <tr className="hover:bg-muted/50">
                    <td className="px-6 py-4 text-sm font-medium text-muted-foreground align-top">联系方式</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex flex-wrap gap-2">
                        {merchant.contact_phone && (
                          <Badge variant="outline">电话: {merchant.contact_phone}</Badge>
                        )}
                        {merchant.contact_wechat && (
                          <Badge variant="outline">微信: {merchant.contact_wechat}</Badge>
                        )}
                        {merchant.contact_telegram && (
                          <Badge variant="outline">Telegram: {merchant.contact_telegram}</Badge>
                        )}
                        {merchant.contact_whatsapp && (
                          <Badge variant="outline">WhatsApp: {merchant.contact_whatsapp}</Badge>
                        )}
                        {merchant.contact_email && (
                          <Badge variant="outline">邮箱: {merchant.contact_email}</Badge>
                        )}
                        {!merchant.contact_phone &&
                         !merchant.contact_wechat &&
                         !merchant.contact_telegram &&
                         !merchant.contact_whatsapp &&
                         !merchant.contact_email && (
                          <span className="text-muted-foreground">未填写</span>
                        )}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* 编辑确认对话框 */}
        <PointsConfirmDialog
          open={editConfirmOpen}
          onOpenChange={setEditConfirmOpen}
          onConfirm={handleConfirmEdit}
          points={systemSettings?.edit_merchant_cost || 100}
          title="确认编辑商家信息"
          description={`编辑商家信息需要消耗积分，每次编辑扣除${systemSettings?.edit_merchant_cost || 100}积分。`}
          currentPoints={userPoints}
        />

        {/* 编辑表单对话框 */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>编辑商家信息</DialogTitle>
              <DialogDescription>更新您的商家信息（已扣除{systemSettings?.edit_merchant_cost || 100}积分）</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {/* 基本信息 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <h3 className="text-sm font-semibold">基本信息</h3>
                </div>

                <div className="space-y-2">
                  <Label>商家Logo</Label>
                  <ImageUpload
                    currentImage={logoUrl}
                    onImageChange={setLogoUrl}
                    folder="merchant-logos"
                    fallbackText={formData.name || "商"}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-description">
                    详情描述 <span className="text-red-500">*</span>
                    <span className="text-xs text-muted-foreground ml-2">（最多100个字符）</span>
                  </Label>
                  <Textarea
                    id="edit-description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value.slice(0, 100) })}
                    placeholder="请简要描述您的服务特点、优势等"
                    rows={4}
                    maxLength={100}
                  />
                  <p className="text-xs text-muted-foreground">{formData.description.length}/100</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">
                      名称 <span className="text-red-500">*</span>
                      <span className="text-xs text-muted-foreground ml-2">（最多7个字符）</span>
                    </Label>
                    <Input
                      id="edit-name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value.slice(0, 7) })}
                      placeholder="请输入商家名称"
                      maxLength={7}
                    />
                    <p className="text-xs text-muted-foreground">{formData.name.length}/7</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-price">
                      价格区间 <span className="text-red-500">*</span>
                      <span className="text-xs text-muted-foreground ml-2">（仅填数字，如：100-500）</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input
                        id="edit-price"
                        value={formData.price_range}
                        onChange={(e) => setFormData({ ...formData, price_range: e.target.value })}
                        placeholder="100-500"
                        className="pl-7"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-location">
                      地区 <span className="text-red-500">*</span>
                    </Label>
                    <Select value={formData.location} onValueChange={(value) => setFormData({ ...formData, location: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {cityOptions.map((city) => (
                          <SelectItem key={city} value={city}>
                            {city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-response">
                      响应速度 <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.response_time.toString()}
                      onValueChange={(value) => setFormData({ ...formData, response_time: Number.parseInt(value) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {responseTimeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value.toString()}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-stock">
                      库存 <span className="text-red-500">*</span>
                    </Label>
                    <Select value={formData.stock_status} onValueChange={(value) => setFormData({ ...formData, stock_status: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {stockOptions.map((stock) => (
                          <SelectItem key={stock} value={stock}>
                            {stock}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* 服务类型 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <h3 className="text-sm font-semibold">
                    服务类型 <span className="text-red-500">*</span>
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {serviceTypeOptions.map((type) => (
                    <div key={type} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-type-${type}`}
                        checked={serviceTypes.includes(type)}
                        onCheckedChange={() => toggleArrayItem(serviceTypes, setServiceTypes, type)}
                      />
                      <label htmlFor={`edit-type-${type}`} className="text-sm cursor-pointer">
                        {type}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* 售后保障 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <h3 className="text-sm font-semibold">
                    售后保障 <span className="text-red-500">*</span>
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {warrantyOptions.map((warranty) => (
                    <div key={warranty} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-warranty-${warranty}`}
                        checked={warranties.includes(warranty)}
                        onCheckedChange={() => toggleArrayItem(warranties, setWarranties, warranty)}
                      />
                      <label htmlFor={`edit-warranty-${warranty}`} className="text-sm cursor-pointer">
                        {warranty}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* 支付方式 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <h3 className="text-sm font-semibold">
                    支付方式 <span className="text-red-500">*</span>
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {paymentMethodOptions.map((method) => (
                    <div key={method} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-payment-${method}`}
                        checked={paymentMethods.includes(method)}
                        onCheckedChange={() => toggleArrayItem(paymentMethods, setPaymentMethods, method)}
                      />
                      <label htmlFor={`edit-payment-${method}`} className="text-sm cursor-pointer">
                        {method}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* 联系方式 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <h3 className="text-sm font-semibold">
                    联系方式 <span className="text-red-500">*</span>
                    <span className="text-xs text-muted-foreground ml-2 font-normal">（至少填写一项）</span>
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-phone">电话</Label>
                    <Input
                      id="edit-phone"
                      value={formData.contact_phone}
                      onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                      placeholder="请输入电话号码"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-whatsapp">WhatsApp</Label>
                    <Input
                      id="edit-whatsapp"
                      value={formData.contact_whatsapp}
                      onChange={(e) => setFormData({ ...formData, contact_whatsapp: e.target.value })}
                      placeholder="请输入WhatsApp号码"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-telegram">Telegram</Label>
                    <Input
                      id="edit-telegram"
                      value={formData.contact_telegram}
                      onChange={(e) => setFormData({ ...formData, contact_telegram: e.target.value })}
                      placeholder="请输入Telegram账号"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-wechat">微信</Label>
                    <Input
                      id="edit-wechat"
                      value={formData.contact_wechat}
                      onChange={(e) => setFormData({ ...formData, contact_wechat: e.target.value })}
                      placeholder="请输入微信号"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-email">邮箱</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      value={formData.contact_email}
                      onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                      placeholder="请输入邮箱地址"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleUpdateMerchant}>保存</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* 置顶推广对话框 */}
        <Dialog open={topDialogOpen} onOpenChange={setTopDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>置顶推广</DialogTitle>
              <DialogDescription>置顶您的商家信息，获得更多曝光机会</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Alert>
                <Coins className="h-4 w-4" />
                <AlertDescription>
                  置顶费用：<strong>{systemSettings?.merchant_top_cost_per_day || 1000}积分/天</strong>
                  <br />
                  您当前有 <strong>{userPoints}</strong> 积分
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="days">置顶天数</Label>
                <Input
                  id="days"
                  type="number"
                  min="1"
                  max="30"
                  value={topDays}
                  onChange={(e) => setTopDays(Number.parseInt(e.target.value) || 1)}
                />
                <p className="text-sm text-muted-foreground">
                  需要消耗 <strong>{requiredPoints}</strong> 积分
                </p>
              </div>

              {userPoints < requiredPoints && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>积分不足，无法置顶</AlertDescription>
                </Alert>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTopDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleOpenTopDialog} disabled={userPoints < requiredPoints}>
                下一步
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <PointsConfirmDialog
          open={topConfirmOpen}
          onOpenChange={setTopConfirmOpen}
          onConfirm={handleTopMerchant}
          points={requiredPoints}
          title="确认置顶推广"
          description={`您将置顶商家 ${topDays} 天，置顶期间您的商家将显示在列表顶部，获得更多曝光机会。`}
          currentPoints={userPoints}
        />

        <DepositApplyDialog
          open={depositApplyOpen}
          onOpenChange={setDepositApplyOpen}
          merchantId={merchant.id}
          merchantName={merchant.name}
          onSuccess={handleDepositApplySuccess}
        />

        {/* 押金退还申请对话框 */}
        {depositInfo && (
          <DepositRefundDialog
            open={depositRefundOpen}
            onOpenChange={setDepositRefundOpen}
            merchantId={merchant.id}
            depositAmount={depositInfo.deposit_amount}
            depositPaidAt={depositInfo.deposit_paid_at}
            onSuccess={async () => {
              // 强制刷新路由缓存
              router.refresh()

              // 刷新退还申请状态
              const refundAppResult = await getDepositRefundApplication(merchant.id)
              if (refundAppResult.success && refundAppResult.data) {
                setDepositRefundApplication(refundAppResult.data)
              }
            }}
          />
        )}

        {/* 追加押金申请对话框 */}
        {depositInfo && depositInfo.is_deposit_merchant && (
          <DepositTopUpDialog
            open={depositTopUpOpen}
            onOpenChange={setDepositTopUpOpen}
            merchantId={merchant.id}
            currentDeposit={depositInfo.deposit_amount || 0}
          />
        )}
      </div>
    </div>
  )
}
