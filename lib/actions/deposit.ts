"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { createNotification } from "./notifications"
import { getSystemSettings } from "./settings"

// 押金商家申请状态类型
export type DepositApplicationStatus = "pending" | "approved" | "rejected"

// 押金状态类型
export type DepositStatus = "unpaid" | "paid" | "refund_requested" | "refunded" | "violated"

// 押金商家申请记录类型
export interface DepositApplication {
  id: string
  merchant_id: string
  user_id: string
  deposit_amount: number
  payment_proof_url: string | null
  application_status: DepositApplicationStatus
  admin_note: string | null
  approved_by: string | null
  approved_at: string | null
  rejected_reason: string | null
  created_at: string
  updated_at: string
}

/**
 * 检查用户是否已有押金商家申请记录
 */
export async function checkDepositApplication(merchantId: string) {
  try {
    const supabase = await createClient()

    const { data: application, error } = await supabase
      .from("deposit_merchant_applications")
      .select("*")
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error

    return {
      success: true,
      data: application as DepositApplication | null,
    }
  } catch (error) {
    console.error("Error checking deposit application:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "检查申请记录失败",
    }
  }
}

/**
 * 创建押金商家申请
 */
export async function createDepositApplication(data: {
  merchantId: string
  depositAmount: number
  paymentProofUrl: string
  transactionHash?: string
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

    // 检查商家是否存在
    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("id, is_deposit_merchant")
      .eq("id", data.merchantId)
      .eq("user_id", user.id)
      .single()

    if (merchantError || !merchant) {
      return {
        success: false,
        error: "商家不存在或无权限",
      }
    }

    // 检查是否已经是押金商家
    if (merchant.is_deposit_merchant) {
      return {
        success: false,
        error: "您已经是押金商家",
      }
    }

    // 检查是否有待审核的申请
    const { data: existingApplication } = await supabase
      .from("deposit_merchant_applications")
      .select("id, application_status")
      .eq("merchant_id", data.merchantId)
      .eq("application_status", "pending")
      .maybeSingle()

    if (existingApplication) {
      return {
        success: false,
        error: "您已有待审核的申请，请等待审核结果",
      }
    }

    // 创建申请记录
    const { data: application, error: insertError } = await supabase
      .from("deposit_merchant_applications")
      .insert({
        merchant_id: data.merchantId,
        user_id: user.id,
        deposit_amount: data.depositAmount,
        payment_proof_url: data.paymentProofUrl,
        transaction_hash: data.transactionHash || null,
        application_status: "pending",
      })
      .select()
      .single()

    if (insertError) throw insertError

    revalidatePath("/merchant/dashboard")

    return {
      success: true,
      data: application,
    }
  } catch (error) {
    console.error("Error creating deposit application:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建申请失败",
    }
  }
}

/**
 * 获取押金商家信息
 */
export async function getDepositMerchantInfo(merchantId: string) {
  try {
    const supabase = await createClient()

    const { data: merchant, error } = await supabase
      .from("merchants")
      .select(
        `
        id,
        is_deposit_merchant,
        deposit_amount,
        deposit_status,
        deposit_paid_at,
        deposit_refund_requested_at,
        deposit_refund_completed_at,
        last_daily_login_reward_at,
        deposit_bonus_claimed
      `
      )
      .eq("id", merchantId)
      .single()

    if (error) throw error

    return {
      success: true,
      data: merchant,
    }
  } catch (error) {
    console.error("Error getting deposit merchant info:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取押金信息失败",
    }
  }
}

/**
 * 管理员审核押金申请（批准）
 */
