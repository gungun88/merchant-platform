"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { createAdminLog } from "./admin-log"

export interface SystemSettings {
  id: string

  // 基本配置
  platform_name: string
  platform_logo_url: string | null
  platform_description: string
  site_favicon_url: string | null

  // 积分规则配置
  register_points: number
  invitation_points: number
  checkin_points: number
  checkin_7days_bonus: number
  checkin_30days_bonus: number
  merchant_register_points: number
  edit_merchant_cost: number
  view_contact_customer_cost: number
  view_contact_merchant_cost: number
  view_contact_merchant_deduct: number
  upload_avatar_reward: number
  deposit_merchant_daily_reward: number
  deposit_merchant_apply_reward: number
  merchant_top_cost_per_day: number

  // 押金配置
  deposit_refund_fee_rate: number
  deposit_violation_platform_rate: number
  deposit_violation_compensation_rate: number

  // 信用分配置
  default_credit_score: number
  min_credit_score: number
  max_credit_score: number

  // 安全配置
  max_login_attempts: number
  login_lockout_minutes: number
  session_timeout_hours: number

  // 联系方式配置
  support_email: string | null
  support_wechat: string | null
  support_telegram: string | null

  // 敏感词配置
  sensitive_words: string[] | null
  support_whatsapp: string | null

  // 邮箱验证配置
  email_validation_enabled: boolean
  email_validation_mode: 'whitelist' | 'blacklist' | 'both' | 'disabled'
  email_allowed_domains: string[]
  email_blocked_domains: string[]

  // 时间戳
  created_at: string
  updated_at: string
  updated_by: string | null
}

export interface UpdateSettingsData {
  // 基本配置
  platform_name?: string
  platform_logo_url?: string
  platform_description?: string
  site_favicon_url?: string

  // 积分规则配置
  register_points?: number
  invitation_points?: number
  checkin_points?: number
  checkin_7days_bonus?: number
  checkin_30days_bonus?: number
  merchant_register_points?: number
  edit_merchant_cost?: number
  view_contact_customer_cost?: number
  view_contact_merchant_cost?: number
  view_contact_merchant_deduct?: number
  upload_avatar_reward?: number
  deposit_merchant_daily_reward?: number
  deposit_merchant_apply_reward?: number
  merchant_top_cost_per_day?: number

  // 押金配置
  deposit_refund_fee_rate?: number
  deposit_violation_platform_rate?: number
  deposit_violation_compensation_rate?: number

  // 信用分配置
  default_credit_score?: number
  min_credit_score?: number
  max_credit_score?: number

  // 安全配置
  max_login_attempts?: number
  login_lockout_minutes?: number
  session_timeout_hours?: number

  // 联系方式配置
  support_email?: string
  support_wechat?: string
  support_telegram?: string
  support_whatsapp?: string

  // 邮箱验证配置
  email_validation_enabled?: boolean
  email_validation_mode?: 'whitelist' | 'blacklist' | 'both' | 'disabled'
  email_allowed_domains?: string[]
  email_blocked_domains?: string[]
}

/**
 * 验证管理员权限
 */
async function verifyAdminPermission(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single()

  if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
    return false
  }

  return true
}

/**
 * 获取系统设置
 */
export async function getSystemSettings() {
  const supabase = await createClient()

  try {
    const { data: settings, error } = await supabase
      .from("system_settings")
      .select("*")
      .single()

    if (error) {
      console.error("Error fetching system settings:", error)
      return { success: false, error: error.message, data: null }
    }

    return { success: true, data: settings as SystemSettings }
  } catch (error: any) {
    console.error("Error in getSystemSettings:", error)
    return { success: false, error: error.message, data: null }
  }
}

/**
 * 更新系统设置（管理员）
 */
