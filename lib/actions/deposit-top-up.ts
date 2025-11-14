"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface DepositTopUpApplication {
  id: string
  merchant_id: string
  user_id: string
  original_amount: number
  top_up_amount: number
  total_amount: number
  transaction_hash: string | null
  payment_proof_url: string | null
  application_status: "pending" | "approved" | "rejected"
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
  // 关联信息
  merchant_name?: string
  merchant_logo?: string
  merchant_current_deposit?: number
  applicant_username?: string
  applicant_email?: string
  approver_username?: string
  approver_email?: string
}

/**
 * 创建追加押金申请
 */
export async function createDepositTopUpApplication(data: {
  merchantId: string
  topUpAmount: number
  transactionHash?: string
  paymentProofUrl?: string
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录" }
  }

  try {
    console.log("[DEBUG] Starting createDepositTopUpApplication with data:", {
      merchantId: data.merchantId,
      userId: user.id,
      topUpAmount: data.topUpAmount,
    })

    // 验证商家是否存在且是押金商家
    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("id, deposit_amount, is_deposit_merchant, user_id")
      .eq("id", data.merchantId)
      .single()

    console.log("[DEBUG] Merchant query result:", { merchant, merchantError })

    if (merchantError || !merchant) {
      console.error("[ERROR] Merchant not found:", merchantError)
      return { success: false, error: "商家不存在" }
    }

    if (merchant.user_id !== user.id) {
      console.error("[ERROR] User does not own merchant:", {
        merchantUserId: merchant.user_id,
        currentUserId: user.id,
      })
      return { success: false, error: "无权操作此商家" }
    }

    if (!merchant.is_deposit_merchant) {
      console.error("[ERROR] Merchant is not a deposit merchant")
      return { success: false, error: "该商家不是押金商家" }
    }

    // 检查是否有待审核的追加申请
    const { data: pendingApps, error: pendingError } = await supabase
      .from("deposit_top_up_applications")
      .select("id")
      .eq("merchant_id", data.merchantId)
      .eq("application_status", "pending")

    console.log("[DEBUG] Pending applications check:", { pendingApps, pendingError })

    if (pendingApps && pendingApps.length > 0) {
      console.log("[INFO] Found existing pending application, returning error")
      return { success: false, error: "已有待审核的追加申请,请等待审核完成" }
    }

    // 创建追加申请
    const originalAmount = merchant.deposit_amount || 0
    const totalAmount = originalAmount + data.topUpAmount

    console.log("[DEBUG] Preparing to insert application:", {
      merchant_id: data.merchantId,
      user_id: user.id,
      original_amount: originalAmount,
      top_up_amount: data.topUpAmount,
      total_amount: totalAmount,
    })

    const { error: insertError } = await supabase
      .from("deposit_top_up_applications")
      .insert({
        merchant_id: data.merchantId,
        user_id: user.id,
        original_amount: originalAmount,
        top_up_amount: data.topUpAmount,
        total_amount: totalAmount,
        transaction_hash: data.transactionHash || null,
        payment_proof_url: data.paymentProofUrl || null,
        application_status: "pending",
      })

    if (insertError) {
      console.error("[ERROR] Insert failed:", insertError)
      return { success: false, error: insertError.message }
    }

    console.log("[SUCCESS] Top-up application created successfully")

    revalidatePath("/merchant/dashboard")
    return { success: true }
  } catch (error: any) {
    console.error("Error in createDepositTopUpApplication:", error)
    return { success: false, error: error.message }
  }
}

/**
 * 获取商家的追加申请列表
 */
export async function getMerchantTopUpApplications(merchantId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录", data: null }
  }

  try {
    const { data, error } = await supabase
      .from("deposit_top_up_applications_with_details")
      .select("*")
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching top-up applications:", error)
      return { success: false, error: error.message, data: null }
    }

    return { success: true, data: data as DepositTopUpApplication[] }
  } catch (error: any) {
    console.error("Error in getMerchantTopUpApplications:", error)
    return { success: false, error: error.message, data: null }
  }
}

/**
 * 获取所有追加申请(管理员)
 */
export async function getAllTopUpApplications(status?: "pending" | "approved" | "rejected") {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录", data: null }
  }

  // 验证管理员权限
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
    return { success: false, error: "无权限操作", data: null }
  }

  try {
    let query = supabase
      .from("deposit_top_up_applications_with_details")
      .select("*")
      .order("created_at", { ascending: false })

    if (status) {
      query = query.eq("application_status", status)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching all top-up applications:", error)
      return { success: false, error: error.message, data: null }
    }

    return { success: true, data: data as DepositTopUpApplication[] }
  } catch (error: any) {
    console.error("Error in getAllTopUpApplications:", error)
    return { success: false, error: error.message, data: null }
  }
}

