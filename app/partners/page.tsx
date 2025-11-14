"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Upload, X, CheckCircle2, AlertCircle, Eye, Coins, MessageSquare, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { getApprovedPartners, submitPartnerApplication, uploadPartnerLogo } from "@/lib/actions/partners"
import { createClient } from "@/lib/supabase/client"
import { OfficialContactDialog } from "@/components/official-contact-dialog"

export default function PartnersPage() {
  const [addPartnerOpen, setAddPartnerOpen] = useState(false)
  const [contactDialogOpen, setContactDialogOpen] = useState(false)
  const [step, setStep] = useState(1) // 多步骤表单
  const [logoPreview, setLogoPreview] = useState("")
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [partnerName, setPartnerName] = useState("")
  const [partnerUrl, setPartnerUrl] = useState("")
  const [partnerDescription, setPartnerDescription] = useState("")
  const [applicantNotes, setApplicantNotes] = useState("")

  // 新增: 订阅时长和支付相关
  const [subscriptionUnit, setSubscriptionUnit] = useState<"month" | "year">("year")
  const [durationValue, setDurationValue] = useState(1)
  const [durationError, setDurationError] = useState("")
  const [paymentProofUrl, setPaymentProofUrl] = useState("")
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null)
  const [transactionHash, setTransactionHash] = useState("")
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const totalSteps = 4 // 总步骤数: 1.基本信息 2.订阅时长 3.支付 4.完成
  const monthlyFee = 20 // 月费: 20 USDT
  const annualFee = 100 // 年费: 100 USDT
  const unitFee = subscriptionUnit === "month" ? monthlyFee : annualFee
  const totalAmount = durationValue * unitFee // 总金额

  // 合作伙伴列表 - 从后端加载
  const [partners, setPartners] = useState<Array<{
    id: string
    name: string
    logo_url: string
    website_url: string
    status: string
  }>>([])
  const [loading, setLoading] = useState(true)

  // 加载已审核通过的合作伙伴
  useEffect(() => {
    loadPartners()

    // 设置实时订阅
    const supabase = createClient()
    const channel = supabase
      .channel('partners-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'partners'
        },
        (payload) => {
          console.log('✅ Partners table changed:', payload)
          // 重新加载数据
          loadPartners()
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status)
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to partners changes')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Error subscribing to partners changes')
          console.log('⚠️ Realtime may not be enabled. Falling back to polling...')
        } else if (status === 'TIMED_OUT') {
          console.error('⏱️ Subscription timed out')
          console.log('⚠️ Realtime connection timed out. Falling back to polling...')
        }
      })

    // 添加轮询作为备选方案 - 每10秒检查一次
    const pollingInterval = setInterval(() => {
      console.log('🔄 Polling for updates...')
      loadPartners()
    }, 10000) // 10秒轮询一次

    // 清理订阅和轮询
    return () => {
      console.log('🧹 Cleaning up realtime subscription and polling')
      supabase.removeChannel(channel)
      clearInterval(pollingInterval)
    }
  }, [])

  async function loadPartners() {
    try {
      setLoading(false)
      const result = await getApprovedPartners()
      if (result.success && result.data) {
        setPartners(result.data)
      }
    } catch (error) {
      console.error("Error loading partners:", error)
    } finally {
      setLoading(false)
    }
  }

  // 处理Logo上传
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件类型
    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件")
      return
    }

    // 验证文件大小 (最大 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("图片大小不能超过 2MB")
      return
    }

    // 保存文件对象
    setLogoFile(file)

    // 生成预览
    const reader = new FileReader()
    reader.onloadend = () => {
      setLogoPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  // 验证URL是否为正规官网
  const isValidWebsiteUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url)
      const hostname = urlObj.hostname.toLowerCase()

      // 禁止的社交媒体和群聊平台域名
      const blockedDomains = [
        't.me',           // Telegram
        'telegram.me',    // Telegram
        'telegram.org',   // Telegram
        'chat.whatsapp',  // WhatsApp
        'wa.me',          // WhatsApp
        'discord.gg',     // Discord
        'discord.com/invite', // Discord
        'facebook.com/groups', // Facebook 群组
        'reddit.com/r/',  // Reddit
        'wechat.com',     // 微信
        'line.me',        // Line
        'viber.com',      // Viber
        'signal.group',   // Signal
      ]

      // 检查是否包含禁止的域名
      for (const blocked of blockedDomains) {
        if (hostname.includes(blocked) || url.includes(blocked)) {
          return false
        }
      }

      // 必须是 http 或 https 协议
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return false
      }

      return true
    } catch {
      return false
    }
  }

  // 验证订阅时长
  const validateDuration = (value: number): boolean => {
    if (!value || isNaN(value)) {
      setDurationError("请输入有效的订阅时长")
      return false
    }
    if (!Number.isInteger(value)) {
      setDurationError("订阅时长必须是整数")
      return false
    }
    if (value < 1) {
      setDurationError("订阅时长最低1个单位")
      return false
    }
    setDurationError("")
    return true
  }

  // 上传支付凭证
  const handlePaymentProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件类型
    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if (!validTypes.includes(file.type)) {
      toast.error("请上传图片文件（JPG、PNG、GIF）")
      return
    }

    // 验证文件大小（2MB）
    if (file.size > 2 * 1024 * 1024) {
      toast.error("图片大小不能超过2MB")
      return
    }

    setUploading(true)
    try {
      // 使用相同的 uploadPartnerLogo 函数，修改为 payment-proofs 路径
      const result = await uploadPartnerLogo(file)
      if (!result.success || !result.url) {
        toast.error(result.error || "上传失败")
        return
      }

      setPaymentProofUrl(result.url)
      setPaymentProofFile(file)
      toast.success("上传成功")
    } catch (error) {
      console.error("Upload error:", error)
      toast.error(error instanceof Error ? error.message : "上传失败，请重试")
    } finally {
      setUploading(false)
    }
  }

  // 下一步
  const handleNext = () => {
    // 第1步: 验证基本信息
    if (step === 1) {
      if (!partnerName.trim()) {
        toast.error("请输入品牌名称")
        return
      }
      if (!partnerUrl.trim()) {
        toast.error("请输入官网链接")
        return
      }
      if (!isValidWebsiteUrl(partnerUrl)) {
        toast.error("请输入正规的官方网站链接,不支持 Telegram、WhatsApp、Discord 等群聊链接")
        return
      }
      if (!logoFile) {
        toast.error("请上传Logo图片")
        return
      }
    }

    // 第2步: 验证订阅时长
    if (step === 2) {
      if (!validateDuration(durationValue)) {
        return
      }
    }

    if (step < totalSteps) {
      setStep(step + 1)
    }
  }

  // 上一步
  const handlePrev = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  // 提交申请
  const handleSubmit = async () => {
    if (!paymentProofUrl) {
      toast.error("请上传支付凭证")
      return
    }

    if (!transactionHash || !transactionHash.trim()) {
      toast.error("请填写交易哈希/交易ID")
      return
    }

    try {
      setSubmitting(true)

      // 1. 上传Logo（如果还没上传）
      let logoUrl = ""
      if (logoFile) {
        const uploadResult = await uploadPartnerLogo(logoFile)
        if (!uploadResult.success || !uploadResult.url) {
          toast.error(uploadResult.error || "Logo上传失败")
          return
        }
        logoUrl = uploadResult.url
      }

      // 2. 提交申请（包含订阅时长和支付信息）
      const result = await submitPartnerApplication({
        name: partnerName,
        logo_url: logoUrl,
        website_url: partnerUrl,
        description: "",
        applicant_notes: applicantNotes,
        subscription_unit: subscriptionUnit,
        duration_value: durationValue,
        unit_fee: unitFee,
        total_amount: totalAmount,
        payment_proof_url: paymentProofUrl,
        transaction_hash: transactionHash,
      })

      if (!result.success) {
        toast.error(result.error || "提交失败")
        return
      }

      // 跳转到成功页面
      setStep(4)
      toast.success("申请已提交，请等待审核")

      // 刷新列表
      loadPartners()
    } catch (error) {
      console.error("Error submitting partner application:", error)
      toast.error("提交失败,请重试")
    } finally {
      setSubmitting(false)
    }
  }

  // 关闭对话框并重置所有状态
  const handleClose = () => {
    setStep(1)
    setAddPartnerOpen(false)
    setLogoPreview("")
    setLogoFile(null)
    setPartnerName("")
    setPartnerUrl("")
    setPartnerDescription("")
    setApplicantNotes("")
    setSubscriptionUnit("year")
    setDurationValue(1)
    setDurationError("")
    setPaymentProofUrl("")
    setPaymentProofFile(null)
    setTransactionHash("")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="container mx-auto px-0 py-8 max-w-6xl">
        {/* 返回按钮 */}
        <div className="px-4 mb-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回首页
            </Button>
          </Link>
        </div>

        {/* 合作伙伴Logo网格 - 金色渐变背景,网格边框 */}
        <div className="bg-gradient-to-br from-yellow-50 via-yellow-100 to-amber-100 border-0 rounded-none overflow-hidden">
          {/* 标题栏 */}
          <div className="bg-gradient-to-r from-yellow-200 to-amber-200 py-4 px-6 border-b-2 border-amber-300">
            <h2 className="text-xl font-bold text-gray-800 text-center">Doingfb合作商家</h2>
            <p className="text-sm text-gray-700 text-center mt-3 leading-relaxed">
              <span className="font-semibold text-red-700">免责声明:</span>
              本页面展示的合作商家仅表明其支付了推广费用,不代表平台对其信用背书或服务质量担保。所有商家均可能存在经营风险,
              <span className="font-bold text-amber-800">【押金商家】</span>
              相对更有保障。请在交易前仔细核实商家缴纳押金金额,谨慎选择,自担风险。
            </p>
          </div>

          {/* 网格容器 - 表格样式,带边框 */}
          <div className="p-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {/* 已审核通过的合作伙伴 - 放在前面 */}
              {partners.map((partner, index) => (
                <a
                  key={partner.id}
                  href={partner.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative aspect-square border border-amber-300/60 bg-white/70 hover:bg-white overflow-hidden transition-all duration-300 group cursor-pointer"
                  style={{
                    borderRight: (index + 1) % 5 === 0 ? 'none' : undefined,
                  }}
                >
                  {/* Logo 图片 - 完全填满整个格子 */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    {partner.logo_url ? (
                      <img
                        src={partner.logo_url}
                        alt={partner.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <svg
                        className="w-full h-full text-amber-400 group-hover:text-amber-500 transition-colors"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                        <path d="M21 15l-5-5L5 21" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    )}
                  </div>
                  {/* 名称 - 底部悬浮显示 */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs font-semibold text-white text-center line-clamp-1 block">
                      {partner.name}
                    </span>
                  </div>
                  <div className="absolute inset-0 bg-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                </a>
              ))}

              {/* 申请入驻按钮 - 放在最后一个位置 */}
              <div className="relative aspect-square border border-amber-300/60 bg-white/40 flex items-center justify-center p-4">
                <button
                  onClick={() => setAddPartnerOpen(true)}
                  className="flex flex-col items-center justify-center gap-2 w-full h-full text-amber-600 hover:text-amber-700 transition-colors group"
                >
                  <div className="w-16 h-16 rounded-full border-2 border-dashed border-amber-400 group-hover:border-amber-500 flex items-center justify-center transition-colors">
                    <Plus className="w-8 h-8" />
                  </div>
                  <span className="text-sm font-medium">申请入驻</span>
                </button>
              </div>

              {/* 空白占位格子 */}
              {Array.from({ length: Math.max(0, 19 - partners.length) }).map((_, index) => (
                <div
                  key={`empty-${index}`}
                  className="relative aspect-square border border-amber-300/60 bg-white/40 flex items-center justify-center p-4"
                  style={{
                    borderRight: (partners.length + index + 2) % 5 === 0 ? 'none' : undefined,
                  }}
                >
                  <div className="w-full h-full flex items-center justify-center opacity-30">
                    <svg
                      className="w-12 h-12 text-amber-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" strokeDasharray="4 4" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 添加合作伙伴弹窗 - 多步骤表单 */}
      <Dialog open={addPartnerOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>申请成为合作伙伴</DialogTitle>
            <DialogDescription>
              {step === 1 && "提交您的品牌信息,我们会在审核通过后将您的Logo展示在合作伙伴页面"}
              {step === 2 && "选择订阅时长,最低1年起步"}
              {step === 3 && "完成支付以激活合作伙伴权益"}
              {step === 4 && "申请已提交,请等待审核"}
            </DialogDescription>
          </DialogHeader>

          {/* 进度条 */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>步骤 {step}/{totalSteps}</span>
              <span>{Math.round((step / totalSteps) * 100)}%</span>
            </div>
            <Progress value={(step / totalSteps) * 100} />
          </div>

          {/* 第一步: 基本信息 */}
          {step === 1 && (
            <div className="space-y-4 py-4">
              <div className="space-y-4">
                {/* Logo上传 */}
                <div className="space-y-2">
                  <Label>
                    品牌Logo <span className="text-red-500">*</span>
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    建议尺寸: 200x200px 至 500x500px,支持 PNG、JPG、SVG 格式,大小不超过 2MB
                  </p>

                  {!logoPreview ? (
                    <div className="relative">
                      <input
                        type="file"
                        id="logo-upload"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                      <div
                        onClick={() => document.getElementById("logo-upload")?.click()}
                        className="border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-amber-400 transition-colors cursor-pointer bg-gray-50/50"
                      >
                        <div className="flex flex-col items-center justify-center text-center">
                          <Upload className="h-12 w-12 text-gray-400 mb-3" />
                          <p className="text-sm text-gray-700 font-medium mb-1">点击上传Logo</p>
                          <p className="text-xs text-gray-500">支持 PNG、JPG、SVG 格式</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="relative border-2 border-amber-200 rounded-lg p-4 bg-amber-50/30">
                      <button
                        type="button"
                        onClick={() => {
                          setLogoPreview("")
                          setLogoFile(null)
                        }}
                        className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-sm hover:bg-gray-100 transition-colors"
                      >
                        <X className="h-4 w-4 text-gray-600" />
                      </button>
                      <div className="flex items-center gap-4">
                        <div className="w-24 h-24 border-2 border-amber-300 rounded-lg overflow-hidden bg-white flex items-center justify-center">
                          <img
                            src={logoPreview}
                            alt="Logo预览"
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-green-700 mb-1">Logo已上传</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => document.getElementById("logo-upload")?.click()}
                          >
                            重新上传
                          </Button>
                        </div>
                      </div>
                      <input
                        type="file"
                        id="logo-upload"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                    </div>
                  )}
                </div>

                {/* 品牌名称 */}
                <div className="space-y-2">
                  <Label htmlFor="partner-name">
                    品牌名称 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="partner-name"
                    placeholder="请输入品牌名称"
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                  />
                </div>

                {/* 官网链接 */}
                <div className="space-y-2">
                  <Label htmlFor="partner-url">
                    官网链接 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="partner-url"
                    type="url"
                    placeholder="https://example.com"
                    value={partnerUrl}
                    onChange={(e) => setPartnerUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    请填写正规的官方网站链接,不支持 Telegram、WhatsApp、Discord 等群聊链接
                  </p>
                </div>

                {/* 备注 */}
                <div className="space-y-2">
                  <Label htmlFor="applicant-notes">备注（可选）</Label>
                  <Textarea
                    id="applicant-notes"
                    placeholder="如有特殊说明或需要补充的信息,请在此填写..."
                    value={applicantNotes}
                    onChange={(e) => setApplicantNotes(e.target.value)}
                    rows={3}
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {applicantNotes.length}/500
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={handleClose}>
                  取消
                </Button>
                <Button onClick={handleNext}>下一步</Button>
              </div>
            </div>
          )}

          {/* 第二步: 选择订阅时长 */}
          {step === 2 && (
            <div className="space-y-4 py-4">
              <div className="space-y-4">
                <h3 className="text-base font-semibold">选择订阅时长</h3>

                {/* 订阅单位选择 */}
                <div className="space-y-3">
                  <Label>订阅单位 <span className="text-red-500">*</span></Label>
                  <Select value={subscriptionUnit} onValueChange={(value: "month" | "year") => setSubscriptionUnit(value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">按月订阅 (20 USDT/月)</SelectItem>
                      <SelectItem value="year">按年订阅 (100 USDT/年)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {subscriptionUnit === "month"
                      ? "按月订阅更灵活,适合短期推广"
                      : "按年订阅更优惠,平均每月仅8.3 USDT"}
                  </p>
                </div>

                {/* 订阅时长输入 */}
                <div className="space-y-3">
                  <Label htmlFor="duration-value">
                    订阅时长（{subscriptionUnit === "month" ? "月" : "年"}）
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="duration-value"
                    type="number"
                    min={1}
                    step={1}
                    value={durationValue}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10)
                      setDurationValue(value)
                      setDurationError("")
                    }}
                    placeholder={`请输入订阅时长（最低1${subscriptionUnit === "month" ? "月" : "年"}）`}
                    className={durationError ? "border-red-500 w-full" : "w-full"}
                  />
                  {durationError && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {durationError}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    最低订阅时长为1{subscriptionUnit === "month" ? "月" : "年"}
                  </p>
                </div>

                <Alert>
                  <Coins className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-medium">订阅费用明细</p>
                      <div className="text-sm space-y-1">
                        <p>订阅单位: {subscriptionUnit === "month" ? "按月" : "按年"}</p>
                        <p>订阅时长: {durationValue} {subscriptionUnit === "month" ? "月" : "年"}</p>
                        <p>单价: {unitFee} USDT/{subscriptionUnit === "month" ? "月" : "年"}</p>
                        <p className="text-lg font-bold text-amber-600">总金额: {totalAmount} USDT</p>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>

              <div className="flex justify-between gap-2 pt-4">
                <Button variant="outline" onClick={handlePrev}>
                  上一步
                </Button>
                <Button onClick={handleNext}>下一步</Button>
              </div>
            </div>
          )}

          {/* 第三步: 支付 */}
          {step === 3 && (
            <div className="space-y-4 py-4">
              <div className="space-y-4">
                <h3 className="text-base font-semibold">支付订阅费用</h3>

                <Alert>
                  <Coins className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium mb-1">支付金额: {totalAmount} USDT</p>
                    <p className="text-xs text-muted-foreground">
                      请使用USDT（TRC20/ERC20）支付订阅费用,并上传支付凭证
                    </p>
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <Label>支付凭证 <span className="text-red-500">*</span></Label>
                      <button
                        type="button"
                        onClick={() => setContactDialogOpen(true)}
                        className="text-xs text-amber-600 hover:text-amber-700 hover:underline flex items-center gap-1"
                      >
                        <AlertCircle className="h-3 w-3" />
                        上传前请先联系官方获取收款信息
                      </button>
                    </div>

                    {!paymentProofUrl ? (
                      <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                        <input
                          type="file"
                          id="payment-proof"
                          accept="image/*"
                          onChange={handlePaymentProofUpload}
                          disabled={uploading}
                          className="hidden"
                        />
                        <label htmlFor="payment-proof" className="cursor-pointer block">
                          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm font-medium mb-1">
                            {uploading ? "上传中..." : "点击上传图片"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            支持 JPG、PNG、GIF 格式,大小不超过 2MB
                          </p>
                        </label>
                      </div>
                    ) : (
                      <div className="border rounded-lg p-4 bg-green-50 border-green-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            <span className="text-sm font-medium text-green-700">上传成功</span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(paymentProofUrl, "_blank")}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              预览
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setPaymentProofUrl("")}
                            >
                              重新上传
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      请上传支付成功的截图,确保包含交易金额、时间和订单号
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="transaction-hash">交易哈希/交易ID <span className="text-red-500">*</span></Label>
                    <Input
                      id="transaction-hash"
                      value={transactionHash}
                      onChange={(e) => setTransactionHash(e.target.value)}
                      placeholder="请输入区块链交易哈希或支付平台交易ID"
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      填写此信息可加快审核速度
                    </p>
                  </div>

                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      <strong>重要提示:</strong>
                      <br />
                      1. 请确保支付凭证真实有效,虚假凭证将被拒绝
                      <br />
                      2. 支付金额必须与申请金额一致
                      <br />
                      3. 审核通过后订阅立即生效
                    </AlertDescription>
                  </Alert>
                </div>
              </div>

              <div className="flex justify-between gap-2 pt-4">
                <Button variant="outline" onClick={handlePrev}>
                  上一步
                </Button>
                <Button onClick={handleSubmit} disabled={!paymentProofUrl || !transactionHash?.trim() || submitting}>
                  {submitting ? "提交中..." : "提交申请"}
                </Button>
              </div>
            </div>
          )}

          {/* 第四步: 提交成功 */}
          {step === 4 && (
            <div className="space-y-4 py-8">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="rounded-full bg-green-100 p-3">
                    <CheckCircle2 className="h-12 w-12 text-green-600" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">申请已提交</h3>
                  <p className="text-sm text-muted-foreground">
                    您的合作伙伴申请已成功提交,我们将在1-3个工作日内完成审核
                  </p>
                </div>

                <div className="p-4 rounded-lg border bg-card text-left">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1">品牌名称</p>
                      <p className="font-medium">{partnerName}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">订阅方式</p>
                      <p className="font-medium">{subscriptionUnit === "month" ? "按月订阅" : "按年订阅"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">订阅时长</p>
                      <p className="font-medium">{durationValue} {subscriptionUnit === "month" ? "月" : "年"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">订阅金额</p>
                      <p className="font-medium text-amber-600">{totalAmount} USDT</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground mb-1">交易ID</p>
                      <p className="font-medium text-xs break-all">{transactionHash}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500">
                        <CheckCircle2 className="h-4 w-4 text-white" />
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900">后续流程</h3>
                    </div>

                    <div className="space-y-2 pl-9">
                      <div className="flex items-start gap-2">
                        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 shrink-0 mt-0.5">
                          <span className="text-xs font-medium text-blue-600">1</span>
                        </div>
                        <p className="text-xs text-gray-700 leading-snug">
                          我们将在 <span className="font-semibold text-gray-900">1-3个工作日</span> 内验证您的支付信息
                        </p>
                      </div>

                      <div className="flex items-start gap-2">
                        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 shrink-0 mt-0.5">
                          <span className="text-xs font-medium text-blue-600">2</span>
                        </div>
                        <p className="text-xs text-gray-700 leading-snug">
                          审核通过后Logo将自动展示在合作伙伴页面
                        </p>
                      </div>

                      <div className="flex items-start gap-2">
                        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 shrink-0 mt-0.5">
                          <span className="text-xs font-medium text-blue-600">3</span>
                        </div>
                        <p className="text-xs text-gray-700 leading-snug">
                          您将收到审核结果通知
                        </p>
                      </div>

                      <div className="flex items-start gap-2 pt-2 border-t border-blue-200">
                        <MessageSquare className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-gray-700 leading-snug">
                          如有疑问,请
                          <button
                            type="button"
                            onClick={() => setContactDialogOpen(true)}
                            className="text-blue-600 hover:text-blue-700 underline mx-1 font-medium"
                          >
                            联系官方
                          </button>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center pt-4">
                  <Button onClick={handleClose} className="w-full max-w-xs">
                    完成
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 官方客服对话框 */}
      <OfficialContactDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
      />
    </div>
  )
}
