"use client"

import { useState, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Bell, Calendar, User, Settings, LogOut, ChevronDown, Star, Store, Users, MessageCircle, History, Shield } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { checkIn, getCheckInStatus } from "@/lib/actions/points"
import { getUserMerchant } from "@/lib/actions/merchant"
import { getUnreadCount, getNotifications, markNotificationAsRead } from "@/lib/actions/notifications"
import { getSystemSettings } from "@/lib/actions/settings"
import { triggerPointsUpdate } from "@/lib/utils/points-update"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export function Navigation() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [hasCheckedIn, setHasCheckedIn] = useState(false)
  const [consecutiveDays, setConsecutiveDays] = useState(0)
  const [earnedPoints, setEarnedPoints] = useState(0)
  const [hasMerchant, setHasMerchant] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<any[]>([])
  const [loadingNotifications, setLoadingNotifications] = useState(false)
  const [notificationPage, setNotificationPage] = useState(1)
  const [hasMoreNotifications, setHasMoreNotifications] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [systemSettings, setSystemSettings] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let realtimeChannel: ReturnType<typeof supabase.channel> | null = null
    let notificationsChannel: ReturnType<typeof supabase.channel> | null = null

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      // 加载系统设置(无论是否登录都加载)
      const settingsResult = await getSystemSettings()
      if (settingsResult.success && settingsResult.data) {
        setSystemSettings(settingsResult.data)
      }

      if (user) {
        setIsLoggedIn(true)
        setUser(user)

        // 获取用户profile
        const { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()

        if (profileData) {
          setProfile(profileData)
          // 检查是否是管理员
          setIsAdmin(profileData.role === "admin" || profileData.role === "super_admin")
        }

        const merchant = await getUserMerchant()
        setHasMerchant(!!merchant)

        // 获取签到状态
        const status = await getCheckInStatus(user.id)
        setHasCheckedIn(status.hasCheckedInToday)
        setConsecutiveDays(status.consecutiveDays)

        // 获取未读通知数量
        const unreadResult = await getUnreadCount()
        console.log('[Navigation] Initial unread count:', unreadResult)
        if (unreadResult.success) {
          setUnreadCount(unreadResult.count)
        }

        // 订阅当前用户的 profile 变化（实时更新积分）
        realtimeChannel = supabase
          .channel(`profile-${user.id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'profiles',
              filter: `id=eq.${user.id}`,
            },
            (payload) => {
              console.log('[Realtime] Profile updated:', payload)
              // 实时更新 profile 数据
              if (payload.new) {
                setProfile(payload.new as any)
              }
            }
          )
          .subscribe()

        // 订阅当前用户的通知（实时更新通知）
        notificationsChannel = supabase
          .channel(`notifications-${user.id}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${user.id}`,
            },
            async (payload) => {
              console.log('[Realtime] New notification:', payload)
              // 实时更新未读数量
              const unreadResult = await getUnreadCount()
              console.log('[Realtime INSERT] Updated unread count:', unreadResult)
              if (unreadResult.success) {
                setUnreadCount(unreadResult.count)
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${user.id}`,
            },
            async (payload) => {
              console.log('[Realtime] Notification updated:', payload)
              // 实时更新未读数量
              const unreadResult = await getUnreadCount()
              console.log('[Realtime UPDATE] Updated unread count:', unreadResult)
              if (unreadResult.success) {
                setUnreadCount(unreadResult.count)
              }
              // 更新本地通知列表
              if (payload.new) {
                setNotifications(prev =>
                  prev.map(n => n.id === (payload.new as any).id ? payload.new : n)
                )
              }
            }
          )
          .subscribe((status) => {
            console.log('[Realtime] Notifications channel status:', status)
          })
      }
    }

    loadUser()

    // 监听积分变化事件（兼容旧的事件触发方式）
    const handlePointsChanged = () => {
      // 重新加载用户积分
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle()
            .then(({ data: profileData }) => {
              if (profileData) {
                setProfile(profileData)
              }
            })
        }
      })
    }

    window.addEventListener('pointsChanged', handlePointsChanged)

    return () => {
      window.removeEventListener('pointsChanged', handlePointsChanged)
      // 清理 realtime 订阅
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel)
      }
      if (notificationsChannel) {
        supabase.removeChannel(notificationsChannel)
      }
    }
  }, [])

  const handleCheckIn = async () => {
    if (!user) return

    setLoading(true)
    try {
      const result = await checkIn(user.id)
      setHasCheckedIn(true)
      setConsecutiveDays(result.consecutiveDays)
      setEarnedPoints(result.points)
      toast.success(`签到成功！获得 ${result.points} 积分`)

      // 触发积分更新事件
      triggerPointsUpdate()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "签到失败")
    } finally {
      setLoading(false)
    }
  }

  const loadNotifications = async (page = 1) => {
    setLoadingNotifications(true)
    try {
      const result = await getNotifications({ page, limit: 10 })
      if (result.success && result.data) {
        if (page === 1) {
          setNotifications(result.data)
        } else {
          setNotifications(prev => [...prev, ...result.data!])
        }
        setHasMoreNotifications((result.pagination?.totalPages || 1) > page)
        setNotificationPage(page)
      }
    } catch (error) {
      console.error("Error loading notifications:", error)
    } finally {
      setLoadingNotifications(false)
    }
  }

  const handleNotificationClick = async (notification: any) => {
    console.log('[handleNotificationClick] Clicked notification:', notification)
    // 标记为已读
    if (!notification.is_read) {
      const result = await markNotificationAsRead(notification.id)
      console.log('[handleNotificationClick] Mark as read result:', result)

      // 更新未读数量
      const unreadResult = await getUnreadCount()
      console.log('[handleNotificationClick] Updated unread count:', unreadResult)
      if (unreadResult.success) {
        setUnreadCount(unreadResult.count)
      }
      // 更新本地通知列表
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
      )
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

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/"
  }

  const getUserInitial = () => {
    if (profile?.username) {
      return profile.username[0].toUpperCase()
    }
    if (user?.email) {
      return user.email[0].toUpperCase()
    }
    return "U"
  }

  const getUserName = () => {
    return profile?.username || user?.email?.split("@")[0] || "用户"
  }

  return (
    <header className="border-b bg-card sticky top-0 z-50">
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between">
          {/* 左侧：Logo + 平台名称 */}
          <Link href="/" className="flex items-center gap-2 md:gap-4 hover:opacity-80 transition-opacity">
            <div className="h-10 w-10 md:h-12 md:w-12 rounded-full flex items-center justify-center overflow-hidden">
              {systemSettings?.platform_logo_url ? (
                <img
                  src={systemSettings.platform_logo_url}
                  alt="Platform Logo"
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-primary font-bold">商</span>
              )}
            </div>
            <div className="hidden sm:block">
              <h1 className="font-semibold text-base md:text-lg">{systemSettings?.platform_name || "跨境服务商平台"}</h1>
              <p className="text-xs text-muted-foreground hidden md:block">{systemSettings?.platform_description || "汇聚优质跨境电商服务商"}</p>
            </div>
          </Link>

          {/* 右侧：登录状态 */}
          <div className="flex items-center gap-1 md:gap-3">
            {isLoggedIn ? (
              <>
                {/* 签到按钮 */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative">
                      <Calendar className="h-5 w-5" />
                      {!hasCheckedIn && (
                        <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                          1
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <div className="p-4 space-y-3">
                      <div className="font-medium">每日签到</div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {hasCheckedIn ? (
                          <>
                            <div className="flex items-center justify-between">
                              <span>今日状态</span>
                              <span className="text-green-600 font-medium">已签到</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>连续签到</span>
                              <span className="font-medium">{consecutiveDays} 天</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>今日获得</span>
                              <span className="text-yellow-600 font-medium">+{earnedPoints || systemSettings?.checkin_points || 5} 积分</span>
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-2">
                            <p className="mb-3">今天还没有签到哦</p>
                            <Button onClick={handleCheckIn} disabled={loading} className="w-full">
                              {loading ? "签到中..." : "立即签到"}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* 通知中心 */}
                <DropdownMenu onOpenChange={async (open) => {
                  if (open) {
                    loadNotifications(1)
                    // 刷新未读数量
                    const unreadResult = await getUnreadCount()
                    if (unreadResult.success) {
                      setUnreadCount(unreadResult.count)
                    }
                  }
                }}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative">
                      <Bell className="h-5 w-5" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] max-w-96 p-0">
                    {/* 标题栏 */}
                    <div className="border-b px-4 py-3">
                      <h3 className="font-semibold">通知中心</h3>
                    </div>

                    {/* 通知列表 */}
                    <div className="max-h-[400px] overflow-y-auto">
                      {loadingNotifications && notifications.length === 0 ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                          加载中...
                        </div>
                      ) : notifications.length === 0 ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                          暂无通知
                        </div>
                      ) : (
                        <div className="divide-y">
                          {notifications.map((notification) => (
                            <div
                              key={notification.id}
                              className={`p-3 flex gap-3 hover:bg-muted/30 transition-colors cursor-pointer ${
                                !notification.is_read ? "bg-blue-50/30" : ""
                              }`}
                              onClick={() => handleNotificationClick(notification)}
                            >
                              {/* 左侧未读标识 */}
                              <div className="flex-shrink-0 w-2 pt-1">
                                {!notification.is_read && (
                                  <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                                )}
                              </div>

                              {/* 通知内容 */}
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm mb-1 ${!notification.is_read ? "font-semibold" : ""}`}>
                                  {notification.title}
                                </p>
                                {notification.content && (
                                  <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
                                    {notification.content}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  {formatTime(notification.created_at)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 底部操作栏 */}
                    {notifications.length > 0 && (
                      <div className="border-t px-4 py-2 flex items-center justify-between">
                        {hasMoreNotifications ? (
                          <button
                            className="text-sm text-primary hover:underline"
                            onClick={(e) => {
                              e.stopPropagation()
                              loadNotifications(notificationPage + 1)
                            }}
                            disabled={loadingNotifications}
                          >
                            {loadingNotifications ? "加载中..." : "加载更多"}
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">已全部加载</span>
                        )}
                        <Link href="/notifications" className="text-sm text-primary hover:underline">
                          查看全部
                        </Link>
                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* 用户菜单 */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={profile?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(getUserName())}&background=random&color=fff&size=128&bold=true`}
                          alt="用户头像"
                        />
                        <AvatarFallback>{getUserInitial()}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{getUserName()}</span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="p-2">
                      <div className="text-sm font-medium">{getUserName()}</div>
                      <div className="text-xs text-muted-foreground">{user?.email}</div>
                      <div className="mt-2 pt-2 border-t space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">积分</span>
                          <span className="font-medium text-yellow-600">{profile?.points || 0}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">身份</span>
                          <span className="font-medium">{profile?.is_merchant ? "商家" : "注册用户"}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">用户编号</span>
                          <span className="font-mono font-medium text-primary">
                            NO.{profile?.user_number || "-"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    {/* 管理员专属入口 */}
                    {isAdmin && (
                      <>
                        <DropdownMenuItem asChild>
                          <Link href="/admin/dashboard" className="flex items-center w-full text-primary font-medium">
                            <Shield className="h-4 w-4 mr-2" />
                            管理后台
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem asChild>
                      <Link href="/settings" className="flex items-center w-full">
                        <Settings className="h-4 w-4 mr-2" />
                        个人设置
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/favorites" className="flex items-center w-full">
                        <Star className="h-4 w-4 mr-2" />
                        我的收藏
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/invitations" className="flex items-center w-full">
                        <Users className="h-4 w-4 mr-2" />
                        邀请好友
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/user/points-history" className="flex items-center w-full">
                        <History className="h-4 w-4 mr-2" />
                        积分记录
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href="https://doingfb.com/" target="_blank" rel="noopener noreferrer" className="flex items-center w-full">
                        <MessageCircle className="h-4 w-4 mr-2" />
                        社区交流
                      </a>
                    </DropdownMenuItem>
                    {hasMerchant && (
                      <DropdownMenuItem asChild>
                        <Link href="/merchant/dashboard" className="flex items-center w-full">
                          <Store className="h-4 w-4 mr-2" />
                          商家后台
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="h-4 w-4 mr-2" />
                      退出登录
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Link href="/auth/register">
                  <Button variant="outline">注册</Button>
                </Link>
                <Link href="/auth/login">
                  <Button>登录</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
