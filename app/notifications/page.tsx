"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, CheckCheck, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  type Notification,
} from "@/lib/actions/notifications"

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const limit = 20

  useEffect(() => {
    loadNotifications()
  }, [currentPage])

  const loadNotifications = async () => {
    setLoading(true)

    const result = await getNotifications({
      page: currentPage,
      limit,
    })

    if (result.success && result.data) {
      setNotifications(result.data)
      setTotalPages(result.pagination?.totalPages || 1)
      setTotal(result.pagination?.total || 0)
    } else {
      toast.error("加载通知失败")
    }

    setLoading(false)
  }

  const handleMarkAsRead = async (id: string) => {
    const result = await markNotificationAsRead(id)
    if (result.success) {
      await loadNotifications()
    } else {
      toast.error("操作失败")
    }
  }

  const handleMarkAllAsRead = async () => {
    const result = await markAllNotificationsAsRead()
    if (result.success) {
      toast.success("已全部标记为已读")
      await loadNotifications()
    } else {
      toast.error("操作失败")
    }
  }

  const handleDelete = async (id: string) => {
    const result = await deleteNotification(id)
    if (result.success) {
      toast.success("删除成功")
      await loadNotifications()
    } else {
      toast.error("删除失败")
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return "刚刚"
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    if (days < 7) return `${days}天前`

    return date.toLocaleDateString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
    })
  }

  const handleNotificationClick = (notification: Notification) => {
    // 标记为已读
    if (!notification.is_read) {
      handleMarkAsRead(notification.id)
    }

    // 如果有关联的商家，跳转到商家详情页
    if (notification.related_merchant_id) {
      router.push(`/merchant/${notification.related_merchant_id}`)
    }
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4 md:px-6">
      <div className="container mx-auto max-w-4xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回首页
            </Button>
          </Link>

          <Button size="sm" variant="outline" onClick={handleMarkAllAsRead}>
            <CheckCheck className="h-4 w-4 mr-2" />
            全部已读
          </Button>
        </div>

        <div className="bg-card rounded-lg border shadow-sm">
          {/* 标题栏 */}
          <div className="border-b px-3 md:px-4 py-3">
            <h2 className="font-semibold text-lg">通知中心</h2>
          </div>

          {/* 通知列表 */}
          <div className="divide-y">
            {loading ? (
              // 加载骨架屏
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-3 md:p-4 flex gap-3">
                  <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              ))
            ) : notifications.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground">
                <p className="text-sm">暂无通知</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 md:p-4 flex gap-3 hover:bg-muted/30 transition-colors cursor-pointer ${
                    !notification.is_read ? "bg-blue-50/30" : ""
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  {/* 左侧未读标识 */}
                  <div className="flex-shrink-0 w-2">
                    {!notification.is_read && (
                      <div className="h-2 w-2 bg-blue-500 rounded-full mt-2"></div>
                    )}
                  </div>

                  {/* 通知内容 */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm mb-1 ${!notification.is_read ? "font-semibold" : ""}`}>
                      {notification.title}
                    </p>
                    {notification.content && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {notification.content}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatTime(notification.created_at)}
                    </p>
                  </div>

                  {/* 右侧删除按钮 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(notification.id)
                    }}
                    className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded hover:bg-muted transition-colors"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="border-t px-3 md:px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  下一页
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                第 {currentPage} / {totalPages} 页
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
