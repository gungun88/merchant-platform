'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Coins, User, TrendingUp } from 'lucide-react'
import { getGroupRewardLogs, getGroupRewardStats } from '@/lib/actions/user-groups'
import { toast } from 'sonner'

interface HistoryTabProps {
  groupId: string
}

export function HistoryTab({ groupId }: HistoryTabProps) {
  const [logs, setLogs] = useState<any[]>([])
  const [stats, setStats] = useState({ totalRewards: 0, totalCoins: 0, memberCount: 0 })
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      setLoading(true)
      const [logsData, statsData] = await Promise.all([
        getGroupRewardLogs({ groupId, limit: 50 }),
        getGroupRewardStats(groupId)
      ])
      setLogs(logsData)
      setStats(statsData)
    } catch (error: any) {
      toast.error('加载失败', { description: error.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [groupId])

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          加载中...
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">发放次数</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRewards}</div>
            <p className="text-xs text-muted-foreground">
              历史发放总次数
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">发放积分</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCoins.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              累计发放积分总额
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">当前成员</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.memberCount}</div>
            <p className="text-xs text-muted-foreground">
              活跃的组成员数量
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Logs List */}
      <Card>
        <CardHeader>
          <CardTitle>发放记录</CardTitle>
          <CardDescription>
            最近50条积分发放记录
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">还没有发放记录</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Coins className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">
                        {log.profiles?.username || log.profiles?.email || '未知用户'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {log.profiles?.email}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        计划日期: {new Date(log.reward_date).toLocaleDateString('zh-CN')}
                      </div>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <Badge variant="outline" className="font-mono">
                      +{log.coins_amount} 积分
                    </Badge>
                    <div className="text-xs text-muted-foreground">
                      {new Date(log.executed_at).toLocaleString('zh-CN')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
