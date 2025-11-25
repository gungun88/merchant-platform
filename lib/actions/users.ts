"use server"

import { createClient, createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface UserProfile {
  id: string
  user_number: number
  username: string
  email: string
  avatar: string | null
  role: string
  is_banned: boolean
  banned_at: string | null
  banned_reason: string | null
  banned_by: string | null
  points: number
  report_count: number
  merchant_count: number
  max_invitations?: number
  used_invitations?: number
  created_at: string
  updated_at: string
}

export interface GetUsersParams {
  role?: string
  status?: string
  search?: string
  dateFrom?: string
  dateTo?: string
}

export interface UserStats {
  total: number
  active: number
  banned: number
  newToday: number
  merchants: number
  admins: number
}

/**
 * 获取用户列表（管理员）
 */
export async function adminGetUsers(params: GetUsersParams = {}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录", data: [] }
  }

  // 验证管理员权限
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "admin") {
    return { success: false, error: "无权限访问", data: [] }
  }

  try {
    let query = supabase
      .from("profiles")
      .select(`
        id,
        user_number,
        username,
        avatar,
        role,
        is_banned,
        banned_at,
        banned_reason,
        banned_by,
        points,
        report_count,
        max_invitations,
        used_invitations,
        created_at,
        updated_at
      `)
      .order("created_at", { ascending: false })

    // 角色筛选
    if (params.role && params.role !== "all") {
      query = query.eq("role", params.role)
    }

    // 状态筛选
    if (params.status) {
      if (params.status === "active") {
        query = query.eq("is_banned", false)
      } else if (params.status === "banned") {
        query = query.eq("is_banned", true)
      }
    }

    // 日期筛选
    if (params.dateFrom) {
      query = query.gte("created_at", params.dateFrom)
    }
    if (params.dateTo) {
      query = query.lte("created_at", params.dateTo)
    }

    const { data: profiles, error } = await query

    if (error) {
      console.error("Error fetching users:", error)
      return { success: false, error: error.message, data: [] }
    }

    if (!profiles || profiles.length === 0) {
      return { success: true, data: [] }
    }

    // 获取用户 ID 列表
    const userIds = profiles.map((p) => p.id)

    // 获取邮箱信息 - 使用自定义函数
    const { getUserEmails } = await import("@/lib/actions/partners")
    const emailResult = await getUserEmails(userIds)
    const emailMap = emailResult.success ? emailResult.data : {}

    // 获取商家数量
    const { data: merchants } = await supabase
      .from("merchants")
      .select("user_id")
      .in("user_id", userIds)

    const merchantCountMap: Record<string, number> = {}
    merchants?.forEach((m) => {
      merchantCountMap[m.user_id] = (merchantCountMap[m.user_id] || 0) + 1
    })

    // 组装完整数据
    const enrichedProfiles: UserProfile[] = profiles.map((profile) => ({
      ...profile,
      email: emailMap[profile.id] || "",
      merchant_count: merchantCountMap[profile.id] || 0,
    }))

    // 搜索筛选（在内存中进行，因为邮箱不在 profiles 表）
    let finalData = enrichedProfiles
    if (params.search) {
      const searchLower = params.search.toLowerCase()
      // 检测是否是纯数字搜索
      const isNumericSearch = /^\d+$/.test(params.search)

      finalData = enrichedProfiles.filter((p) => {
        // 如果是纯数字，优先匹配 user_number
        if (isNumericSearch) {
          const searchNumber = parseInt(params.search)
          if (p.user_number === searchNumber) {
            return true
          }
        }
        // 否则搜索用户名和邮箱
        return (
          p.username.toLowerCase().includes(searchLower) ||
          p.email.toLowerCase().includes(searchLower) ||
          p.user_number.toString().includes(params.search)
        )
      })
    }

    return { success: true, data: finalData }
  } catch (error: any) {
    console.error("Error in adminGetUsers:", error)
    return { success: false, error: error.message, data: [] }
  }
}

/**
 * 获取用户统计数据（管理员）
 */
