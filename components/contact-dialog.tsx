"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Copy, MessageCircle, Phone, Mail, AlertCircle, Coins } from "lucide-react"
import { viewContact, canViewContact } from "@/lib/actions/contact"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { triggerPointsUpdate } from "@/lib/utils/points-update"

type ContactInfo = {
  phone?: string
  wechat?: string
  telegram?: string
  whatsapp?: string
  email?: string
}

type ContactDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  merchantId: string
  merchantName: string
}

export function ContactDialog({ open, onOpenChange, merchantId, merchantName }: ContactDialogProps) {
  const [loading, setLoading] = useState(false)
  const [contact, setContact] = useState<ContactInfo | null>(null)
  const [showConfirm, setShowConfirm] = useState(true)
  const [checkResult, setCheckResult] = useState<{
    canView: boolean
    reason?: string
    requiredPoints?: number
    currentPoints?: number
    isOwnMerchant?: boolean
  } | null>(null)
  const router = useRouter()

  // 当对话框打开时,检查是否可以查看
  useEffect(() => {
    console.log('=== ContactDialog useEffect ===', { open, merchantId })
    if (open && !checkResult && !loading) {
      // 对话框打开时，检查是否可以查看
      setLoading(true)
      setShowConfirm(true)
      console.log('=== Calling canViewContact ===', merchantId)
      canViewContact(merchantId)
        .then((result) => {
          console.log('=== canViewContact result ===', result)
          setCheckResult(result)
        })
        .catch((error) => {
          console.error('=== canViewContact error ===', error)
          toast.error(error instanceof Error ? error.message : "检查失败")
          onOpenChange(false) // 检查失败就关闭对话框
        })
        .finally(() => {
          setLoading(false)
        })
    }

    // 当对话框关闭时，重置状态
    if (!open) {
      setContact(null)
      setShowConfirm(true)
      setCheckResult(null)
    }
  }, [open, merchantId])

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen)
  }

  const handleViewContact = async () => {
    setLoading(true)
    try {
      const result = await viewContact(merchantId)
      setContact(result.contact)
      setShowConfirm(false)

      // 如果是商家本人查看，不显示积分消耗提示
      if (result.pointsDeducted === 0) {
        toast.success("查看自己的联系方式")
      } else {
        toast.success(`成功查看联系方式，消耗${result.pointsDeducted}积分`)
        // 触发自定义事件通知导航栏刷新积分
        triggerPointsUpdate()
      }

      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "查看失败")
      if (error instanceof Error && error.message.includes("登录")) {
        onOpenChange(false)
        router.push("/auth/login")
      }
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("已复制到剪贴板")
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>联系方式</DialogTitle>
          <DialogDescription>服务商：{merchantName}</DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">检查中...</p>
          </div>
        )}

        {!loading && showConfirm && checkResult && (
          <div className="space-y-4 py-4">
            {checkResult.canView ? (
              <>
                {checkResult.isOwnMerchant ? (
                  // 商家本人查看自己的联系方式
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      这是您自己的联系方式，无需消耗积分
                    </AlertDescription>
                  </Alert>
                ) : (
                  // 其他用户查看需要扣积分
                  <Alert>
                    <Coins className="h-4 w-4" />
                    <AlertDescription>
                      查看此商家联系方式需要消耗 <strong>{checkResult.requiredPoints}</strong> 积分
                      <br />
                      您当前有 <strong>{checkResult.currentPoints}</strong> 积分
                    </AlertDescription>
                  </Alert>
                )}
                <div className="flex gap-2">
                  <Button onClick={handleViewContact} disabled={loading} className="flex-1">
                    {loading ? "处理中..." : checkResult.isOwnMerchant ? "查看联系方式" : "确认查看"}
                  </Button>
                  <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                    取消
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{checkResult.reason}</AlertDescription>
                </Alert>
                <Button onClick={() => onOpenChange(false)} className="w-full">
                  关闭
                </Button>
              </>
            )}
          </div>
        )}

        {!showConfirm && contact && (
          <div className="space-y-4 py-4">
            {contact.phone && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Phone className="h-4 w-4" />
                  电话
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm">{contact.phone}</span>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(contact.phone!)}>
                    <Copy className="h-4 w-4" />
                    复制
                  </Button>
                </div>
              </div>
            )}

            {contact.wechat && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MessageCircle className="h-4 w-4" />
                  微信
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm">{contact.wechat}</span>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(contact.wechat!)}>
                    <Copy className="h-4 w-4" />
                    复制
                  </Button>
                </div>
              </div>
            )}

            {contact.telegram && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MessageCircle className="h-4 w-4" />
                  Telegram
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm">{contact.telegram}</span>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(contact.telegram!)}>
                    <Copy className="h-4 w-4" />
                    复制
                  </Button>
                </div>
              </div>
            )}

            {contact.whatsapp && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Phone className="h-4 w-4" />
                  WhatsApp
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm">{contact.whatsapp}</span>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(contact.whatsapp!)}>
                    <Copy className="h-4 w-4" />
                    复制
                  </Button>
                </div>
              </div>
            )}

            {contact.email && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Mail className="h-4 w-4" />
                  邮箱
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm">{contact.email}</span>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(contact.email!)}>
                    <Copy className="h-4 w-4" />
                    复制
                  </Button>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => onOpenChange(false)}>关闭</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