export async function approveDepositApplication(applicationId: string, adminNote?: string) {
  try {
    const supabase = await createClient()

    // 获取当前用户
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new Error("请先登录")
    }

    // 检查是否是管理员
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
      throw new Error("只有管理员可以执行此操作")
    }

    // 使用管理员 client（绕过 RLS）
    const { createAdminClient } = await import("@/lib/supabase/server")
    const adminClient = createAdminClient()

    // 获取申请信息（包含商家和用户信息）
    const { data: application, error: appError } = await adminClient
      .from("deposit_merchant_applications")
      .select("*, merchants!inner(name, user_id)")
      .eq("id", applicationId)
      .single()

    if (appError || !application) {
      console.error("获取申请信息失败:", appError)
      throw new Error("申请不存在")
    }

    // 更新申请状态（使用 admin client）
    const { error: updateAppError } = await adminClient
      .from("deposit_merchant_applications")
      .update({
        application_status: "approved",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        admin_note: adminNote,
      })
      .eq("id", applicationId)

    if (updateAppError) throw updateAppError

    // 更新商家押金状态（使用 admin client）
    const { error: updateMerchantError } = await adminClient
      .from("merchants")
      .update({
        is_deposit_merchant: true,
        deposit_amount: application.deposit_amount,
        deposit_status: "paid",
        deposit_paid_at: new Date().toISOString(),
      })
      .eq("id", application.merchant_id)

    if (updateMerchantError) throw updateMerchantError

    // 发送通知给商家用户
    await createNotification({
      userId: application.merchants.user_id,
      type: "transaction",
      category: "deposit_approved",
      title: "押金申请已通过",
      content: `恭喜！您的商家【${application.merchants.name}】的押金申请已通过审核，押金金额：${application.deposit_amount} USDT。${adminNote ? `管理员备注：${adminNote}` : ""}`,
      priority: "high",
      relatedMerchantId: application.merchant_id,
    })

    // 记录管理员操作日志（使用 admin client）
    await adminClient.from("admin_operation_logs").insert({
      admin_id: user.id,
      operation_type: "approve_deposit",
      target_type: "deposit_application",
      target_id: applicationId,
      description: `批准商家【${application.merchants.name}】的押金申请，金额：${application.deposit_amount} USDT`,
      metadata: { admin_note: adminNote, deposit_amount: application.deposit_amount },
    })

    revalidatePath("/merchant/dashboard")
    revalidatePath("/admin/deposits/applications")
    revalidatePath("/")

    return {
      success: true,
    }
  } catch (error) {
    console.error("Error approving deposit application:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "批准申请失败",
    }
  }
}

/**
 * 管理员拒绝押金申请
 */
export async function rejectDepositApplication(applicationId: string, rejectedReason: string) {
  try {
    const supabase = await createClient()

    // 获取当前用户
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new Error("请先登录")
    }

    // 检查是否是管理员
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
      throw new Error("只有管理员可以执行此操作")
    }

    if (!rejectedReason || !rejectedReason.trim()) {
      throw new Error("请填写拒绝原因")
    }

    // 使用管理员 client（绕过 RLS）
    const { createAdminClient } = await import("@/lib/supabase/server")
    const adminClient = createAdminClient()

    // 获取申请信息（包含商家和用户信息）
    const { data: application, error: appError } = await adminClient
      .from("deposit_merchant_applications")
      .select("*, merchants!inner(name, user_id)")
      .eq("id", applicationId)
      .single()

    if (appError || !application) {
      console.error("获取申请信息失败:", appError)
      throw new Error("申请不存在")
    }

    // 更新申请状态（使用 admin client）
    const { error: updateError } = await adminClient
      .from("deposit_merchant_applications")
      .update({
        application_status: "rejected",
        rejected_reason: rejectedReason,
      })
      .eq("id", applicationId)

    if (updateError) throw updateError

    // 发送通知给商家用户
    await createNotification({
      userId: application.merchants.user_id,
      type: "transaction",
      category: "deposit_rejected",
      title: "押金申请未通过",
      content: `很抱歉，您的商家【${application.merchants.name}】的押金申请未通过审核。原因：${rejectedReason}`,
      priority: "high",
      relatedMerchantId: application.merchant_id,
    })

    // 记录管理员操作日志（使用 admin client）
    await adminClient.from("admin_operation_logs").insert({
      admin_id: user.id,
      operation_type: "reject_deposit",
      target_type: "deposit_application",
      target_id: applicationId,
      description: `拒绝商家【${application.merchants.name}】的押金申请`,
      metadata: { rejected_reason: rejectedReason, deposit_amount: application.deposit_amount },
    })

    revalidatePath("/merchant/dashboard")
    revalidatePath("/admin/deposits/applications")
    revalidatePath("/")

    return {
      success: true,
    }
  } catch (error) {
    console.error("Error rejecting deposit application:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "拒绝申请失败",
    }
  }
}

/**
 * 领取每日登录奖励（押金商家）
 */
