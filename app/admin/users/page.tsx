"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { AdminLayout } from "@/components/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  UserCheck,
  UserX,
  Eye,
  Ban,
  CheckCircle,
  Coins,
  ShieldCheck,
  Store,
  User,
  UserPlus,
  Send,
} from "lucide-react"
import { toast } from "sonner"
import {
  adminGetUsers,
  getUserStats,
  banUser,
  unbanUser,
  adjustUserPoints,
  createUser,
  batchTransferPoints as batchTransferPointsAction,
  type UserProfile,
  type UserStats,
  type CreateUserData,
} from "@/lib/actions/users"

export default function UsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [stats, setStats] = useState<UserStats>({
    total: 0,
    active: 0,
    banned: 0,
    newToday: 0,
    merchants: 0,
    admins: 0,
  })
  const [loading, setLoading] = useState(true)
  const [filterRole, setFilterRole] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)

  // 对话框状态
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [banDialogOpen, setBanDialogOpen] = useState(false)
  const [unbanDialogOpen, setUnbanDialogOpen] = useState(false)
  const [pointsDialogOpen, setPointsDialogOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [batchTransferDialogOpen, setBatchTransferDialogOpen] = useState(false)
  const [batchUpdateDialogOpen, setBatchUpdateDialogOpen] = useState(false)

  // 表单状态
  const [banReason, setBanReason] = useState("")
  const [unbanNote, setUnbanNote] = useState("")
  const [pointsAdjustment, setPointsAdjustment] = useState("")
  const [pointsReason, setPointsReason] = useState("")
  const [processing, setProcessing] = useState(false)

  // 创建用户表单状态
  const [newUsername, setNewUsername] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [requireEmailVerification, setRequireEmailVerification] = useState(false)
  const [generateRandomPassword, setGenerateRandomPassword] = useState(false)

  // 批量转账表单状态
  const [batchTransferPoints, setBatchTransferPoints] = useState("")
  const [batchTransferReason, setBatchTransferReason] = useState("")

  // 批量修改表单状态
  const [batchUpdateUsernamePrefix, setBatchUpdateUsernamePrefix] = useState("")
  const [batchUpdateUsernameSuffix, setBatchUpdateUsernameSuffix] = useState("")
  const [batchUpdateAvatar, setBatchUpdateAvatar] = useState("")
  const [batchUpdateTargetRole, setBatchUpdateTargetRole] = useState("all")
  const [batchUpdateResetToUserNumber, setBatchUpdateResetToUserNumber] = useState(false)
  const [batchUpdateUsernameFormat, setBatchUpdateUsernameFormat] = useState("用户{number}")
  const [batchUpdateFindText, setBatchUpdateFindText] = useState("")
  const [batchUpdateReplaceText, setBatchUpdateReplaceText] = useState("")
  const [batchUpdateFilterKeyword, setBatchUpdateFilterKeyword] = useState("")
  const [batchTransferTargetRole, setBatchTransferTargetRole] = useState("all")
  const [batchTransferDate, setBatchTransferDate] = useState<Date | undefined>(new Date())

  // 加载用户数据
  useEffect(() => {
    loadUsers()
    setCurrentPage(1)
  }, [filterRole, filterStatus])

  // 搜索时重置到第一页
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  async function loadUsers() {
    try {
      setLoading(true)

      const [usersResult, statsData] = await Promise.all([
        adminGetUsers({
          role: filterRole === "all" ? undefined : filterRole,
          status: filterStatus === "all" ? undefined : filterStatus,
          search: searchTerm || undefined,
        }),
        getUserStats(),
      ])

      if (!usersResult.success) {
        throw new Error(usersResult.error)
      }

      setUsers(usersResult.data)
      setStats(statsData)
    } catch (error: any) {
      console.error("Error loading users:", error)
      toast.error(error.message || "加载用户列表失败")
    } finally {
      setLoading(false)
    }
  }

  function handleViewDetail(user: UserProfile) {
    setSelectedUser(user)
    setDetailDialogOpen(true)
  }

  function handleBanClick(user: UserProfile) {
    setSelectedUser(user)
    setBanReason("")
    setBanDialogOpen(true)
  }

  async function handleBan() {
    if (!selectedUser) return

    if (!banReason.trim()) {
      toast.error("请填写封禁原因")
      return
    }

    try {
      setProcessing(true)
      const result = await banUser(selectedUser.id, banReason)

      if (!result.success) {
        throw new Error(result.error)
      }

      toast.success(`已封禁用户【${selectedUser.username}】`)
      setBanDialogOpen(false)
      setSelectedUser(null)
      setBanReason("")
      router.refresh()
      await loadUsers()
    } catch (error: any) {
      console.error("Error banning user:", error)
      toast.error(error.message || "封禁失败")
    } finally {
      setProcessing(false)
    }
  }

  function handleUnbanClick(user: UserProfile) {
    setSelectedUser(user)
    setUnbanNote("")
    setUnbanDialogOpen(true)
  }

  async function handleUnban() {
    if (!selectedUser) return

    try {
      setProcessing(true)
      const result = await unbanUser(selectedUser.id, unbanNote || undefined)

      if (!result.success) {
        throw new Error(result.error)
      }

      toast.success(`已解封用户【${selectedUser.username}】`)
      setUnbanDialogOpen(false)
      setSelectedUser(null)
      setUnbanNote("")
      router.refresh()
      await loadUsers()
    } catch (error: any) {
      console.error("Error unbanning user:", error)
      toast.error(error.message || "解封失败")
    } finally {
      setProcessing(false)
    }
  }

  function handlePointsClick(user: UserProfile) {
    setSelectedUser(user)
    setPointsAdjustment("")
    setPointsReason("")
    setPointsDialogOpen(true)
  }

  async function handleAdjustPoints() {
    if (!selectedUser) return

    const points = parseInt(pointsAdjustment)

    if (!pointsAdjustment || isNaN(points) || points === 0) {
      toast.error("请输入有效的积分调整值（正数为增加，负数为扣除）")
      return
    }

    if (!pointsReason.trim()) {
      toast.error("请填写调整原因")
      return
    }

    try {
      setProcessing(true)
      const result = await adjustUserPoints(selectedUser.id, points, pointsReason)

      if (!result.success) {
        throw new Error(result.error)
      }

      toast.success(
        `已${points > 0 ? "增加" : "扣除"}用户【${selectedUser.username}】${Math.abs(points)} 积分，当前积分：${result.newPoints}`
      )
      setPointsDialogOpen(false)
      setSelectedUser(null)
      setPointsAdjustment("")
      setPointsReason("")
      router.refresh()
      await loadUsers()
    } catch (error: any) {
      console.error("Error adjusting points:", error)
      toast.error(error.message || "调整积分失败")
    } finally {
      setProcessing(false)
    }
  }

  function handleCreateUserClick() {
    setNewUsername("")
    setNewEmail("")
    setNewPassword("")
    setRequireEmailVerification(false)
    setGenerateRandomPassword(false)
    setCreateDialogOpen(true)
  }

  function generatePassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
    let password = ""
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
  }

  useEffect(() => {
    if (generateRandomPassword) {
      setNewPassword(generatePassword())
    }
  }, [generateRandomPassword])

  async function handleCreateUser() {
    if (!newUsername.trim()) {
      toast.error("请输入用户名")
      return
    }

    if (!newEmail.trim()) {
      toast.error("请输入邮箱")
      return
    }

    if (!newPassword || newPassword.length < 6) {
      toast.error("密码长度至少为6位")
      return
    }

    try {
      setProcessing(true)

      const userData: CreateUserData = {
        username: newUsername.trim(),
        email: newEmail.trim(),
        password: newPassword,
        requireEmailVerification,
        generateRandomPassword,
      }

      const result = await createUser(userData)

      if (!result.success) {
        throw new Error(result.error)
      }

      toast.success(`用户【${newUsername}】创建成功！`)
      setCreateDialogOpen(false)
      setNewUsername("")
      setNewEmail("")
      setNewPassword("")
      setRequireEmailVerification(false)
      setGenerateRandomPassword(false)
      router.refresh()
      await loadUsers()
    } catch (error: any) {
      console.error("Error creating user:", error)
      toast.error(error.message || "创建用户失败")
    } finally {
      setProcessing(false)
    }
  }

  function handleBatchTransferClick() {
    setBatchTransferPoints("")
    setBatchTransferReason("")
    setBatchTransferTargetRole("all")
    setBatchTransferDate(new Date())
    setBatchTransferDialogOpen(true)
  }

  async function handleBatchTransfer() {
    const points = parseInt(batchTransferPoints)

    if (!batchTransferPoints || isNaN(points) || points <= 0) {
      toast.error("请输入有效的积分数量（必须为正数）")
      return
    }

    if (!batchTransferReason.trim()) {
      toast.error("请填写转账原因")
      return
    }

    if (!batchTransferDate) {
      toast.error("请选择活动日期")
      return
    }

    try {
      setProcessing(true)
      const result = await batchTransferPointsAction(points, batchTransferReason, batchTransferTargetRole, batchTransferDate)

      if (!result.success) {
        throw new Error(result.error)
      }

      toast.success(result.message || "批量转账成功")
      setBatchTransferDialogOpen(false)
      setBatchTransferPoints("")
      setBatchTransferReason("")
      setBatchTransferTargetRole("all")
      setBatchTransferDate(new Date())
      router.refresh()
      await loadUsers()
    } catch (error: any) {
      console.error("Error batch transferring points:", error)
      toast.error(error.message || "批量转账失败")
    } finally {
      setProcessing(false)
    }
  }

  // 批量修改用户信息
  function handleBatchUpdateClick() {
    setBatchUpdateDialogOpen(true)
  }

  async function handleBatchUpdate() {
    // 至少要提供一个修改项
    if (
      !batchUpdateAvatar &&
      !batchUpdateUsernamePrefix &&
      !batchUpdateUsernameSuffix &&
      !batchUpdateResetToUserNumber &&
      !batchUpdateFindText
    ) {
      toast.error("请至少提供一个修改项")
      return
    }

    // 如果选择查找替换，必须填写查找文本
    if (batchUpdateFindText && batchUpdateReplaceText === undefined) {
      toast.error("请填写替换文本（可以为空）")
      return
    }

    try {
      setProcessing(true)

      // 导入批量修改函数
      const { batchUpdateUsers } = await import("@/lib/actions/users")

      const result = await batchUpdateUsers({
        avatar: batchUpdateAvatar || undefined,
        usernamePrefix: batchUpdateUsernamePrefix || undefined,
        usernameSuffix: batchUpdateUsernameSuffix || undefined,
        resetToUserNumber: batchUpdateResetToUserNumber || undefined,
        usernameFormat: batchUpdateResetToUserNumber ? batchUpdateUsernameFormat : undefined,
        findText: batchUpdateFindText || undefined,
        replaceText: batchUpdateFindText ? batchUpdateReplaceText : undefined,
        filterKeyword: batchUpdateFilterKeyword || undefined,
        targetRole: batchUpdateTargetRole === "all" ? undefined : batchUpdateTargetRole,
      })

      if (!result.success) {
        throw new Error(result.error)
      }

      toast.success(result.message || "批量修改成功")
      setBatchUpdateDialogOpen(false)
      // 重置所有表单状态
      setBatchUpdateAvatar("")
      setBatchUpdateUsernamePrefix("")
      setBatchUpdateUsernameSuffix("")
      setBatchUpdateResetToUserNumber(false)
      setBatchUpdateUsernameFormat("用户{number}")
      setBatchUpdateFindText("")
      setBatchUpdateReplaceText("")
      setBatchUpdateFilterKeyword("")
      setBatchUpdateTargetRole("all")
      router.refresh()
      await loadUsers()
    } catch (error: any) {
      console.error("Error batch updating users:", error)
      toast.error(error.message || "批量修改失败")
    } finally {
      setProcessing(false)
    }
  }

  // 过滤用户列表
  const filteredUsers = users

  // 分页计算
  const totalPages = Math.ceil(filteredUsers.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const currentUsers = filteredUsers.slice(startIndex, endIndex)

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-3xl font-bold">用户管理</h1>
          <p className="text-muted-foreground mt-1">管理平台所有用户账户</p>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                总用户数
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                正常用户
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                封禁用户
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.banned}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                今日新增
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.newToday}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                商家用户
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.merchants}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                管理员
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{stats.admins}</div>
            </CardContent>
          </Card>
        </div>

        {/* 用户列表 */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <CardTitle>用户列表</CardTitle>
            </div>
            {/* 筛选和操作栏 */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">角色筛选:</span>
                  <Select value={filterRole} onValueChange={setFilterRole}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部</SelectItem>
                      <SelectItem value="user">普通用户</SelectItem>
                      <SelectItem value="merchant">商家</SelectItem>
                      <SelectItem value="admin">管理员</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">状态筛选:</span>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部</SelectItem>
                      <SelectItem value="active">正常</SelectItem>
                      <SelectItem value="banned">已封禁</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">搜索:</span>
                  <Input
                    placeholder="用户名、邮箱或编号(如1033)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-[220px]"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleBatchUpdateClick} variant="default" size="sm">
                  <User className="h-4 w-4 mr-2" />
                  批量修改
                </Button>
                <Button onClick={handleBatchTransferClick} variant="default" size="sm">
                  <Send className="h-4 w-4 mr-2" />
                  批量转账
                </Button>
                <Button onClick={handleCreateUserClick} variant="default" size="sm">
                  <UserPlus className="h-4 w-4 mr-2" />
                  添加用户
                </Button>
                <Button onClick={loadUsers} variant="outline" size="sm">
                  刷新数据
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">加载中...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">暂无用户</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>用户</TableHead>
                        <TableHead>用户编号</TableHead>
                        <TableHead>邮箱</TableHead>
                        <TableHead>角色</TableHead>
                        <TableHead>积分</TableHead>
                        <TableHead>商家数</TableHead>
                        <TableHead>举报次数</TableHead>
                        <TableHead>注册时间</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentUsers.map((user) => (
                        <TableRow key={user.id}>
                          {/* 用户列 */}
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={user.avatar || undefined} />
                                <AvatarFallback>{user.username[0]}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{user.username}</p>
                                <p className="text-xs text-muted-foreground font-mono break-all">
                                  ID: {user.id}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          {/* 用户编号列 */}
                          <TableCell>
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-primary/10 font-mono font-medium text-primary text-xs">
                              NO.{user.user_number}
                            </span>
                          </TableCell>
                          {/* 邮箱列 */}
                          <TableCell>
                            <p className="text-sm">{user.email}</p>
                          </TableCell>
                          {/* 角色列 */}
                          <TableCell>
                            {user.role === "admin" ? (
                              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
                                <ShieldCheck className="h-3 w-3 mr-1" />
                                管理员
                              </Badge>
                            ) : user.merchant_count > 0 ? (
                              <Badge variant="outline" className="border-purple-300 bg-purple-50 text-purple-700">
                                <Store className="h-3 w-3 mr-1" />
                                商家
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-gray-300 bg-gray-50 text-gray-700">
                                <User className="h-3 w-3 mr-1" />
                                用户
                              </Badge>
                            )}
                          </TableCell>
                          {/* 积分列 */}
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Coins className="h-4 w-4 text-yellow-600" />
                              <span className="font-medium">{user.points}</span>
                            </div>
                          </TableCell>
                          {/* 商家数列 */}
                          <TableCell>
                            <span className="text-sm">{user.merchant_count}</span>
                          </TableCell>
                          {/* 举报次数列 */}
                          <TableCell>
                            <span className="text-sm">{user.report_count}</span>
                          </TableCell>
                          {/* 注册时间列 */}
                          <TableCell>
                            <p className="text-sm whitespace-nowrap">
                              {new Date(user.created_at).toLocaleDateString("zh-CN")}
                            </p>
                          </TableCell>
                          {/* 状态列 */}
                          <TableCell>
                            {user.is_banned ? (
                              <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700">
                                <Ban className="h-3 w-3 mr-1" />
                                已封禁
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-green-300 bg-green-50 text-green-700">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                正常
                              </Badge>
                            )}
                          </TableCell>
                          {/* 操作列 */}
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleViewDetail(user)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {user.role !== "admin" && (
                                <>
                                  {user.is_banned ? (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                      onClick={() => handleUnbanClick(user)}
                                    >
                                      <UserCheck className="h-4 w-4" />
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => handleBanClick(user)}
                                    >
                                      <UserX className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                                    onClick={() => handlePointsClick(user)}
                                  >
                                    <Coins className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* 分页控件 */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      显示 {startIndex + 1} - {Math.min(endIndex, filteredUsers.length)} 条，共{" "}
                      {filteredUsers.length} 条
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        上一页
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className="w-9"
                          >
                            {page}
                          </Button>
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        下一页
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 详情对话框 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>用户详细信息</DialogTitle>
            <DialogDescription>查看用户的详细信息</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4 py-4">
              {/* 用户头像和基本信息 */}
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={selectedUser.avatar || undefined} />
                  <AvatarFallback className="text-2xl">{selectedUser.username[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-xl font-bold">{selectedUser.username}</h3>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>

              {/* 基本信息 */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">基本信息</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">用户ID (UUID)</Label>
                    <p className="font-mono text-xs bg-muted px-2 py-1 rounded break-all">
                      {selectedUser.id}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">会员编号</Label>
                    <span className="inline-flex items-center px-2.5 py-1 rounded bg-primary/10 font-mono font-medium text-primary">
                      NO.{selectedUser.user_number}
                    </span>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">角色</Label>
                    <p className="font-medium">
                      {selectedUser.role === "admin"
                        ? "管理员"
                        : selectedUser.merchant_count > 0
                          ? "商家"
                          : "普通用户"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">积分</Label>
                    <p className="font-medium">{selectedUser.points}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">账户状态</Label>
                    <p className="font-medium">
                      {selectedUser.is_banned ? "已封禁" : "正常"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">商家数量</Label>
                    <p className="font-medium">{selectedUser.merchant_count}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">举报次数</Label>
                    <p className="font-medium">{selectedUser.report_count}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">注册时间</Label>
                    <p className="font-medium">
                      {new Date(selectedUser.created_at).toLocaleString("zh-CN")}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">最后更新</Label>
                    <p className="font-medium">
                      {new Date(selectedUser.updated_at).toLocaleString("zh-CN")}
                    </p>
                  </div>
                </div>
              </div>

              {/* 封禁信息 */}
              {selectedUser.is_banned && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-red-700">封禁信息</h4>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
                    <div>
                      <Label className="text-muted-foreground">封禁时间</Label>
                      <p className="font-medium">
                        {selectedUser.banned_at
                          ? new Date(selectedUser.banned_at).toLocaleString("zh-CN")
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">封禁原因</Label>
                      <p className="font-medium whitespace-pre-wrap">
                        {selectedUser.banned_reason || "-"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              关闭
            </Button>
            {selectedUser && selectedUser.role !== "admin" && (
              <>
                {selectedUser.is_banned ? (
                  <Button
                    variant="outline"
                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => {
                      setDetailDialogOpen(false)
                      handleUnbanClick(selectedUser)
                    }}
                  >
                    <UserCheck className="h-4 w-4 mr-1" />
                    解封用户
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => {
                      setDetailDialogOpen(false)
                      handleBanClick(selectedUser)
                    }}
                  >
                    <UserX className="h-4 w-4 mr-1" />
                    封禁用户
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                  onClick={() => {
                    setDetailDialogOpen(false)
                    handlePointsClick(selectedUser)
                  }}
                >
                  <Coins className="h-4 w-4 mr-1" />
                  调整积分
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 封禁对话框 */}
      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>封禁用户</DialogTitle>
            <DialogDescription>
              封禁用户【{selectedUser?.username}】，请填写封禁原因
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ban-reason">
                封禁原因 <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="ban-reason"
                placeholder="请详细说明封禁原因，用户将会在通知中看到"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                rows={4}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanDialogOpen(false)} disabled={processing}>
              取消
            </Button>
            <Button
              onClick={handleBan}
              disabled={processing || !banReason.trim()}
              variant="destructive"
            >
              {processing ? "处理中..." : "确认封禁"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 解封对话框 */}
      <Dialog open={unbanDialogOpen} onOpenChange={setUnbanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>解封用户</DialogTitle>
            <DialogDescription>
              确认解封用户【{selectedUser?.username}】?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="unban-note">备注（可选）</Label>
              <Textarea
                id="unban-note"
                placeholder="可以添加一些备注信息，用户将会在通知中看到"
                value={unbanNote}
                onChange={(e) => setUnbanNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUnbanDialogOpen(false)}
              disabled={processing}
            >
              取消
            </Button>
            <Button
              onClick={handleUnban}
              disabled={processing}
              className="bg-green-600 hover:bg-green-700"
            >
              {processing ? "处理中..." : "确认解封"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 调整积分对话框 */}
      <Dialog open={pointsDialogOpen} onOpenChange={setPointsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>调整积分</DialogTitle>
            <DialogDescription>
              为用户【{selectedUser?.username}】调整积分
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedUser && (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900">
                    当前积分：<span className="font-bold text-lg">{selectedUser.points}</span>
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="points-adjustment">
                    调整积分 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="points-adjustment"
                    type="number"
                    placeholder="正数为增加，负数为扣除"
                    value={pointsAdjustment}
                    onChange={(e) => setPointsAdjustment(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    例如：输入 10 为增加10积分，输入 -10 为扣除10积分
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="points-reason">
                    调整原因 <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="points-reason"
                    placeholder="请说明调整原因，用户将会在通知中看到"
                    value={pointsReason}
                    onChange={(e) => setPointsReason(e.target.value)}
                    rows={3}
                    required
                  />
                </div>
                {pointsAdjustment && !isNaN(parseInt(pointsAdjustment)) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-amber-900">
                      调整后积分：
                      <span className="ml-2 text-lg font-bold">
                        {Math.max(0, selectedUser.points + parseInt(pointsAdjustment))}
                      </span>
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPointsDialogOpen(false)}
              disabled={processing}
            >
              取消
            </Button>
            <Button
              onClick={handleAdjustPoints}
              disabled={
                processing ||
                !pointsAdjustment ||
                isNaN(parseInt(pointsAdjustment)) ||
                parseInt(pointsAdjustment) === 0 ||
                !pointsReason.trim()
              }
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              {processing ? "处理中..." : "确认调整"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 创建用户对话框 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加新用户</DialogTitle>
            <DialogDescription>
              手动创建新用户账户，可选择是否需要邮箱验证
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-username">
                用户名 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="new-username"
                placeholder="请输入用户名"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-email">
                邮箱 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="new-email"
                type="email"
                placeholder="user@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">
                密码 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="new-password"
                type="text"
                placeholder="至少6位字符"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={generateRandomPassword}
                required
              />
              <p className="text-xs text-muted-foreground">
                密码长度至少为6位
              </p>
            </div>
            <div className="space-y-3 border-t pt-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="generate-password">生成随机密码</Label>
                  <p className="text-xs text-muted-foreground">
                    自动生成12位安全密码
                  </p>
                </div>
                <input
                  id="generate-password"
                  type="checkbox"
                  checked={generateRandomPassword}
                  onChange={(e) => setGenerateRandomPassword(e.target.checked)}
                  className="h-4 w-4"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="require-verification">需要邮箱验证</Label>
                  <p className="text-xs text-muted-foreground">
                    用户需要验证邮箱才能登录
                  </p>
                </div>
                <input
                  id="require-verification"
                  type="checkbox"
                  checked={requireEmailVerification}
                  onChange={(e) => setRequireEmailVerification(e.target.checked)}
                  className="h-4 w-4"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={processing}
            >
              取消
            </Button>
            <Button
              onClick={handleCreateUser}
              disabled={
                processing ||
                !newUsername.trim() ||
                !newEmail.trim() ||
                !newPassword ||
                newPassword.length < 6
              }
            >
              {processing ? "创建中..." : "添加用户"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量转账对话框 */}
      <Dialog open={batchTransferDialogOpen} onOpenChange={setBatchTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量转账积分</DialogTitle>
            <DialogDescription>
              给所有符合条件的用户批量发放积分，适用于平台活动日或纪念日奖励
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="batch-transfer-target">
                转账对象 <span className="text-red-500">*</span>
              </Label>
              <Select value={batchTransferTargetRole} onValueChange={setBatchTransferTargetRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有用户（排除管理员和已封禁用户）</SelectItem>
                  <SelectItem value="user">仅普通用户</SelectItem>
                  <SelectItem value="merchant">仅商家用户</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                选择要发放积分的用户群体
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-transfer-date">
                活动日期 <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="batch-transfer-date"
                      variant="outline"
                      className={cn(
                        "flex-1 justify-start text-left font-normal",
                        !batchTransferDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {batchTransferDate ? (
                        format(batchTransferDate, "yyyy年MM月dd日", { locale: zhCN })
                      ) : (
                        <span>选择日期</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={batchTransferDate}
                      onSelect={setBatchTransferDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <div className="flex gap-1 items-center">
                  <Input
                    type="number"
                    min="0"
                    max="23"
                    placeholder="时"
                    value={batchTransferDate ? batchTransferDate.getHours() : 0}
                    onChange={(e) => {
                      const hours = parseInt(e.target.value) || 0
                      if (batchTransferDate) {
                        const newDate = new Date(batchTransferDate)
                        newDate.setHours(Math.min(23, Math.max(0, hours)))
                        setBatchTransferDate(newDate)
                      }
                    }}
                    className="w-16 text-center"
                  />
                  <span className="text-muted-foreground">:</span>
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    placeholder="分"
                    value={batchTransferDate ? batchTransferDate.getMinutes() : 0}
                    onChange={(e) => {
                      const minutes = parseInt(e.target.value) || 0
                      if (batchTransferDate) {
                        const newDate = new Date(batchTransferDate)
                        newDate.setMinutes(Math.min(59, Math.max(0, minutes)))
                        setBatchTransferDate(newDate)
                      }
                    }}
                    className="w-16 text-center"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                选择此次积分发放对应的活动日期或纪念日
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-transfer-points">
                发放积分 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="batch-transfer-points"
                type="number"
                placeholder="请输入要发放的积分数量"
                value={batchTransferPoints}
                onChange={(e) => setBatchTransferPoints(e.target.value)}
                required
                min="1"
              />
              <p className="text-xs text-muted-foreground">
                每位用户将获得相同数量的积分（必须为正数）
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-transfer-reason">
                转账原因 <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="batch-transfer-reason"
                placeholder="例如：平台周年庆活动奖励、春节红包等，用户将在通知中看到此内容"
                value={batchTransferReason}
                onChange={(e) => setBatchTransferReason(e.target.value)}
                rows={4}
                required
              />
            </div>
            {batchTransferPoints && !isNaN(parseInt(batchTransferPoints)) && parseInt(batchTransferPoints) > 0 && batchTransferDate && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <span className="font-semibold">预计影响：</span>
                  将给{" "}
                  <span className="font-bold">
                    {batchTransferTargetRole === "all"
                      ? "所有正常用户"
                      : batchTransferTargetRole === "merchant"
                        ? "所有商家用户"
                        : "所有普通用户"}
                  </span>
                  （排除管理员和已封禁用户）发放{" "}
                  <span className="font-bold text-lg">{batchTransferPoints}</span> 积分。
                  <br />
                  活动日期：<span className="font-bold">{format(batchTransferDate, "yyyy年MM月dd日 HH:mm", { locale: zhCN })}</span>
                  <br />
                  {batchTransferDate.getTime() > new Date().getTime() + 60000 ? (
                    <span className="text-orange-700 font-medium">
                      ⏰ 将在指定时间自动执行（定时任务）
                    </span>
                  ) : (
                    <span className="text-green-700 font-medium">
                      ⚡ 确认后立即执行
                    </span>
                  )}
                  <br />
                  所有用户将收到系统通知。
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBatchTransferDialogOpen(false)}
              disabled={processing}
            >
              取消
            </Button>
            <Button
              onClick={handleBatchTransfer}
              disabled={
                processing ||
                !batchTransferPoints ||
                isNaN(parseInt(batchTransferPoints)) ||
                parseInt(batchTransferPoints) <= 0 ||
                !batchTransferReason.trim() ||
                !batchTransferDate
              }
              className="bg-blue-600 hover:bg-blue-700"
            >
              {processing ? "处理中..." : "确认转账"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量修改用户信息对话框 */}
      <Dialog open={batchUpdateDialogOpen} onOpenChange={setBatchUpdateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>批量修改用户信息</DialogTitle>
            <DialogDescription>
              支持多种批量修改方式，至少选择一项进行修改
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* 修改对象 */}
            <div className="space-y-2">
              <Label htmlFor="batch-update-target">
                修改对象 <span className="text-red-500">*</span>
              </Label>
              <Select value={batchUpdateTargetRole} onValueChange={setBatchUpdateTargetRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有用户（排除管理员）</SelectItem>
                  <SelectItem value="user">仅普通用户</SelectItem>
                  <SelectItem value="merchant">仅商家用户</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                选择要修改信息的用户群体
              </p>
            </div>

            {/* 关键词筛选 */}
            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="batch-update-filter">
                🔍 关键词筛选（可选）
              </Label>
              <Input
                id="batch-update-filter"
                placeholder="输入关键词，只修改用户名包含此关键词的用户（如：测试）"
                value={batchUpdateFilterKeyword}
                onChange={(e) => setBatchUpdateFilterKeyword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                例如：输入"测试"，将只修改用户名包含"测试"的用户
              </p>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-4">修改方式（选择一种，优先级从上到下）</h4>

              <div className="space-y-6">
                {/* 方案1: 重置为用户编号 */}
                <div className="border rounded-lg p-4 space-y-3 bg-blue-50/30">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="reset-to-user-number"
                      checked={batchUpdateResetToUserNumber}
                      onCheckedChange={(checked) => {
                        setBatchUpdateResetToUserNumber(!!checked)
                        if (checked) {
                          // 清空其他选项
                          setBatchUpdateFindText("")
                          setBatchUpdateReplaceText("")
                          setBatchUpdateUsernamePrefix("")
                          setBatchUpdateUsernameSuffix("")
                        }
                      }}
                    />
                    <div className="flex-1">
                      <Label htmlFor="reset-to-user-number" className="cursor-pointer font-semibold">
                        ⭐ 重置为用户编号格式（推荐）
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        将用户名统一重置为指定格式，使用{`{number}`}表示用户编号
                      </p>
                    </div>
                  </div>
                  {batchUpdateResetToUserNumber && (
                    <div className="ml-6 space-y-2">
                      <Input
                        placeholder="用户{number}"
                        value={batchUpdateUsernameFormat}
                        onChange={(e) => setBatchUpdateUsernameFormat(e.target.value)}
                      />
                      <p className="text-xs text-green-600">
                        预览：用户编号2570 → {batchUpdateUsernameFormat.replace("{number}", "2570")}
                      </p>
                    </div>
                  )}
                </div>

                {/* 方案2: 查找替换 */}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="find-replace"
                      checked={!!batchUpdateFindText}
                      onCheckedChange={(checked) => {
                        if (!checked) {
                          setBatchUpdateFindText("")
                          setBatchUpdateReplaceText("")
                        }
                      }}
                    />
                    <div className="flex-1">
                      <Label htmlFor="find-replace" className="cursor-pointer font-semibold">
                        🔄 查找替换
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        查找用户名中的特定文本并替换为新文本
                      </p>
                    </div>
                  </div>
                  {(batchUpdateFindText || (!batchUpdateResetToUserNumber && !batchUpdateUsernamePrefix && !batchUpdateUsernameSuffix)) && (
                    <div className="ml-6 space-y-2">
                      <Input
                        placeholder="查找文本（如：测试）"
                        value={batchUpdateFindText}
                        onChange={(e) => {
                          setBatchUpdateFindText(e.target.value)
                          if (e.target.value) {
                            setBatchUpdateResetToUserNumber(false)
                            setBatchUpdateUsernamePrefix("")
                            setBatchUpdateUsernameSuffix("")
                          }
                        }}
                      />
                      <Input
                        placeholder="替换为（如：玩家，留空表示删除）"
                        value={batchUpdateReplaceText}
                        onChange={(e) => setBatchUpdateReplaceText(e.target.value)}
                      />
                      {batchUpdateFindText && (
                        <p className="text-xs text-green-600">
                          预览："测试01" → "{`测试01`.replace(new RegExp(batchUpdateFindText, 'g'), batchUpdateReplaceText || "")}"
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* 方案3: 添加前缀后缀 */}
                <div className="border rounded-lg p-4 space-y-3">
                  <Label className="font-semibold">➕ 添加前缀/后缀</Label>
                  <p className="text-xs text-muted-foreground">
                    在原用户名前面或后面添加文本
                  </p>
                  <div className="ml-6 space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="batch-update-username-prefix">前缀</Label>
                      <Input
                        id="batch-update-username-prefix"
                        placeholder="例如：VIP_"
                        value={batchUpdateUsernamePrefix}
                        onChange={(e) => {
                          setBatchUpdateUsernamePrefix(e.target.value)
                          if (e.target.value) {
                            setBatchUpdateResetToUserNumber(false)
                            setBatchUpdateFindText("")
                            setBatchUpdateReplaceText("")
                          }
                        }}
                        maxLength={20}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="batch-update-username-suffix">后缀</Label>
                      <Input
                        id="batch-update-username-suffix"
                        placeholder="例如：_2024"
                        value={batchUpdateUsernameSuffix}
                        onChange={(e) => {
                          setBatchUpdateUsernameSuffix(e.target.value)
                          if (e.target.value) {
                            setBatchUpdateResetToUserNumber(false)
                            setBatchUpdateFindText("")
                            setBatchUpdateReplaceText("")
                          }
                        }}
                        maxLength={20}
                      />
                    </div>
                    {(batchUpdateUsernamePrefix || batchUpdateUsernameSuffix) && (
                      <p className="text-xs text-green-600">
                        预览：张三 → {batchUpdateUsernamePrefix}张三{batchUpdateUsernameSuffix}
                      </p>
                    )}
                  </div>
                </div>

                {/* 头像修改 */}
                <div className="border rounded-lg p-4 space-y-3 bg-gray-50/30">
                  <Label htmlFor="batch-update-avatar" className="font-semibold">
                    🖼️ 修改头像
                  </Label>
                  <Input
                    id="batch-update-avatar"
                    placeholder="输入新的头像图片URL"
                    value={batchUpdateAvatar}
                    onChange={(e) => setBatchUpdateAvatar(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    所有符合条件的用户头像将被修改为此图片
                  </p>
                </div>
              </div>
            </div>

            {/* 警告提示 */}
            {(batchUpdateAvatar || batchUpdateUsernamePrefix || batchUpdateUsernameSuffix || batchUpdateResetToUserNumber || batchUpdateFindText) && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm text-orange-900">
                  <span className="font-semibold">⚠️ 操作预览：</span>
                  <br />
                  将批量修改{" "}
                  <span className="font-bold">
                    {batchUpdateTargetRole === "all"
                      ? "所有用户"
                      : batchUpdateTargetRole === "merchant"
                        ? "所有商家用户"
                        : "所有普通用户"}
                  </span>
                  {batchUpdateFilterKeyword && (
                    <>（仅用户名包含"{batchUpdateFilterKeyword}"的用户）</>
                  )}
                  （排除管理员）
                  <br />
                  {batchUpdateResetToUserNumber && (
                    <>
                      • 用户名将重置为：<span className="font-bold">{batchUpdateUsernameFormat}</span>
                      <br />
                    </>
                  )}
                  {batchUpdateFindText && (
                    <>
                      • 查找"{batchUpdateFindText}"替换为"{batchUpdateReplaceText || "(删除)"}"
                      <br />
                    </>
                  )}
                  {batchUpdateUsernamePrefix && (
                    <>
                      • 添加前缀：<span className="font-bold">{batchUpdateUsernamePrefix}</span>
                      <br />
                    </>
                  )}
                  {batchUpdateUsernameSuffix && (
                    <>
                      • 添加后缀：<span className="font-bold">{batchUpdateUsernameSuffix}</span>
                      <br />
                    </>
                  )}
                  {batchUpdateAvatar && (
                    <>
                      • 修改头像为指定URL
                      <br />
                    </>
                  )}
                  <span className="text-red-600 font-medium">操作不可撤销，请谨慎确认！</span>
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBatchUpdateDialogOpen(false)}
              disabled={processing}
            >
              取消
            </Button>
            <Button
              onClick={handleBatchUpdate}
              disabled={
                processing ||
                (
                  !batchUpdateAvatar &&
                  !batchUpdateUsernamePrefix &&
                  !batchUpdateUsernameSuffix &&
                  !batchUpdateResetToUserNumber &&
                  !batchUpdateFindText
                )
              }
              className="bg-orange-600 hover:bg-orange-700"
            >
              {processing ? "处理中..." : "确认修改"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}

