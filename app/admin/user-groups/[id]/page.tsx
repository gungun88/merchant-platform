'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AdminLayout } from '@/components/admin-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Users, Settings, History } from 'lucide-react'
import { getUserGroups } from '@/lib/actions/user-groups'
import { MembersTab } from './members-tab'
import { RewardRuleTab } from './reward-rule-tab'
import { HistoryTab } from './history-tab'
import { toast } from 'sonner'

export default function GroupDetailPage() {
  const params = useParams()
  const router = useRouter()
  const groupId = params.id as string

  const [group, setGroup] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('members')

  const loadGroup = async () => {
    try {
      setLoading(true)
      const groups = await getUserGroups()
      const found = groups.find((g) => g.id === groupId)
      if (!found) {
        toast.error('用户组不存在')
        router.push('/admin/user-groups')
        return
      }
      setGroup(found)
    } catch (error: any) {
      toast.error('加载失败', { description: error.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGroup()
  }, [groupId])

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">加载中...</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (!group) {
    return null
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{group.name}</h1>
            {group.description && (
              <p className="text-muted-foreground mt-2">{group.description}</p>
            )}
          </div>
        </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="members">
            <Users className="mr-2 h-4 w-4" />
            成员管理
          </TabsTrigger>
          <TabsTrigger value="rule">
            <Settings className="mr-2 h-4 w-4" />
            发放规则
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="mr-2 h-4 w-4" />
            发放历史
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <MembersTab groupId={groupId} onUpdate={loadGroup} />
        </TabsContent>

        <TabsContent value="rule">
          <RewardRuleTab groupId={groupId} onUpdate={loadGroup} />
        </TabsContent>

        <TabsContent value="history">
          <HistoryTab groupId={groupId} />
        </TabsContent>
      </Tabs>
    </div>
    </AdminLayout>
  )
}