export async function getUserStats(): Promise<UserStats> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { total: 0, active: 0, banned: 0, newToday: 0, merchants: 0, admins: 0 }
  }

  try {
    // 获取所有用户
    const { data: allUsers } = await supabase.from("profiles").select("id, role, is_banned, created_at")

    if (!allUsers) {
      return { total: 0, active: 0, banned: 0, newToday: 0, merchants: 0, admins: 0 }
    }

    const total = allUsers.length
    const active = allUsers.filter((u) => !u.is_banned).length
    const banned = allUsers.filter((u) => u.is_banned).length
    const admins = allUsers.filter((u) => u.role === "admin").length

    // 计算今天新增用户
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const newToday = allUsers.filter((u) => new Date(u.created_at) >= today).length

    // 统计商家用户数（拥有商家的用户）
    const userIds = allUsers.map((u) => u.id)
    const { data: merchantUsers } = await supabase
      .from("merchants")
      .select("user_id")
      .in("user_id", userIds)

    // 去重，统计拥有商家的用户数量
    const uniqueMerchantUsers = new Set(merchantUsers?.map((m) => m.user_id) || [])
    const merchants = uniqueMerchantUsers.size

    return { total, active, banned, newToday, merchants, admins }
  } catch (error) {
    console.error("Error in getUserStats:", error)
    return { total: 0, active: 0, banned: 0, newToday: 0, merchants: 0, admins: 0 }
  }
}

/**
 * 封禁用户（管理员）
 */
export async function banUser(userId: string, reason: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录" }
  }

  // 验证管理员权限
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "admin") {
    return { success: false, error: "无权限操作" }
  }

  if (!reason || !reason.trim()) {
    return { success: false, error: "请填写封禁原因" }
  }

  try {
    // 获取被封禁用户信息
    const { data: targetUser } = await supabase
      .from("profiles")
      .select("username, role")
      .eq("id", userId)
      .single()

    if (!targetUser) {
      return { success: false, error: "用户不存在" }
    }

    // 不允许封禁管理员
    if (targetUser.role === "admin") {
      return { success: false, error: "不能封禁管理员账户" }
    }

    // 更新用户状态
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        is_banned: true,
        banned_at: new Date().toISOString(),
        banned_reason: reason,
        banned_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)

    if (updateError) {
      console.error("Error banning user:", updateError)
      return { success: false, error: updateError.message }
    }

    // 发送通知给被封禁用户
    await supabase.from("notifications").insert({
      user_id: userId,
      type: "account_banned",
      category: "system",
      title: "账户已被封禁",
      content: `您的账户因以下原因被封禁：${reason}。如有疑问，请联系客服。`,
      priority: "high",
    })

    revalidatePath("/admin/users")
    return { success: true }
  } catch (error: any) {
    console.error("Error in banUser:", error)
    return { success: false, error: error.message }
  }
}

/**
 * 解封用户（管理员）
 */
export async function unbanUser(userId: string, note?: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录" }
  }

  // 验证管理员权限
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "admin") {
    return { success: false, error: "无权限操作" }
  }

  try {
    // 获取用户信息
    const { data: targetUser } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .single()

    if (!targetUser) {
      return { success: false, error: "用户不存在" }
    }

    // 更新用户状态
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        is_banned: false,
        banned_at: null,
        banned_reason: null,
        banned_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)

    if (updateError) {
      console.error("Error unbanning user:", updateError)
      return { success: false, error: updateError.message }
    }

    // 发送通知给用户
    await supabase.from("notifications").insert({
      user_id: userId,
      type: "account_unbanned",
      category: "system",
      title: "账户已解封",
      content: note
        ? `您的账户已解封。管理员备注：${note}`
        : "您的账户已解封，现在可以正常使用了。",
      priority: "normal",
    })

    revalidatePath("/admin/users")
    return { success: true }
  } catch (error: any) {
    console.error("Error in unbanUser:", error)
    return { success: false, error: error.message }
  }
}

/**
 * 调整用户积分（管理员）
 */
