"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Bell, User, LogOut, Settings, Medal, Users } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"

interface UserProfile {
  id: string
  username: string | null
  avatar_url: string | null
  points: number
  role: string
}

// 客户端组件 - 用户菜单和交互部分
export function NavigationClient() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [initialLoading, setInitialLoading] = useState(true)

  useEffect(() => {
    loadUser()
  }, [])

  async function loadUser() {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      setIsLoggedIn(true)

      // 获取用户资料
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, points, role")
        .eq("id", user.id)
        .single()

      if (profile) {
        setUserProfile(profile)
      }

      // 获取未读通知数量
      const { count } = await supabase
        .from("user_notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false)

      setUnreadCount(count || 0)

      // 订阅实时通知
      const channel = supabase
        .channel("user-notifications")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_notifications",
            filter: `user_id=eq.${user.id}`,
          },
          async () => {
            const { count: newCount } = await supabase
              .from("user_notifications")
              .select("*", { count: "exact", head: true })
              .eq("user_id", user.id)
              .eq("read", false)

            setUnreadCount(newCount || 0)
          }
        )
        .subscribe()

      // 订阅积分变化
      const pointsChannel = supabase
        .channel("user-points")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${user.id}`,
          },
          (payload: any) => {
            if (payload.new.points !== undefined) {
              setUserProfile((prev) =>
                prev ? { ...prev, points: payload.new.points } : null
              )
            }
          }
        )
        .subscribe()

      return () => {
        channel.unsubscribe()
        pointsChannel.unsubscribe()
      }
    }

    setInitialLoading(false)
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/"
  }

  // 骨架屏
  if (initialLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-muted animate-pulse"></div>
        <div className="h-8 w-8 rounded-full bg-muted animate-pulse"></div>
        <div className="h-10 w-32 rounded-md bg-muted animate-pulse"></div>
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" asChild>
          <Link href="/auth/login">登录</Link>
        </Button>
        <Button asChild>
          <Link href="/auth/register">注册</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 md:gap-4">
      {/* 通知铃铛 */}
      <Button variant="ghost" size="icon" className="relative" asChild>
        <Link href="/user/notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Link>
      </Button>

      {/* 积分显示 */}
      <Link
        href="/user/points-history"
        className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
      >
        <Medal className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">{userProfile?.points || 0}</span>
      </Link>

      {/* 用户菜单 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full">
            <Avatar className="h-10 w-10">
              <AvatarImage src={userProfile?.avatar_url || ""} alt="头像" />
              <AvatarFallback>
                <User className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">
                {userProfile?.username || "用户"}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                积分: {userProfile?.points || 0}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* 管理员入口 */}
          {userProfile?.role === "admin" && (
            <>
              <DropdownMenuItem asChild>
                <Link href="/admin" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>管理后台</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuItem asChild>
            <Link href="/user/profile" className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              <span>个人资料</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/user/points-history" className="cursor-pointer">
              <Medal className="mr-2 h-4 w-4" />
              <span>积分记录</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/user/invitation" className="cursor-pointer">
              <Users className="mr-2 h-4 w-4" />
              <span>邀请好友</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings" className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              <span>设置</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
            <LogOut className="mr-2 h-4 w-4" />
            <span>退出登录</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
