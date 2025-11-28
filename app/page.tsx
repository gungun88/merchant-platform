"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { Coins, AlertCircle } from "lucide-react"
import { ContactDialog } from "@/components/contact-dialog"
import { PointsConfirmDialog } from "@/components/points-confirm-dialog"
import { ReportDialog } from "@/components/report-dialog"
import { ShareMerchantDialog } from "@/components/share-merchant-dialog"
import { MerchantNoteDialog } from "@/components/merchant-note-dialog"
import { FloatingMenu } from "@/components/floating-menu"
import { AnnouncementBanner } from "@/components/announcement-banner"
import { MerchantListSkeleton } from "@/components/merchant-list-skeleton"
import { LoadingProgress } from "@/components/loading-progress"
import { HomeBanners } from "@/components/home-banners"
import {
  Search,
  RefreshCw,
  Eye,
  Star,
  MapPin,
  Shield,
  CreditCard,
  MoreVertical,
  Plus,
  Edit,
  TrendingUp,
  PackageX,
  PackageCheck,
  AlertTriangle,
  Filter,
  Crown,
  Share2,
  StickyNote,
  Pin,
  Layers3,
} from "lucide-react"
import { useState, useEffect, useMemo } from "react"
import {
  getMerchants,
  editMerchant,
  deactivateMerchant,
  activateMerchant,
  topMerchant,
  toggleFavoriteMerchant,
  getAllServiceTypes,
} from "@/lib/actions/merchant"
import { createClient } from "@/lib/supabase/client"
import { getUserPoints } from "@/lib/actions/points"
import { getSystemSettings } from "@/lib/actions/settings"
import { getAllMerchantNotes } from "@/lib/actions/merchant-notes"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { triggerPointsUpdate } from "@/lib/utils/points-update"

