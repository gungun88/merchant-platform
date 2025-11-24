'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Coins, Save, Info, Play } from 'lucide-react'
import { getGroupRewardRule, createOrUpdateRewardRule, toggleRewardRule, triggerGroupReward } from '@/lib/actions/user-groups'
import { RewardType } from '@/lib/types/database'
import { toast } from 'sonner'

interface RewardRuleTabProps {
  groupId: string
  onUpdate: () => void
}

export function RewardRuleTab({ groupId, onUpdate }: RewardRuleTabProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [triggering, setTriggering] = useState(false)
  const [rule, setRule] = useState<any>(null)

  // Form state
  const [coinsAmount, setCoinsAmount] = useState(100)
  const [rewardType, setRewardType] = useState<RewardType>('monthly')
  const [monthDay, setMonthDay] = useState(1)
  const [weekDay, setWeekDay] = useState(1)
  const [isActive, setIsActive] = useState(true)

  // 计算下次发放日期
  const calculateNextRewardDate = () => {
    const now = new Date()
    let nextDate = new Date()

    switch (rewardType) {
      case 'daily':
        nextDate.setDate(now.getDate() + 1)
        break
      case 'weekly':
        const currentDay = now.getDay()
        const daysUntilTarget = (weekDay - currentDay + 7) % 7
        nextDate.setDate(now.getDate() + (daysUntilTarget || 7))
        break
      case 'monthly':
      case 'custom':
        nextDate.setMonth(now.getMonth() + 1)
        nextDate.setDate(monthDay)
        // 如果设置的日期在本月还没到,就用本月
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), monthDay)
        if (thisMonth > now) {
          nextDate = thisMonth
        }
        break
    }

    return nextDate.toISOString().split('T')[0]
  }

  const loadRule = async () => {
    try {
      setLoading(true)
      const data = await getGroupRewardRule(groupId)
      setRule(data)

      if (data) {
        setCoinsAmount(data.coins_amount)
        setRewardType(data.reward_type)
        setMonthDay(data.custom_day_of_month || 1)
        setWeekDay(data.custom_day_of_week || 1)
        setIsActive(data.is_active)
      }
    } catch (error: any) {
      toast.error('加载失败', { description: error.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRule()
  }, [groupId])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (coinsAmount <= 0) {
      toast.error('积分数量必须大于0')
      return
    }

    try {
      setSaving(true)
      const nextRewardDate = calculateNextRewardDate()

      await createOrUpdateRewardRule({
        groupId,
        coinsAmount,
        rewardType,
        customDayOfMonth: rewardType === 'monthly' || rewardType === 'custom' ? monthDay : undefined,
        customDayOfWeek: rewardType === 'weekly' ? weekDay : undefined,
        nextRewardDate,
        isActive
      })
      toast.success('保存成功', { description: '发放规则已更新' })
      loadRule()
      onUpdate()
    } catch (error: any) {
      toast.error('保存失败', { description: error.message })
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async () => {
    if (!rule) {
      toast.error('请先保存规则')
      return
    }

    try {
      const newStatus = !isActive
      await toggleRewardRule(groupId, newStatus)
      setIsActive(newStatus)
      toast.success(newStatus ? '规则已启用' : '规则已禁用')
      onUpdate()
    } catch (error: any) {
      toast.error('操作失败', { description: error.message })
    }
  }

  const handleTriggerReward = async () => {
    if (!rule) {
      toast.error('请先保存规则')
      return
    }

    if (!isActive) {
      toast.error('请先启用规则')
      return
    }

    try {
      setTriggering(true)
      const result = await triggerGroupReward(groupId)
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

  // 格式化下次发放时间显示
  const formatNextRewardDate = () => {
    const date = new Date(calculateNextRewardDate())
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    })
  }

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
    <form onSubmit={handleSave}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>发放规则</CardTitle>
              <CardDescription>
                设置该用户组的定期积分发放规则
              </CardDescription>
            </div>
            {rule && (
              <div className="flex items-center gap-2">
                <Label htmlFor="active-switch">启用规则</Label>
                <Switch
                  id="active-switch"
                  checked={isActive}
                  onCheckedChange={handleToggleActive}
                />
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* 积分数量 */}
          <div className="space-y-2">
            <Label htmlFor="coins">每次发放积分数量</Label>
            <div className="relative">
              <Coins className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="coins"
                type="number"
                min="1"
                value={coinsAmount}
                onChange={(e) => setCoinsAmount(parseInt(e.target.value) || 0)}
                className="pl-10"
                required
              />
            </div>
          </div>

          {/* 发放时间 */}
          <div className="space-y-4">
            <Label>发放时间</Label>
            <RadioGroup value={rewardType} onValueChange={(v) => setRewardType(v as RewardType)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="daily" id="daily" />
                <Label htmlFor="daily" className="font-normal cursor-pointer">
                  每天
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <RadioGroupItem value="weekly" id="weekly" />
                <Label htmlFor="weekly" className="font-normal cursor-pointer">
                  每周
                </Label>
                {rewardType === 'weekly' && (
                  <Select value={weekDay.toString()} onValueChange={(v) => setWeekDay(parseInt(v))}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">周日</SelectItem>
                      <SelectItem value="1">周一</SelectItem>
                      <SelectItem value="2">周二</SelectItem>
                      <SelectItem value="3">周三</SelectItem>
                      <SelectItem value="4">周四</SelectItem>
                      <SelectItem value="5">周五</SelectItem>
                      <SelectItem value="6">周六</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <RadioGroupItem value="monthly" id="monthly" />
                <Label htmlFor="monthly" className="font-normal cursor-pointer">
                  每月
                </Label>
                {rewardType === 'monthly' && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={monthDay}
                      onChange={(e) => setMonthDay(parseInt(e.target.value) || 1)}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">号</span>
                  </div>
                )}
              </div>
            </RadioGroup>
          </div>

          {/* 下次发放时间预览 */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  下次发放时间
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  {formatNextRewardDate()}
                </p>
              </div>
            </div>
          </div>

          {/* 规则说明 */}
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h4 className="font-medium text-sm">规则说明</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>系统每天自动检查并执行到期的发放任务</li>
              <li>发放成功后会自动通知用户</li>
              <li>所有发放记录都会保存在历史记录中</li>
            </ul>
          </div>

          {/* 保存和立即发放按钮 */}
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? '保存中...' : '保存规则'}
            </Button>
            {rule && isActive && (
              <Button
                type="button"
                variant="outline"
                onClick={handleTriggerReward}
                disabled={triggering}
              >
                <Play className="mr-2 h-4 w-4" />
                {triggering ? '发放中...' : '立即发放'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
