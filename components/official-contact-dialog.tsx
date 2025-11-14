"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Copy, Mail, MessageCircle, Send, Clock } from "lucide-react"
import { toast } from "sonner"
import { getSystemSettings } from "@/lib/actions/settings"

interface OfficialContactDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OfficialContactDialog({ open, onOpenChange }: OfficialContactDialogProps) {
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (open) {
      loadSettings()
    }
  }, [open])

  async function loadSettings() {
    try {
      setLoading(true)
      const result = await getSystemSettings()
      if (result.success && result.data) {
        setSettings(result.data)
      }
    } catch (error) {
      console.error("Failed to load settings:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label}已复制到剪贴板`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Mail className="h-6 w-6 text-primary" />
            联系官方客服
          </DialogTitle>
          <DialogDescription>
            通过以下方式联系我们的客服团队
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">
            加载中...
          </div>
        ) : !settings?.support_email && !settings?.support_wechat && !settings?.support_telegram ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground mb-4">暂未配置客服联系方式</p>
            <p className="text-sm text-muted-foreground">
              请联系管理员在系统设置中配置客服信息
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* 客服邮箱 */}
            {settings?.support_email && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  客服邮箱
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-4 py-2.5 bg-muted rounded-lg font-mono text-sm">
                    {settings.support_email}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(settings.support_email, "客服邮箱")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* 客服微信 */}
            {settings?.support_wechat && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  客服微信
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-4 py-2.5 bg-muted rounded-lg font-mono text-sm">
                    {settings.support_wechat}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(settings.support_wechat, "客服微信")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Telegram */}
            {settings?.support_telegram && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Telegram
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-4 py-2.5 bg-muted rounded-lg font-mono text-sm">
                    {settings.support_telegram}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(settings.support_telegram, "Telegram")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* 工作时间 */}
            <div className="pt-4 border-t">
              <p className="text-sm text-center text-muted-foreground flex items-center justify-center gap-2">
                <Clock className="h-4 w-4" />
                工作时间：周一至周日 9:00-22:00
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
