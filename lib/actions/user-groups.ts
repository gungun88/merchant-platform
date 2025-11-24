'use server'

import { createClient } from '@/lib/supabase/server'
import { UserGroup, GroupRewardRule, UserGroupMember, GroupRewardLog, RewardType } from '@/lib/types/database'

// ==================== 用户组管理 ====================

export async function getUserGroups() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('user_groups')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as UserGroup[]
}

export async function createUserGroup(name: string, description?: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('user_groups')
    .insert({ name, description })
    .select()
    .single()

  if (error) throw error
  return data as UserGroup
}

export async function updateUserGroup(id: string, updates: { name?: string; description?: string }) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('user_groups')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as UserGroup
}

export async function deleteUserGroup(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('user_groups')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// ==================== 用户组成员管理 ====================

export async function getGroupMembers(groupId: string) {
  const supabase = await createClient()

  // 先获取所有成员
  const { data: members, error: membersError } = await supabase
    .from('user_group_members')
    .select('*')
    .eq('group_id', groupId)
    .order('added_at', { ascending: false })

  if (membersError) throw membersError
  if (!members || members.length === 0) return []

  // 然后获取每个成员的profile信息
  const membersWithProfiles = await Promise.all(
    members.map(async (member) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, email, username, avatar')
        .eq('id', member.user_id)
        .single()

      return {
        ...member,
        profiles: profile
      }
    })
  )

  return membersWithProfiles
}

export async function addGroupMember(groupId: string, userEmail: string) {
  const supabase = await createClient()

  // 先通过邮箱查找用户
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', userEmail)
    .single()

  if (profileError) throw new Error('用户不存在')

  // 获取当前管理员ID
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('user_group_members')
    .insert({
      group_id: groupId,
      user_id: profile.id,
      added_by: user?.id
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('该用户已在此组中')
    }
    throw error
  }
  return data as UserGroupMember
}

export async function removeGroupMember(memberId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('user_group_members')
    .delete()
    .eq('id', memberId)

  if (error) throw error
}

export async function batchAddGroupMembers(groupId: string, userEmails: string[]) {
  const supabase = await createClient()

  const results = {
    success: [] as string[],
    failed: [] as { email: string; reason: string }[]
  }

  // 获取当前管理员ID
  const { data: { user } } = await supabase.auth.getUser()

  for (const email of userEmails) {
    try {
      // 查找用户
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.trim())
        .single()

      if (profileError) {
        results.failed.push({ email, reason: '用户不存在' })
        continue
      }

      // 添加到组
      const { error } = await supabase
        .from('user_group_members')
        .insert({
          group_id: groupId,
          user_id: profile.id,
          added_by: user?.id
        })

      if (error) {
        if (error.code === '23505') {
          results.failed.push({ email, reason: '已在组中' })
        } else {
          results.failed.push({ email, reason: error.message })
        }
      } else {
        results.success.push(email)
      }
    } catch (err) {
      results.failed.push({ email, reason: '处理失败' })
    }
  }

  return results
}

// ==================== 用户组奖励规则管理 ====================