export async function updateSystemSettings(data: UpdateSettingsData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录" }
  }

  // 验证管理员权限
  const hasPermission = await verifyAdminPermission(supabase, user.id)
  if (!hasPermission) {
    return { success: false, error: "无权限操作" }
  }

  // 数据验证
  if (data.register_points !== undefined && data.register_points < 0) {
    return { success: false, error: "注册积分不能为负数" }
  }

  if (data.deposit_refund_fee_rate !== undefined) {
    if (data.deposit_refund_fee_rate < 0 || data.deposit_refund_fee_rate > 100) {
      return { success: false, error: "手续费率必须在 0-100 之间" }
    }
  }

  if (data.deposit_violation_platform_rate !== undefined || data.deposit_violation_compensation_rate !== undefined) {
    const platformRate = data.deposit_violation_platform_rate ?? 30
    const compensationRate = data.deposit_violation_compensation_rate ?? 70

    if (platformRate + compensationRate !== 100) {
      return { success: false, error: "平台抽成率和赔付率之和必须等于 100" }
    }
  }

  if (data.default_credit_score !== undefined) {
    const min = data.min_credit_score ?? 0
    const max = data.max_credit_score ?? 100

    if (data.default_credit_score < min || data.default_credit_score > max) {
      return { success: false, error: "默认信用分必须在最小值和最大值之间" }
    }
  }

  try {
    // 获取更新前的数据
    const { data: oldSettings } = await supabase
      .from("system_settings")
      .select("*")
      .eq("id", "00000000-0000-0000-0000-000000000001")
      .single()

    const updateData: any = { ...data, updated_by: user.id }

    const { error } = await supabase
      .from("system_settings")
      .update(updateData)
      .eq("id", "00000000-0000-0000-0000-000000000001")

    if (error) {
      console.error("Error updating system settings:", error)
      return { success: false, error: error.message }
    }

    // 记录操作日志
    const changedCount = Object.keys(data).length
    const description = `更新了 ${changedCount} 项系统设置`

    await createAdminLog({
      actionType: "settings_update",
      targetType: "settings",
      targetId: "00000000-0000-0000-0000-000000000001",
      oldData: oldSettings,
      newData: updateData,
      description,
    })

    revalidatePath("/admin/settings")
    return { success: true }
  } catch (error: any) {
    console.error("Error in updateSystemSettings:", error)
    return { success: false, error: error.message }
  }
}

/**
 * 添加敏感词
 */