export async function adjustUserPoints(userId: string, points: number, reason: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录" }
  }

  // 验证管理员权限
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "admin") {
    return { success: false, error: "无权限操作" }
  }

  if (!reason || !reason.trim()) {
    return { success: false, error: "请填写调整原因" }
  }

  if (points === 0) {
    return { success: false, error: "调整积分不能为0" }
  }

  try {
    // 获取用户当前积分
    const { data: targetUser } = await supabase
      .from("profiles")
      .select("username, points")
      .eq("id", userId)
      .single()

    if (!targetUser) {
      return { success: false, error: "用户不存在" }
    }

    const previousPoints = targetUser.points || 0
    const newPoints = Math.max(0, previousPoints + points)

    // 更新用户积分
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        points: newPoints,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)

    if (updateError) {
      console.error("Error adjusting user points:", updateError)
      return { success: false, error: updateError.message }
    }

    // 发送通知给用户
    const notificationContent =
      points > 0
        ? `您获得了 ${points} 积分。原因：${reason}。当前积分：${newPoints}`
        : `您被扣除了 ${Math.abs(points)} 积分。原因：${reason}。当前积分：${newPoints}`

    await supabase.from("notifications").insert({
      user_id: userId,
      type: "points_adjusted",
      category: "system",
      title: points > 0 ? "积分增加" : "积分扣除",
      content: notificationContent,
      priority: "normal",
    })

    revalidatePath("/admin/users")
    return { success: true, newPoints }
  } catch (error: any) {
    console.error("Error in adjustUserPoints:", error)
    return { success: false, error: error.message }
  }
}

export interface CreateUserData {
  username: string
  email: string
  password: string
  requireEmailVerification: boolean
  generateRandomPassword: boolean
}

/**
 * 批量转账积分给所有用户（管理员）
 * 支持立即执行或定时执行
 */
export async function batchTransferPoints(points: number, reason: string, targetRole?: string, activityDate?: Date) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录" }
  }

  // 验证管理员权限
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "admin") {
    return { success: false, error: "无权限操作" }
  }

  if (!reason || !reason.trim()) {
    return { success: false, error: "请填写转账原因" }
  }

  if (points === 0) {
    return { success: false, error: "转账积分不能为0" }
  }

  if (points < 0) {
    return { success: false, error: "批量转账只能增加积分，不能扣除" }
  }

  if (!activityDate) {
    return { success: false, error: "请选择活动日期" }
  }

  try {
    const scheduledTime = new Date(activityDate)
    const now = new Date()

    // 判断是立即执行还是定时执行
    // 如果选择的时间在当前时间之后超过1分钟，则创建定时任务
    const isScheduled = scheduledTime.getTime() > now.getTime() + 60000

    if (isScheduled) {
      // 创建定时任务
      const { data: scheduledTask, error: insertError } = await supabase
        .from("scheduled_point_transfers")
        .insert({
          created_by: user.id,
          points,
          reason,
          target_role: targetRole || "all",
          scheduled_at: scheduledTime.toISOString(),
          status: "pending",
        })
        .select()
        .single()

      if (insertError) {
        console.error("Error creating scheduled task:", insertError)
        return { success: false, error: insertError.message }
      }

      // 手动转换为中国时区 (UTC+8)
      const chinaTime = new Date(scheduledTime.getTime() + 8 * 60 * 60 * 1000)
      const dateStr = chinaTime.toLocaleString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC"  // 使用UTC因为我们已经手动加了8小时
      })

      revalidatePath("/admin/users")
      return {
        success: true,
        scheduled: true,
        scheduledAt: scheduledTime.toISOString(),
        message: `已创建定时转账任务，将在 ${dateStr} 自动执行`
      }
    }

    // 立即执行转账
    // 获取目标用户列表（排除管理员，排除已封禁用户）
    let query = supabase
      .from("profiles")
      .select("id, username, points, role")
      .eq("is_banned", false)
      .neq("role", "admin")

    // 如果指定了角色，只转账给该角色的用户
    if (targetRole && targetRole !== "all") {
      if (targetRole === "merchant") {
        // 获取所有商家用户ID
        const { data: merchantUsers } = await supabase
          .from("merchants")
          .select("user_id")

        if (merchantUsers && merchantUsers.length > 0) {
          const merchantUserIds = [...new Set(merchantUsers.map(m => m.user_id))]
          query = query.in("id", merchantUserIds)
        } else {
          return { success: false, error: "没有找到商家用户" }
        }
      } else {
        query = query.eq("role", targetRole)
      }
    }

    const { data: targetUsers, error: fetchError } = await query

    if (fetchError) {
      console.error("Error fetching target users:", fetchError)
      return { success: false, error: fetchError.message }
    }

    if (!targetUsers || targetUsers.length === 0) {
      return { success: false, error: "没有找到符合条件的用户" }
    }

    // 格式化活动日期用于通知消息 (明确指定中国时区)
    const dateStr = scheduledTime.toLocaleString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Shanghai"
    })

    // 批量更新用户积分
    const updatePromises = targetUsers.map(async (targetUser) => {
      const newPoints = (targetUser.points || 0) + points

      // 更新积分
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          points: newPoints,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetUser.id)

      if (updateError) {
        console.error(`Error updating points for user ${targetUser.id}:`, updateError)
        return { userId: targetUser.id, success: false, error: updateError.message }
      }

      // 创建积分交易记录
      await supabase.from("point_transactions").insert({
        user_id: targetUser.id,
        amount: points,
        balance_after: newPoints,
        type: "points_reward",
        description: `${reason}（活动日期：${dateStr}）`,
      })

      // 发送通知 - 包含日期信息
      const notificationContent = `您获得了 ${points} 积分。原因：${reason}（活动日期：${dateStr}）。当前积分：${newPoints}`

      await supabase.from("notifications").insert({
        user_id: targetUser.id,
        type: "points_reward",
        category: "system",
        title: "积分奖励",
        content: notificationContent,
        priority: "normal",
      })

      return { userId: targetUser.id, success: true }
    })

    const results = await Promise.all(updatePromises)

    // 统计成功和失败的数量
    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    revalidatePath("/admin/users")
    return {
      success: true,
      scheduled: false,
      totalUsers: targetUsers.length,
      successCount,
      failCount,
      message: `立即转账完成：成功给 ${successCount} 位用户转账 ${points} 积分${failCount > 0 ? `，${failCount} 位用户转账失败` : ""}`
    }
  } catch (error: any) {
    console.error("Error in batchTransferPoints:", error)
    return { success: false, error: error.message }
  }
}

