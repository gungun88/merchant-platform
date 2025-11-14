"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { createDepositApplication } from "@/lib/actions/deposit"
import { getSystemSettings } from "@/lib/actions/settings"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Shield, Gift, TrendingUp, Lock, CheckCircle2, AlertCircle, Coins, Upload, Eye } from "lucide-react"
import { OfficialContactDialog } from "@/components/official-contact-dialog"

interface DepositApplyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  merchantId: string
  merchantName: string
  onSuccess?: () => void
}

export function DepositApplyDialog({
  open,
  onOpenChange,
  merchantId,
  merchantName,
  onSuccess,
}: DepositApplyDialogProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [paymentProofUrl, setPaymentProofUrl] = useState("")
  const [transactionHash, setTransactionHash] = useState("")
  const [uploading, setUploading] = useState(false)
  const [depositAmount, setDepositAmount] = useState(500) // 自定义押金金额
  const [depositAmountError, setDepositAmountError] = useState("")
  const [systemSettings, setSystemSettings] = useState<any>(null)
  const [contactDialogOpen, setContactDialogOpen] = useState(false)

  const totalSteps = 5

  useEffect(() => {
    async function loadSettings() {
      const result = await getSystemSettings()
      if (result.success) {
        setSystemSettings(result.data)
      }
    }
    loadSettings()
  }, [])

  // 验证押金金额
  const validateDepositAmount = (amount: number): boolean => {
    if (!amount || isNaN(amount)) {
      setDepositAmountError("请输入有效的押金金额")
      return false
    }
    if (!Number.isInteger(amount)) {
      setDepositAmountError("押金金额必须是整数")
      return false
    }
    if (amount < 500) {
      setDepositAmountError("押金金额不能低于500 USDT")
      return false
    }
    setDepositAmountError("")
    return true
  }

  // 上传支付凭证
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      const supabase = createClient()
      const fileExt = file.name.split(".").pop()
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
      const filePath = `deposit-proofs/${fileName}`

      console.log("Uploading file:", filePath)

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("merchant-assets")
        .upload(filePath, file)

      if (uploadError) {
        console.error("Upload error:", uploadError)
        throw uploadError
      }

      console.log("Upload successful:", uploadData)

      const {
        data: { publicUrl },
      } = supabase.storage.from("merchant-assets").getPublicUrl(filePath)

      console.log("Public URL:", publicUrl)

      setPaymentProofUrl(publicUrl)
      toast.success("上传成功")
    } catch (error) {
      console.error("Upload error:", error)
      toast.error(error instanceof Error ? error.message : "上传失败，请重试")
    } finally {
      setUploading(false)
    }
  }

  const handleNext = () => {
    // 从第2步到第3步时验证押金金额
    if (step === 2) {
      if (!validateDepositAmount(depositAmount)) {
        return
      }
    }

    if (step < totalSteps) {
      setStep(step + 1)
    }
  }

  const handlePrev = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  const handleSubmit = async () => {
    if (!paymentProofUrl) {
      toast.error("请上传支付凭证")
      return
    }

    if (!transactionHash || !transactionHash.trim()) {
      toast.error("请填写交易哈希/交易ID")
      return
    }

    setLoading(true)
    try {
      const result = await createDepositApplication({
        merchantId,
        depositAmount,
        paymentProofUrl,
        transactionHash,
      })

      if (result.success) {
        toast.success("申请已提交，请等待审核")
        setStep(5) // 跳转到成功页面
        onSuccess?.()
      } else {
        toast.error(result.error || "申请失败")
      }
    } catch (error) {
      toast.error("申请失败，请稍后重试")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setStep(1)
    setAgreed(false)
    setPaymentProofUrl("")
    setTransactionHash("")
    setUploading(false)
    setDepositAmount(500)
    setDepositAmountError("")
    onOpenChange(false)
  }

  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>申请成为押金商家</DialogTitle>
          <DialogDescription>商家：{merchantName}</DialogDescription>
        </DialogHeader>

        {/* 进度条 */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>步骤 {step}/{totalSteps}</span>
            <span>{Math.round((step / totalSteps) * 100)}%</span>
          </div>
          <Progress value={(step / totalSteps) * 100} />
        </div>

        {/* 第一步：了解权益 */}
        {step === 1 && (
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <h3 className="text-base font-semibold">成为押金商家的权益</h3>
              <div className="grid gap-3">
                <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                  <Shield className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">认证徽章</p>
                    <p className="text-xs text-muted-foreground">
                      获得"押金商家"认证徽章，大幅提升买家信任度
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                  <Gift className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">每日登录奖励</p>
                    <p className="text-xs text-muted-foreground">
                      每日登录即可获得 <strong>{systemSettings?.deposit_merchant_daily_reward || 50}积分</strong> 奖励（普通商家无此权益）
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                  <TrendingUp className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">申请奖励</p>
                    <p className="text-xs text-muted-foreground">
                      押金审核通过后立即获得 <strong>{systemSettings?.deposit_merchant_apply_reward || 1000}积分</strong> 奖励（一次性，退押金不扣积分）
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                  <Lock className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">押金保障</p>
                    <p className="text-xs text-muted-foreground">
                      押金为买家提供交易保障，显著提升成交率
                    </p>
                  </div>
                </div>
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

        {/* 第二步：押金说明 */}
        {step === 2 && (
          <div className="space-y-4 py-4">
            <div className="space-y-4">
              <h3 className="text-base font-semibold">押金说明与规则</h3>

              <div className="space-y-3">
                <Label htmlFor="deposit-amount">押金金额（USDT）<span className="text-red-500">*</span></Label>
                <Input
                  id="deposit-amount"
                  type="number"
                  min={500}
                  step={1}
                  value={depositAmount}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10)
                    setDepositAmount(value)
                    setDepositAmountError("")
                  }}
                  placeholder="请输入押金金额（最低500 USDT）"
                  className={depositAmountError ? "border-red-500" : ""}
                />
                {depositAmountError && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {depositAmountError}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  起步金额为500 USDT，您可以根据需要增加押金金额以提升商家信誉度
                </p>
              </div>

              <Alert>
                <Coins className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">当前押金金额：{depositAmount} USDT</p>
                    <p className="text-xs">押金将用于保障买家权益，为您的商家信誉背书</p>
                  </div>
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <div className="p-3 rounded-lg border bg-muted/50">
                  <h4 className="text-sm font-medium mb-2">押金作用</h4>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                    <li>保障买家交易安全</li>
                    <li>提升商家信誉和成交率</li>
                    <li>违规时用于赔偿受害者</li>
                  </ul>
                </div>

                <div className="p-3 rounded-lg border bg-muted/50">
                  <h4 className="text-sm font-medium mb-2">退还规则</h4>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                    <li>可随时申请退还押金</li>
                    <li>缴纳3个月内申请退还：扣除30%手续费</li>
                    <li>缴纳3个月后申请退还：扣除15%手续费</li>
                    <li>网络费用（交易所手续费）需商家自行承担</li>
                    <li>无违规记录方可申请退还</li>
                    <li>退还周期：3-7个工作日</li>
                  </ul>
                </div>

                <div className="p-3 rounded-lg border border-red-200 bg-red-50">
                  <h4 className="text-sm font-medium mb-2 text-red-700">违规处理</h4>
                  <ul className="text-xs text-red-600 space-y-1 list-disc list-inside">
                    <li>发生违规行为时，押金将被扣除</li>
                    <li>30% 归平台，70% 补偿受害者</li>
                    <li>严重违规将永久封禁账号</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex justify-between gap-2 pt-4">
              <Button variant="outline" onClick={handlePrev}>
                上一步
              </Button>
              <Button onClick={handleNext}>下一步</Button>
            </div>
          </div>
        )}

        {/* 第三步：填写申请信息 */}
        {step === 3 && (
          <div className="space-y-4 py-4">
            <div className="space-y-4">
              <h3 className="text-base font-semibold">确认申请信息</h3>

              <div className="space-y-3">
                <div className="p-4 rounded-lg border bg-card">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1">商家名称</p>
                      <p className="font-medium">{merchantName}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">押金金额</p>
                      <p className="font-medium">{depositAmount} USDT</p>
                    </div>
                  </div>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    提交申请前，请仔细阅读押金商家协议。申请提交后，我们将在1-3个工作日内完成审核。
                  </AlertDescription>
                </Alert>

                <div className="flex items-start space-x-2 p-3 rounded-lg border">
                  <Checkbox
                    id="agreement"
                    checked={agreed}
                    onCheckedChange={(checked) => setAgreed(checked as boolean)}
                  />
                  <label htmlFor="agreement" className="text-sm cursor-pointer leading-relaxed">
                    我已仔细阅读并同意
                    <a
                      href="/agreements/deposit-merchant"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary font-medium mx-1 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      《押金商家服务协议》
                    </a>
                    及相关规则，承诺遵守平台规范，诚信经营。
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-between gap-2 pt-4">
              <Button variant="outline" onClick={handlePrev}>
                上一步
              </Button>
              <Button onClick={handleNext} disabled={!agreed}>
                下一步
              </Button>
            </div>
          </div>
        )}

        {/* 第四步：支付押金 */}
        {step === 4 && (
          <div className="space-y-4 py-4">
            <div className="space-y-4">
              <h3 className="text-base font-semibold">支付押金</h3>

              <Alert>
                <Coins className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-1">支付金额：{depositAmount} USDT</p>
                  <p className="text-xs text-muted-foreground">
                    请使用USDT（TRC20/ERC20）支付押金，并上传支付凭证
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
                        onChange={handleFileUpload}
                        disabled={uploading}
                        className="hidden"
                      />
                      <label htmlFor="payment-proof" className="cursor-pointer block">
                        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm font-medium mb-1">
                          {uploading ? "上传中..." : "点击上传图片"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          支持 JPG、PNG、GIF 格式，大小不超过 2MB
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
                    请上传支付成功的截图，确保包含交易金额、时间和订单号
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="transaction-hash">交易哈希/交易ID <span className="text-red-500">*</span></Label>
                  <Input
                    id="transaction-hash"
                    value={transactionHash}
                    onChange={(e) => setTransactionHash(e.target.value)}
                    placeholder="请输入区块链交易哈希或支付平台交易ID单号"
                  />
                  <p className="text-xs text-muted-foreground">
                    填写此信息可加快审核速度
                  </p>
                </div>

                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <strong>重要提示：</strong>
                    <br />
                    1. 请确保支付凭证真实有效，虚假凭证将被拒绝
                    <br />
                    2. 支付金额必须与申请金额一致
                    <br />
                    3. 审核通过后押金将锁定，期间无法提现
                  </AlertDescription>
                </Alert>
              </div>
            </div>

            <div className="flex justify-between gap-2 pt-4">
              <Button variant="outline" onClick={handlePrev}>
                上一步
              </Button>
              <Button onClick={handleSubmit} disabled={!paymentProofUrl || !transactionHash?.trim() || loading}>
                {loading ? "提交中..." : "提交申请"}
              </Button>
            </div>
          </div>
        )}

        {/* 第五步：提交成功 */}
        {step === 5 && (
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
                  您的押金商家申请已成功提交，我们将在1-3个工作日内完成审核
                </p>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <div className="space-y-1 text-left">
                    <p className="font-medium">审核期间：</p>
                    <ul className="list-disc list-inside space-y-0.5 ml-2">
                      <li>您可以在商家后台查看申请状态</li>
                      <li>审核通过后将自动激活押金商家权益</li>
                      <li>
                        如有疑问，请
                        <button
                          type="button"
                          onClick={() => setContactDialogOpen(true)}
                          className="text-primary hover:underline mx-1 font-medium"
                        >
                          联系官方
                        </button>
                      </li>
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>

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
    </>
  )
}