export async function claimDailyLoginReward() {
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

    // 获取用户的押金商家信息
    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("id, is_deposit_merchant, deposit_status, last_daily_login_reward_at")
      .eq("user_id", user.id)
      .single()

    if (merchantError || !merchant) {
      return {
        success: false,
        error: "未找到商家信息",
      }
    }

    // 检查是否是押金商家
    if (!merchant.is_deposit_merchant || merchant.deposit_status !== "paid") {
      return {
        success: false,
        error: "只有押金商家可以领取每日登录奖励",
      }
    }

    // 检查今天是否已经领取过
    const today = new Date().toISOString().split("T")[0]
    const lastRewardDate = merchant.last_daily_login_reward_at
      ? new Date(merchant.last_daily_login_reward_at).toISOString().split("T")[0]
      : null

    if (lastRewardDate === today) {
      return {
        success: false,
        error: "今天已经领取过奖励了",
        alreadyClaimed: true,
      }
    }

    // 从系统设置获取每日奖励积分
    const settingsResult = await getSystemSettings()
    const rewardPoints = settingsResult.data?.deposit_merchant_daily_reward || 50

    // 先更新用户积分
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("points")
      .eq("id", user.id)
      .single()

    if (profileError || !profile) {
      throw new Error("获取用户积分失败")
    }

    const newPoints = profile.points + rewardPoints

    const { error: updatePointsError } = await supabase
      .from("profiles")
      .update({ points: newPoints })
      .eq("id", user.id)

    if (updatePointsError) throw updatePointsError

    // 记录积分交易（此时profiles已经更新，函数会读取新积分作为balance_after）
    const { error: pointsError } = await supabase.rpc("record_point_transaction", {
      p_user_id: user.id,
      p_amount: rewardPoints,
      p_type: "daily_login",
      p_description: "押金商家每日登录奖励",
      p_related_user_id: null,
      p_related_merchant_id: merchant.id,
      p_metadata: null,
    })

    if (pointsError) throw pointsError

    // 更新商家最后领取时间
    const { error: updateError } = await supabase
      .from("merchants")
      .update({
        last_daily_login_reward_at: new Date().toISOString(),
      })
      .eq("id", merchant.id)

    if (updateError) throw updateError

    // 记录到每日登录奖励表
    await supabase.from("daily_login_rewards").insert({
      user_id: user.id,
      merchant_id: merchant.id,
      is_deposit_merchant: true,
      reward_points: rewardPoints,
      login_date: today,
    })

    revalidatePath("/merchant/dashboard")

    return {
      success: true,
      rewardPoints,
    }
  } catch (error) {
    console.error("Error claiming daily login reward:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "领取奖励失败",
    }
  }
}

/**
 * 检查今天是否已领取每日奖励
 */
export async function checkDailyRewardStatus() {
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

    // 获取用户的押金商家信息
    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("id, is_deposit_merchant, deposit_status, last_daily_login_reward_at")
      .eq("user_id", user.id)
      .single()

    if (merchantError || !merchant) {
      return {
        success: true,
        canClaim: false,
        isDepositMerchant: false,
      }
    }

    // 不是押金商家
    if (!merchant.is_deposit_merchant || merchant.deposit_status !== "paid") {
      return {
        success: true,
        canClaim: false,
        isDepositMerchant: false,
      }
    }

    // 检查今天是否已经领取过
    const today = new Date().toISOString().split("T")[0]
    const lastRewardDate = merchant.last_daily_login_reward_at
      ? new Date(merchant.last_daily_login_reward_at).toISOString().split("T")[0]
      : null

    const canClaim = lastRewardDate !== today

    return {
      success: true,
      canClaim,
      isDepositMerchant: true,
      lastRewardDate: merchant.last_daily_login_reward_at,
    }
  } catch (error) {
    console.error("Error checking daily reward status:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "检查状态失败",
    }
  }
}

/**
 * 领取押金商家审核通过奖励（一次性1000积分）
 */