export async function getGroupRewardRule(groupId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('group_reward_rules')
    .select('*')
    .eq('group_id', groupId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data as GroupRewardRule | null
}

export async function createOrUpdateRewardRule(params: {
  groupId: string
  coinsAmount: number
  rewardType: RewardType
  customDayOfMonth?: number
  customDayOfWeek?: number
  nextRewardDate: string
  isActive: boolean
}) {
  const supabase = await createClient()

  // 检查是否已存在规则
  const { data: existing } = await supabase
    .from('group_reward_rules')
    .select('id')
    .eq('group_id', params.groupId)
    .single()

  if (existing) {
    // 更新现有规则
    const { data, error } = await supabase
      .from('group_reward_rules')
      .update({
        coins_amount: params.coinsAmount,
        reward_type: params.rewardType,
        custom_day_of_month: params.customDayOfMonth,
        custom_day_of_week: params.customDayOfWeek,
        next_reward_date: params.nextRewardDate,
        is_active: params.isActive
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) throw error
    return data as GroupRewardRule
  } else {
    // 创建新规则
    const { data, error } = await supabase
      .from('group_reward_rules')
      .insert({
        group_id: params.groupId,
        coins_amount: params.coinsAmount,
        reward_type: params.rewardType,
        custom_day_of_month: params.customDayOfMonth,
        custom_day_of_week: params.customDayOfWeek,
        next_reward_date: params.nextRewardDate,
        is_active: params.isActive
      })
      .select()
      .single()

    if (error) throw error
    return data as GroupRewardRule
  }
}

export async function toggleRewardRule(groupId: string, isActive: boolean) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('group_reward_rules')
    .update({ is_active: isActive })
    .eq('group_id', groupId)
    .select()
    .single()

  if (error) throw error
  return data as GroupRewardRule
}

export async function deleteRewardRule(groupId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('group_reward_rules')
    .delete()
    .eq('group_id', groupId)

  if (error) throw error
}

// ==================== 发放日志查询 ====================

export async function getGroupRewardLogs(params: {
  groupId?: string
  userId?: string
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}) {
  const supabase = await createClient()

  let query = supabase
    .from('group_reward_logs')
    .select('*')
    .order('executed_at', { ascending: false })

  if (params.groupId) {
    query = query.eq('group_id', params.groupId)
  }

  if (params.userId) {
    query = query.eq('user_id', params.userId)
  }

  if (params.startDate) {
    query = query.gte('reward_date', params.startDate)
  }

  if (params.endDate) {
    query = query.lte('reward_date', params.endDate)
  }

  if (params.limit) {
    query = query.limit(params.limit)
  }

  if (params.offset) {
    query = query.range(params.offset, params.offset + (params.limit || 50) - 1)
  }

  const { data: logs, error } = await query

  if (error) throw error
  if (!logs || logs.length === 0) return []

  // 获取关联的用户组和用户信息
  const logsWithDetails = await Promise.all(
    logs.map(async (log) => {
      const [groupResult, profileResult] = await Promise.all([
        supabase
          .from('user_groups')
          .select('name')
          .eq('id', log.group_id)
          .single(),
        supabase
          .from('profiles')
          .select('email, username')
          .eq('id', log.user_id)
          .single()
      ])

      return {
        ...log,
        user_groups: groupResult.data,
        profiles: profileResult.data
      }
    })
  )

  return logsWithDetails
}

export async function getGroupRewardStats(groupId: string) {
  const supabase = await createClient()

  // 获取总发放次数和总发放积分
  const { data: stats, error } = await supabase
    .from('group_reward_logs')
    .select('coins_amount')
    .eq('group_id', groupId)

  if (error) throw error

  const totalRewards = stats?.length || 0
  const totalCoins = stats?.reduce((sum, log) => sum + log.coins_amount, 0) || 0

  // 获取组成员数量
  const { count: memberCount } = await supabase
    .from('user_group_members')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', groupId)

  return {
    totalRewards,
    totalCoins,
    memberCount: memberCount || 0
  }
}

// ==================== 手动触发发放 ====================

export async function triggerGroupReward(groupId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('trigger_group_reward', {
    p_group_id: groupId
  })

  if (error) throw error
  return data
}

// ==================== 获取所有组及其规则(用于管理后台展示) ====================

export async function getAllGroupsWithRules() {
  const supabase = await createClient()

  // 先获取所有用户组和规则
  const { data: groups, error: groupsError } = await supabase
    .from('user_groups')
    .select(`
      *,
      group_reward_rules (*)
    `)
    .order('created_at', { ascending: false })

  if (groupsError) throw groupsError

  // 为每个组获取成员数量
  const groupsWithCounts = await Promise.all(
    (groups || []).map(async (group) => {
      const { count } = await supabase
        .from('user_group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', group.id)

      return {
        ...group,
        user_group_members: [{ count: count || 0 }]
      }
    })
  )

  return groupsWithCounts
}
