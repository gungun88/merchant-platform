"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

/**
 * 获取所有举报列表（管理员）
 */
export async function getAllReports(filters?: {
  status?: string
  reportType?: string
  searchTerm?: string
}) {
  const supabase = await createClient()

  // 验证管理员权限
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("未登录")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (!profile || profile.role !== "admin") {
    throw new Error("无权限访问")
  }

  // 构建查询 - 简化查询，避免复杂的关联
  let query = supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false })

  // 应用过滤条件
  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status)
  }

  if (filters?.reportType && filters.reportType !== "all") {
    query = query.eq("report_type", filters.reportType)
  }

  // 搜索功能 - 按商家名称或举报原因搜索
  if (filters?.searchTerm) {
    // 注意：这里需要先获取所有数据再过滤，因为 Supabase 不支持跨表搜索
    // 更好的做法是使用全文搜索或在应用层过滤
  }

  const { data, error } = await query

  if (error) {
    console.error("获取举报列表失败:", error)
    throw new Error("获取举报列表失败")
  }

  return data || []
}

/**
 * 获取举报详情
 */
export async function getReportDetail(reportId: string) {
  const supabase = await createClient()

  // 验证管理员权限
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("未登录")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (!profile || profile.role !== "admin") {
    throw new Error("无权限访问")
  }

  const { data, error } = await supabase
    .from("reports")
    .select(
      `
      *,
      reporter:reporter_id (
        id,
        email,
        profiles (username, avatar_url)
      ),
      merchant:merchant_id (
        id,
        name,
        logo,
        description,
        contact_phone,
        contact_wechat,
        is_active
      ),
      admin:admin_id (
        id,
        email,
        profiles (username)
      )
    `
    )
    .eq("id", reportId)
    .single()

  if (error) {
    console.error("获取举报详情失败:", error)
    throw new Error("获取举报详情失败")
  }

  return data
}

/**
 * 审核通过举报并扣除信用分（不下架商家）
 */
export async function approveReportWithPenalty(
  reportId: string,
  penaltyPoints: number,
  adminNote?: string
) {
  const supabase = await createClient()

  // 验证管理员权限
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("未登录")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (!profile || profile.role !== "admin") {
    throw new Error("无权限操作")
  }

  // 验证扣分数量
  if (!penaltyPoints || penaltyPoints <= 0 || penaltyPoints > 100) {
    throw new Error("扣分数量必须在1-100之间")
  }

  // 获取举报信息
  const { data: report, error: reportError } = await supabase
    .from("reports")
    .select("*, merchant:merchant_id(*)")
    .eq("id", reportId)
    .single()

  if (reportError || !report) {
    throw new Error("举报不存在")
  }

  if (report.status !== "pending") {
    throw new Error("该举报已处理")
  }

  // 获取商家当前信用分
  const currentScore = report.merchant?.credit_score || 100
  const newScore = Math.max(0, currentScore - penaltyPoints)

  // 1. 更新举报状态
  const { error: updateReportError } = await supabase
    .from("reports")
    .update({
      status: "approved",
      admin_id: user.id,
      admin_note: adminNote || `举报属实，已扣除商家 ${penaltyPoints} 信用分`,
      processed_at: new Date().toISOString(),
    })
    .eq("id", reportId)

  if (updateReportError) {
    console.error("更新举报状态失败 - 详细错误:", updateReportError)
    throw new Error(`更新举报状态失败: ${updateReportError.message || JSON.stringify(updateReportError)}`)
  }

  // 2. 扣除商家信用分
  const { error: updateMerchantError } = await supabase
    .from("merchants")
    .update({
      credit_score: newScore,
      updated_at: new Date().toISOString(),
    })
    .eq("id", report.merchant_id)

  if (updateMerchantError) {
    console.error("扣除信用分失败:", updateMerchantError)
    throw new Error("扣除信用分失败")
  }

  // 3. 记录信用分变动
  await supabase.from("credit_logs").insert({
    merchant_id: report.merchant_id,
    admin_id: user.id,
    report_id: reportId,
    change_amount: -penaltyPoints,
    previous_score: currentScore,
    new_score: newScore,
    reason: `举报审核通过 - ${report.report_type}：${adminNote || "违规行为"}`,
  })

  // 4. 记录操作日志
  await supabase.from("admin_logs").insert({
    admin_id: user.id,
    action: "approve_report_with_penalty",
    target_type: "report",
    target_id: reportId,
    details: {
      report_id: reportId,
      merchant_id: report.merchant_id,
      merchant_name: report.merchant?.name,
      report_type: report.report_type,
      penalty_points: penaltyPoints,
      previous_score: currentScore,
      new_score: newScore,
      admin_note: adminNote,
    },
  })

  // 5. 发送通知给举报人
  await supabase.from("notifications").insert({
    user_id: report.reporter_id,
    type: "report_approved",
    category: "report",
    title: "举报已处理",
    content: `您对商家【${report.merchant?.name}】的举报已被审核通过，该商家已被扣除 ${penaltyPoints} 信用分。感谢您的反馈！`,
    related_merchant_id: report.merchant_id,
    priority: "normal",
  })

  // 6. 发送通知给商家
  if (report.merchant?.user_id) {
    const deactivatedWarning = newScore === 0 ? "，您的商家已被系统自动下架" : ""
    await supabase.from("notifications").insert({
      user_id: report.merchant.user_id,
      type: "credit_penalty",
      category: "merchant",
      title: "信用分扣除通知",
      content: `您的商家【${report.merchant.name}】因被举报违规已被扣除 ${penaltyPoints} 信用分${deactivatedWarning}。当前剩余信用分：${newScore} 分。原因：${adminNote || "违规行为"}`,
      related_merchant_id: report.merchant_id,
      priority: "high",
    })
  }

  revalidatePath("/admin/reports")
  revalidatePath("/admin/merchants")

  return { success: true, newScore }
}

