'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Users, Settings, Calendar, Coins, Play, Edit, Trash } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { deleteUserGroup, triggerGroupReward } from '@/lib/actions/user-groups'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface GroupCardProps {
  group: any
  onUpdate: () => void
}

export function GroupCard({ group, onUpdate }: GroupCardProps) {
  const router = useRouter()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [triggering, setTriggering] = useState(false)

  const rule = group.group_reward_rules?.[0]
  const memberCount = group.user_group_members?.[0]?.count || 0

  const handleDelete = async () => {
    try {
      setDeleting(true)
      await deleteUserGroup(group.id)
      toast.success('删除成功', { description: `用户组 "${group.name}" 已删除` })
      onUpdate()
    } catch (error: any) {
      toast.error('删除失败', { description: error.message })
    } finally {
      setDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  const handleTriggerReward = async () => {
    if (!rule) {
      toast.error('此用户组还未设置发放规则')
      return
    }

    try {
      setTriggering(true)
      const result = await triggerGroupReward(group.id)
      if (result[0]?.success) {
        toast.success('发放成功', { description: result[0].message })
        onUpdate()
      } else {
        toast.error('发放失败', { description: result[0]?.message || '未知错误' })
      }
    } catch (error: any) {
      toast.error('发放失败', { description: error.message })
    } finally {
      setTriggering(false)
    }
  }

  const getRewardTypeText = (type: string) => {
    const map: Record<string, string> = {
      daily: '每日',
      weekly: '每周',
      monthly: '每月',
      custom: '自定义'
    }
    return map[type] || type
  }

  return (
    <>
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-xl">{group.name}</CardTitle>
              {group.description && (
                <CardDescription className="mt-2">
                  {group.description}
                </CardDescription>
              )}
            </div>
            {rule && (
              <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                {rule.is_active ? '已启用' : '已禁用'}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {memberCount} 个成员
              </span>
            </div>
            {rule && (
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {rule.coins_amount} 积分
                </span>
              </div>
            )}
          </div>

          {/* Reward Rule Info */}
          {rule && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {getRewardTypeText(rule.reward_type)}发放
                  {rule.custom_day_of_month && ` (每月${rule.custom_day_of_month}号)`}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                下次发放: {new Date(rule.next_reward_date).toLocaleDateString('zh-CN')}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => router.push(`/admin/user-groups/${group.id}`)}
            >
              <Settings className="mr-2 h-4 w-4" />
              管理
            </Button>
            {rule && rule.is_active && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleTriggerReward}
                disabled={triggering}
              >
                <Play className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除用户组 "{group.name}" 吗? 这将同时删除该组的所有成员关系和发放规则,但不会影响已发放的积分记录。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