export default function MerchantCenter() {
  const router = useRouter()
  const [contactDialogOpen, setContactDialogOpen] = useState(false)
  const [selectedMerchantId, setSelectedMerchantId] = useState<string>("")
  const [selectedMerchantName, setSelectedMerchantName] = useState<string>("")
  const [merchants, setMerchants] = useState<any[]>([])
  const [totalMerchants, setTotalMerchants] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [initializing, setInitializing] = useState(true) // 添加初始化状态
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [userMerchant, setUserMerchant] = useState<any>(null)
  const [userPoints, setUserPoints] = useState(0)
  const [editConfirmOpen, setEditConfirmOpen] = useState(false)
  const [selectedEditMerchantId, setSelectedEditMerchantId] = useState<string>("")
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [topDialogOpen, setTopDialogOpen] = useState(false)
  const [topConfirmOpen, setTopConfirmOpen] = useState(false)
  const [selectedTopMerchantId, setSelectedTopMerchantId] = useState<string>("")
  const [topDays, setTopDays] = useState(7)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [serviceTypes, setServiceTypes] = useState<string[]>([])
  const [systemSettings, setSystemSettings] = useState<any>(null)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)
  const [selectedShareMerchant, setSelectedShareMerchant] = useState<{ id: string; name: string }>({
    id: "",
    name: "",
  })
  const [merchantNotes, setMerchantNotes] = useState<Record<string, string>>({})
  const [filters, setFilters] = useState({
    service_type: "all",
    location: "all",
    price_range: "all",
    merchant_type: "all",
    search: "",
  })

  // 优化：分阶段加载 + 本地缓存
  useEffect(() => {
    async function loadInitialData() {
      const supabase = createClient()

      // 第一步：立即从缓存加载静态数据，快速渲染界面
      const cachedServiceTypes = localStorage.getItem('cached_service_types')
      const cachedSettings = localStorage.getItem('cached_system_settings')
      const cacheTimestamp = localStorage.getItem('cache_timestamp')
      const now = Date.now()
      const CACHE_DURATION = 5 * 60 * 1000 // 5分钟缓存

      // 如果缓存有效（5分钟内），先用缓存数据快速渲染
      if (cacheTimestamp && (now - parseInt(cacheTimestamp)) < CACHE_DURATION) {
        if (cachedServiceTypes) {
          setServiceTypes(JSON.parse(cachedServiceTypes))
        }
        if (cachedSettings) {
          const settings = JSON.parse(cachedSettings)
          setSystemSettings(settings)
          if (settings.merchants_per_page) {
            setPageSize(settings.merchants_per_page)
          }
        }
      }

      // 第二步：获取用户信息（最重要，优先加载）
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        setCurrentUserId(user.id)
      }

      // 第三步：后台并行刷新静态数据并更新缓存
      Promise.all([
        getAllServiceTypes(),
        getSystemSettings(),
      ]).then(([serviceTypesResult, settingsResult]) => {
        // 更新服务类型
        setServiceTypes(serviceTypesResult)
        localStorage.setItem('cached_service_types', JSON.stringify(serviceTypesResult))

        // 更新系统配置
        if (settingsResult.success && settingsResult.data) {
          setSystemSettings(settingsResult.data)
          localStorage.setItem('cached_system_settings', JSON.stringify(settingsResult.data))
          if (settingsResult.data.merchants_per_page) {
            setPageSize(settingsResult.data.merchants_per_page)
          }
        }

        // 更新缓存时间戳
        localStorage.setItem('cache_timestamp', now.toString())
      })

      // 第四步：如果有用户登录，延迟加载用户数据（不阻塞界面渲染）
      if (user) {
        // 先标记初始化完成，让界面先显示
        setInitializing(false)

        // 延迟100ms再加载用户详细数据，让界面先渲染
        setTimeout(() => {
          Promise.all([
            supabase.from("merchants").select("*").eq("user_id", user.id).maybeSingle(),
            getUserPoints(user.id),
            getAllMerchantNotes(),
          ]).then(([merchantData, points, notesResult]) => {
            if (merchantData.data) {
              setUserMerchant(merchantData.data)
            }
            setUserPoints(points)
            if (notesResult.success) {
              setMerchantNotes(notesResult.data)
            }
          })
        }, 100)
      } else {
        setInitializing(false)
      }
    }

    loadInitialData()
  }, [])

  useEffect(() => {
    // 只有在初始化完成后才加载商家数据
    if (initializing) return

    async function loadMerchants() {
      setLoading(true)
      const result = await getMerchants({
        ...filters,
        page: currentPage,
        pageSize: pageSize,
      })
      setMerchants(result.merchants)
      setTotalMerchants(result.total)
      setLoading(false)
    }
    loadMerchants()
  }, [
    filters.service_type,
    filters.location,
    filters.price_range,
    filters.merchant_type,
    filters.search,
    currentPage,
    pageSize,
    initializing,
  ])

  // 优化：使用防抖的实时订阅，避免频繁重新加载
  useEffect(() => {
    const supabase = createClient()
    let debounceTimer: NodeJS.Timeout | null = null

    // 订阅商家表的变化
    const channel = supabase
      .channel('merchants-changes-frontend')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'merchants'
        },
        (payload) => {
          // 使用防抖，避免短时间内多次变化导致频繁加载
          if (debounceTimer) {
            clearTimeout(debounceTimer)
          }

          debounceTimer = setTimeout(async () => {
            const result = await getMerchants({
              ...filters,
              page: currentPage,
              pageSize: pageSize,
            })
            setMerchants(result.merchants)
            setTotalMerchants(result.total)
          }, 1000) // 1秒防抖
        }
      )
      .subscribe()

    // 清理函数：组件卸载时取消订阅和定时器
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      supabase.removeChannel(channel)
    }
  }, [filters, currentPage, pageSize])

  const checkLoginAndRedirect = () => {
    if (!currentUserId) {
      window.location.href = "/auth/register"
      return false
    }
    return true
  }

  const handleContactClick = (merchantId: string, merchantName: string) => {
    if (!checkLoginAndRedirect()) return

    setSelectedMerchantId(merchantId)
    setSelectedMerchantName(merchantName)
    setContactDialogOpen(true)
  }

  const handleRefresh = async () => {
    // 重置所有筛选条件
    setFilters({ service_type: "all", location: "all", price_range: "all", merchant_type: "all", search: "" })
    setCurrentPage(1)

    // 立即重新加载商家数据
    setLoading(true)
    const result = await getMerchants({
      service_type: "all",
      location: "all",
      price_range: "all",
      merchant_type: "all",
      search: "",
      page: 1,
      pageSize: pageSize,
    })
    setMerchants(result.merchants)
    setTotalMerchants(result.total)
    setLoading(false)
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

  const handleEditMerchant = (merchantId: string) => {
    if (!checkLoginAndRedirect()) return
    setSelectedEditMerchantId(merchantId)
    setEditConfirmOpen(true)
  }

  const confirmEditMerchant = async () => {
    try {
      await editMerchant(selectedEditMerchantId, {})
      setEditConfirmOpen(false)
      toast.success(`已扣除${systemSettings?.edit_merchant_cost || 100}积分，可以编辑商家信息`)

      // 触发积分更新
      triggerPointsUpdate()

      // 跳转到编辑页面
      window.location.href = `/merchant/edit/${selectedEditMerchantId}`
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败")
    }
  }

  const handleOpenTopDialog = (merchantId: string) => {
    if (!checkLoginAndRedirect()) return
    setSelectedTopMerchantId(merchantId)
    setTopDialogOpen(true)
  }

  const handleConfirmTop = () => {
    setTopDialogOpen(false)
    setTopConfirmOpen(true)
  }

  const confirmTopMerchant = async () => {
    try {
      await topMerchant(selectedTopMerchantId, topDays)
      setTopConfirmOpen(false)
      toast.success(`置顶成功，有效期${topDays}天`)

      // 触发积分更新
      triggerPointsUpdate()

      // 刷新列表
      const result = await getMerchants({
        ...filters,
        page: currentPage,
        pageSize: pageSize,
      })
      setMerchants(result.merchants)
      setTotalMerchants(result.total)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "置顶失败")
    }
  }

  const handleDeactivate = async (merchantId: string) => {
    if (!checkLoginAndRedirect()) return
    try {
      await deactivateMerchant(merchantId)
      toast.success("商家已下架")
      // 刷新列表
      const result = await getMerchants({
        ...filters,
        page: currentPage,
        pageSize: pageSize,
      })
      setMerchants(result.merchants)
      setTotalMerchants(result.total)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "下架失败")
    }
  }

  const handleActivate = async (merchantId: string) => {
    if (!checkLoginAndRedirect()) return
    try {
      await activateMerchant(merchantId)
      toast.success("商家已重新上架")
      // 刷新列表
      const result = await getMerchants({
        ...filters,
        page: currentPage,
        pageSize: pageSize,
      })
      setMerchants(result.merchants)
      setTotalMerchants(result.total)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "上架失败")
    }
  }

  const handleReport = (merchantId: string, merchantName: string) => {
    if (!checkLoginAndRedirect()) return
    setSelectedMerchantId(merchantId)
    setSelectedMerchantName(merchantName)
    setReportDialogOpen(true)
  }

  const handleShare = (merchantId: string, merchantName: string) => {
    setSelectedShareMerchant({ id: merchantId, name: merchantName })
    setShareDialogOpen(true)
  }

  const handleNote = (merchantId: string, merchantName: string) => {
    if (!checkLoginAndRedirect()) return
    setSelectedShareMerchant({ id: merchantId, name: merchantName })
    setNoteDialogOpen(true)
  }

  const handleNoteUpdated = async () => {
    // 刷新备注数据
    const notesResult = await getAllMerchantNotes()
    if (notesResult.success) {
      setMerchantNotes(notesResult.data)
    }
  }

  const formatResponseTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`
    } else {
      const hours = Math.floor(minutes / 60)
      return `${hours} h`
    }
  }

  const calculateJoinDays = (createdAt: string) => {
    const created = new Date(createdAt)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - created.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const isOwnMerchant = (merchantUserId: string) => {
    return currentUserId === merchantUserId
  }

  const handleViewDetail = (merchantId: string) => {
    if (!checkLoginAndRedirect()) return

    // TODO: 跳转到商家详情页面
    window.location.href = `/merchant/${merchantId}`
  }

  const handleFavorite = async (merchantId: string) => {
    if (!checkLoginAndRedirect()) return

    if (!currentUserId) return

    try {
      const result = await toggleFavoriteMerchant(merchantId)

      if (result.success) {
        toast.success(result.isFavorited ? "收藏成功" : "已取消收藏")
        // 刷新页面以更新状态
        router.refresh()
      } else {
        toast.error("操作失败")
      }
    } catch (error: any) {
      toast.error(error.message || "操作失败")
    }
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background pb-20">
        {/* Main Content */}
        <main className="container mx-auto px-4 py-6 tracking-normal leading-7 font-medium">
          {/* 广告Banner */}
          <HomeBanners />

          {/* 公告展示 - 使用数据库公告 */}
          <AnnouncementBanner targetAudience="all" maxDisplay={3} className="mb-4" />

          {/* PC端筛选器 */}
          <div className="hidden lg:flex items-center justify-between mb-6 gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-1 flex-wrap">
              <Select
                value={filters.service_type}
                onValueChange={(value) => {
                  setFilters({ ...filters, service_type: value })
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="服务类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  {serviceTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.merchant_type}
                onValueChange={(value) => {
                  setFilters({ ...filters, merchant_type: value })
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="商家类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部商家</SelectItem>
                  <SelectItem value="deposit">押金商家</SelectItem>
                  <SelectItem value="regular">普通商家</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.price_range}
                onValueChange={(value) => {
                  setFilters({ ...filters, price_range: value })
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="价格区间" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部价格</SelectItem>
                  <SelectItem value="$0-50">$0-50</SelectItem>
                  <SelectItem value="$50-200">$50-200</SelectItem>
                  <SelectItem value="$200+">$200以上</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.location} onValueChange={(value) => {
                  setFilters({ ...filters, location: value })
                  setCurrentPage(1)
                }}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="地区" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部地区</SelectItem>
                  <SelectItem value="全国">全国</SelectItem>
                  <SelectItem value="广州">广州</SelectItem>
                  <SelectItem value="深圳">深圳</SelectItem>
                  <SelectItem value="杭州">杭州</SelectItem>
                  <SelectItem value="上海">上海</SelectItem>
                  <SelectItem value="北京">北京</SelectItem>
                  <SelectItem value="成都">成都</SelectItem>
                  <SelectItem value="重庆">重庆</SelectItem>
                  <SelectItem value="武汉">武汉</SelectItem>
                  <SelectItem value="西安">西安</SelectItem>
                  <SelectItem value="南京">南京</SelectItem>
                  <SelectItem value="苏州">苏州</SelectItem>
                  <SelectItem value="东莞">东莞</SelectItem>
                  <SelectItem value="佛山">佛山</SelectItem>
                  <SelectItem value="厦门">厦门</SelectItem>
                  <SelectItem value="福州">福州</SelectItem>
                  <SelectItem value="长沙">长沙</SelectItem>
                  <SelectItem value="郑州">郑州</SelectItem>
                  <SelectItem value="济南">济南</SelectItem>
                  <SelectItem value="青岛">青岛</SelectItem>
                </SelectContent>
              </Select>

              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索服务商名称、描述或用户编号..."
                  className="pl-9"
                  value={filters.search}
                  onChange={(e) => {
                    setFilters({ ...filters, search: e.target.value })
                    setCurrentPage(1)
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button className="font-normal bg-transparent" variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                刷新
              </Button>

              <Link href="/merchant/register">
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-normal"
                  disabled={!!userMerchant}
                >
                  <Plus className="h-4 w-4 mr-0" />
                  免费入驻
                </Button>
              </Link>
            </div>
          </div>

          {/* 移动端筛选器 */}
          <div className="lg:hidden mb-4 flex items-center gap-2">
            {/* 搜索框 */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索服务商名称或编号..."
                className="pl-9"
                value={filters.search}
                onChange={(e) => {
                  setFilters({ ...filters, search: e.target.value })
                  setCurrentPage(1)
                }}
              />
            </div>

            {/* 筛选按钮 */}
            <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <Filter className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px]">
                <SheetHeader>
                  <SheetTitle>筛选条件</SheetTitle>
                  <SheetDescription>选择筛选条件来查找商家</SheetDescription>
                </SheetHeader>
                <div className="space-y-4 mt-6">
                  <div>
                    <Label className="mb-2 block">服务类型</Label>
                    <Select
                      value={filters.service_type}
                      onValueChange={(value) => {
                        setFilters({ ...filters, service_type: value })
                        setCurrentPage(1)
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="服务类型" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部类型</SelectItem>
                        {serviceTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="mb-2 block">商家类型</Label>
                    <Select
                      value={filters.merchant_type}
                      onValueChange={(value) => {
                        setFilters({ ...filters, merchant_type: value })
                        setCurrentPage(1)
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="商家类型" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部商家</SelectItem>
                        <SelectItem value="deposit">押金商家</SelectItem>
                        <SelectItem value="regular">普通商家</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="mb-2 block">价格区间</Label>
                    <Select
                      value={filters.price_range}
                      onValueChange={(value) => {
                        setFilters({ ...filters, price_range: value })
                        setCurrentPage(1)
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="价格区间" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部价格</SelectItem>
                        <SelectItem value="$0-50">$0-50</SelectItem>
                        <SelectItem value="$50-200">$50-200</SelectItem>
                        <SelectItem value="$200+">$200以上</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="mb-2 block">地区</Label>
                    <Select
                      value={filters.location}
                      onValueChange={(value) => {
                        setFilters({ ...filters, location: value })
                        setCurrentPage(1)
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="地区" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部地区</SelectItem>
                        <SelectItem value="全国">全国</SelectItem>
                        <SelectItem value="广州">广州</SelectItem>
                        <SelectItem value="深圳">深圳</SelectItem>
                        <SelectItem value="杭州">杭州</SelectItem>
                        <SelectItem value="上海">上海</SelectItem>
                        <SelectItem value="北京">北京</SelectItem>
                        <SelectItem value="成都">成都</SelectItem>
                        <SelectItem value="重庆">重庆</SelectItem>
                        <SelectItem value="武汉">武汉</SelectItem>
                        <SelectItem value="西安">西安</SelectItem>
                        <SelectItem value="南京">南京</SelectItem>
                        <SelectItem value="苏州">苏州</SelectItem>
                        <SelectItem value="东莞">东莞</SelectItem>
                        <SelectItem value="佛山">佛山</SelectItem>
                        <SelectItem value="厦门">厦门</SelectItem>
                        <SelectItem value="福州">福州</SelectItem>
                        <SelectItem value="长沙">长沙</SelectItem>
                        <SelectItem value="郑州">郑州</SelectItem>
                        <SelectItem value="济南">济南</SelectItem>
                        <SelectItem value="青岛">青岛</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setFilters({
                          service_type: "all",
                          location: "all",
                          price_range: "all",
                          merchant_type: "all",
                          search: "",
                        })
                        setCurrentPage(1)
                      }}
                    >
                      重置
                    </Button>
                    <Button className="flex-1" onClick={() => setFilterSheetOpen(false)}>
                      确定
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            {/* 免费入驻按钮 */}
            <Link href="/merchant/register">
              <Button
                size="icon"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={!!userMerchant}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          {loading ? (
            <LoadingProgress isLoading={loading} message="正在加载商家列表..." />
          ) : merchants.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">暂无商家数据</p>
            </Card>
          ) : (
            <>
              {/* PC端：表格布局 */}
              <Card className="leading-7 py-px font-normal hidden lg:block">
                <div className="overflow-x-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                      <TableHead className="w-[160px]">名称</TableHead>
                      <TableHead className="w-[130px]">类型</TableHead>
                      <TableHead className="min-w-[180px]">详情描述</TableHead>
                      <TableHead className="w-[100px]">价格区间</TableHead>
                      <TableHead className="w-[80px]">认证</TableHead>
                      <TableHead className="w-[80px]">信用分</TableHead>
                      <TableHead className="w-[80px]">地区</TableHead>
                      <TableHead className="w-[90px]">响应速度</TableHead>
                      <TableHead className="w-[80px]">入驻时长</TableHead>
                      <TableHead className="w-[110px]">售后保障</TableHead>
                      <TableHead className="w-[110px]">支付方式</TableHead>
                      <TableHead className="w-[80px]">库存</TableHead>
                      <TableHead className="w-[100px]">联系方式</TableHead>
                      <TableHead className="w-[70px] text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {merchants.map((merchant) => {
                      const isOwnMerchantRow = userMerchant?.id === merchant.id
                      return (
                        <TableRow
                          key={merchant.id}
                          className={`hover:bg-muted/50 ${isOwnMerchantRow ? 'bg-blue-100/80 dark:bg-blue-900/40 border-l-4 border-l-blue-600 shadow-sm' : ''}`}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <Avatar className={`h-10 w-10 ${merchant.is_deposit_merchant ? 'ring-2 ring-yellow-500 ring-offset-2' : ''}`}>
                                  <AvatarImage src={merchant.logo || "/placeholder.svg"} />
                                  <AvatarFallback>{merchant.name[0]}</AvatarFallback>
                                </Avatar>
                                {/* 头像图标 - 官方置顶优先,自助置顶Pin次之,最后是押金Crown */}
                                {merchant.pin_type === "admin" && merchant.topped_until && new Date(merchant.topped_until) > new Date() ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="absolute -top-1 -right-1 rounded-full p-1 shadow-lg cursor-help" style={{ backgroundColor: '#2864b4' }}>
                                        <Layers3 className="h-3 w-3 text-white" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p className="text-xs">官方置顶</p>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (merchant.pin_type === "self" || merchant.is_topped) && merchant.topped_until && new Date(merchant.topped_until) > new Date() ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 shadow-md cursor-help">
                                        <Pin className="h-3 w-3 text-white" fill="currentColor" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p className="text-xs">自助置顶</p>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : merchant.is_deposit_merchant ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="absolute -top-1 -right-1 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full p-0.5 shadow-md cursor-help">
                                        <Crown className="h-3 w-3 text-white" fill="currentColor" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p className="text-xs">押金商家</p>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : null}
                              </div>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="font-medium text-sm cursor-pointer hover:text-blue-600 transition-colors"
                                    onClick={() => window.open(`/merchant/${merchant.id}`, '_blank')}
                                  >
                                    {merchant.name}
                                  </span>
                                  {merchantNotes[merchant.id] && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <StickyNote className="h-3.5 w-3.5 text-amber-500 cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent side="right" className="max-w-xs">
                                        <p className="text-xs">{merchantNotes[merchant.id]}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 mt-1">
                                {merchant.is_deposit_merchant && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="default" className="text-xs w-fit bg-yellow-500 cursor-help">
                                        押金商家
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>押金金额: {merchant.deposit_amount || 500} USDT</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1 whitespace-nowrap">
                                <Badge variant="secondary" className="text-xs">
                                  {merchant.service_types[0]}
                                </Badge>
                                {merchant.service_types.length > 1 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{merchant.service_types.length - 1}
                                  </Badge>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="flex flex-col gap-1">
                                {merchant.service_types.map((type: string, i: number) => (
                                  <div key={i} className="text-xs">
                                    {type}
                                  </div>
                                ))}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>

                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p
                                className="text-sm text-muted-foreground truncate max-w-[220px] cursor-pointer hover:text-blue-600 transition-colors"
                                onClick={() => window.open(`/merchant/${merchant.id}`, '_blank')}
                              >
                                {merchant.description}
                              </p>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[300px]">
                              <p className="text-xs">{merchant.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>

                        <TableCell>
                          <Badge variant="outline" className="font-semibold text-xs">
                            {formatPrice(merchant.price_range)}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant={merchant.is_deposit_merchant ? "default" : "secondary"}
                            className={
                              merchant.is_deposit_merchant
                                ? "text-xs bg-green-600 hover:bg-green-700 text-white"
                                : "text-xs"
                            }
                          >
                            {merchant.is_deposit_merchant ? "已认证" : "未认证"}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col items-start gap-0.5">
                            <span className={`text-sm font-bold ${
                              merchant.credit_score >= 80 ? 'text-green-600' :
                              merchant.credit_score >= 60 ? 'text-yellow-600' :
                              merchant.credit_score >= 40 ? 'text-orange-600' :
                              'text-red-600'
                            }`}>
                              {merchant.credit_score}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {merchant.credit_score >= 80 ? '信用优秀' :
                               merchant.credit_score >= 60 ? '信用良好' :
                               merchant.credit_score >= 40 ? '信用一般' :
                               '信用较差'}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            {merchant.location || "未知"}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-1">
                            <div
                              className={`h-2 w-2 rounded-full ${merchant.response_time <= 10 ? "bg-green-500" : "bg-yellow-500"}`}
                            />
                            <span className="text-sm font-medium">{formatResponseTime(merchant.response_time)}</span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {calculateJoinDays(merchant.created_at)}天
                          </span>
                        </TableCell>

                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1 whitespace-nowrap">
                                <Badge variant="outline" className="text-xs">
                                  <Shield className="h-3 w-3 mr-1" />
                                  {merchant.warranties[0] || "售后保障"}
                                </Badge>
                                {merchant.warranties.length > 1 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{merchant.warranties.length - 1}
                                  </Badge>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="flex flex-col gap-1">
                                {merchant.warranties.map((item: string, i: number) => (
                                  <div key={i} className="text-xs flex items-center gap-1">
                                    <Shield className="h-3 w-3" />
                                    {item}
                                  </div>
                                ))}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>

                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1 whitespace-nowrap">
                                <Badge variant="secondary" className="text-xs">
                                  <CreditCard className="h-3 w-3 mr-1" />
                                  {merchant.payment_methods[0]}
                                </Badge>
                                {merchant.payment_methods.length > 1 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{merchant.payment_methods.length - 1}
                                  </Badge>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="flex flex-col gap-1">
                                {merchant.payment_methods.map((method: string, i: number) => (
                                  <div key={i} className="text-xs flex items-center gap-1">
                                    <CreditCard className="h-3 w-3" />
                                    {method}
                                  </div>
                                ))}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              merchant.stock_status?.includes("充足") || merchant.stock_status?.includes("500+")
                                ? "bg-green-50 text-green-700 border-green-200"
                                : "bg-gray-50 text-gray-700 border-gray-200"
                            }`}
                          >
                            {merchant.stock_status || "现货"}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <Button
                            variant="default"
                            size="sm"
                            className="h-8"
                            onClick={() => handleContactClick(merchant.id, merchant.name)}
                          >
                            立即咨询
                          </Button>
                        </TableCell>

                        <TableCell>
                          <div className="flex justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {isOwnMerchant(merchant.user_id) ? (
                                  <>
                                    {/* 商家自己看到的菜单 */}
                                    <DropdownMenuItem onClick={() => handleEditMerchant(merchant.id)}>
                                      <Edit className="h-4 w-4 mr-2" />
                                      编辑
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleViewDetail(merchant.id)}>
                                      <Eye className="h-4 w-4 mr-2" />
                                      查看详情
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleOpenTopDialog(merchant.id)}>
                                      <TrendingUp className="h-4 w-4 mr-2" />
                                      置顶推广
                                    </DropdownMenuItem>
                                  </>
                                ) : (
                                  <>
                                    {/* 其他用户看到的菜单 */}
                                    <DropdownMenuItem onClick={() => handleViewDetail(merchant.id)}>
                                      <Eye className="h-4 w-4 mr-2" />
                                      查看详情
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleFavorite(merchant.id)}>
                                      <Star className="h-4 w-4 mr-2" />
                                      收藏
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleNote(merchant.id, merchant.name)}>
                                      <StickyNote className="h-4 w-4 mr-2" />
                                      添加备注
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleShare(merchant.id, merchant.name)}>
                                      <Share2 className="h-4 w-4 mr-2" />
                                      分享商家
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleReport(merchant.id, merchant.name)}>
                                      <AlertTriangle className="h-4 w-4 mr-2" />
                                      举报
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  </TableBody>
                </Table>
              </div>
            </Card>

            {/* 移动端：卡片布局 */}
            <div className="lg:hidden space-y-3">
              {merchants.map((merchant) => {
                const isOwnMerchantCard = userMerchant?.id === merchant.id
                return (
                  <Card
                    key={merchant.id}
                    className={`p-3 ${
                      merchant.is_deposit_merchant
                        ? 'border-2 border-yellow-500 shadow-lg shadow-yellow-200/50'
                        : isOwnMerchantCard
                        ? 'border-2 border-blue-600 bg-blue-100/50 dark:bg-blue-900/30 shadow-md'
                        : ''
                    }`}
                  >
                    {/* 头部：Logo + 名称 + 操作菜单 */}
                    <div className="flex items-start gap-2.5 mb-2">
                      <div className="relative flex-shrink-0">
                        <Avatar className={`h-12 w-12 ${merchant.is_deposit_merchant ? 'ring-2 ring-yellow-500 ring-offset-1' : ''}`}>
                          <AvatarImage src={merchant.logo || "/placeholder.svg"} />
                          <AvatarFallback>{merchant.name[0]}</AvatarFallback>
                        </Avatar>
                        {/* 头像图标 - 官方置顶优先,自助置顶Pin次之,最后是押金Crown */}
                        {merchant.pin_type === "admin" && merchant.topped_until && new Date(merchant.topped_until) > new Date() ? (
                          <div className="absolute -top-0.5 -right-0.5 rounded-full p-1 shadow-md" style={{ backgroundColor: '#2864b4' }}>
                            <Layers3 className="h-3 w-3 text-white" />
                          </div>
                        ) : (merchant.pin_type === "self" || merchant.is_topped) && merchant.topped_until && new Date(merchant.topped_until) > new Date() ? (
                          <div className="absolute -top-0.5 -right-0.5 bg-red-500 rounded-full p-0.5 shadow-md">
                            <Pin className="h-3 w-3 text-white" fill="currentColor" />
                          </div>
                        ) : merchant.is_deposit_merchant ? (
                          <div className="absolute -top-0.5 -right-0.5 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full p-0.5 shadow-md">
                            <Crown className="h-3 w-3 text-white" fill="currentColor" />
                          </div>
                        ) : null}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <h3
                                className="font-semibold text-sm truncate cursor-pointer hover:text-blue-600 transition-colors"
                                onClick={() => window.open(`/merchant/${merchant.id}`, '_blank')}
                              >
                                {merchant.name}
                              </h3>
                              {merchantNotes[merchant.id] && (
                                <StickyNote className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {merchant.is_deposit_merchant && (
                                <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 bg-yellow-500">
                                  押金
                                </Badge>
                              )}
                              <Badge
                                variant={merchant.is_deposit_merchant ? "default" : "secondary"}
                                className={`text-[10px] px-1.5 py-0 h-4 ${
                                  merchant.is_deposit_merchant
                                    ? "bg-green-600 hover:bg-green-700 text-white"
                                    : ""
                                }`}
                              >
                                {merchant.is_deposit_merchant ? "已认证" : "未认证"}
                              </Badge>
                              <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                <MapPin className="h-2.5 w-2.5" />
                                {merchant.location || "未知"}
                              </div>
                              <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                <div className={`h-1.5 w-1.5 rounded-full ${merchant.response_time <= 10 ? "bg-green-500" : "bg-yellow-500"}`} />
                                {formatResponseTime(merchant.response_time)}
                              </div>
                            </div>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {isOwnMerchant(merchant.user_id) ? (
                                <>
                                  <DropdownMenuItem onClick={() => handleEditMerchant(merchant.id)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    编辑
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleViewDetail(merchant.id)}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    查看详情
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleOpenTopDialog(merchant.id)}>
                                    <TrendingUp className="h-4 w-4 mr-2" />
                                    置顶推广
                                  </DropdownMenuItem>
                                </>
                              ) : (
                                <>
                                  <DropdownMenuItem onClick={() => handleViewDetail(merchant.id)}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    查看详情
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleFavorite(merchant.id)}>
                                    <Star className="h-4 w-4 mr-2" />
                                    收藏
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleNote(merchant.id, merchant.name)}>
                                    <StickyNote className="h-4 w-4 mr-2" />
                                    添加备注
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleShare(merchant.id, merchant.name)}>
                                    <Share2 className="h-4 w-4 mr-2" />
                                    分享商家
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleReport(merchant.id, merchant.name)}>
                                    <AlertTriangle className="h-4 w-4 mr-2" />
                                    举报
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>

                    {/* 服务类型和价格 */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap flex-1">
                        {merchant.service_types.slice(0, 2).map((type: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                            {type}
                          </Badge>
                        ))}
                        {merchant.service_types.length > 2 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                            +{merchant.service_types.length - 2}
                          </Badge>
                        )}
                      </div>
                      <Badge variant="outline" className="font-semibold text-xs px-2 shrink-0">
                        {formatPrice(merchant.price_range)}
                      </Badge>
                    </div>

                    {/* 描述 */}
                    <p
                      className="text-xs text-muted-foreground mb-2 line-clamp-2 leading-relaxed cursor-pointer hover:text-blue-600 transition-colors"
                      onClick={() => window.open(`/merchant/${merchant.id}`, '_blank')}
                    >
                      {merchant.description}
                    </p>

                    {/* 底部信息行 */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t">
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-0.5">
                          <CreditCard className="h-3 w-3" />
                          {merchant.payment_methods[0]}
                          {merchant.payment_methods.length > 1 && `+${merchant.payment_methods.length - 1}`}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Shield className="h-3 w-3" />
                          {merchant.warranties[0]}
                          {merchant.warranties.length > 1 && `+${merchant.warranties.length - 1}`}
                        </span>
                      </div>
                      <Button
                        variant="default"
                        size="sm"
                        className="h-7 text-xs px-3"
                        onClick={() => handleContactClick(merchant.id, merchant.name)}
                      >
                        立即咨询
                      </Button>
                    </div>
                </Card>
                )
              })}
            </div>
            </>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              共 {totalMerchants} 条记录，当前第 {currentPage} 页，共 {Math.ceil(totalMerchants / pageSize)} 页
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1 || loading}
              >
                上一页
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, Math.ceil(totalMerchants / pageSize)) }, (_, i) => {
                  const totalPages = Math.ceil(totalMerchants / pageSize)
                  let pageNumber: number

                  if (totalPages <= 5) {
                    // 总页数<=5，显示全部
                    pageNumber = i + 1
                  } else if (currentPage <= 3) {
                    // 当前页靠前，显示1-5
                    pageNumber = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    // 当前页靠后，显示最后5页
                    pageNumber = totalPages - 4 + i
                  } else {
                    // 当前页在中间，显示当前页前后各2页
                    pageNumber = currentPage - 2 + i
                  }

                  return (
                    <Button
                      key={i}
                      variant={currentPage === pageNumber ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNumber)}
                      disabled={loading}
                      className="w-8 h-8 p-0"
                    >
                      {pageNumber}
                    </Button>
                  )
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(Math.ceil(totalMerchants / pageSize), prev + 1))}
                disabled={currentPage >= Math.ceil(totalMerchants / pageSize) || loading}
              >
                下一页
              </Button>
            </div>
          </div>
        </main>

        <ContactDialog
          open={contactDialogOpen}
          onOpenChange={setContactDialogOpen}
          merchantId={selectedMerchantId}
          merchantName={selectedMerchantName}
        />

        <PointsConfirmDialog
          open={editConfirmOpen}
          onOpenChange={setEditConfirmOpen}
          onConfirm={confirmEditMerchant}
          points={systemSettings?.edit_merchant_cost || 100}
          title="确认编辑商家信息"
          description={`编辑商家信息需要消耗积分，每次编辑扣除${systemSettings?.edit_merchant_cost || 100}积分。`}
          currentPoints={userPoints}
        />

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
                  需要消耗 <strong>{topDays * (systemSettings?.merchant_top_cost_per_day || 1000)}</strong> 积分
                </p>
              </div>

              {userPoints < topDays * (systemSettings?.merchant_top_cost_per_day || 1000) && (
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
              <Button onClick={handleConfirmTop} disabled={userPoints < topDays * (systemSettings?.merchant_top_cost_per_day || 1000)}>
                下一步
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* 置顶推广确认对话框 */}
        <PointsConfirmDialog
          open={topConfirmOpen}
          onOpenChange={setTopConfirmOpen}
          onConfirm={confirmTopMerchant}
          points={topDays * (systemSettings?.merchant_top_cost_per_day || 1000)}
          title="确认置顶推广"
          description={`您将置顶商家 ${topDays} 天，置顶期间您的商家将显示在列表顶部，获得更多曝光机会。`}
          currentPoints={userPoints}
        />

        {/* 举报对话框 */}
        <ReportDialog
          open={reportDialogOpen}
          onOpenChange={setReportDialogOpen}
          merchantId={selectedMerchantId}
          merchantName={selectedMerchantName}
        />

        {/* 分享商家对话框 */}
        <ShareMerchantDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          merchantId={selectedShareMerchant.id}
          merchantName={selectedShareMerchant.name}
        />

        {/* 添加备注对话框 */}
        <MerchantNoteDialog
          open={noteDialogOpen}
          onOpenChange={setNoteDialogOpen}
          merchantId={selectedShareMerchant.id}
          merchantName={selectedShareMerchant.name}
          onNoteUpdated={handleNoteUpdated}
        />

        {/* 右侧悬浮菜单 */}
        <FloatingMenu />
      </div>
    </TooltipProvider>
  )
}
