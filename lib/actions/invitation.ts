"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { addPointsLog } from "./points"
import { createNotification } from "./notifications"
import { getSystemSettings } from "./settings"

/**
 * 检查并重置用户的邀请次数（如果需要）
 * @param userId 用户ID
 * @returns 重置后的用户邀请信息
 */
async function checkAndResetInvitations(userId: string) {
  const supabase = await createClient()

  // 获取系统设置
  const settingsResult = await getSystemSettings()
  const monthlyResetEnabled = settingsResult.data?.invitation_monthly_reset ?? true
  const systemMaxInvitations = settingsResult.data?.max_invitations_per_user || 5

  // 如果未启用按月重置，直接返回当前信息
  if (!monthlyResetEnabled) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("max_invitations, used_invitations, invitation_reset_month")
      .eq("id", userId)
      .maybeSingle()

    return {
      maxInvitations: profile?.max_invitations || systemMaxInvitations,
      usedInvitations: profile?.used_invitations || 0,
      needsReset: false
    }
  }

  // 获取当前月份（格式：YYYY-MM）
  const currentMonth = new Date().toISOString().substring(0, 7) // "2025-11"

  // 获取用户的邀请信息
  const { data: profile } = await supabase
    .from("profiles")
    .select("max_invitations, used_invitations, invitation_reset_month")
    .eq("id", userId)
    .maybeSingle()

  const maxInvitations = profile?.max_invitations || systemMaxInvitations
  const usedInvitations = profile?.used_invitations || 0
  const lastResetMonth = profile?.invitation_reset_month || currentMonth

  // 如果上次重置的月份不是当前月份，需要重置
  if (lastResetMonth !== currentMonth) {
    // 重置 used_invitations 为 0，并更新 invitation_reset_month
    const { error } = await supabase
      .from("profiles")
      .update({
        used_invitations: 0,
        invitation_reset_month: currentMonth
      })
      .eq("id", userId)

    if (error) {
      console.error("重置邀请次数失败:", error)
    } else {
      console.log(`用户 ${userId} 的邀请次数已重置（从 ${lastResetMonth} 到 ${currentMonth}）`)
    }

    return {
      maxInvitations,
      usedInvitations: 0, // 重置后为 0
      needsReset: true
    }
  }

  return {
    maxInvitations,
    usedInvitations,
    needsReset: false
  }
}

// 生成或获取用户的邀请码
export async function getUserInvitationCode() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("请先登录")
  }

  // 检查并重置邀请次数（如果需要）
  const { maxInvitations, usedInvitations } = await checkAndResetInvitations(user.id)

  const remainingInvitations = Math.max(maxInvitations - usedInvitations, 0)

  // 从 profile 中查询邀请码
  const { data: profile } = await supabase
    .from("profiles")
    .select("invitation_code")
    .eq("id", user.id)
    .maybeSingle()

  // 如果没有剩余次数，不允许生成邀请码（但如果已有邀请码，仍然返回）
  if (remainingInvitations <= 0 && !profile?.invitation_code) {
    throw new Error("您的邀请次数已用完，无法生成新的邀请码")
  }

  // 如果已有邀请码，直接返回
  if (profile?.invitation_code) {
    return profile.invitation_code
  }

  // 如果没有，生成一个新的邀请码
  const { data: code } = await supabase.rpc("generate_invitation_code")

  if (!code) {
    throw new Error("生成邀请码失败")
  }

  // 保存到 profile 中
  const { error } = await supabase
    .from("profiles")
    .update({ invitation_code: code })
    .eq("id", user.id)

  if (error) {
    throw new Error("保存邀请码失败")
  }

  return code
}

