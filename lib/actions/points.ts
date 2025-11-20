"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { createNotification } from "./notifications"
import { getSystemSettings } from "./settings"

export interface PointTransaction {
  id: string
  user_id: string
  amount: number
  balance_after: number
  type: string
  description: string
  related_user_id: string | null
  related_merchant_id: string | null
  metadata: any
  created_at: string
}

export interface PointsStatistics {
  current_points: number
  total_earned: number
  total_spent: number
}

export interface GetPointTransactionsParams {
  page?: number
  limit?: number
  type?: string | null // 'income' | 'expense' | 交易类型
  startDate?: string | null
  endDate?: string | null
}

/**
 * 获取用户的积分交易记录
 */
export async function getPointTransactions(params: GetPointTransactionsParams = {}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录" }
  }

  const page = params.page || 1
  const limit = params.limit || 20
  const offset = (page - 1) * limit

  try {
    // 构建查询
    let query = supabase
      .from("point_transactions")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)

    // 应用筛选条件
    if (params.type) {
      if (params.type === "income") {
        query = query.gt("amount", 0)
      } else if (params.type === "expense") {
        query = query.lt("amount", 0)
      } else {
        // 具体的交易类型
        query = query.eq("type", params.type)
      }
    }

    if (params.startDate) {
      query = query.gte("created_at", params.startDate)
    }

    if (params.endDate) {
      query = query.lte("created_at", params.endDate)
    }

    // 排序和分页
    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error("Error fetching point transactions:", error)
      return { success: false, error: error.message }
    }

    return {
      success: true,
      data: data as PointTransaction[],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    }
  } catch (error: any) {
    console.error("Error in getPointTransactions:", error)
    return { success: false, error: error.message }
  }
}

/**
 * 获取积分统计信息
 */
export async function getPointsStatistics(): Promise<
  | { success: true; data: PointsStatistics }
  | { success: false; error: string }
> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录" }
  }

  try {
    // 获取当前积分
    const { data: profile } = await supabase
      .from("profiles")
      .select("points")
      .eq("id", user.id)
      .single()

    // 获取所有交易记录用于统计
    const { data: transactions } = await supabase
      .from("point_transactions")
      .select("amount")
      .eq("user_id", user.id)

    if (!profile || !transactions) {
      return { success: false, error: "获取数据失败" }
    }

    // 计算累计获得和消耗
    const total_earned = transactions
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0)

    const total_spent = Math.abs(
      transactions
        .filter((t) => t.amount < 0)
        .reduce((sum, t) => sum + t.amount, 0)
    )

    return {
      success: true,
      data: {
        current_points: profile.points,
        total_earned,
        total_spent,
      },
    }
  } catch (error: any) {
    console.error("Error in getPointsStatistics:", error)
    return { success: false, error: error.message }
  }
}

/**
 * 记录积分变动(内部函数,供其他actions调用)
 */
