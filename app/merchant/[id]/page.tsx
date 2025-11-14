"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ContactDialog } from "@/components/contact-dialog"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { toggleFavoriteMerchant } from "@/lib/actions/merchant"
import {
  ArrowLeft,
  MapPin,
  Clock,
  Shield,
  CreditCard,
  Package,
  Calendar,
  Eye,
  Star,
  MessageCircle,
} from "lucide-react"
import Link from "next/link"

export default function MerchantDetailPage() {
  const params = useParams()
  const router = useRouter()
  const merchantId = params.id as string

  const [merchant, setMerchant] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [contactDialogOpen, setContactDialogOpen] = useState(false)
  const [isFavorited, setIsFavorited] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      const supabase = createClient()

      // 获取当前用户
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        setCurrentUserId(user.id)

        // 检查是否已收藏
        const { data: favoriteData } = await supabase
          .from("favorites")
          .select("*")
          .eq("user_id", user.id)
          .eq("merchant_id", merchantId)
          .maybeSingle()

        setIsFavorited(!!favoriteData)
      }

      // 获取商家信息
      const { data: merchantData, error } = await supabase
        .from("merchants")
        .select("*, credit_score")
        .eq("id", merchantId)
        .maybeSingle()

      if (error || !merchantData) {
        toast.error("商家不存在")
        router.push("/")
        return
      }

      setMerchant(merchantData)

      // 增加浏览量
      await supabase.rpc("increment_merchant_views", { merchant_id: merchantId })

      setLoading(false)
    }

    loadData()
  }, [merchantId, router])

  const handleFavorite = async () => {
    if (!currentUserId) {
      toast.error("请先登录")
      router.push("/auth/login")
      return
    }

    try {
      const result = await toggleFavoriteMerchant(merchantId)

      if (result.success) {
        setIsFavorited(result.isFavorited)
        toast.success(result.isFavorited ? "收藏成功" : "已取消收藏")
      } else {
        toast.error(result.error || "操作失败")
      }
    } catch (error: any) {
      toast.error(error.message || "操作失败")
    }
  }

  const formatResponseTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} 分钟`
    } else {
      const hours = Math.floor(minutes / 60)
      return `${hours} 小时`
    }
  }

  const calculateJoinDays = (createdAt: string) => {
    const created = new Date(createdAt)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - created.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    )
  }

  if (!merchant) {
    return null
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background py-4 md:py-8">
        <div className="container mx-auto px-4 max-w-5xl">
          <Link href="/">
            <Button variant="ghost" className="mb-4" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回列表
            </Button>
          </Link>

        <div className="space-y-4 md:space-y-6">
          {/* 商家头部信息 */}
          <Card>
            <CardContent className="pt-4 md:pt-6">
              <div className="flex flex-col md:flex-row items-start gap-4 md:gap-6">
                <Avatar className="h-20 w-20 md:h-24 md:w-24 mx-auto md:mx-0">
                  <AvatarImage src={merchant.logo || "/placeholder.svg"} />
                  <AvatarFallback className="text-xl md:text-2xl">{merchant.name[0]}</AvatarFallback>
                </Avatar>

                <div className="flex-1 w-full">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <h1 className="text-xl md:text-3xl font-bold">{merchant.name}</h1>
                        {merchant.is_topped && (
                          <Badge variant="default" className="bg-red-500 w-fit">
                            置顶
                          </Badge>
                        )}
                        {merchant.is_deposit_merchant && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="default" className="bg-yellow-500 w-fit cursor-help">
                                押金商家
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>押金金额: {merchant.deposit_amount || 500} USDT</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <Badge
                          variant={
                            merchant.certification_status === "已认证" || merchant.is_deposit_merchant
                              ? "default"
                              : merchant.certification_status === "待认证"
                                ? "secondary"
                                : "destructive"
                          }
                          className={
                            merchant.is_deposit_merchant || merchant.certification_status === "已认证"
                              ? "bg-green-600 hover:bg-green-700 text-white w-fit text-xs"
                              : "text-xs w-fit"
                          }
                        >
                          {merchant.is_deposit_merchant || merchant.certification_status === "已认证"
                            ? "已认证"
                            : merchant.certification_status || "待认证"}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 md:gap-4 mt-2 text-xs md:text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 md:h-4 md:w-4" />
                          {merchant.location || "未知"}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 md:h-4 md:w-4" />
                          入驻 {calculateJoinDays(merchant.created_at)} 天
                        </div>
                        <div className="flex items-center gap-1">
                          <Eye className="h-3 w-3 md:h-4 md:w-4" />
                          浏览 {merchant.views || 0} 次
                        </div>
                        <div className="flex items-center gap-1">
                          <Shield className="h-3 w-3 md:h-4 md:w-4" />
                          <span className={`font-semibold ${
                            merchant.credit_score >= 80 ? 'text-green-600' :
                            merchant.credit_score >= 60 ? 'text-yellow-600' :
                            merchant.credit_score >= 40 ? 'text-orange-600' :
                            'text-red-600'
                          }`}>
                            信用分 {merchant.credit_score}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 只有非商家所有者才显示收藏和咨询按钮 */}
                    {currentUserId !== merchant.user_id && (
                      <div className="flex gap-2 w-full md:w-auto">
                        <Button
                          variant={isFavorited ? "default" : "outline"}
                          size="sm"
                          onClick={handleFavorite}
                          className="flex-1 md:flex-initial"
                        >
                          <Star className={`h-4 w-4 mr-2 ${isFavorited ? "fill-current" : ""}`} />
                          {isFavorited ? "已收藏" : "收藏"}
                        </Button>
                        <Button size="sm" onClick={() => setContactDialogOpen(true)} className="flex-1 md:flex-initial">
                          <MessageCircle className="h-4 w-4 mr-2" />
                          立即咨询
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3 md:mt-4">
                    {merchant.service_types?.map((type: string) => (
                      <Badge key={type} variant="secondary" className="text-xs">
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 服务信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base md:text-lg">服务信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 md:space-y-4">
              {/* 价格信息 */}
              <div className="flex items-center justify-between p-3 md:p-4 bg-muted/50 rounded-lg">
                <span className="text-sm md:text-base text-muted-foreground">价格区间</span>
                <span className="text-xl md:text-2xl font-bold text-primary">{formatPrice(merchant.price_range)}</span>
              </div>

              {/* 服务详情 */}
              <div>
                <p className="text-sm font-medium mb-2 text-muted-foreground">服务详情</p>
                <p className="text-sm md:text-base text-foreground leading-relaxed whitespace-pre-wrap">
                  {merchant.description || "暂无详细描述"}
                </p>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">响应速度</p>
                    <p className="font-medium">{formatResponseTime(merchant.response_time)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">库存状态</p>
                    <p className="font-medium">{merchant.stock_status || "现货"}</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <p className="font-medium">售后保障</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {merchant.warranties?.map((warranty: string, index: number) => (
                    <Badge key={index} variant="outline">
                      {warranty}
                    </Badge>
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <p className="font-medium">支付方式</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {merchant.payment_methods?.map((method: string, index: number) => (
                    <Badge key={index} variant="outline">
                      {method}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <ContactDialog
          open={contactDialogOpen}
          onOpenChange={setContactDialogOpen}
          merchantId={merchantId}
          merchantName={merchant.name}
        />
      </div>
    </div>
    </TooltipProvider>
  )
}