/**
 * 批量修改用户头像(管理员)
 */
export async function batchUpdateUsers(params: {
  avatar: string
  targetRole?: string
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录" }
  }

  // 验证管理员权限
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "admin") {
    return { success: false, error: "无权限操作" }
  }

  // 验证头像URL
  if (!params.avatar) {
    return { success: false, error: "请提供头像URL" }
  }

  try {
    // 构建查询条件：排除管理员
    let query = supabase
      .from("profiles")
      .update({ avatar: params.avatar })
      .neq("role", "admin")

    // 根据目标角色过滤
    if (params.targetRole && params.targetRole !== "all") {
      if (params.targetRole === "user") {
        query = query.eq("role", "user")
      } else if (params.targetRole === "merchant") {
        query = query.eq("role", "merchant")
      }
    }

    const { data, error, count } = await query.select()

    if (error) {
      console.error("Error in batchUpdateUsers:", error)
      return { success: false, error: `批量修改失败: ${error.message}` }
    }

    // 记录管理员操作
    const { logAdminOperation } = await import("./admin")
    await logAdminOperation({
      operationType: "batch_update_users",
      targetType: "user",
      targetId: "batch",
      description: `批量修改用户头像: ${params.avatar}`,
      metadata: {
        ...params,
        affectedCount: data?.length || 0,
      },
    })

    revalidatePath("/admin/users")
    return {
      success: true,
      count: data?.length || 0,
      message: `批量修改完成：成功修改 ${data?.length || 0} 位用户的头像`
    }
  } catch (error: any) {
    console.error("Error in batchUpdateUsers:", error)
    return { success: false, error: error.message }
  }
}

/**
 * 创建新用户(管理员) - 无需邮箱验证
 */
