'use client'

import { useState, useEffect } from 'react'
import { AdminLayout } from '@/components/admin-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Users, Settings, Calendar, TrendingUp } from 'lucide-react'
import { getAllGroupsWithRules } from '@/lib/actions/user-groups'
import { CreateGroupDialog } from './create-group-dialog'
import { GroupCard } from './group-card'
import { toast } from 'sonner'

export default function UserGroupsPage() {
  const [groups, setGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [stats, setStats] = useState({
    totalGroups: 0,
    totalMembers: 0,
    activeRules: 0
  })

  const loadGroups = async () => {
    try {
      setLoading(true)
      const data = await getAllGroupsWithRules()
      setGroups(data)

      // 计算统计数据
      const totalMembers = data.reduce((sum: number, group: any) => {
        return sum + (group.user_group_members?.[0]?.count || 0)
      }, 0)
      const activeRules = data.filter((group: any) =>
        group.group_reward_rules?.[0]?.is_active
      ).length

      setStats({
        totalGroups: data.length,
        totalMembers,
        activeRules
      })
    } catch (error: any) {
      toast.error('加载失败', { description: error.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGroups()
  }, [])

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">用户组管理</h1>
            <p className="text-muted-foreground mt-2">
              创建用户组并设置定期积分发放规则
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            创建用户组
          </Button>
        </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">用户组总数</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalGroups}</div>
            <p className="text-xs text-muted-foreground">
              已创建的用户组数量
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">成员总数</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMembers}</div>
            <p className="text-xs text-muted-foreground">
              所有用户组的成员总和
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">启用的规则</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeRules}</div>
            <p className="text-xs text-muted-foreground">
              正在运行的发放规则
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Groups List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">加载中...</p>
          </div>
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">还没有用户组</h3>
            <p className="text-muted-foreground text-center mb-4">
              创建第一个用户组,开始管理定期积分发放
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              创建用户组
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              onUpdate={loadGroups}
            />
          ))}
        </div>
      )}

      {/* Create Group Dialog */}
      <CreateGroupDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={loadGroups}
      />
    </div>
    </AdminLayout>
  )
}