/**
 * 审核通过追加申请(管理员)
 */
export async function approveTopUpApplication(applicationId: string, adminNote?: string) {
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

  if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
    return { success: false, error: "无权限操作" }
  }

  try {
    // 获取申请信息
    const { data: application, error: appError } = await supabase
      .from("deposit_top_up_applications")
      .select("*, merchants!inner(*)")
      .eq("id", applicationId)
      .single()

    if (appError || !application) {
      return { success: false, error: "申请不存在" }
    }

    if (application.application_status !== "pending") {
      return { success: false, error: "该申请已被处理" }
    }

    // 更新申请状态
    const { error: updateError } = await supabase
      .from("deposit_top_up_applications")
      .update({
        application_status: "approved",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", applicationId)

    if (updateError) {
      console.error("Error updating application:", updateError)
      return { success: false, error: updateError.message }
    }

    // 更新商家押金金额
    const { error: merchantError } = await supabase
      .from("merchants")
      .update({
        deposit_amount: application.total_amount,
      })
      .eq("id", application.merchant_id)

    if (merchantError) {
      console.error("Error updating merchant deposit:", merchantError)
      return { success: false, error: "更新商家押金失败" }
    }

    // 发送通知给商家
    const { createNotification } = await import("./notifications")
    await createNotification({
      userId: application.user_id,
      type: "system",
      category: "deposit_top_up",
      title: "押金追加申请已通过",
      content: `您的押金追加申请已通过审核。追加金额: ${application.top_up_amount} USDT,当前押金总额: ${application.total_amount} USDT。${
        adminNote ? `管理员备注: ${adminNote}` : ""
      }`,
    })

    revalidatePath("/admin/deposits/top-ups")
    revalidatePath("/merchant/dashboard")
    return { success: true }
  } catch (error: any) {
    console.error("Error in approveTopUpApplication:", error)
    return { success: false, error: error.message }
  }
}

/**
 * 拒绝追加申请(管理员)
 */
export async function rejectTopUpApplication(applicationId: string, rejectionReason: string) {
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

  if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
    return { success: false, error: "无权限操作" }
  }

  if (!rejectionReason.trim()) {
    return { success: false, error: "请填写拒绝原因" }
  }

  try {
    // 获取申请信息
    const { data: application, error: appError } = await supabase
      .from("deposit_top_up_applications")
      .select("*")
      .eq("id", applicationId)
      .single()

    if (appError || !application) {
      return { success: false, error: "申请不存在" }
    }

    if (application.application_status !== "pending") {
      return { success: false, error: "该申请已被处理" }
    }

    // 更新申请状态
    const { error: updateError } = await supabase
      .from("deposit_top_up_applications")
      .update({
        application_status: "rejected",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        rejection_reason: rejectionReason,
      })
      .eq("id", applicationId)

    if (updateError) {
      console.error("Error updating application:", updateError)
      return { success: false, error: updateError.message }
    }

    // 发送通知给商家
    const { createNotification } = await import("./notifications")
    await createNotification({
      userId: application.user_id,
      type: "system",
      category: "deposit_top_up",
      title: "押金追加申请被拒绝",
      content: `很遗憾,您的押金追加申请未通过审核。拒绝原因: ${rejectionReason}`,
    })

    revalidatePath("/admin/deposits/top-ups")
    revalidatePath("/merchant/dashboard")
    return { success: true }
  } catch (error: any) {
    console.error("Error in rejectTopUpApplication:", error)
    return { success: false, error: error.message }
  }
}

/**
 * 获取追加申请统计(管理员)
 */
export async function getTopUpApplicationsStats() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { total: 0, pending: 0, approved: 0, rejected: 0 }
  }

  // 验证管理员权限
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
    return { total: 0, pending: 0, approved: 0, rejected: 0 }
  }

  try {
    const { data, error } = await supabase
      .from("deposit_top_up_applications")
      .select("application_status")

    if (error) {
      console.error("Error fetching stats:", error)
      return { total: 0, pending: 0, approved: 0, rejected: 0 }
    }

    const stats = {
      total: data.length,
      pending: data.filter((app) => app.application_status === "pending").length,
      approved: data.filter((app) => app.application_status === "approved").length,
      rejected: data.filter((app) => app.application_status === "rejected").length,
    }

    return stats
  } catch (error: any) {
    console.error("Error in getTopUpApplicationsStats:", error)
    return { total: 0, pending: 0, approved: 0, rejected: 0 }
  }
}
