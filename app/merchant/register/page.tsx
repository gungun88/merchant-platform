"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { ImageUpload } from "@/components/image-upload"
import { createMerchant } from "@/lib/actions/merchant"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { triggerPointsUpdate } from "@/lib/utils/points-update"
import { detectSensitiveWords } from "@/lib/actions/settings"

export default function MerchantRegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
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
  const [customServiceType, setCustomServiceType] = useState("")
  const [customWarranty, setCustomWarranty] = useState("")
  const [showCustomServiceInput, setShowCustomServiceInput] = useState(false)
  const [showCustomWarrantyInput, setShowCustomWarrantyInput] = useState(false)

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
    "全国",
    "广州",
    "深圳",
    "杭州",
    "上海",
    "北京",
    "成都",
    "重庆",
    "武汉",
    "西安",
    "南京",
    "苏州",
    "东莞",
    "佛山",
    "厦门",
    "福州",
    "长沙",
    "郑州",
    "济南",
    "青岛",
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || formData.name.length > 7) {
      toast.error("商家名称必填，且不超过7个字符")
      return
    }

    if (!logoUrl) {
      toast.error("请上传商家Logo")
      return
    }

    if (!formData.description || formData.description.length > 100) {
      toast.error("详情描述必填，且不超过100个字符")
      return
    }

    // 检测敏感词（严格模式：检测失败也阻止提交）
    try {
      const sensitiveCheck = await detectSensitiveWords(formData.description)

      // 检测功能本身出错
      if (!sensitiveCheck.success) {
        toast.error("敏感词检测服务异常，请稍后重试")
        return
      }

      // 检测到敏感词
      if (sensitiveCheck.found) {
        toast.error(`描述中包含敏感词：${sensitiveCheck.detected.join("、")}，请修改后重试`)
        return
      }
    } catch (error) {
      console.error("敏感词检测失败:", error)
      toast.error("敏感词检测服务异常，请稍后重试")
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

    setLoading(true)

    try {
      await createMerchant({
        ...formData,
        logo: logoUrl || undefined,
        service_types: serviceTypes,
        certifications: ["实名认证"], // 默认实名认证
        warranties,
        payment_methods: paymentMethods,
      })

      toast.success("商家入驻成功！获得积分奖励")

      // 触发积分更新
      triggerPointsUpdate()

      router.push("/")
    } catch (error) {
      console.error("商家入驻失败:", error)
      const errorMessage = error instanceof Error ? error.message : "入驻失败"
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const toggleArrayItem = (array: string[], setArray: (arr: string[]) => void, item: string) => {
    if (array.includes(item)) {
      setArray(array.filter((i) => i !== item))
    } else {
      setArray([...array, item])
    }
  }

  const handleCustomServiceTypeToggle = () => {
    setShowCustomServiceInput(!showCustomServiceInput)
    if (showCustomServiceInput && customServiceType) {
      // 如果关闭自定义输入框，移除自定义项
      setServiceTypes(serviceTypes.filter((t) => t !== customServiceType))
      setCustomServiceType("")
    }
  }

  const handleCustomWarrantyToggle = () => {
    setShowCustomWarrantyInput(!showCustomWarrantyInput)
    if (showCustomWarrantyInput && customWarranty) {
      // 如果关闭自定义输入框，移除自定义项
      setWarranties(warranties.filter((w) => w !== customWarranty))
      setCustomWarranty("")
    }
  }

  const handleCustomServiceTypeChange = (value: string) => {
    const trimmedValue = value.slice(0, 7)
    // 移除旧的自定义值
    const updatedTypes = serviceTypes.filter((t) => t !== customServiceType)
    setCustomServiceType(trimmedValue)
    // 如果有新值，添加到列表
    if (trimmedValue.trim()) {
      setServiceTypes([...updatedTypes, trimmedValue])
    } else {
      setServiceTypes(updatedTypes)
    }
  }

  const handleCustomWarrantyChange = (value: string) => {
    const trimmedValue = value.slice(0, 7)
    // 移除旧的自定义值
    const updatedWarranties = warranties.filter((w) => w !== customWarranty)
    setCustomWarranty(trimmedValue)
    // 如果有新值，添加到列表
    if (trimmedValue.trim()) {
      setWarranties([...updatedWarranties, trimmedValue])
    } else {
      setWarranties(updatedWarranties)
    }
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="container mx-auto max-w-3xl">
        <Link href="/">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回首页
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>商家入驻</CardTitle>
            <CardDescription>填写以下信息完成商家入驻，入驻成功后获得积分奖励</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 基本信息 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <h3 className="text-sm font-semibold">基本信息</h3>
                </div>

                <div className="space-y-2">
                  <Label>
                    商家Logo <span className="text-red-500">*</span>
                  </Label>
                  <ImageUpload
                    currentImage={logoUrl}
                    onImageChange={setLogoUrl}
                    folder="merchant-logos"
                    fallbackText={formData.name || "商"}
                  />
                  <p className="text-xs text-muted-foreground">必须上传商家Logo，支持 JPG、PNG、GIF 格式，大小不超过 2MB</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      名称 <span className="text-red-500">*</span>
                      <span className="text-xs text-muted-foreground ml-2">（最多7个字符）</span>
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value.slice(0, 7) })}
                      placeholder="请输入商家名称"
                      maxLength={7}
                      required
                    />
                    <p className="text-xs text-muted-foreground">{formData.name.length}/7</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="price_range">
                      价格区间 <span className="text-red-500">*</span>
                      <span className="text-xs text-muted-foreground ml-2">（仅填数字，如：100-500）</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input
                        id="price_range"
                        value={formData.price_range}
                        onChange={(e) => setFormData({ ...formData, price_range: e.target.value })}
                        placeholder="100-500"
                        className="pl-7"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">
                    详情描述 <span className="text-red-500">*</span>
                    <span className="text-xs text-muted-foreground ml-2">（最多100个字符）</span>
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value.slice(0, 100) })}
                    placeholder="详细介绍您的服务内容、优势等"
                    rows={4}
                    maxLength={100}
                    required
                  />
                  <p className="text-xs text-muted-foreground">{formData.description.length}/100</p>
                  <p className="text-xs text-muted-foreground">
                    请勿在描述栏中填写任何联系方式（如微信、QQ、邮箱、网址等）。一经发现，将视为违规行为，账号将被永久封禁。
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="location">
                      地区 <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.location}
                      onValueChange={(value) => setFormData({ ...formData, location: value })}
                    >
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
                    <Label htmlFor="response_time">
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
                    <Label htmlFor="stock_status">
                      库存 <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.stock_status}
                      onValueChange={(value) => setFormData({ ...formData, stock_status: value })}
                    >
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
                  <h3 className="text-sm font-semibold">服务类型 <span className="text-red-500">*</span></h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {serviceTypeOptions.map((type) => (
                    <div key={type} className="flex items-center space-x-2">
                      <Checkbox
                        id={`service-${type}`}
                        checked={serviceTypes.includes(type)}
                        onCheckedChange={() => toggleArrayItem(serviceTypes, setServiceTypes, type)}
                      />
                      <label htmlFor={`service-${type}`} className="text-sm cursor-pointer">
                        {type}
                      </label>
                    </div>
                  ))}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="service-custom"
                      checked={showCustomServiceInput}
                      onCheckedChange={handleCustomServiceTypeToggle}
                    />
                    <label htmlFor="service-custom" className="text-sm cursor-pointer">
                      自定义
                    </label>
                  </div>
                </div>
                {showCustomServiceInput && (
                  <div className="space-y-2 pl-6">
                    <Input
                      value={customServiceType}
                      onChange={(e) => handleCustomServiceTypeChange(e.target.value)}
                      placeholder="请输入自定义服务类型（最多7个字符）"
                      maxLength={7}
                      className="max-w-md"
                    />
                    <p className="text-xs text-muted-foreground">{customServiceType.length}/7</p>
                  </div>
                )}
              </div>

              {/* 售后保障 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <h3 className="text-sm font-semibold">售后保障 <span className="text-red-500">*</span></h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {warrantyOptions.map((warranty) => (
                    <div key={warranty} className="flex items-center space-x-2">
                      <Checkbox
                        id={`warranty-${warranty}`}
                        checked={warranties.includes(warranty)}
                        onCheckedChange={() => toggleArrayItem(warranties, setWarranties, warranty)}
                      />
                      <label htmlFor={`warranty-${warranty}`} className="text-sm cursor-pointer">
                        {warranty}
                      </label>
                    </div>
                  ))}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="warranty-custom"
                      checked={showCustomWarrantyInput}
                      onCheckedChange={handleCustomWarrantyToggle}
                    />
                    <label htmlFor="warranty-custom" className="text-sm cursor-pointer">
                      自定义
                    </label>
                  </div>
                </div>
                {showCustomWarrantyInput && (
                  <div className="space-y-2 pl-6">
                    <Input
                      value={customWarranty}
                      onChange={(e) => handleCustomWarrantyChange(e.target.value)}
                      placeholder="请输入自定义售后保障（最多7个字符）"
                      maxLength={7}
                      className="max-w-md"
                    />
                    <p className="text-xs text-muted-foreground">{customWarranty.length}/7</p>
                  </div>
                )}
              </div>

              {/* 支付方式 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <h3 className="text-sm font-semibold">支付方式 <span className="text-red-500">*</span></h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {paymentMethodOptions.map((method) => (
                    <div key={method} className="flex items-center space-x-2">
                      <Checkbox
                        id={`payment-${method}`}
                        checked={paymentMethods.includes(method)}
                        onCheckedChange={() => toggleArrayItem(paymentMethods, setPaymentMethods, method)}
                      />
                      <label htmlFor={`payment-${method}`} className="text-sm cursor-pointer">
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
                    <Label htmlFor="contact_phone">电话</Label>
                    <Input
                      id="contact_phone"
                      value={formData.contact_phone}
                      onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                      placeholder="+86 138 0000 0000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact_whatsapp">WhatsApp</Label>
                    <Input
                      id="contact_whatsapp"
                      value={formData.contact_whatsapp}
                      onChange={(e) => setFormData({ ...formData, contact_whatsapp: e.target.value })}
                      placeholder="+86 138 0000 0000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact_telegram">Telegram</Label>
                    <Input
                      id="contact_telegram"
                      value={formData.contact_telegram}
                      onChange={(e) => setFormData({ ...formData, contact_telegram: e.target.value })}
                      placeholder="@username"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact_wechat">微信</Label>
                    <Input
                      id="contact_wechat"
                      value={formData.contact_wechat}
                      onChange={(e) => setFormData({ ...formData, contact_wechat: e.target.value })}
                      placeholder="微信号"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact_email">邮箱</Label>
                    <Input
                      id="contact_email"
                      type="email"
                      value={formData.contact_email}
                      onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                      placeholder="contact@example.com"
                    />
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "提交中..." : "提交入驻申请"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
