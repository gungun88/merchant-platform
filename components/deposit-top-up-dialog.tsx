"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createDepositTopUpApplication } from "@/lib/actions/deposit-top-up"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { PlusCircle, AlertTriangle, Upload, CheckCircle2, Eye, AlertCircle } from "lucide-react"
import { OfficialContactDialog } from "@/components/official-contact-dialog"

interface DepositTopUpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  merchantId: string
  currentDeposit: number
}

export function DepositTopUpDialog({
  open,
  onOpenChange,
  merchantId,
  currentDeposit,
}: DepositTopUpDialogProps) {
  const [topUpAmount, setTopUpAmount] = useState("")
  const [transactionHash, setTransactionHash] = useState("")
  const [paymentProofUrl, setPaymentProofUrl] = useState("")
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [contactDialogOpen, setContactDialogOpen] = useState(false)

  // 上传支付凭证
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件类型
    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if (!validTypes.includes(file.type)) {
      toast.error("请上传图片文件（JPG、PNG、GIF、WEBP）")
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
      const filePath = `deposit-top-up-proofs/${fileName}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("merchant-assets")
        .upload(filePath, file)

      if (uploadError) {
        console.error("Upload error:", uploadError)
        throw uploadError
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("merchant-assets").getPublicUrl(filePath)

      setPaymentProofUrl(publicUrl)
      toast.success("上传成功")
    } catch (error) {
      console.error("Upload error:", error)
      toast.error(error instanceof Error ? error.message : "上传失败，请重试")
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async () => {
    // 验证追加金额
    const amount = parseFloat(topUpAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error("请输入有效的追加金额")
      return
    }

    if (amount < 100) {
      toast.error("追加金额不能少于100 USDT")
      return
    }

    if (!transactionHash || !transactionHash.trim()) {
      toast.error("请填写交易哈希/交易ID")
      return
    }

    if (!paymentProofUrl) {
      toast.error("请上传支付凭证")
      return
    }

    try {
      setSubmitting(true)

      console.log("Submitting top-up application:", {
        merchantId,
        topUpAmount: amount,
        transactionHash,
        paymentProofUrl,
      })

      const result = await createDepositTopUpApplication({
        merchantId,
        topUpAmount: amount,
        transactionHash: transactionHash || undefined,
        paymentProofUrl,
      })

      console.log("Top-up application result:", result)

      if (result.success) {
        toast.success("追加押金申请已提交,请等待审核")
        onOpenChange(false)
        // 重置表单
        setTopUpAmount("")
        setTransactionHash("")
        setPaymentProofUrl("")
        // 刷新页面
        window.location.reload()
      } else {
        toast.error(result.error || "提交失败")
      }
    } catch (error) {
      console.error("Error submitting top-up application:", error)
      toast.error("提交失败,请稍后重试")
    } finally {
      setSubmitting(false)
    }
  }

  const totalAmount = currentDeposit + (parseFloat(topUpAmount) || 0)

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-blue-600" />
            追加押金
          </DialogTitle>
          <DialogDescription>
            追加押金可以进一步提升商家信誉度
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 当前押金信息 */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">当前押金:</span>
              <span className="font-medium">{currentDeposit.toLocaleString()} USDT</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">追加金额:</span>
              <span className="font-medium text-blue-600">
                {parseFloat(topUpAmount) || 0} USDT
              </span>
            </div>
            <div className="border-t pt-2 flex justify-between">
              <span className="text-sm font-medium">追加后总额:</span>
              <span className="text-lg font-bold text-green-600">
                {totalAmount.toLocaleString()} USDT
              </span>
            </div>
          </div>

          {/* 追加金额输入 */}
          <div className="space-y-2">
            <Label htmlFor="top-up-amount">
              追加金额 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="top-up-amount"
              type="number"
              min="100"
              step="100"
              placeholder="请输入追加金额（最低100 USDT）"
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
              className="text-lg font-medium"
            />
            <p className="text-xs text-muted-foreground">
              最低追加金额: 100 USDT
            </p>
          </div>

          {/* 交易哈希 */}
          <div className="space-y-2">
            <Label htmlFor="transaction-hash">交易哈希/交易ID <span className="text-red-500">*</span></Label>
            <Input
              id="transaction-hash"
              placeholder="请输入区块链交易哈希或支付平台交易ID单号"
              value={transactionHash}
              onChange={(e) => setTransactionHash(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              填写此信息可加快审核速度
            </p>
          </div>

          {/* 支付凭证上传 */}
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
                    支持 JPG、PNG、GIF、WEBP 格式，大小不超过 2MB
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

          {/* 提示信息 */}
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>重要提示:</strong>
              <br />
              1. 请确保支付凭证真实有效，虚假凭证将被拒绝
              <br />
              2. 支付金额必须与申请金额一致
              <br />
              3. 审核通过后押金将自动累加到商家账户
              <br />
              4. 审核一般在1-3个工作日内完成
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!paymentProofUrl || !transactionHash?.trim() || submitting}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {submitting ? "提交中..." : "提交追加申请"}
          </Button>
        </DialogFooter>
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
