"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Info,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Pin,
  X,
  Megaphone,
} from "lucide-react"
import { getActiveAnnouncements, incrementAnnouncementClickCount, type Announcement } from "@/lib/actions/announcements"
import { cn } from "@/lib/utils"

interface AnnouncementBannerProps {
  targetAudience?: "all" | "users" | "merchants" | "partners"
  className?: string
  maxDisplay?: number
  scrollSpeed?: number // 滚动速度（像素/秒），默认50
}

export function AnnouncementBanner({
  targetAudience = "all",
  className,
  maxDisplay = 5,
  scrollSpeed = 50,
}: AnnouncementBannerProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    loadAnnouncements()
    loadDismissedIds()
  }, [targetAudience])

  // 计算可见公告 - 使用 useMemo 避免不必要的重新计算
  const visibleAnnouncements = useMemo(
    () => announcements.filter((announcement) => !dismissedIds.has(announcement.id)).slice(0, maxDisplay),
    [announcements, dismissedIds, maxDisplay]
  )

  // 自动轮播效果
  useEffect(() => {
    if (visibleAnnouncements.length <= 1 || isPaused) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % visibleAnnouncements.length)
    }, 4000) // 每 4 秒切换一次

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [visibleAnnouncements.length, isPaused])

  // 当公告列表变化时重置索引
  useEffect(() => {
    setCurrentIndex(0)
  }, [visibleAnnouncements.length])

  async function loadAnnouncements() {
    try {
      const result = await getActiveAnnouncements(targetAudience)

      if (result.success) {
        setAnnouncements(result.data)
      }
      // 只在首次加载时设置 loading
      setLoading(false)
    } catch (error) {
      console.error("Error loading announcements:", error)
      setLoading(false)
    }
  }

  function loadDismissedIds() {
    try {
      const stored = localStorage.getItem("dismissedAnnouncements")
      if (stored) {
        setDismissedIds(new Set(JSON.parse(stored)))
      }
    } catch (error) {
      console.error("Error loading dismissed IDs:", error)
    }
  }

  function handleDismiss(announcementId: string, e: React.MouseEvent) {
    e.stopPropagation()
    const newDismissed = new Set(dismissedIds)
    newDismissed.add(announcementId)
    setDismissedIds(newDismissed)
    localStorage.setItem("dismissedAnnouncements", JSON.stringify(Array.from(newDismissed)))
  }

  async function handleViewDetail(announcement: Announcement, e: React.MouseEvent) {
    e.stopPropagation()
    setSelectedAnnouncement(announcement)
    setDetailDialogOpen(true)
    // 增加点击次数
    await incrementAnnouncementClickCount(announcement.id)
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "info":
        return <Info className="h-4 w-4" />
      case "warning":
        return <AlertTriangle className="h-4 w-4" />
      case "success":
        return <CheckCircle className="h-4 w-4" />
      case "error":
        return <XCircle className="h-4 w-4" />
      case "update":
        return <Clock className="h-4 w-4" />
      default:
        return <Info className="h-4 w-4" />
    }
  }

  const getTypeBgClass = (type: string) => {
    switch (type) {
      case "info":
        return "bg-blue-50 border-blue-200 text-blue-900"
      case "warning":
        return "bg-amber-50 border-amber-200 text-amber-900"
      case "success":
        return "bg-green-50 border-green-200 text-green-900"
      case "error":
        return "bg-red-50 border-red-200 text-red-900"
      case "update":
        return "bg-purple-50 border-purple-200 text-purple-900"
      default:
        return "bg-gray-50 border-gray-200 text-gray-900"
    }
  }

  const getTypeIconColor = (type: string) => {
    switch (type) {
      case "info":
        return "text-blue-600"
      case "warning":
        return "text-amber-600"
      case "success":
        return "text-green-600"
      case "error":
        return "text-red-600"
      case "update":
        return "text-purple-600"
      default:
        return "text-gray-600"
    }
  }

  if (loading) {
    return null
  }

  if (visibleAnnouncements.length === 0) {
    return null
  }

  const currentAnnouncement = visibleAnnouncements[currentIndex]

  return (
    <>
      <div className={cn("mb-4", className)}>
        <Card className="border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 overflow-hidden">
          <CardContent className="p-0">
            <div
              className="flex items-center gap-3 py-2.5 px-4"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              {/* 左侧图标 - 固定不滚动 */}
              <div className="flex-shrink-0">
                <Megaphone className="h-5 w-5 text-blue-600 animate-pulse" />
              </div>

              {/* 中间公告内容区域 - 淡入淡出效果 */}
              <div className="flex-1 overflow-hidden relative h-7">
                {visibleAnnouncements.map((announcement, index) => (
                  <div
                    key={announcement.id}
                    className={cn(
                      "absolute inset-0 flex items-center gap-2 cursor-pointer group transition-all duration-700",
                      index === currentIndex ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
                    )}
                    onClick={(e) => handleViewDetail(announcement, e)}
                  >
                    {/* 类型图标 */}
                    <span className={cn("flex-shrink-0", getTypeIconColor(announcement.type))}>
                      {getTypeIcon(announcement.type)}
                    </span>

                    {/* 置顶标记 */}
                    {announcement.is_pinned && (
                      <Pin className="h-3 w-3 text-purple-600 flex-shrink-0" />
                    )}

                    {/* 标题和内容 */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="font-medium text-sm text-gray-900 truncate">
                        {announcement.title}
                      </span>
                      <span className="text-xs text-gray-500 truncate hidden md:inline">
                        {announcement.content.substring(0, 30)}
                        {announcement.content.length > 30 && "..."}
                      </span>
                    </div>

                    {/* 查看详情提示 - 始终显示，悬停时加强 */}
                    <div className="flex items-center gap-1 text-blue-600 opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all flex-shrink-0">
                      <span className="text-xs font-medium whitespace-nowrap">查看详情</span>
                      <svg className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>

              {/* 右侧指示器和信息 */}
              <div className="flex-shrink-0 flex items-center gap-2">
                {visibleAnnouncements.length > 1 && (
                  <div className="flex items-center gap-1">
                    {visibleAnnouncements.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentIndex(index)}
                        className={cn(
                          "h-1.5 rounded-full transition-all duration-300",
                          index === currentIndex ? "w-4 bg-blue-600" : "w-1.5 bg-blue-300 hover:bg-blue-400"
                        )}
                        aria-label={`跳转到第 ${index + 1} 条公告`}
                      />
                    ))}
                  </div>
                )}
                <Badge variant="outline" className="text-xs border-blue-300 bg-blue-100 text-blue-700 hidden sm:inline-flex">
                  {visibleAnnouncements.length > 1
                    ? `${currentIndex + 1}/${visibleAnnouncements.length}`
                    : "1 条公告"
                  }
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 详情对话框 - 简约版设计 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden p-0 gap-0">
          {selectedAnnouncement && (
            <>
              {/* 顶部标题区 */}
              <div className="px-6 pt-6 pb-4 border-b">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-3">
                      <div className={cn(
                        "w-1 h-6 rounded-full",
                        selectedAnnouncement.type === "info" && "bg-blue-500",
                        selectedAnnouncement.type === "warning" && "bg-amber-500",
                        selectedAnnouncement.type === "success" && "bg-green-500",
                        selectedAnnouncement.type === "error" && "bg-red-500",
                        selectedAnnouncement.type === "update" && "bg-purple-500"
                      )} />
                      <h2 className="text-xl font-semibold text-gray-900 line-clamp-2">
                        {selectedAnnouncement.title}
                      </h2>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span>
                        {new Date(selectedAnnouncement.created_at).toLocaleString("zh-CN", {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      <span>•</span>
                      <span>
                        {selectedAnnouncement.type === "info" && "信息"}
                        {selectedAnnouncement.type === "warning" && "重要"}
                        {selectedAnnouncement.type === "success" && "推荐"}
                        {selectedAnnouncement.type === "error" && "紧急"}
                        {selectedAnnouncement.type === "update" && "更新"}
                      </span>
                      {selectedAnnouncement.is_pinned && (
                        <>
                          <span>•</span>
                          <span className="text-purple-600">置顶</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 内容区域 */}
              <div className="overflow-y-auto max-h-[calc(85vh-180px)] px-6 py-6">
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                  {selectedAnnouncement.content}
                </div>
              </div>

              {/* 底部操作区 */}
              <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDetailDialogOpen(false)}
                >
                  关闭
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
