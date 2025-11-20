"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getSystemSettings } from "./settings"
import { sanitizeText, sanitizeURL } from "@/lib/utils/sanitize"
import { filterSupabaseError, logSecurityEvent } from "@/lib/utils/security-filter"

/**
 * 更新用户资料
 */
export async function updateProfile(data: {
  username?: string
  avatar?: string
}) {
  try {
    const supabase = await createClient()

    // 获取当前用户
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        error: "未登录",
      }
    }

    // 获取当前的 profile 信息
    const { data: currentProfile, error: fetchError } = await supabase
      .from("profiles")
      .select("avatar")
      .eq("id", user.id)
      .single()

    if (fetchError) {
      // 🔒 安全修复：过滤数据库错误信息
      const safeError = filterSupabaseError(fetchError)
      logSecurityEvent('error', '获取用户信息失败', { error: safeError, userId: user.id })
      return {
        success: false,
        error: "获取用户信息失败",
      }
    }

    // 检查是否是首次上传头像
    const isFirstAvatarUpload = !currentProfile.avatar && data.avatar

    // 🔒 XSS防护：清理用户输入
    const updateData: any = {}
    if (data.username !== undefined) {
      updateData.username = sanitizeText(data.username)
    }
    if (data.avatar !== undefined) {
      // 头像URL需要特殊处理，确保是安全的URL
      const sanitizedAvatar = sanitizeURL(data.avatar)
      if (sanitizedAvatar) {
        updateData.avatar = sanitizedAvatar
      } else {
        return {
          success: false,
          error: "不安全的头像URL",
        }
      }
    }

    // 更新 profile
    const { error: updateError } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", user.id)

    if (updateError) {
      // 🔒 安全修复：过滤数据库错误信息
      const safeError = filterSupabaseError(updateError)
      logSecurityEvent('error', '更新用户资料失败', { error: safeError, userId: user.id })
      return {
        success: false,
        error: "更新失败",
      }
    }

    // 如果是首次上传头像，奖励积分
    if (isFirstAvatarUpload) {
      // 从系统设置获取头像上传奖励积分
      const settingsResult = await getSystemSettings()
      const bonusPoints = settingsResult.data?.upload_avatar_reward || 30

      // 记录积分交易（函数内部会自动更新用户积分）
      await supabase.rpc("record_point_transaction", {
        p_user_id: user.id,
        p_amount: bonusPoints,
        p_type: "profile_complete",
        p_description: "首次上传头像奖励",
        p_related_user_id: null,
        p_related_merchant_id: null,
        p_metadata: null,
      })

      revalidatePath("/settings")
      revalidatePath("/")

      return {
        success: true,
        isFirstAvatarUpload,
        bonusPoints,
      }
    }

    revalidatePath("/settings")
    revalidatePath("/")

    return {
      success: true,
      isFirstAvatarUpload,
      bonusPoints: 0,
    }
  } catch (error) {
    console.error("Error updating profile:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "更新失败",
    }
  }
}

/**
 * 获取用户资料
 */
export async function getProfile() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        error: "未登录",
      }
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, username, avatar, points, created_at")
      .eq("id", user.id)
      .single()

    if (error) {
      return {
        success: false,
        error: "获取用户信息失败",
      }
    }

    return {
      success: true,
      profile,
    }
  } catch (error) {
    console.error("Error getting profile:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取用户信息失败",
    }
  }
}