// 获取用户的邀请统计
export async function getInvitationStats() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("请先登录")
  }

  // 检查并重置邀请次数（如果需要）
  const { maxInvitations, usedInvitations, needsReset } = await checkAndResetInvitations(user.id)

  const remainingInvitations = Math.max(maxInvitations - usedInvitations, 0)

  // 只统计真实的邀请记录（invitee_id 不为空的记录）
  const { data: invitations, error } = await supabase
    .from("invitations")
    .select("*")
    .eq("inviter_id", user.id)
    .not("invitee_id", "is", null)  // 只查询有被邀请人的记录
    .order("created_at", { ascending: false })

  if (error) {
    console.error("获取邀请记录失败:", error)
    throw new Error(`获取邀请记录失败: ${error.message}`)
  }

  // 如果有被邀请人，获取他们的 profiles 信息
  const invitationsWithProfiles = await Promise.all(
    (invitations || []).map(async (inv) => {
      if (inv.invitee_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, email")
          .eq("id", inv.invitee_id)
          .maybeSingle()

        return {
          ...inv,
          profiles: profile
        }
      }
      return inv
    })
  )

  const completed = invitations?.filter((inv) => inv.status === "completed").length || 0
  const pending = invitations?.filter((inv) => inv.status === "pending").length || 0

  // 从系统设置获取邀请奖励积分
  const settingsResult = await getSystemSettings()
  const invitationPoints = settingsResult.data?.invitation_points || 100
  const totalRewards = completed * invitationPoints

  return {
    total: invitations?.length || 0,
    completed,
    pending,
    totalRewards,
    invitations: invitationsWithProfiles || [],
    maxInvitations,
    usedInvitations,
    remainingInvitations,
  }
}