/**
 * 审核通过举报（将商家标记为违规并下架）
 */
export async function approveReport(reportId: string, adminNote?: string) {
  const supabase = await createClient()

  // 验证管理员权限
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("未登录")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (!profile || profile.role !== "admin") {
    throw new Error("无权限操作")
  }

  // 获取举报信息
  const { data: report, error: reportError } = await supabase
    .from("reports")
    .select("*, merchant:merchant_id(*)")
    .eq("id", reportId)
    .single()

  if (reportError || !report) {
    throw new Error("举报不存在")
  }

  if (report.status !== "pending") {
    throw new Error("该举报已处理")
  }

  // 1. 更新举报状态
  const { error: updateReportError } = await supabase
    .from("reports")
    .update({
      status: "approved",
      admin_id: user.id,
      admin_note: adminNote || "举报属实，商家已下架",
      processed_at: new Date().toISOString(),
    })
    .eq("id", reportId)

  if (updateReportError) {
    throw new Error("更新举报状态失败")
  }

  // 2. 下架商家
  const { error: updateMerchantError } = await supabase
    .from("merchants")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", report.merchant_id)

  if (updateMerchantError) {
    console.error("下架商家失败:", updateMerchantError)
    throw new Error("下架商家失败")
  }

  // 3. 记录操作日志
  await supabase.from("admin_logs").insert({
    admin_id: user.id,
    action: "approve_report",
    target_type: "report",
    target_id: reportId,
    details: {
      report_id: reportId,
      merchant_id: report.merchant_id,
      merchant_name: report.merchant?.name,
      report_type: report.report_type,
      admin_note: adminNote,
    },
  })

  // 4. 发送通知给举报人
  await supabase.from("notifications").insert({
    user_id: report.reporter_id,
    type: "report_approved",
    category: "report",
    title: "举报已处理",
    content: `您对商家【${report.merchant?.name}】的举报已被审核通过，该商家已下架。感谢您的反馈！`,
    related_merchant_id: report.merchant_id,
    priority: "normal",
  })

  // 5. 发送通知给商家
  if (report.merchant?.user_id) {
    await supabase.from("notifications").insert({
      user_id: report.merchant.user_id,
      type: "merchant_reported",
      category: "merchant",
      title: "商家已被举报下架",
      content: `您的商家【${report.merchant.name}】因被举报违规已被平台下架，如有疑问请联系客服。`,
      related_merchant_id: report.merchant_id,
      priority: "high",
    })
  }

  revalidatePath("/admin/reports")
  revalidatePath("/admin/merchants")

  return { success: true }
}

/**
 * 驳回举报
 */
export async function rejectReport(reportId: string, adminNote: string) {
  const supabase = await createClient()

  // 验证管理员权限
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("未登录")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (!profile || profile.role !== "admin") {
    throw new Error("无权限操作")
  }

  if (!adminNote || adminNote.trim().length === 0) {
    throw new Error("请填写驳回原因")
  }

  // 获取举报信息
  const { data: report, error: reportError } = await supabase
    .from("reports")
    .select("*, merchant:merchant_id(*)")
    .eq("id", reportId)
    .single()

  if (reportError || !report) {
    throw new Error("举报不存在")
  }

  if (report.status !== "pending") {
    throw new Error("该举报已处理")
  }

  // 更新举报状态
  const { error: updateError } = await supabase
    .from("reports")
    .update({
      status: "rejected",
      admin_id: user.id,
      admin_note: adminNote,
      processed_at: new Date().toISOString(),
    })
    .eq("id", reportId)

  if (updateError) {
    throw new Error("更新举报状态失败")
  }

  // 记录操作日志
  await supabase.from("admin_logs").insert({
    admin_id: user.id,
    action: "reject_report",
    target_type: "report",
    target_id: reportId,
    details: {
      report_id: reportId,
      merchant_id: report.merchant_id,
      merchant_name: report.merchant?.name,
      report_type: report.report_type,
      admin_note: adminNote,
    },
  })

  // 发送通知给举报人
  await supabase.from("notifications").insert({
    user_id: report.reporter_id,
    type: "report_rejected",
    category: "report",
    title: "举报已被驳回",
    content: `您对商家【${report.merchant?.name}】的举报经审核后被驳回。驳回原因：${adminNote}`,
    related_merchant_id: report.merchant_id,
    priority: "normal",
  })

  revalidatePath("/admin/reports")

  return { success: true }
}

/**
 * 获取举报统计数据
 */
export async function getReportStats() {
  const supabase = await createClient()

  // 验证管理员权限
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("未登录")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (!profile || profile.role !== "admin") {
    throw new Error("无权限访问")
  }

  // 获取统计数据
  const { data: allReports } = await supabase.from("reports").select("id, status, report_type")

  if (!allReports) {
    return {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      byType: {},
    }
  }

  const stats = {
    total: allReports.length,
    pending: allReports.filter((r) => r.status === "pending").length,
    approved: allReports.filter((r) => r.status === "approved").length,
    rejected: allReports.filter((r) => r.status === "rejected").length,
    byType: {} as Record<string, number>,
  }

  // 按类型统计
  allReports.forEach((report) => {
    const type = report.report_type
    stats.byType[type] = (stats.byType[type] || 0) + 1
  })

  return stats
}
