"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AdminLayout } from "@/components/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  ShieldCheck,
  UserX,
  UserPlus,
  Shield,
} from "lucide-react"
import { toast } from "sonner"
import {
  getAdmins,
  promoteToAdmin,
  revokeAdmin,
  type PromoteToAdminData,
} from "@/lib/actions/users"

interface AdminProfile {
  id: string
  username: string
  email: string
  avatar: string | null
  role: string
  points: number
  created_at: string
  updated_at: string
}

export default function AdminsPage() {
  const router = useRouter()
  const [admins, setAdmins] = useState<AdminProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  // 对话框状态
  const [promoteDialogOpen, setPromoteDialogOpen] = useState(false)
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false)
  const [selectedAdmin, setSelectedAdmin] = useState<AdminProfile | null>(null)

  // 表单状态
  const [promoteUserId, setPromoteUserId] = useState("")
  const [promoteReason, setPromoteReason] = useState("")
  const [revokeReason, setRevokeReason] = useState("")

  // 加载管理员列表
  useEffect(() => {
    loadAdmins()
  }, [])

  async function loadAdmins() {
    try {
      setLoading(true)
      const result = await getAdmins()

      if (!result.success) {
        throw new Error(result.error)
      }

      setAdmins(result.data)
    } catch (error: any) {
      console.error("Error loading admins:", error)
      toast.error(error.message || "加载管理员列表失败")
    } finally {
      setLoading(false)
    }
  }

  function handlePromoteClick() {
    setPromoteUserId("")
    setPromoteReason("")
    setPromoteDialogOpen(true)
  }

  async function handlePromote() {
    if (!promoteUserId.trim()) {
      toast.error("请输入用户ID、用户名或邮箱")
      return
    }

    try {
      setProcessing(true)
      const data: PromoteToAdminData = {
        userIdentifier: promoteUserId.trim(),
        reason: promoteReason.trim() || undefined,
      }

      const result = await promoteToAdmin(data)

      if (!result.success) {
        throw new Error(result.error)
      }

      toast.success(`成功提升【${result.username || promoteUserId}】为管理员`)
      setPromoteDialogOpen(false)
      setPromoteUserId("")
      setPromoteReason("")
      router.refresh()
      await loadAdmins()
    } catch (error: any) {
      console.error("Error promoting to admin:", error)
      toast.error(error.message || "提升管理员失败")
    } finally {
      setProcessing(false)
    }
  }

  function handleRevokeClick(admin: AdminProfile) {
    setSelectedAdmin(admin)
    setRevokeReason("")
    setRevokeDialogOpen(true)
  }

  async function handleRevoke() {
    if (!selectedAdmin) return

    try {
      setProcessing(true)
      const result = await revokeAdmin(selectedAdmin.id, revokeReason.trim() || undefined)

      if (!result.success) {
        throw new Error(result.error)
      }

      toast.success(`已撤销【${selectedAdmin.username}】的管理员权限`)
      setRevokeDialogOpen(false)
      setSelectedAdmin(null)
      setRevokeReason("")
      router.refresh()
      await loadAdmins()
    } catch (error: any) {
      console.error("Error revoking admin:", error)
      toast.error(error.message || "撤销管理员权限失败")
    } finally {
      setProcessing(false)
    }
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-3xl font-bold">管理员管理</h1>
          <p className="text-muted-foreground mt-1">管理平台管理员账户</p>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                管理员总数
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{admins.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* 管理员列表 */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <CardTitle>管理员列表</CardTitle>
              <div className="flex gap-2">
                <Button onClick={handlePromoteClick} variant="default" size="sm">
                  <UserPlus className="h-4 w-4 mr-2" />
                  提升用户为管理员
                </Button>
                <Button onClick={loadAdmins} variant="outline" size="sm">
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
            ) : admins.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">暂无管理员</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>管理员</TableHead>
                      <TableHead>邮箱</TableHead>
                      <TableHead>积分</TableHead>
                      <TableHead>加入时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {admins.map((admin) => (
                      <TableRow key={admin.id}>
                        {/* 管理员列 */}
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={admin.avatar || undefined} />
                              <AvatarFallback>{admin.username[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium flex items-center gap-2">
                                {admin.username}
                                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
                                  <ShieldCheck className="h-3 w-3 mr-1" />
                                  管理员
                                </Badge>
                              </p>
                              <p className="text-xs text-muted-foreground font-mono break-all">
                                ID: {admin.id}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        {/* 邮箱列 */}
                        <TableCell>
                          <p className="text-sm">{admin.email}</p>
                        </TableCell>
                        {/* 积分列 */}
                        <TableCell>
                          <span className="font-medium">{admin.points}</span>
                        </TableCell>
                        {/* 加入时间列 */}
                        <TableCell>
                          <p className="text-sm whitespace-nowrap">
                            {new Date(admin.created_at).toLocaleDateString("zh-CN")}
                          </p>
                        </TableCell>
                        {/* 操作列 */}
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleRevokeClick(admin)}
                            >
                              <UserX className="h-4 w-4 mr-1" />
                              撤销权限
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 提升为管理员对话框 */}
      <Dialog open={promoteDialogOpen} onOpenChange={setPromoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>提升用户为管理员</DialogTitle>
            <DialogDescription>
              将普通用户提升为管理员，该用户将获得管理后台的访问权限
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="promote-user-id">
                用户标识 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="promote-user-id"
                placeholder="请输入用户ID、用户名或邮箱"
                value={promoteUserId}
                onChange={(e) => setPromoteUserId(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                支持输入: 完整的用户ID、用户名(如 plum9407)或邮箱
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="promote-reason">原因（可选）</Label>
              <Textarea
                id="promote-reason"
                placeholder="提升原因，用户将在通知中看到"
                value={promoteReason}
                onChange={(e) => setPromoteReason(e.target.value)}
                rows={3}
              />
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Shield className="h-5 w-5 text-amber-600 mt-0.5" />
                <div className="text-sm text-amber-900">
                  <p className="font-semibold mb-1">注意事项</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>管理员拥有平台的所有管理权限</li>
                    <li>请谨慎选择可信任的用户</li>
                    <li>用户将收到系统通知</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPromoteDialogOpen(false)}
              disabled={processing}
            >
              取消
            </Button>
            <Button
              onClick={handlePromote}
              disabled={processing || !promoteUserId.trim()}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {processing ? "处理中..." : "确认提升"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 撤销管理员对话框 */}
      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>撤销管理员权限</DialogTitle>
            <DialogDescription>
              撤销【{selectedAdmin?.username}】的管理员权限，该用户将恢复为普通用户
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="revoke-reason">撤销原因（可选）</Label>
              <Textarea
                id="revoke-reason"
                placeholder="撤销原因，用户将在通知中看到"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                rows={3}
              />
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-900">
                <span className="font-semibold">警告：</span>
                撤销后，该用户将无法访问管理后台，所有管理权限将被移除。
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRevokeDialogOpen(false)}
              disabled={processing}
            >
              取消
            </Button>
            <Button
              onClick={handleRevoke}
              disabled={processing}
              variant="destructive"
            >
              {processing ? "处理中..." : "确认撤销"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
