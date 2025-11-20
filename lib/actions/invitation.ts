"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { addPointsLog, updateUserPoints } from "./points"
import { createNotification } from "./notifications"
import { getSystemSettings } from "./settings"

// 生成或获取用户的邀请码
export async function getUserInvitationCode() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("请先登录")
  }

  // 从 profile 中查询邀请码
  const { data: profile } = await supabase
    .from("profiles")
    .select("invitation_code")
    .eq("id", user.id)
    .maybeSingle()

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
  }
}

// 验证邀请码并处理奖励
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

  // 通过邀请码查找邀请人
  const { data: inviterProfile, error: findError } = await supabase
    .from("profiles")
    .select("id, invitation_code")
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
    // 先记录交易（读取旧余额），再更新积分
    await addPointsLog(
      inviterProfile.id,
      invitationPoints,
      "invitation_reward",
      `邀请好友注册奖励 +${invitationPoints}积分`,
      inviteeId,
    )
    console.log("[服务端] 邀请人积分日志创建成功")

    await updateUserPoints(inviterProfile.id, invitationPoints)
    console.log("[服务端] 邀请人积分更新成功")

    // 3. 给被邀请人增加积分（此时被邀请人已经有注册送的积分了，再加邀请奖励）
    console.log(`[服务端] 步骤3: 给被邀请人增加${invitationPoints}积分`)
    // 先记录交易（读取旧余额），再更新积分
    await addPointsLog(inviteeId, invitationPoints, "invited_reward", `通过邀请注册奖励 +${invitationPoints}积分`, inviterProfile.id)
    console.log("[服务端] 被邀请人积分日志创建成功")

    await updateUserPoints(inviteeId, invitationPoints)
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

// 验证邀请码是否有效
export async function validateInvitationCode(invitationCode: string) {
  const supabase = await createClient()

  // 从 profiles 表中查询邀请码
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("invitation_code", invitationCode)
    .maybeSingle()

  return !!profile
}