export async function createUser(data: CreateUserData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录" }
  }

  // 验证管理员权限
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "admin") {
    return { success: false, error: "无权限操作" }
  }

  // 数据验证
  if (!data.username || !data.username.trim()) {
    return { success: false, error: "请输入用户名" }
  }

  if (!data.email || !data.email.trim()) {
    return { success: false, error: "请输入邮箱" }
  }

  // 邮箱格式验证
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(data.email)) {
    return { success: false, error: "邮箱格式不正确" }
  }

  if (!data.password || data.password.length < 6) {
    return { success: false, error: "密码长度至少为6位" }
  }

  try {
    // 使用 Service Role Key 创建管理员客户端
    const adminSupabase = createAdminClient()

    // 创建认证用户
    console.log('Creating user with admin API...', { email: data.email, username: data.username })
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: !data.requireEmailVerification, // 如果不需要验证,直接确认邮箱
      user_metadata: {
        username: data.username,
      },
    })

    if (authError) {
      console.error("Error creating auth user:", authError)
      console.error("Full error details:", JSON.stringify(authError, null, 2))
      if (authError.message.includes("already registered")) {
        return { success: false, error: "该邮箱已被注册" }
      }
      return { success: false, error: `创建用户失败: ${authError.message}` }
    }

    console.log('Auth user created successfully:', authData.user?.id)

    if (!authData.user) {
      return { success: false, error: "创建用户失败" }
    }

    // 等待触发器自动创建 profile(触发器已修复并重新启用)
    console.log("Waiting for trigger to create profile...")

    // 等待最多3秒,让触发器完成 profile 创建
    let profileCreated = false
    for (let i = 0; i < 6; i++) {
      await new Promise(resolve => setTimeout(resolve, 500))

      const { data: profile } = await adminSupabase
        .from("profiles")
        .select("id")
        .eq("id", authData.user.id)
        .single()

      if (profile) {
        profileCreated = true
        console.log("Profile created by trigger successfully")
        break
      }
    }

    if (!profileCreated) {
      console.error("Trigger failed to create profile")
      // 如果触发器失败,删除刚创建的 auth 用户
      await adminSupabase.auth.admin.deleteUser(authData.user.id)
      return { success: false, error: "用户资料创建失败,请联系管理员检查数据库触发器" }
    }

    revalidatePath("/admin/users")
    return {
      success: true,
      userId: authData.user.id,
      email: data.email,
    }
  } catch (error: any) {
    console.error("Error in createUser:", error)
    return { success: false, error: error.message || "创建用户失败" }
  }
}

/**
 * 获取管理员列表(仅限管理员)
 */
export async function getAdmins() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录", data: [] }
  }

  // 验证管理员权限
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "admin") {
    return { success: false, error: "无权限访问", data: [] }
  }

  try {
    // 获取所有管理员
    const { data: admins, error } = await supabase
      .from("profiles")
      .select("id, user_number, username, avatar, role, created_at, updated_at, points")
      .eq("role", "admin")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching admins:", error)
      return { success: false, error: error.message, data: [] }
    }

    if (!admins || admins.length === 0) {
      return { success: true, data: [] }
    }

    // 获取管理员邮箱
    const adminIds = admins.map((a) => a.id)
    const { getUserEmails } = await import("@/lib/actions/partners")
    const emailResult = await getUserEmails(adminIds)
    const emailMap = emailResult.success ? emailResult.data : {}

    // 组装完整数据
    const enrichedAdmins = admins.map((admin) => ({
      ...admin,
      email: emailMap[admin.id] || "",
    }))

    return { success: true, data: enrichedAdmins }
  } catch (error: any) {
    console.error("Error in getAdmins:", error)
    return { success: false, error: error.message, data: [] }
  }
}

export interface PromoteToAdminData {
  userIdentifier: string  // 可以是用户ID、用户名或邮箱
  reason?: string
}

/**
 * 提升用户为管理员(仅限管理员)
 */
