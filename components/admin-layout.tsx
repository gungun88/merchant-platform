"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  LayoutDashboard,
  Users,
  Store,
  AlertCircle,
  Megaphone,
  Coins,
  FileText,
  Settings,
  LogOut,
  Menu,
  Shield,
  CreditCard,
  CheckCircle,
  XCircle,
  Handshake,
  ChevronDown,
  ChevronRight,
  ArrowUpCircle,
  ShieldCheck,
  KeyRound,
  DollarSign,
  Ticket,
  Image,
  UsersRound,
} from "lucide-react"

interface AdminLayoutProps {
  children: React.ReactNode
}

const menuItems = [
  {
    title: "概览",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "商家管理",
    icon: Store,
    subItems: [
      { title: "商家列表", href: "/admin/merchants", icon: Store },
    ],
  },
  {
    title: "押金管理",
    icon: CreditCard,
    subItems: [
      { title: "押金申请", href: "/admin/deposits/applications", icon: Coins },
      { title: "追加押金", href: "/admin/deposits/top-ups", icon: ArrowUpCircle },
      { title: "退还申请", href: "/admin/deposits/refunds", icon: XCircle },
    ],
  },
  {
    title: "合作伙伴",
    href: "/admin/partners",
    icon: Handshake,
  },
  {
    title: "财务管理",
    href: "/admin/income",
    icon: DollarSign,
  },
  {
    title: "举报管理",
    href: "/admin/reports",
    icon: AlertCircle,
  },
  {
    title: "用户管理",
    icon: Users,
    subItems: [
      { title: "用户列表", href: "/admin/users", icon: Users },
      { title: "用户组管理", href: "/admin/user-groups", icon: UsersRound },
      { title: "管理员管理", href: "/admin/admins", icon: ShieldCheck },
    ],
  },
  {
    title: "内测管理",
    href: "/admin/beta-codes",
    icon: Ticket,
  },
  {
    title: "公告管理",
    href: "/admin/announcements",
    icon: Megaphone,
  },
  {
    title: "广告图管理",
    href: "/admin/banners",
    icon: Image,
  },
  {
    title: "操作日志",
    href: "/admin/logs",
    icon: FileText,
  },
  {
    title: "系统设置",
    href: "/admin/settings",
    icon: Settings,
  },
]

export function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]) // 默认收起所有子菜单

  // 密码修改对话框状态
  const [changePasswordDialogOpen, setChangePasswordDialogOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    async function loadUser() {
      try {
        const supabase = createClient()

        const {
          data: { user: authUser },
        } = await supabase.auth.getUser()

        if (!authUser) {
          router.push("/admin/login")
          return
        }

        // 获取用户资料
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authUser.id)
          .single()

        if (profileError || !profileData) {
          router.push("/admin/login")
          return
        }

        // 检查是否是管理员
        if (profileData.role !== "admin" && profileData.role !== "super_admin") {
          toast.error("您没有管理员权限")
          await supabase.auth.signOut()
          router.push("/admin/login")
          return
        }

        setUser(authUser)
        setProfile(profileData)
      } catch (error) {
        console.error("Error loading user:", error)
        router.push("/admin/login")
      } finally {
        setLoading(false)
      }
    }

    loadUser()
  }, [router])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success("已退出登录")
    router.push("/admin/login")
  }

  const toggleMenu = (title: string) => {
    setExpandedMenus((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    )
  }

  const handleChangePasswordClick = () => {
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setChangePasswordDialogOpen(true)
  }

  const handleChangePassword = async () => {
    // 验证输入
    if (!currentPassword.trim()) {
      toast.error("请输入当前密码")
      return
    }

    if (!newPassword || newPassword.length < 6) {
      toast.error("新密码长度至少为6位")
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error("两次输入的新密码不一致")
      return
    }

    if (currentPassword === newPassword) {
      toast.error("新密码不能与当前密码相同")
      return
    }

    try {
      setChangingPassword(true)
      const supabase = createClient()

      // 先验证当前密码
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })

      if (signInError) {
        toast.error("当前密码错误")
        return
      }

      // 更新密码
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        console.error("Error updating password:", updateError)
        toast.error(updateError.message || "修改密码失败")
        return
      }

      toast.success("密码修改成功")
      setChangePasswordDialogOpen(false)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (error: any) {
      console.error("Error changing password:", error)
      toast.error(error.message || "修改密码失败")
    } finally {
      setChangingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 mx-auto mb-4 text-primary animate-pulse" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    )
  }

  if (!user || !profile) {
    return null
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 border-b">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold">管理后台</span>
        </div>
      </div>

      {/* 菜单 */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => {
          if (item.subItems) {
            const isExpanded = expandedMenus.includes(item.title)
            return (
              <div key={item.title} className="space-y-1">
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => toggleMenu(item.title)}
                >
                  <item.icon className="h-4 w-4 mr-2" />
                  <span className="flex-1 text-left">{item.title}</span>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
                {isExpanded && (
                  <div className="ml-6 space-y-1">
                    {item.subItems.map((subItem) => (
                      <Link key={subItem.href} href={subItem.href}>
                        <Button
                          variant={pathname === subItem.href ? "secondary" : "ghost"}
                          className="w-full justify-start"
                          size="sm"
                        >
                          <subItem.icon className="h-4 w-4 mr-2" />
                          {subItem.title}
                        </Button>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          }

          return (
            <Link key={item.href} href={item.href!}>
              <Button
                variant={pathname === item.href ? "secondary" : "ghost"}
                className="w-full justify-start"
              >
                <item.icon className="h-4 w-4 mr-2" />
                {item.title}
              </Button>
            </Link>
          )
        })}
      </nav>

      {/* 用户信息 */}
      <div className="p-4 border-t">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile.avatar || ""} />
                <AvatarFallback>{profile.username?.[0] || "A"}</AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">{profile.username || "管理员"}</p>
                <p className="text-xs text-muted-foreground">{profile.role === "super_admin" ? "超级管理员" : "管理员"}</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>管理员账号</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/">返回前台</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleChangePasswordClick}>
              <KeyRound className="h-4 w-4 mr-2" />
              修改密码
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout} className="text-red-600">
              <LogOut className="h-4 w-4 mr-2" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 移动端顶部栏 */}
      <div className="lg:hidden border-b bg-white sticky top-0 z-50">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-bold">管理后台</span>
          </div>
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
              <SidebarContent />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[280px_1fr]">
        {/* 桌面端侧边栏 */}
        <aside className="hidden lg:block border-r bg-white h-screen sticky top-0">
          <SidebarContent />
        </aside>

        {/* 主内容区 */}
        <main className="min-h-screen p-6">{children}</main>
      </div>

      {/* 修改密码对话框 */}
      <Dialog open={changePasswordDialogOpen} onOpenChange={setChangePasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改密码</DialogTitle>
            <DialogDescription>
              请输入当前密码和新密码以完成修改
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">
                当前密码 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="current-password"
                type="password"
                placeholder="请输入当前密码"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={changingPassword}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">
                新密码 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="new-password"
                type="password"
                placeholder="至少6位字符"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={changingPassword}
              />
              <p className="text-xs text-muted-foreground">
                密码长度至少为6位
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">
                确认新密码 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="请再次输入新密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={changingPassword}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setChangePasswordDialogOpen(false)}
              disabled={changingPassword}
            >
              取消
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={
                changingPassword ||
                !currentPassword.trim() ||
                !newPassword ||
                newPassword.length < 6 ||
                !confirmPassword
              }
            >
              {changingPassword ? "修改中..." : "确认修改"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