export async function claimDepositBonus() {
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

    // 获取用户的商家信息
    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("id, name, is_deposit_merchant, deposit_status, deposit_bonus_claimed")
      .eq("user_id", user.id)
      .single()

    if (merchantError || !merchant) {
      return {
        success: false,
        error: "未找到商家信息",
      }
    }

    // 检查是否是押金商家
    if (!merchant.is_deposit_merchant || merchant.deposit_status !== "paid") {
      return {
        success: false,
        error: "只有押金商家可以领取此奖励",
      }
    }

    // 检查是否已经领取过
    if (merchant.deposit_bonus_claimed) {
      return {
        success: false,
        error: "您已经领取过此奖励",
        alreadyClaimed: true,
      }
    }

    // 从系统设置获取押金商家审核通过奖励积分
    const settingsResult = await getSystemSettings()
    const bonusPoints = settingsResult.data?.deposit_merchant_apply_reward || 1000

    // 先更新用户积分
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("points")
      .eq("id", user.id)
      .single()

    if (profileError || !profile) {
      throw new Error("获取用户积分失败")
    }

    const newPoints = profile.points + bonusPoints

    const { error: updatePointsError } = await supabase
      .from("profiles")
      .update({ points: newPoints })
      .eq("id", user.id)

    if (updatePointsError) throw updatePointsError

    // 记录积分交易
    const { error: pointsError } = await supabase.rpc("record_point_transaction", {
      p_user_id: user.id,
      p_amount: bonusPoints,
      p_type: "merchant_register",
      p_description: "押金商家审核通过奖励（一次性）",
      p_related_user_id: null,
      p_related_merchant_id: merchant.id,
      p_metadata: null,
    })

    if (pointsError) throw pointsError

    // 更新商家的领取状态
    const { error: updateMerchantError } = await supabase
      .from("merchants")
      .update({
        deposit_bonus_claimed: true,
      })
      .eq("id", merchant.id)

    if (updateMerchantError) throw updateMerchantError

    // 发送通知
    await createNotification({
      userId: user.id,
      type: "merchant",
      category: "deposit_bonus_claimed",
      title: "押金商家奖励已领取",
      content: `恭喜！您已成功领取押金商家审核通过奖励，获得 ${bonusPoints} 积分`,
      priority: "normal",
      relatedMerchantId: merchant.id,
    })

    revalidatePath("/merchant/dashboard")

    return {
      success: true,
      bonusPoints,
    }
  } catch (error) {
    console.error("Error claiming deposit bonus:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "领取奖励失败",
    }
  }
}

/**
 * 计算退还手续费
 */
function calculateRefundFee(depositAmount: number, depositPaidAt: string): {
  feeRate: number
  feeAmount: number
  refundAmount: number
} {
  const paidDate = new Date(depositPaidAt)
  const now = new Date()
  const monthsDiff = (now.getTime() - paidDate.getTime()) / (1000 * 60 * 60 * 24 * 30)

  let feeRate = 0
  if (monthsDiff < 3) {
    feeRate = 30 // 3个月内：30%手续费
  } else {
    feeRate = 15 // 3个月后：15%手续费
  }

  const feeAmount = Math.round(depositAmount * feeRate) / 100
  const refundAmount = depositAmount - feeAmount

  return { feeRate, feeAmount, refundAmount }
}

/**
 * 创建押金退还申请
 */
export async function createDepositRefundApplication(data: {
  merchantId: string
  reason: string
  walletAddress: string
  walletNetwork: "TRC20" | "ERC20" | "BEP20"
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

    // 获取商家信息
    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("*")
      .eq("id", data.merchantId)
      .eq("user_id", user.id)
      .single()

    if (merchantError || !merchant) {
      return {
        success: false,
        error: "商家信息不存在",
      }
    }

    // 检查是否是押金商家
    if (!merchant.is_deposit_merchant || merchant.deposit_status !== "paid") {
      return {
        success: false,
        error: "只有已支付押金的商家才能申请退还",
      }
    }

    // 检查是否已有待处理的申请(只检查pending状态)
    const { data: existingApp } = await supabase
      .from("deposit_refund_applications")
      .select("id, application_status")
      .eq("merchant_id", data.merchantId)
      .eq("application_status", "pending")
      .maybeSingle()

    if (existingApp) {
      return {
        success: false,
        error: "您已有待处理的退还申请，请等待审核结果",
      }
    }

    // 计算手续费
    const { feeRate, feeAmount, refundAmount } = calculateRefundFee(
      merchant.deposit_amount,
      merchant.deposit_paid_at
    )

    // 创建退还申请
    const { data: application, error: insertError } = await supabase
      .from("deposit_refund_applications")
      .insert({
        merchant_id: data.merchantId,
        user_id: user.id,
        deposit_amount: merchant.deposit_amount,
        deposit_paid_at: merchant.deposit_paid_at,
        refund_amount: refundAmount,
        fee_amount: feeAmount,
        fee_rate: feeRate,
        reason: data.reason,
        wallet_address: data.walletAddress,
        wallet_network: data.walletNetwork,
        application_status: "pending",
      })
      .select()
      .single()

    if (insertError) throw insertError

    // 更新商家表的退还状态
    await supabase
      .from("merchants")
      .update({
        deposit_refund_requested_at: new Date().toISOString(),
        deposit_refund_status: "pending",
      })
      .eq("id", data.merchantId)

    revalidatePath("/merchant/dashboard")

    return {
      success: true,
      data: application,
      refundInfo: {
        feeRate,
        feeAmount,
        refundAmount,
      },
    }
  } catch (error) {
    console.error("Error creating deposit refund application:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建申请失败",
    }
  }
}

