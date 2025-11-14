"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Copy, Check, Share2 } from "lucide-react"
import { toast } from "sonner"

interface ShareMerchantDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  merchantId: string
  merchantName: string
}

export function ShareMerchantDialog({ open, onOpenChange, merchantId, merchantName }: ShareMerchantDialogProps) {
  const [copied, setCopied] = useState(false)

  // 生成分享链接
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/merchant/${merchantId}` : ""

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success("链接已复制到剪贴板")
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error("复制失败，请手动复制")
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `推荐商家：${merchantName}`,
          text: `我发现了一个不错的商家：${merchantName}，快来看看吧！`,
          url: shareUrl,
        })
        toast.success("分享成功")
        onOpenChange(false) // 分享成功后关闭对话框
      } catch (error) {
        // 用户取消分享不显示错误
        if ((error as Error).name !== "AbortError") {
          console.error("分享失败:", error)
          toast.error("分享失败")
        }
      }
    } else {
      // 不支持 Web Share API，复制链接
      handleCopy()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            分享商家
          </DialogTitle>
          <DialogDescription>分享 {merchantName} 给你的朋友</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="share-link">分享链接</Label>
            <div className="flex gap-2">
              <Input id="share-link" value={shareUrl} readOnly className="flex-1" />
              <Button onClick={handleCopy} size="icon" variant="outline" className="shrink-0">
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">点击复制按钮复制链接，然后可以分享到微信、QQ等任何平台</p>
          </div>

          <Button onClick={() => onOpenChange(false)} className="w-full">
            关闭
          </Button>

          <div className="border-t pt-4">
            <p className="text-xs text-muted-foreground text-center">分享商家帮助更多人找到优质服务</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
