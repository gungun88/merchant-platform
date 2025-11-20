"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Copy, Users, Gift, Clock, CheckCircle, ArrowLeft } from "lucide-react"
import { getUserInvitationCode, getInvitationStats } from "@/lib/actions/invitation"
import { getSystemSettings } from "@/lib/actions/settings"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function InvitationsPage() {
  const router = useRouter()
  const [invitationCode, setInvitationCode] = useState<string>("")
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [systemSettings, setSystemSettings] = useState<any>(null)

  useEffect(() => {
    async function loadData() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/auth/register")
        return
      }

      setCurrentUserId(user.id)

      try {
        // 自动获取或生成邀请码
        const code = await getUserInvitationCode()
        setInvitationCode(code)

        // 获取统计数据
        const statsData = await getInvitationStats()
        setStats(statsData)

        // 加载系统设置
        const settingsResult = await getSystemSettings()
        if (settingsResult.success && settingsResult.data) {
          setSystemSettings(settingsResult.data)
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "加载失败")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  const handleCopyLink = () => {
    const invitationUrl = `${window.location.origin}/auth/register?invitation_code=${invitationCode}`
    navigator.clipboard.writeText(invitationUrl)
    toast.success("邀请链接已复制到剪贴板")
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(invitationCode)
    toast.success("邀请码已复制到剪贴板")
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回首页
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">邀请好友</h1>
          <p className="text-muted-foreground mt-2">邀请好友注册，双方各得{systemSettings?.invitation_points || 100}积分奖励</p>
        </div>

        <div className="space-y-6">

          {/* 邀请次数限制提示 */}
          {stats && (
            <Alert className={stats.remainingInvitations > 0 ? "bg-blue-50 border-blue-200" : "bg-orange-50 border-orange-200"}>
              <Gift className={`h-4 w-4 ${stats.remainingInvitations > 0 ? "text-blue-600" : "text-orange-600"}`} />
              <AlertDescription className={stats.remainingInvitations > 0 ? "text-blue-700" : "text-orange-700"}>
                {stats.remainingInvitations > 0 ? (
                  <>您当前还可以邀请 <strong className="text-lg">{stats.remainingInvitations}</strong> 位好友（已使用 {stats.usedInvitations}/{stats.maxInvitations}）</>
                ) : (
                  <>您的邀请次数已用完（{stats.usedInvitations}/{stats.maxInvitations}），如需更多邀请机会请联系管理员</>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* 统计卡片 */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-2 text-center md:text-left">
                  <p className="text-xs md:text-sm text-muted-foreground">剩余次数</p>
                  <div className="flex items-center justify-center md:justify-start gap-2">
                    <p className="text-xl md:text-2xl font-bold">{stats?.remainingInvitations || 0}</p>
                    <Gift className="h-6 w-6 md:h-8 md:w-8 text-orange-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-2 text-center md:text-left">
                  <p className="text-xs md:text-sm text-muted-foreground">总邀请数</p>
                  <div className="flex items-center justify-center md:justify-start gap-2">
                    <p className="text-xl md:text-2xl font-bold">{stats?.total || 0}</p>
                    <Users className="h-6 w-6 md:h-8 md:w-8 text-blue-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-2 text-center md:text-left">
                  <p className="text-xs md:text-sm text-muted-foreground">已完成</p>
                  <div className="flex items-center justify-center md:justify-start gap-2">
                    <p className="text-xl md:text-2xl font-bold">{stats?.completed || 0}</p>
                    <CheckCircle className="h-6 w-6 md:h-8 md:w-8 text-green-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-2 text-center md:text-left">
                  <p className="text-xs md:text-sm text-muted-foreground">待完成</p>
                  <div className="flex items-center justify-center md:justify-start gap-2">
                    <p className="text-xl md:text-2xl font-bold">{stats?.pending || 0}</p>
                    <Clock className="h-6 w-6 md:h-8 md:w-8 text-yellow-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-2 text-center md:text-left">
                  <p className="text-xs md:text-sm text-muted-foreground">总奖励</p>
                  <div className="flex items-center justify-center md:justify-start gap-2">
                    <p className="text-xl md:text-2xl font-bold">{stats?.totalRewards || 0}</p>
                    <Gift className="h-6 w-6 md:h-8 md:w-8 text-purple-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 邀请链接卡片 */}
          <Card>
            <CardHeader>
              <CardTitle>我的邀请码</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <div className="flex items-center gap-2">
                  <Gift className="h-4 w-4 flex-shrink-0" />
                  <AlertDescription className="mb-0">
                    分享您的邀请码或邀请链接给好友，好友注册成功后,您和好友都将获得 <strong>{systemSettings?.invitation_points || 100}积分</strong> 奖励
                  </AlertDescription>
                </div>
              </Alert>

              {invitationCode && (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">邀请码</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="flex-1 px-3 md:px-4 py-2 md:py-3 bg-muted rounded-lg font-mono text-sm md:text-lg font-bold overflow-x-auto">
                        {invitationCode}
                      </div>
                      <Button onClick={handleCopyCode} variant="outline" className="sm:whitespace-nowrap">
                        <Copy className="h-4 w-4 mr-2" />
                        复制
                      </Button>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-2">邀请链接</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="flex-1 px-3 md:px-4 py-2 md:py-3 bg-muted rounded-lg text-xs md:text-sm truncate">
                        {`${typeof window !== "undefined" ? window.location.origin : ""}/auth/register?invitation_code=${invitationCode}`}
                      </div>
                      <Button onClick={handleCopyLink} className="sm:whitespace-nowrap">
                        <Copy className="h-4 w-4 mr-2" />
                        复制链接
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 邀请记录 */}
          <Card>
            <CardHeader>
              <CardTitle>邀请记录</CardTitle>
            </CardHeader>
            <CardContent>
              {!stats?.invitations || stats.invitations.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">暂无邀请记录</p>
                  <p className="text-sm text-muted-foreground mt-2">快去邀请好友吧！</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>被邀请人</TableHead>
                        <TableHead>注册时间</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead className="text-right">获得积分</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.invitations.map((invitation: any) => (
                        <TableRow key={invitation.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              {invitation.profiles ? (
                                <>
                                  <span className="font-medium">{invitation.profiles.username || "未设置"}</span>
                                  <span className="text-sm text-muted-foreground">{invitation.profiles.email}</span>
                                </>
                              ) : (
                                <span className="text-muted-foreground">待注册</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {invitation.completed_at ? formatDate(invitation.completed_at) : "-"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                invitation.status === "completed"
                                  ? "default"
                                  : invitation.status === "pending"
                                    ? "secondary"
                                    : "destructive"
                              }
                            >
                              {invitation.status === "completed"
                                ? "已完成"
                                : invitation.status === "pending"
                                  ? "待完成"
                                  : "已过期"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {invitation.status === "completed" ? (
                              <span className="font-semibold text-green-600">+{systemSettings?.invitation_points || 100}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
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
      </div>
    </div>
  )
}