export async function promoteToAdmin(data: PromoteToAdminData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录" }
  }

  // 验证管理员权限
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "admin") {
    return { success: false, error: "无权限操作" }
  }

  try {
    const identifier = data.userIdentifier.trim()

    // 尝试通过ID、用户名或邮箱查找用户
    let targetUser: any = null
    let targetUserId: string = ""

    // 先尝试作为ID查找
    const { data: userById } = await supabase
      .from("profiles")
      .select("id, username, role")
      .eq("id", identifier)
      .single()

    if (userById) {
      targetUser = userById
      targetUserId = userById.id
    } else {
      // 如果不是ID,尝试作为用户名查找
      const { data: userByUsername } = await supabase
        .from("profiles")
        .select("id, username, role")
        .eq("username", identifier)
        .single()

      if (userByUsername) {
        targetUser = userByUsername
        targetUserId = userByUsername.id
      } else {
        // 最后尝试通过邮箱查找
        const { getUserEmails } = await import("@/lib/actions/partners")
        const { data: allUsers } = await supabase
          .from("profiles")
          .select("id, username, role")

        if (allUsers && allUsers.length > 0) {
          const userIds = allUsers.map(u => u.id)
          const emailResult = await getUserEmails(userIds)

          if (emailResult.success) {
            const emailMap = emailResult.data
            const foundUserId = Object.keys(emailMap).find(
              uid => emailMap[uid].toLowerCase() === identifier.toLowerCase()
            )

            if (foundUserId) {
              const foundUser = allUsers.find(u => u.id === foundUserId)
              if (foundUser) {
                targetUser = foundUser
                targetUserId = foundUser.id
              }
            }
          }
        }
      }
    }

    if (!targetUser) {
      return { success: false, error: "用户不存在,请检查用户ID、用户名或邮箱是否正确" }
    }

    if (targetUser.role === "admin") {
      return { success: false, error: "该用户已经是管理员" }
    }

    // 更新用户角色为管理员
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        role: "admin",
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetUserId)

    if (updateError) {
      console.error("Error promoting user to admin:", updateError)
      return { success: false, error: updateError.message }
    }

    // 发送通知给新管理员
    await supabase.from("notifications").insert({
      user_id: targetUserId,
      type: "role_changed",
      category: "system",
      title: "您已成为管理员",
      content: data.reason
        ? `恭喜!您已被提升为管理员。原因:${data.reason}`
        : "恭喜!您已被提升为管理员。现在您可以访问管理后台了。",
      priority: "high",
    })

    revalidatePath("/admin/admins")
    revalidatePath("/admin/users")
    return { success: true, username: targetUser.username }
  } catch (error: any) {
    console.error("Error in promoteToAdmin:", error)
    return { success: false, error: error.message }
  }
}

/**
 * 撤销管理员权限(仅限管理员)
 */
export async function revokeAdmin(userId: string, reason?: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录" }
  }

  // 验证管理员权限
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "admin") {
    return { success: false, error: "无权限操作" }
  }

  // 防止撤销自己的管理员权限
  if (userId === user.id) {
    return { success: false, error: "不能撤销自己的管理员权限" }
  }

  try {
    // 获取目标用户信息
    const { data: targetUser } = await supabase
      .from("profiles")
      .select("username, role")
      .eq("id", userId)
      .single()

    if (!targetUser) {
      return { success: false, error: "用户不存在" }
    }

    if (targetUser.role !== "admin") {
      return { success: false, error: "该用户不是管理员" }
    }

    // 更新用户角色为普通用户
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        role: "user",
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)

    if (updateError) {
      console.error("Error revoking admin:", updateError)
      return { success: false, error: updateError.message }
    }

    // 发送通知
    await supabase.from("notifications").insert({
      user_id: userId,
      type: "role_changed",
      category: "system",
      title: "管理员权限已被撤销",
      content: reason
        ? `您的管理员权限已被撤销。原因:${reason}`
        : "您的管理员权限已被撤销。",
      priority: "high",
    })

    revalidatePath("/admin/admins")
    revalidatePath("/admin/users")
    return { success: true }
  } catch (error: any) {
    console.error("Error in revokeAdmin:", error)
    return { success: false, error: error.message }
  }
}

/**
 * 更新用户的邀请次数限制（仅限管理员）
 */
export async function updateUserInvitationLimit(userId: string, maxInvitations: number) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录" }
  }

  // 验证管理员权限
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "admin") {
    return { success: false, error: "无权限操作" }
  }

  try {
    // 验证 maxInvitations 是否有效
    if (maxInvitations < 0) {
      return { success: false, error: "邀请次数不能为负数" }
    }

    // 更新用户的邀请次数限制
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        max_invitations: maxInvitations,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)

    if (updateError) {
      console.error("Error updating invitation limit:", updateError)
      return { success: false, error: updateError.message }
    }

    revalidatePath("/admin/users")
    return { success: true }
  } catch (error: any) {
    console.error("Error in updateUserInvitationLimit:", error)
    return { success: false, error: error.message }
  }
}