/**
 * 获取押金退还申请信息
 */
export async function getDepositRefundApplication(merchantId: string) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("deposit_refund_applications")
      .select("*")
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error && error.code !== "PGRST116") {
      throw error
    }

    return {
      success: true,
      data,
    }
  } catch (error) {
    console.error("Error getting deposit refund application:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取申请失败",
    }
  }
}

/**
 * 撤回押金退还申请（仅pending状态）
 */
export async function cancelDepositRefundApplication(applicationId: string) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return {
        success: false,
        error: "未登录",
      }
    }

    // 获取申请信息
    const { data: application } = await supabase
      .from("deposit_refund_applications")
      .select("merchant_id, application_status")
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .single()

    if (!application) {
      return {
        success: false,
        error: "申请不存在",
      }
    }

    if (application.application_status !== "pending") {
      return {
        success: false,
        error: "只能撤回待审核的申请",
      }
    }

    // 删除申请
    const { error: deleteError } = await supabase
      .from("deposit_refund_applications")
      .delete()
      .eq("id", applicationId)

    if (deleteError) throw deleteError

    // 更新商家表
    await supabase
      .from("merchants")
      .update({
        deposit_refund_status: "none",
      })
      .eq("id", application.merchant_id)

    revalidatePath("/merchant/dashboard")

    return {
      success: true,
    }
  } catch (error) {
    console.error("Error canceling deposit refund application:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "撤回申请失败",
    }
  }
}

// ==================== 管理员功能 ====================

/**
 * 获取待审核的押金申请列表 (管理员)
 */
export async function getPendingDepositApplications(params?: { page?: number; pageSize?: number }) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      throw new Error("请先登录")
    }

    // 检查是否是管理员
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profileError) {
      throw new Error("查询用户权限失败")
    }

    if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
      throw new Error("只有管理员可以访问")
    }

    const page = params?.page || 1
    const pageSize = params?.pageSize || 20
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    // 使用管理员 client（绕过 RLS）
    const { createAdminClient } = await import("@/lib/supabase/server")
    const adminClient = createAdminClient()

    // 查询待审核的押金申请
    const { data, error, count } = await adminClient
      .from("deposit_merchant_applications")
      .select("*, merchants!inner(name, user_id)", { count: "exact" })
      .eq("application_status", "pending")
      .order("created_at", { ascending: false })
      .range(from, to)

    if (error) {
      console.error("Error fetching pending deposit applications:", error)
      throw new Error("获取待审核押金申请列表失败")
    }

    // 如果没有数据，直接返回
    if (!data || data.length === 0) {
      return {
        applications: [],
        total: 0,
        page,
        pageSize,
      }
    }

    // 获取所有用户ID
    const userIds = data.map((app: any) => app.user_id)

    // 查询用户资料（从 profiles 表）
    const { data: profiles } = await adminClient.from("profiles").select("id, username").in("id", userIds)

    // 查询用户邮箱（从 auth.users 表）
    const emailMap = new Map<string, string>()
    for (const userId of userIds) {
      try {
        const { data: authUser } = await adminClient.auth.admin.getUserById(userId)
        if (authUser && authUser.user) {
          emailMap.set(userId, authUser.user.email || "")
        }
      } catch (error) {
        console.error(`Error fetching email for user ${userId}:`, error)
      }
    }

    // 将用户资料和邮箱合并到申请数据中
    const applicationsWithProfiles = data.map((app: any) => {
      const profile = profiles?.find((p: any) => p.id === app.user_id)
      return {
        ...app,
        profiles: profile || { username: "未知用户" },
        user_email: emailMap.get(app.user_id) || null,
      }
    })

    return {
      applications: applicationsWithProfiles,
      total: count || 0,
      page,
      pageSize,
    }
  } catch (error) {
    console.error("getPendingDepositApplications error:", error)
    throw error
  }
}

