"use server"

import { createClient, createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getSystemSettings } from "./settings"
import { sanitizeText, sanitizeURL } from "@/lib/utils/sanitize"
import { filterSupabaseError, logSecurityEvent } from "@/lib/utils/security-filter"

/**
 * 为新注册用户创建 profile
 * 注意: 由于数据库触发器无法可靠工作,改用应用层方案
 */
export async function createUserProfile(data: {
  userId: string
  username?: string
  email: string
  createdAt?: string
}) {
  try {
    // 🔥 重要：使用 Admin Client 绕过 RLS，因为新用户还没有 profile 记录
    // 如果使用普通 client，会被 RLS 策略阻止（new row violates row-level security policy）
    const supabase = createAdminClient()

    // 检查 profile 是否已存在 (幂等性保证)
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", data.userId)
      .maybeSingle()

    if (existingProfile) {
      console.log(`Profile already exists for user ${data.userId}`)
      return {
        success: true,
        message: "Profile already exists",
        alreadyExists: true,
      }
    }

    // 获取系统设置
    const settingsResult = await getSystemSettings()
    const registerPoints = settingsResult.data?.register_points || 100

    // 获取下一个用户编号
    const { data: maxUserNumber } = await supabase
      .from("profiles")
      .select("user_number")
      .order("user_number", { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextUserNumber = maxUserNumber?.user_number ? maxUserNumber.user_number + 1 : 100001

    // 生成邀请码
    const { data: invitationCode, error: codeError } = await supabase.rpc(
      "generate_invitation_code"
    )

    if (codeError) {
      console.error("Failed to generate invitation code:", codeError)
      // 如果生成失败,使用备用方案
      const fallbackCode = `U${Date.now().toString(36).toUpperCase().slice(-6)}`
      console.log("Using fallback invitation code:", fallbackCode)
    }

    const finalInvitationCode = invitationCode || `U${Date.now().toString(36).toUpperCase().slice(-6)}`

    // 清理用户名
    const sanitizedUsername = data.username
      ? sanitizeText(data.username)
      : data.email.split("@")[0]

    // 创建 profile
    const { data: newProfile, error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: data.userId,
        username: sanitizedUsername,
        email: data.email,
        user_number: nextUserNumber,
        invitation_code: finalInvitationCode,
        points: 0, // 🔥 修复：初始积分为 0，由 RPC 函数统一管理
        role: "user",
        is_merchant: false,
        consecutive_checkin_days: 0,
        report_count: 0,
        is_banned: false,
        login_failed_attempts: 0,
        created_at: data.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (profileError) {
      console.error("Failed to create profile:", profileError)
      console.error("Profile creation details:", {
        userId: data.userId,
        email: data.email,
        username: sanitizedUsername,
        userNumber: nextUserNumber,
        invitationCode: finalInvitationCode,
        errorCode: profileError.code,
        errorMessage: profileError.message,
        errorDetails: profileError.details,
        errorHint: profileError.hint,
      })
      const safeError = filterSupabaseError(profileError)
      logSecurityEvent("error", "创建用户profile失败", {
        error: safeError,
        userId: data.userId,
        email: data.email,
        username: sanitizedUsername,
      })
      return {
        success: false,
        error: `创建用户资料失败: ${profileError.message || "未知错误"}`,
        details: {
          code: profileError.code,
          hint: profileError.hint,
        }
      }
    }

    // 记录注册积分
    try {
      const { error: pointError } = await supabase.rpc("record_point_transaction", {
        p_user_id: data.userId,
        p_amount: registerPoints,
        p_type: "registration",
        p_description: `注册赠送积分 +${registerPoints}积分`,
        p_related_user_id: null,
        p_related_merchant_id: null,
        p_metadata: { source: "registration" },
      })

      if (pointError) {
        console.error("Failed to record registration points:", pointError)
        // 不阻断流程,只记录错误
      }
    } catch (err) {
      console.error("Error recording points:", err)
    }

    // 发送注册成功通知
    try {
      console.log(`[Profile] 准备发送注册通知给用户 ${data.userId}`)
      const { error: notifError } = await supabase.rpc("create_notification", {
        p_user_id: data.userId,
        p_type: "system",
        p_category: "registration",
        p_title: "注册奖励",
        p_content: `欢迎加入！注册成功，获得 ${registerPoints} 积分奖励！`,
        p_related_merchant_id: null,
        p_related_user_id: null,
        p_metadata: { points: registerPoints, source: "registration" },
        p_priority: "normal",
        p_expires_at: null,
      })

      if (notifError) {
        console.error("[Profile] 发送注册通知失败:", notifError)
        // 不阻断流程,只记录错误
      } else {
        console.log(`[Profile] 注册通知发送成功`)
      }
    } catch (err) {
      console.error("[Profile] 发送通知异常:", err)
    }

    console.log(`Profile created successfully for user ${data.userId}`)

    return {
      success: true,
      profile: newProfile,
      userNumber: nextUserNumber,
      invitationCode: finalInvitationCode,
      registerPoints,
    }
  } catch (error) {
    console.error("Error creating user profile:", error)
    logSecurityEvent("error", "创建用户profile异常", {
      error: error instanceof Error ? error.message : "Unknown error",
      userId: data.userId,
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建用户资料失败",
    }
  }
}

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
