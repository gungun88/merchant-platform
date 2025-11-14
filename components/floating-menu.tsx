"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  MessageCircle,
  Trophy,
  HelpCircle,
  Handshake,
  ChevronUp,
  Mail,
  Copy,
  Check,
  Coins,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getPlatformContact } from "@/lib/actions/settings"
import { toast } from "sonner"

interface PlatformContact {
  email: string | null
  wechat: string | null
  telegram: string | null
  whatsapp: string | null
}

export function FloatingMenu() {
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [contactDialogOpen, setContactDialogOpen] = useState(false)
  const [platformContact, setPlatformContact] = useState<PlatformContact | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // 监听滚动，控制"返回顶部"按钮显示
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300)
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // 加载平台联系方式
  useEffect(() => {
    if (contactDialogOpen && !platformContact) {
      loadPlatformContact()
    }
  }, [contactDialogOpen])

  const loadPlatformContact = async () => {
    const result = await getPlatformContact()
    if (result.success && result.data) {
      setPlatformContact(result.data)
    }
  }

  // 返回顶部
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // 复制到剪贴板
  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      toast.success("已复制到剪贴板")
      setTimeout(() => setCopiedField(null), 2000)
    } catch (error) {
      toast.error("复制失败，请手动复制")
    }
  }

  const menuItems = [
    {
      icon: MessageCircle,
      label: "官方论坛",
      onClick: () => window.open("https://doingfb.com/", "_blank"),
      color: "text-blue-600",
      bgColor: "hover:bg-blue-50",
    },
    {
      icon: Trophy,
      label: "排行榜",
      href: "/leaderboard",
      color: "text-yellow-600",
      bgColor: "hover:bg-yellow-50",
    },
    {
      icon: HelpCircle,
      label: "帮助中心",
      href: "/help",
      color: "text-green-600",
      bgColor: "hover:bg-green-50",
    },
    {
      icon: Handshake,
      label: "合作伙伴",
      href: "/partners",
      color: "text-purple-600",
      bgColor: "hover:bg-purple-50",
    },
    {
      icon: Coins,
      label: "兑换积分",
      href: "/help#coin-exchange",
      color: "text-orange-600",
      bgColor: "hover:bg-orange-50",
    },
  ]

  return (
    <>
      {/* 右侧悬浮菜单 */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 z-40 hidden lg:block">
        <Card className="w-24 shadow-xl border-2">
          {/* 官方客服区域 */}
          <div className="p-3 text-center border-b">
            <Button
              variant="ghost"
              className="w-full h-auto flex flex-col items-center gap-2 p-2 hover:bg-blue-50 transition-colors"
              onClick={() => setContactDialogOpen(true)}
            >
              <Mail className="h-8 w-8 text-blue-600" />
              <span className="text-xs font-medium text-gray-700">官方客服</span>
            </Button>
          </div>

          <Separator />

          {/* 快捷操作按钮 */}
          <div className="p-2 space-y-1">
            {menuItems.map((item, index) => {
              const Icon = item.icon
              const content = (
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full h-auto flex flex-col items-center gap-1.5 p-2",
                    item.bgColor
                  )}
                  onClick={item.onClick}
                >
                  <Icon className={cn("h-5 w-5", item.color)} />
                  <span className="text-xs font-medium text-gray-700 leading-tight">
                    {item.label}
                  </span>
                </Button>
              )

              return item.href ? (
                <Link key={index} href={item.href}>
                  {content}
                </Link>
              ) : (
                <div key={index}>{content}</div>
              )
            })}
          </div>

          <Separator />

          {/* 返回顶部按钮 */}
          <div className="p-2">
            <Button
              variant="ghost"
              className={cn(
                "w-full h-auto flex flex-col items-center gap-1.5 p-2 hover:bg-gray-100 transition-opacity",
                showBackToTop ? "opacity-100" : "opacity-40"
              )}
              onClick={scrollToTop}
            >
              <ChevronUp className="h-5 w-5 text-gray-700" />
              <span className="text-xs font-medium text-gray-700">返回顶部</span>
            </Button>
          </div>
        </Card>
      </div>

      {/* 官方客服联系方式弹窗 */}
      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              联系官方客服
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {platformContact ? (
              <>
                {/* 邮箱 */}
                {platformContact.email && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">客服邮箱</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(platformContact.email!, "email")}
                        className="h-7 text-xs"
                      >
                        {copiedField === "email" ? (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            已复制
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 mr-1" />
                            复制
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="bg-gray-50 rounded-lg px-3 py-2 border">
                      <p className="text-sm text-gray-900 font-mono">{platformContact.email}</p>
                    </div>
                  </div>
                )}

                {/* 微信 */}
                {platformContact.wechat && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">客服微信</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(platformContact.wechat!, "wechat")}
                        className="h-7 text-xs"
                      >
                        {copiedField === "wechat" ? (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            已复制
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 mr-1" />
                            复制
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="bg-gray-50 rounded-lg px-3 py-2 border">
                      <p className="text-sm text-gray-900 font-mono">{platformContact.wechat}</p>
                    </div>
                  </div>
                )}

                {/* Telegram */}
                {platformContact.telegram && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Telegram</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(platformContact.telegram!, "telegram")}
                        className="h-7 text-xs"
                      >
                        {copiedField === "telegram" ? (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            已复制
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 mr-1" />
                            复制
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="bg-gray-50 rounded-lg px-3 py-2 border">
                      <p className="text-sm text-gray-900 font-mono">{platformContact.telegram}</p>
                    </div>
                  </div>
                )}

                {/* WhatsApp */}
                {platformContact.whatsapp && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">WhatsApp</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(platformContact.whatsapp!, "whatsapp")}
                        className="h-7 text-xs"
                      >
                        {copiedField === "whatsapp" ? (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            已复制
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 mr-1" />
                            复制
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="bg-gray-50 rounded-lg px-3 py-2 border">
                      <p className="text-sm text-gray-900 font-mono">{platformContact.whatsapp}</p>
                    </div>
                  </div>
                )}

                {/* 如果没有任何联系方式 */}
                {!platformContact.email &&
                  !platformContact.wechat &&
                  !platformContact.telegram &&
                  !platformContact.whatsapp && (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-500">暂未配置客服联系方式</p>
                      <p className="text-xs text-gray-400 mt-2">管理员可在后台设置中配置</p>
                    </div>
                  )}

                {/* 工作时间提示 */}
                {(platformContact.email ||
                  platformContact.wechat ||
                  platformContact.telegram ||
                  platformContact.whatsapp) && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs text-center text-gray-500">
                      工作时间：周一至周日 9:00-22:00
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">加载中...</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