export async function addSensitiveWord(word: string) {
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

  if (!word || !word.trim()) {
    return { success: false, error: "敏感词不能为空" }
  }

  const trimmedWord = word.trim()

  try {
    // 获取当前敏感词列表
    const { data: settings } = await supabase
      .from("system_settings")
      .select("sensitive_words")
      .eq("id", "00000000-0000-0000-0000-000000000001")
      .single()

    const currentWords = (settings?.sensitive_words as string[]) || []

    // 检查是否已存在
    if (currentWords.includes(trimmedWord)) {
      return { success: false, error: "该敏感词已存在" }
    }

    // 添加新敏感词
    const newWords = [...currentWords, trimmedWord]

    const { error } = await supabase
      .from("system_settings")
      .update({ sensitive_words: newWords })
      .eq("id", "00000000-0000-0000-0000-000000000001")

    if (error) {
      return { success: false, error: error.message }
    }

    await createAdminLog({
      actionType: "settings_update",
      targetType: "settings",
      targetId: "00000000-0000-0000-0000-000000000001",
      description: `添加敏感词：${trimmedWord}`,
    })

    revalidatePath("/admin/settings")
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * 删除敏感词
 */
export async function removeSensitiveWord(word: string) {
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
    // 获取当前敏感词列表
    const { data: settings } = await supabase
      .from("system_settings")
      .select("sensitive_words")
      .eq("id", "00000000-0000-0000-0000-000000000001")
      .single()

    const currentWords = (settings?.sensitive_words as string[]) || []

    // 移除指定敏感词
    const newWords = currentWords.filter((w) => w !== word)

    const { error } = await supabase
      .from("system_settings")
      .update({ sensitive_words: newWords })
      .eq("id", "00000000-0000-0000-0000-000000000001")

    if (error) {
      return { success: false, error: error.message }
    }

    await createAdminLog({
      actionType: "settings_update",
      targetType: "settings",
      targetId: "00000000-0000-0000-0000-000000000001",
      description: `删除敏感词：${word}`,
    })

    revalidatePath("/admin/settings")
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * 检测文本中的敏感词
 */
export async function detectSensitiveWords(text: string) {
  const supabase = await createClient()

  try {
    const { data: settings } = await supabase
      .from("system_settings")
      .select("sensitive_words")
      .eq("id", "00000000-0000-0000-0000-000000000001")
      .single()

    const sensitiveWords = (settings?.sensitive_words as string[]) || []

    if (sensitiveWords.length === 0) {
      return { success: true, detected: [], found: false }
    }

    // 检测文本中是否包含敏感词
    const detectedWords = sensitiveWords.filter((word) => text.includes(word))

    return {
      success: true,
      detected: detectedWords,
      found: detectedWords.length > 0,
    }
  } catch (error: any) {
    return { success: false, error: error.message, detected: [], found: false }
  }
}

/**
 * 获取平台联系方式（公开接口）
 */
export async function getPlatformContact() {
  const supabase = await createClient()

  try {
    const { data: settings, error } = await supabase
      .from("system_settings")
      .select("support_email, support_wechat, support_telegram, support_whatsapp")
      .single()

    if (error) {
      console.error("Error fetching platform contact:", error)
      return { success: false, error: error.message, data: null }
    }

    return {
      success: true,
      data: {
        email: settings.support_email,
        wechat: settings.support_wechat,
        telegram: settings.support_telegram,
        whatsapp: settings.support_whatsapp,
      },
    }
  } catch (error: any) {
    console.error("Error in getPlatformContact:", error)
    return { success: false, error: error.message, data: null }
  }
}

/**
 * 重置系统设置为默认值（管理员）
 */
export async function resetSystemSettings() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录" }
  }

  // 验证管理员权限
  const hasPermission = await verifyAdminPermission(supabase, user.id)
  if (!hasPermission) {
    return { success: false, error: "无权限操作" }
  }

  try {
    const defaultSettings = {
      platform_name: "跨境服务商平台",
      platform_logo_url: null,
      platform_description: "一个面向跨境电商服务商的展示和对接平台",
      site_favicon_url: null,
      register_points: 100,
      invitation_points: 100,
      checkin_points: 5,
      checkin_7days_bonus: 20,
      checkin_30days_bonus: 50,
      merchant_register_points: 50,
      edit_merchant_cost: 100,
      view_contact_customer_cost: 10,
      view_contact_merchant_cost: 50,
      view_contact_merchant_deduct: 10,
      upload_avatar_reward: 30,
      deposit_merchant_daily_reward: 50,
      deposit_merchant_apply_reward: 1000,
      merchant_top_cost_per_day: 1000,
      deposit_refund_fee_rate: 5.0,
      deposit_violation_platform_rate: 30.0,
      deposit_violation_compensation_rate: 70.0,
      default_credit_score: 100,
      min_credit_score: 0,
      max_credit_score: 100,
      max_login_attempts: 5,
      login_lockout_minutes: 30,
      session_timeout_hours: 24,
      support_email: null,
      support_wechat: null,
      support_telegram: null,
      support_whatsapp: null,
      updated_by: user.id,
    }

    const { error } = await supabase
      .from("system_settings")
      .update(defaultSettings)
      .eq("id", "00000000-0000-0000-0000-000000000001")

    if (error) {
      console.error("Error resetting system settings:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/admin/settings")
    return { success: true }
  } catch (error: any) {
    console.error("Error in resetSystemSettings:", error)
    return { success: false, error: error.message }
  }
}