/**
 * 获取待审核的押金退还申请列表 (管理员)
 */
export async function getPendingDepositRefundApplications(params?: { page?: number; pageSize?: number }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("请先登录")
  }

  // 检查是否是管理员
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
    throw new Error("只有管理员可以访问")
  }

  const page = params?.page || 1
  const pageSize = params?.pageSize || 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  // 使用管理员 client（绕过 RLS）
  const { createAdminClient } = await import("@/lib/supabase/server")
  const adminClient = createAdminClient()

  // 查询待审核的退还申请
  const { data, error, count } = await adminClient
    .from("deposit_refund_applications")
    .select("*, merchants!inner(name, user_id)", { count: "exact" })
    .eq("application_status", "pending")
    .order("created_at", { ascending: false })
    .range(from, to)

  if (error) {
    console.error("Error fetching pending deposit refund applications:", error)
    throw new Error("获取待审核退还申请列表失败")
  }

  // 如果没有数据，直接返回
  if (!data || data.length === 0) {
    return {
      applications: [],
      total: 0,
      page,
      pageSize,
    }
  }

  // 获取所有用户ID
  const userIds = data.map((app: any) => app.user_id)

  // 查询用户资料（从 profiles 表）
  const { data: profiles } = await adminClient.from("profiles").select("id, username").in("id", userIds)

  // 查询用户邮箱（从 auth.users 表）
  const emailMap = new Map<string, string>()
  for (const userId of userIds) {
    try {
      const { data: authUser } = await adminClient.auth.admin.getUserById(userId)
      if (authUser && authUser.user) {
        emailMap.set(userId, authUser.user.email || "")
      }
    } catch (error) {
      console.error(`Error fetching email for user ${userId}:`, error)
    }
  }

  // 将用户资料和邮箱合并到申请数据中
  const applicationsWithProfiles = data.map((app: any) => {
    const profile = profiles?.find((p: any) => p.id === app.user_id)
    return {
      ...app,
      profiles: profile || { username: "未知用户" },
      user_email: emailMap.get(app.user_id) || null,
    }
  })

  return {
    applications: applicationsWithProfiles,
    total: count || 0,
    page,
    pageSize,
  }
}

/**
 * 批准押金退还申请 (管理员)
 */
