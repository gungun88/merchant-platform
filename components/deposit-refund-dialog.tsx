"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { createDepositRefundApplication } from "@/lib/actions/deposit"
import { toast } from "sonner"
import {
  AlertCircle,
  Wallet,
  DollarSign,
  Info,
  CheckCircle,
  Clock,
  X
} from "lucide-react"
import { OfficialContactDialog } from "@/components/official-contact-dialog"

interface DepositRefundDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  merchantId: string
  depositAmount: number
  depositPaidAt: string
  onSuccess?: () => void
}

export function DepositRefundDialog({
  open,
  onOpenChange,
  merchantId,
  depositAmount,
  depositPaidAt,
  onSuccess,
}: DepositRefundDialogProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [contactDialogOpen, setContactDialogOpen] = useState(false)

  // 表单数据
  const [reason, setReason] = useState("")
  const [walletAddress, setWalletAddress] = useState("")
  const [walletNetwork, setWalletNetwork] = useState<"TRC20" | "ERC20" | "BEP20">("TRC20")

  // 计算手续费信息
  const [feeInfo, setFeeInfo] = useState({
    feeRate: 0,
    feeAmount: 0,
    refundAmount: 0,
  })

  // 计算手续费
  useEffect(() => {
    if (!depositPaidAt) return

    const paidDate = new Date(depositPaidAt)
    const now = new Date()
    const monthsDiff = (now.getTime() - paidDate.getTime()) / (1000 * 60 * 60 * 24 * 30)

    let feeRate = 0
    if (monthsDiff < 3) {
      feeRate = 30 // 3个月内：30%手续费
    } else {
      feeRate = 15 // 3个月后：15%手续费
    }

    const feeAmount = Math.round(depositAmount * feeRate) / 100
    const refundAmount = depositAmount - feeAmount

    setFeeInfo({ feeRate, feeAmount, refundAmount })
  }, [depositAmount, depositPaidAt])

  // 重置表单
  const resetForm = () => {
    setStep(1)
    setReason("")
    setWalletAddress("")
    setWalletNetwork("TRC20")
  }

  // 验证表单是否完整
  const isFormValid = () => {
    // 退还原因必填
    if (!reason.trim()) return false

    // 退还原因必须包含中文或英文,不能只有数字
    const hasChineseOrEnglish = /[\u4e00-\u9fa5a-zA-Z]/.test(reason)
    if (!hasChineseOrEnglish) return false

    // 钱包地址必填且长度合理
    if (!walletAddress.trim() || walletAddress.trim().length < 20) return false

    return true
  }

  // 验证退还原因格式
  const validateReason = (text: string) => {
    if (!text.trim()) return ""

    const hasChineseOrEnglish = /[\u4e00-\u9fa5a-zA-Z]/.test(text)
    if (!hasChineseOrEnglish) {
      return "退还原因必须包含中文或英文,不能只填写数字"
    }

    return ""
  }

  // 处理提交
  const handleSubmit = async () => {
    // 验证退还原因
    if (!reason.trim()) {
      toast.error("请填写退还原因")
      return
    }

    const reasonError = validateReason(reason)
    if (reasonError) {
      toast.error(reasonError)
      return
    }

    // 验证钱包地址
    if (!walletAddress.trim()) {
      toast.error("请填写钱包地址")
      return
    }

    // 简单验证钱包地址格式
    if (walletAddress.length < 20) {
      toast.error("钱包地址格式不正确，长度不足")
      return
    }

    setLoading(true)

    try {
      const result = await createDepositRefundApplication({
        merchantId,
        reason: reason.trim(),
        walletAddress: walletAddress.trim(),
        walletNetwork,
      })

      if (result.success) {
        toast.success("退还申请已提交，请等待审核")
        setStep(4) // 跳转到成功页面
        if (onSuccess) {
          onSuccess()
        }
      } else {
        toast.error(result.error || "提交失败")
      }
    } catch (error) {
      toast.error("提交失败，请稍后重试")
    } finally {
      setLoading(false)
    }
  }

  // 关闭对话框
  const handleClose = () => {
    if (step === 4) {
      resetForm()
    }
    onOpenChange(false)
  }

  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {step === 1 && "押金退还申请"}
            {step === 2 && "填写退还信息"}
            {step === 3 && "确认申请信息"}
            {step === 4 && "申请已提交"}
          </DialogTitle>
          <DialogDescription>
            {step === 1 && "了解退还规则和手续费说明"}
            {step === 2 && "请填写完整的退还信息"}
            {step === 3 && "请仔细核对以下信息"}
            {step === 4 && "您的退还申请已成功提交"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 步骤1: 退还规则说明 */}
          {step === 1 && (
            <div className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <div className="space-y-2">
                    <p className="font-medium">退还规则：</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>押金缴纳3个月内申请退还：扣除<span className="font-bold text-red-600">30%</span>手续费</li>
                      <li>押金缴纳3个月后申请退还：扣除<span className="font-bold text-orange-600">15%</span>手续费</li>
                      <li>网络费用（交易所手续费）需商家自行承担</li>
                      <li>审核通过后，预计3-7个工作日内完成打款</li>
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>

              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">原始押金金额</span>
                  <span className="font-medium">{depositAmount} USDT</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">手续费率</span>
                  <Badge variant={feeInfo.feeRate === 30 ? "destructive" : "secondary"}>
                    {feeInfo.feeRate}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">手续费金额</span>
                  <span className="text-red-600">-{feeInfo.feeAmount} USDT</span>
                </div>
                <div className="h-px bg-border my-2" />
                <div className="flex items-center justify-between">
                  <span className="font-medium">预计到账金额</span>
                  <span className="text-lg font-bold text-green-600">
                    {feeInfo.refundAmount} USDT
                  </span>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={handleClose}>
                  取消
                </Button>
                <Button onClick={() => setStep(2)}>
                  下一步
                </Button>
              </div>
            </div>
          )}

          {/* 步骤2: 填写退还信息 */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reason">退还原因 *</Label>
                <Textarea
                  id="reason"
                  placeholder="请说明您申请退还押金的原因（必填，需包含中文或英文说明）"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className={validateReason(reason) ? "border-red-500" : ""}
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {reason.length}/500
                  </p>
                  {validateReason(reason) && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {validateReason(reason)}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="network">收款网络 *</Label>
                <Select value={walletNetwork} onValueChange={(v: any) => setWalletNetwork(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TRC20">TRC20 (推荐，手续费低)</SelectItem>
                    <SelectItem value="ERC20">ERC20</SelectItem>
                    <SelectItem value="BEP20">BEP20 (BSC)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="wallet">USDT钱包地址 *</Label>
                <div className="relative">
                  <Wallet className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="wallet"
                    placeholder="请输入您的USDT钱包地址"
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  请确保钱包地址正确，错误的地址将导致资金丢失
                </p>
              </div>

              <Alert className="bg-amber-50 border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-xs text-amber-800">
                  重要提示：请仔细核对钱包地址和网络类型，转账一旦发出无法撤回。如有疑问，请
                  <button
                    type="button"
                    onClick={() => setContactDialogOpen(true)}
                    className="underline font-medium mx-1"
                  >
                    联系官方客服
                  </button>
                </AlertDescription>
              </Alert>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  上一步
                </Button>
                <Button
                  onClick={() => {
                    // 验证表单
                    if (!reason.trim()) {
                      toast.error("请填写退还原因")
                      return
                    }

                    const reasonError = validateReason(reason)
                    if (reasonError) {
                      toast.error(reasonError)
                      return
                    }

                    if (!walletAddress.trim()) {
                      toast.error("请填写钱包地址")
                      return
                    }

                    if (walletAddress.trim().length < 20) {
                      toast.error("钱包地址格式不正确，长度不足20位")
                      return
                    }

                    setStep(3)
                  }}
                  disabled={!isFormValid()}
                >
                  下一步
                </Button>
              </div>
            </div>
          )}

          {/* 步骤3: 确认信息 */}
          {step === 3 && (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  请仔细核对以下信息，提交后无法修改
                </AlertDescription>
              </Alert>

              <div className="space-y-3 bg-muted p-4 rounded-lg">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">退还原因</p>
                  <p className="text-sm">{reason || "未填写"}</p>
                </div>

                <div className="h-px bg-border" />

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">收款网络</p>
                  <Badge>{walletNetwork}</Badge>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">钱包地址</p>
                  <p className="text-sm font-mono break-all">{walletAddress}</p>
                </div>

                <div className="h-px bg-border" />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">原始押金</span>
                    <span>{depositAmount} USDT</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">手续费 ({feeInfo.feeRate}%)</span>
                    <span className="text-red-600">-{feeInfo.feeAmount} USDT</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>预计到账</span>
                    <span className="text-green-600 text-lg">{feeInfo.refundAmount} USDT</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>
                  上一步
                </Button>
                <Button onClick={handleSubmit} disabled={loading}>
                  {loading ? "提交中..." : "确认提交"}
                </Button>
              </div>
            </div>
          )}

          {/* 步骤4: 提交成功 */}
          {step === 4 && (
            <div className="space-y-4 text-center py-6">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-10 w-10 text-green-600" />
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-medium">申请已提交</h3>
                <p className="text-sm text-muted-foreground">
                  您的押金退还申请已成功提交，预计3-7个工作日内完成审核
                </p>
              </div>

              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <p className="font-medium mb-1">接下来的流程：</p>
                  <ol className="list-decimal list-inside space-y-1 text-left">
                    <li>管理员审核申请（1-2个工作日）</li>
                    <li>审核通过后，财务人员处理打款</li>
                    <li>打款完成后，您将收到通知</li>
                  </ol>
                </AlertDescription>
              </Alert>

              <p className="text-xs text-muted-foreground">
                如有疑问，请
                <button
                  type="button"
                  onClick={() => setContactDialogOpen(true)}
                  className="text-blue-600 underline mx-1"
                >
                  联系官方客服
                </button>
              </p>

              <Button onClick={handleClose} className="w-full">
                关闭
              </Button>
            </div>
          )}
        </div>
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