export async function recordPointTransaction(
  userId: string,
  amount: number,
  type: string,
  description: string,
  relatedUserId?: string | null,
  relatedMerchantId?: string | null,
  metadata?: any
) {
  const supabase = await createClient()

  try {
    // 调用数据库函数记录交易
    const { data, error } = await supabase.rpc("record_point_transaction", {
      p_user_id: userId,
      p_amount: amount,
      p_type: type,
      p_description: description,
      p_related_user_id: relatedUserId || null,
      p_related_merchant_id: relatedMerchantId || null,
      p_metadata: metadata || null,
    })

    if (error) {
      console.error("Error recording point transaction:", error)
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (error: any) {
    console.error("Error in recordPointTransaction:", error)
    return { success: false, error: error.message }
  }
}

/**
 * 获取用户当前积分
 */
export async function getUserPoints(userId: string): Promise<number> {
  const supabase = await createClient()

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("points")
      .eq("id", userId)
      .single()

    if (!profile) {
      return 0
    }

    return profile.points
  } catch (error) {
    console.error("Error getting user points:", error)
    return 0
  }
}

/**
 * 更新用户积分
 * @deprecated 此函数现在会同时记录积分变动,建议使用 addPoints 或 deductPoints
 */
export async function updateUserPoints(userId: string, pointsDelta: number) {
  const supabase = await createClient()

  try {
    // 获取当前积分
    const { data: profile } = await supabase.from("profiles").select("points").eq("id", userId).single()

    if (!profile) {
      throw new Error("Profile not found")
    }

    const newPoints = profile.points + pointsDelta

    // 更新积分
    const { error } = await supabase
      .from("profiles")
      .update({ points: newPoints })
      .eq("id", userId)

    if (error) {
      throw error
    }

    return newPoints
  } catch (error) {
    console.error("Error updating points:", error)
    throw error
  }
}

/**
 * 添加积分日志(兼容旧代码)
 * @deprecated 此函数仅用于兼容,新代码应使用 recordPointTransaction
 */
export async function addPointsLog(
  userId: string,
  amount: number,
  type: string,
  description: string,
  relatedUserId?: string | null
) {
  // 调用新的记录函数
  await recordPointTransaction(userId, amount, type, description, relatedUserId)
}

/**
 * 签到功能
 */
export async function checkIn(userId: string) {
  const supabase = await createClient()

  try {
    // 🔒 速率限制：防止重复请求
    const { rateLimitCheck } = await import("@/lib/rate-limiter")
    const rateLimit = await rateLimitCheck(userId, "CHECKIN")
    if (!rateLimit.allowed) {
      throw new Error(`签到操作过于频繁，请在 ${rateLimit.retryAfter} 秒后重试`)
    }

    // 获取签到状态
    const status = await getCheckInStatus(userId)

    if (status.hasCheckedInToday) {
      throw new Error("今天已经签到过了")
    }

    // 获取系统设置
    const settingsResult = await getSystemSettings()
    const settings = settingsResult.data
    const basePoints = settings?.checkin_points || 5
    const bonus7Days = settings?.checkin_7days_bonus || 20
    const bonus30Days = settings?.checkin_30days_bonus || 50

    // 计算新的连续签到天数
    const newConsecutiveDays = status.consecutiveDays + 1

    // 计算奖励积分
    let points = basePoints
    let bonusDesc = ""

    // 连续7天奖励
    if (newConsecutiveDays % 7 === 0) {
      points += bonus7Days
      bonusDesc = ` (连续${newConsecutiveDays}天,额外奖励${bonus7Days}分)`
    }
    // 连续30天奖励
    if (newConsecutiveDays % 30 === 0) {
      points += bonus30Days
      bonusDesc = ` (连续${newConsecutiveDays}天,额外奖励${bonus30Days}分)`
    }

    // 🔒 安全修复：使用数据库服务器时间而不是客户端时间
    // 首先获取数据库当前时间
    const { data: dbTimeData } = await supabase.rpc("now")
    const dbTime = dbTimeData || new Date().toISOString()

    // 先记录积分变动(在更新积分之前记录,以便正确计算balance_after)
    await recordPointTransaction(
      userId,
      points,
      "checkin",
      `每日签到奖励 +${points}积分${bonusDesc}`,
      null,
      null,
      { consecutive_days: newConsecutiveDays }
    )

    // 然后更新profile
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        last_checkin: dbTime, // 使用数据库时间
        consecutive_checkin_days: newConsecutiveDays,
        points: status.currentPoints + points,
      })
      .eq("id", userId)

    if (updateError) {
      throw updateError
    }

    // 发送签到通知
    await createNotification({
      userId,
      type: "transaction",
      category: "checkin",
      title: "签到成功",
      content: `恭喜你获得 ${points} 积分！连续签到 ${newConsecutiveDays} 天${bonusDesc}`,
      metadata: { points, consecutive_days: newConsecutiveDays },
    })

    return {
      points,
      consecutiveDays: newConsecutiveDays,
    }
  } catch (error) {
    console.error("Error checking in:", error)
    throw error
  }
}

/**
 * 获取签到状态
 */
export async function getCheckInStatus(userId: string) {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from("profiles")
    .select("last_checkin, consecutive_checkin_days, points")
    .eq("id", userId)
    .single()

  if (!profile) {
    return {
      hasCheckedInToday: false,
      consecutiveDays: 0,
      currentPoints: 0,
    }
  }

  // 🔒 安全修复：使用数据库服务器时间进行日期比较
  // 获取数据库当前时间
  const { data: dbTimeData } = await supabase.rpc("now")
  const dbTime = dbTimeData ? new Date(dbTimeData) : new Date()

  const today = new Date(dbTime)
  today.setHours(0, 0, 0, 0)

  let hasCheckedInToday = false
  let consecutiveDays = profile.consecutive_checkin_days || 0

  if (profile.last_checkin) {
    const lastCheckin = new Date(profile.last_checkin)
    lastCheckin.setHours(0, 0, 0, 0)

    const diffDays = Math.floor((today.getTime() - lastCheckin.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      hasCheckedInToday = true
    } else if (diffDays > 1) {
      // 超过1天未签到，连续天数重置
      consecutiveDays = 0
    }
  }

  return {
    hasCheckedInToday,
    consecutiveDays,
    currentPoints: profile.points,
  }
}