// 验证邀请码并处理奖励（支持内测码和用户邀请码）
export async function processInvitationReward(invitationCode: string, inviteeId: string) {
  console.log("[服务端] 开始处理邀请奖励:", { invitationCode, inviteeId })
  const supabase = await createClient()

  // 🔒 速率限制：防止重复刷邀请奖励
  const { rateLimitCheck } = await import("@/lib/rate-limiter")
  const rateLimit = await rateLimitCheck(inviteeId, "USE_INVITATION")
  if (!rateLimit.allowed) {
    console.error(`[服务端] 使用邀请码过于频繁，请在 ${rateLimit.retryAfter} 秒后重试`)
    return null
  }

  // 先验证邀请码类型
  const validationResult = await validateInvitationCode(invitationCode)
  console.log("[服务端] 邀请码验证结果:", validationResult)

  if (!validationResult.valid) {
    console.error("[服务端] 邀请码无效")
    return null
  }

  // 如果是内测码，标记为已使用并给予邀请奖励
  if (validationResult.type === 'beta') {
    console.log("[服务端] 检测到内测码，标记为已使用并发放邀请奖励")
    const { useBetaCode } = await import("./beta-codes")
    const result = await useBetaCode(invitationCode, inviteeId)

    if (result.success) {
      console.log("[服务端] 内测码使用成功，开始发放邀请奖励")

      // 等待被邀请人的 profile 创建完成（最多等待5秒）
      let inviteeProfile = null
      for (let i = 0; i < 10; i++) {
        const { data } = await supabase
          .from("profiles")
          .select("id, points")
          .eq("id", inviteeId)
          .maybeSingle()

        console.log(`[服务端] 第${i + 1}次查询被邀请人 profile:`, data)

        if (data) {
          inviteeProfile = data
          break
        }

        // 等待500ms后重试
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      if (!inviteeProfile) {
        console.error("[服务端] 被邀请人的 profile 尚未创建，跳过奖励发放")
        return {
          success: true,
          type: 'beta',
          invitee_id: inviteeId,
        }
      }

      // 获取系统设置的邀请奖励积分
      const settingsResult = await getSystemSettings()
      const invitationPoints = settingsResult.data?.invitation_points || 100
      console.log(`[服务端] 邀请奖励积分配置: ${invitationPoints}`)

      try {
        // 给被邀请人增加积分（使用内测码的奖励）
        console.log(`[服务端] 给被邀请人增加${invitationPoints}积分`)
        await addPointsLog(
          inviteeId,
          invitationPoints,
          "invited_reward",
          `通过内测邀请码注册奖励 +${invitationPoints}积分`,
          null  // 内测码没有具体的邀请人
        )
        console.log("[服务端] 被邀请人积分更新成功")

        // 发送通知给被邀请人
        console.log("[服务端] 发送通知给被邀请人")
        await createNotification({
          userId: inviteeId,
          type: "transaction",
          category: "invited_reward",
          title: "注册奖励",
          content: `欢迎加入!通过内测邀请码注册,获得 ${invitationPoints} 积分奖励!`,
          relatedUserId: null,
          metadata: { points: invitationPoints, codeType: 'beta' },
        })
        console.log("[服务端] 被邀请人通知创建成功")
      } catch (error) {
        console.error("[服务端] 发放内测码邀请奖励失败:", error)
        // 不影响内测码使用成功的状态
      }

      return {
        success: true,
        type: 'beta',
        invitee_id: inviteeId,
      }
    } else {
      console.error("[服务端] 内测码使用失败:", result.error)
      return null
    }
  }

  // 如果是用户邀请码，继续原有的邀请奖励流程
  console.log("[服务端] 检测到用户邀请码，开始处理邀请奖励")

  // 通过邀请码查找邀请人
  const { data: inviterProfile, error: findError } = await supabase
    .from("profiles")
    .select("id, invitation_code, max_invitations, used_invitations")
    .eq("invitation_code", invitationCode)
    .maybeSingle()

  console.log("[服务端] 查找邀请人结果:", { inviterProfile, findError })

  if (findError || !inviterProfile) {
    console.error("[服务端] 邀请码不存在", findError)
    return null
  }

  // 防止自己邀请自己
  if (inviterProfile.id === inviteeId) {
    console.error("[服务端] 不能使用自己的邀请码")
    return null
  }

  // 检查邀请人是否还有剩余邀请次数
  const settingsResult = await getSystemSettings()
  const systemMaxInvitations = settingsResult.data?.max_invitations_per_user || 5
  const maxInvitations = inviterProfile.max_invitations || systemMaxInvitations
  const usedInvitations = inviterProfile.used_invitations || 0
  const remainingInvitations = Math.max(maxInvitations - usedInvitations, 0)

  console.log("[服务端] 邀请人邀请次数信息:", {
    maxInvitations,
    usedInvitations,
    remainingInvitations
  })

  if (remainingInvitations <= 0) {
    console.error("[服务端] 邀请人的邀请次数已用完")
    return null
  }

  console.log("[服务端] 开始等待被邀请人的 profile 创建...")
  // 等待被邀请人的 profile 创建完成（最多等待5秒）
  let inviteeProfile = null
  for (let i = 0; i < 10; i++) {
    const { data } = await supabase
      .from("profiles")
      .select("id, points")
      .eq("id", inviteeId)
      .maybeSingle()

    console.log(`[服务端] 第${i + 1}次查询被邀请人 profile:`, data)

    if (data) {
      inviteeProfile = data
      break
    }

    // 等待500ms后重试
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  if (!inviteeProfile) {
    console.error("[服务端] 被邀请人的 profile 尚未创建")
    return null
  }

  console.log("[服务端] 被邀请人 profile 已找到，检查是否已被邀请过...")

  // 检查被邀请人是否已经被邀请过
  const { data: existingInvitation } = await supabase
    .from("invitations")
    .select("id")
    .eq("invitee_id", inviteeId)
    .maybeSingle()

  console.log("[服务端] 检查已有邀请记录:", existingInvitation)

  if (existingInvitation) {
    console.error("[服务端] 该用户已经被邀请过")
    return null
  }

  console.log("[服务端] 所有检查通过，开始发放奖励...")

  // 开始事务处理
  try {
    // 1. 创建邀请记录 - 使用管理员客户端绕过 RLS
    console.log("[服务端] 步骤1: 创建邀请记录")
    const adminClient = createAdminClient()
    const { error: insertError } = await adminClient
      .from("invitations")
      .insert({
        inviter_id: inviterProfile.id,
        invitee_id: inviteeId,
        invitation_code: invitationCode,
        status: "completed",
        completed_at: new Date().toISOString(),
        inviter_rewarded: true,
        invitee_rewarded: true,
      })

    if (insertError) {
      console.error("[服务端] 创建邀请记录失败:", insertError)
      throw insertError
    }
    console.log("[服务端] 邀请记录创建成功")

    // 获取系统设置的邀请奖励积分
    const settingsResult = await getSystemSettings()
    const invitationPoints = settingsResult.data?.invitation_points || 100
    console.log(`[服务端] 邀请奖励积分配置: ${invitationPoints}`)

    // 2. 给邀请人增加积分
    console.log(`[服务端] 步骤2: 给邀请人增加${invitationPoints}积分`)
    // addPointsLog 内部会调用 recordPointTransaction,自动更新积分和记录交易
    await addPointsLog(
      inviterProfile.id,
      invitationPoints,
      "invitation_reward",
      `邀请好友注册奖励 +${invitationPoints}积分`,
      inviteeId,
    )
    console.log("[服务端] 邀请人积分更新成功")

    // 3. 给被邀请人增加积分（此时被邀请人已经有注册送的积分了，再加邀请奖励）
    console.log(`[服务端] 步骤3: 给被邀请人增加${invitationPoints}积分`)
    // addPointsLog 内部会调用 recordPointTransaction,自动更新积分和记录交易
    await addPointsLog(inviteeId, invitationPoints, "invited_reward", `通过邀请注册奖励 +${invitationPoints}积分`, inviterProfile.id)
    console.log("[服务端] 被邀请人积分更新成功")

    // 4. 发送通知给邀请人
    console.log("[服务端] 步骤4: 发送通知给邀请人")
    await createNotification({
      userId: inviterProfile.id,
      type: "transaction",
      category: "invitation_reward",
      title: "邀请好友成功",
      content: `您邀请的好友已成功注册,获得 ${invitationPoints} 积分奖励!`,
      relatedUserId: inviteeId,
      metadata: { points: invitationPoints },
    })
    console.log("[服务端] 邀请人通知创建成功")

    // 5. 发送通知给被邀请人
    console.log("[服务端] 步骤5: 发送通知给被邀请人")
    await createNotification({
      userId: inviteeId,
      type: "transaction",
      category: "invited_reward",
      title: "注册奖励",
      content: `欢迎加入!通过好友邀请注册,获得 ${invitationPoints} 积分奖励!`,
      relatedUserId: inviterProfile.id,
      metadata: { points: invitationPoints },
    })
    console.log("[服务端] 被邀请人通知创建成功")

    console.log("邀请奖励处理成功:", {
      inviter: inviterProfile.id,
      invitee: inviteeId,
    })

    return {
      success: true,
      inviter_id: inviterProfile.id,
      invitee_id: inviteeId,
    }
  } catch (error) {
    console.error("处理邀请奖励失败:", error)
    throw new Error("处理邀请奖励失败")
  }
}

// 验证邀请码是否有效（支持内测码和用户邀请码）
export async function validateInvitationCode(invitationCode: string): Promise<{
  valid: boolean
  type?: 'beta' | 'user'  // beta=内测码, user=用户邀请码
  betaCodeId?: string
}> {
  const supabase = await createClient()

  // 1. 先检查是否是有效的内测码
  const { validateBetaCode } = await import("./beta-codes")
  const betaCodeResult = await validateBetaCode(invitationCode)

  if (betaCodeResult.success && betaCodeResult.valid) {
    return {
      valid: true,
      type: 'beta',
      betaCodeId: betaCodeResult.betaCodeId
    }
  }

  // 2. 如果不是内测码，检查是否是用户邀请码
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, max_invitations, used_invitations")
    .eq("invitation_code", invitationCode)
    .maybeSingle()

  if (profile) {
    // 检查邀请人是否还有剩余邀请次数
    const settingsResult = await getSystemSettings()
    const systemMaxInvitations = settingsResult.data?.max_invitations_per_user || 5
    const maxInvitations = profile.max_invitations || systemMaxInvitations
    const usedInvitations = profile.used_invitations || 0
    const remainingInvitations = Math.max(maxInvitations - usedInvitations, 0)

    if (remainingInvitations > 0) {
      return {
        valid: true,
        type: 'user'
      }
    }
  }

  return { valid: false }
}