export async function approveDepositRefundApplication(applicationId: string, transactionHash: string, adminNote?: string) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      throw new Error("请先登录")
    }

    // 检查是否是管理员
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
      throw new Error("只有管理员可以执行此操作")
    }

    if (!transactionHash || !transactionHash.trim()) {
      throw new Error("请填写退款交易哈希")
    }

    // 使用管理员 client（绕过 RLS）
    const { createAdminClient } = await import("@/lib/supabase/server")
    const adminClient = createAdminClient()

    // 获取申请信息
    const { data: application, error: appError } = await adminClient
      .from("deposit_refund_applications")
      .select("*, merchants!inner(name, user_id)")
      .eq("id", applicationId)
      .single()

    if (appError || !application) {
      console.error("获取退还申请信息失败:", appError)
      throw new Error("申请不存在")
    }

    // 更新申请状态（使用 admin client）
    const { error: updateAppError } = await adminClient
      .from("deposit_refund_applications")
      .update({
        application_status: "approved",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_note: adminNote,
        transaction_hash: transactionHash,
        completed_at: new Date().toISOString(),
      })
      .eq("id", applicationId)

    if (updateAppError) throw updateAppError

    // 更新商家状态：收回押金商家权益，恢复为普通商家（使用 admin client）
    const { error: updateMerchantError } = await adminClient
      .from("merchants")
      .update({
        // 收回押金商家身份
        is_deposit_merchant: false,

        // 更新押金状态为已退还
        deposit_status: "refunded",
        deposit_amount: 0,
        deposit_refund_status: "completed",
        deposit_refund_completed_at: new Date().toISOString(),

        // 清除每日登录奖励时间（收回每日50积分奖励权益）
        last_daily_login_reward_at: null,
      })
      .eq("id", application.merchant_id)

    if (updateMerchantError) throw updateMerchantError

    // 发送通知给商家用户
    await createNotification({
      userId: application.merchants.user_id,
      type: "transaction",
      category: "deposit_refund_approved",
      title: "押金退还已完成",
      content: `您的商家【${application.merchants.name}】的押金退还已完成，退还金额：${application.refund_amount} USDT（手续费：${application.fee_amount} USDT）。交易哈希：${transactionHash}。您的商家已恢复为普通商家，押金商家权益已收回（已认证身份和每日50积分奖励）。${adminNote ? ` 管理员备注：${adminNote}` : ""}`,
      priority: "high",
      relatedMerchantId: application.merchant_id,
      metadata: { transaction_hash: transactionHash },
    })

    // 记录管理员操作日志（使用 admin client）
    await adminClient.from("admin_operation_logs").insert({
      admin_id: user.id,
      operation_type: "approve_deposit_refund",
      target_type: "deposit_refund_application",
      target_id: applicationId,
      description: `批准商家【${application.merchants.name}】的押金退还申请，退还金额：${application.refund_amount} USDT`,
      metadata: {
        admin_note: adminNote,
        refund_amount: application.refund_amount,
        fee_amount: application.fee_amount,
        transaction_hash: transactionHash,
      },
    })

    revalidatePath("/merchant/dashboard")
    revalidatePath("/admin/deposits/refunds")
    revalidatePath("/")

    return {
      success: true,
    }
  } catch (error) {
    console.error("Error approving deposit refund application:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "批准退还失败",
    }
  }
}

/**
 * 拒绝押金退还申请 (管理员)
 */
export async function rejectDepositRefundApplication(applicationId: string, rejectedReason: string) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      throw new Error("请先登录")
    }

    // 检查是否是管理员
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
      throw new Error("只有管理员可以执行此操作")
    }

    if (!rejectedReason || !rejectedReason.trim()) {
      throw new Error("请填写拒绝原因")
    }

    // 使用管理员 client（绕过 RLS）
    const { createAdminClient } = await import("@/lib/supabase/server")
    const adminClient = createAdminClient()

    // 获取申请信息（使用 admin client）
    const { data: application, error: appError } = await adminClient
      .from("deposit_refund_applications")
      .select("*, merchants!inner(name, user_id)")
      .eq("id", applicationId)
      .single()

    if (appError || !application) {
      console.error("获取退还申请信息失败:", appError)
      throw new Error("申请不存在")
    }

    // 更新申请状态（使用 admin client）
    const { error: updateError } = await adminClient
      .from("deposit_refund_applications")
      .update({
        application_status: "rejected",
        rejected_reason: rejectedReason,
      })
      .eq("id", applicationId)

    if (updateError) throw updateError

    // 更新商家押金状态（使用 admin client）
    await adminClient
      .from("merchants")
      .update({
        deposit_refund_status: "rejected",
      })
      .eq("id", application.merchant_id)

    // 发送通知给商家用户
    await createNotification({
      userId: application.merchants.user_id,
      type: "transaction",
      category: "deposit_refund_rejected",
      title: "押金退还申请未通过",
      content: `很抱歉，您的商家【${application.merchants.name}】的押金退还申请未通过审核。原因：${rejectedReason}`,
      priority: "high",
      relatedMerchantId: application.merchant_id,
    })

    // 记录管理员操作日志（使用 admin client）
    await adminClient.from("admin_operation_logs").insert({
      admin_id: user.id,
      operation_type: "reject_deposit_refund",
      target_type: "deposit_refund_application",
      target_id: applicationId,
      description: `拒绝商家【${application.merchants.name}】的押金退还申请`,
      metadata: { rejected_reason: rejectedReason, refund_amount: application.refund_amount },
    })

    revalidatePath("/merchant/dashboard")
    revalidatePath("/admin/deposits/refunds")
    revalidatePath("/")

    return {
      success: true,
    }
  } catch (error) {
    console.error("Error rejecting deposit refund application:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "拒绝退还失败",
    }
  }
}
