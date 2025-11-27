"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { createNotification } from "./notifications"

export interface Partner {
  id: string
  name: string
  logo_url: string | null
  website_url: string
  description: string | null
  status: "pending" | "approved" | "rejected"
  created_by: string
  created_at: string
  updated_at: string
  approved_at: string | null
  approved_by: string | null
  rejection_reason: string | null
  sort_order: number
  // 订阅相关字段
  subscription_unit: "month" | "year"
  duration_value: number
  unit_fee: number
  total_amount: number
  payment_proof_url: string | null
  transaction_hash: string | null
  expires_at: string | null
  // 备注字段
  admin_notes: string | null
  applicant_notes: string | null
}

export interface SubmitPartnerApplicationParams {
  name: string
  logo_url: string
  website_url: string
  description?: string
  applicant_notes?: string
  // 订阅相关
  subscription_unit: "month" | "year"
  duration_value: number
  unit_fee: number
  total_amount: number
  payment_proof_url: string
  transaction_hash: string
}

/**
 * 提交合作伙伴申请
 */
export async function submitPartnerApplication(params: SubmitPartnerApplicationParams) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录" }
  }

  try {
    // 验证必填字段
    if (!params.name || !params.logo_url || !params.website_url) {
      return { success: false, error: "请填写完整信息" }
    }

    if (!params.payment_proof_url || !params.transaction_hash) {
      return { success: false, error: "请上传支付凭证并填写交易ID" }
    }

    if (!params.duration_value || params.duration_value < 1) {
      return { success: false, error: "订阅时长最低1个单位" }
    }

    // 验证URL格式
    try {
      new URL(params.website_url)
    } catch {
      return { success: false, error: "官网链接格式不正确" }
    }

    // 插入申请记录
    const { data, error } = await supabase
      .from("partners")
      .insert({
        name: params.name,
        logo_url: params.logo_url,
        website_url: params.website_url,
        description: params.description || null,
        applicant_notes: params.applicant_notes || null,
        created_by: user.id,
        status: "pending",
        // 订阅相关字段
        subscription_unit: params.subscription_unit,
        duration_value: params.duration_value,
        unit_fee: params.unit_fee,
        total_amount: params.total_amount,
        payment_proof_url: params.payment_proof_url,
        transaction_hash: params.transaction_hash,
        // expires_at 将在审核通过后设置
      })
      .select()
      .single()

    if (error) {
      console.error("Error submitting partner application:", error)
      return { success: false, error: "提交失败,请重试" }
    }

    // 发送通知给申请人
    await createNotification({
      userId: user.id,
      type: "system",
      category: "partner_application",
      title: "合作伙伴申请已提交",
      content: `您的合作伙伴申请 "${params.name}" 已提交（${params.subscription_unit === "month" ? "按月" : "按年"}订阅${params.duration_value}${params.subscription_unit === "month" ? "月" : "年"},总计${params.total_amount} USDT）,我们会尽快审核。`,
    })

    revalidatePath("/partners")
    revalidatePath("/admin/partners")

    return {
      success: true,
      data,
    }
  } catch (error: any) {
    console.error("Error in submitPartnerApplication:", error)
    return { success: false, error: error.message || "系统错误" }
  }
}

/**
 * 获取已审核通过的合作伙伴(前台展示用)
 * 只返回未过期的合作伙伴
 */
export async function getApprovedPartners() {
  const supabase = await createClient()

  try {
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from("partners")
      .select("*")
      .eq("status", "approved")
      .or(`expires_at.is.null,expires_at.gte.${now}`) // 未设置到期时间或未过期
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching approved partners:", error)
      return { success: false, error: error.message }
    }

    return {
      success: true,
      data: data as Partner[],
    }
  } catch (error: any) {
    console.error("Error in getApprovedPartners:", error)
    return { success: false, error: error.message || "系统错误" }
  }
}

/**
 * 获取用户自己的合作伙伴申请
 */
export async function getMyPartnerApplications() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录" }
  }

  try {
    const { data, error } = await supabase
      .from("partners")
      .select("*")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching my partner applications:", error)
      return { success: false, error: error.message }
    }

    return {
      success: true,
      data: data as Partner[],
    }
  } catch (error: any) {
    console.error("Error in getMyPartnerApplications:", error)
    return { success: false, error: error.message || "系统错误" }
  }
}

/**
 * 上传合作伙伴Logo到Supabase Storage
 */
export async function uploadPartnerLogo(file: File) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录" }
  }

  try {
    // 验证文件类型
    if (!file.type.startsWith("image/")) {
      return { success: false, error: "请上传图片文件" }
    }

    // 验证文件大小 (最大 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return { success: false, error: "图片大小不能超过 2MB" }
    }

    // 生成唯一文件名
    const fileExt = file.name.split(".").pop()
    const fileName = `${user.id}-${Date.now()}.${fileExt}`
    const filePath = `partner-logos/${fileName}`

    // 上传到 Supabase Storage
    const { data, error } = await supabase.storage
      .from("public")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      })

    if (error) {
      console.error("Error uploading logo:", error)
      return { success: false, error: "上传失败,请重试" }
    }

    // 获取公开URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("public").getPublicUrl(filePath)

    return {
      success: true,
      url: publicUrl,
    }
  } catch (error: any) {
    console.error("Error in uploadPartnerLogo:", error)
    return { success: false, error: error.message || "系统错误" }
  }
}

/**
 * 审核合作伙伴申请(管理员)
 */
export async function reviewPartnerApplication(
  partnerId: string,
  action: "approve" | "reject",
  rejectionReason?: string,
  sortOrder?: number
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录" }
  }

  try {
    // 验证管理员权限
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
      return { success: false, error: "权限不足" }
    }

    // 获取申请信息
    const { data: partner, error: fetchError } = await supabase
      .from("partners")
      .select("*")
      .eq("id", partnerId)
      .single()

    if (fetchError || !partner) {
      return { success: false, error: "申请不存在" }
    }

    // 更新状态
    const updateData: any = {
      status: action === "approve" ? "approved" : "rejected",
      approved_at: action === "approve" ? new Date().toISOString() : null,
      approved_by: action === "approve" ? user.id : null,
      rejection_reason: action === "reject" ? rejectionReason : null,
    }

    if (action === "approve") {
      if (sortOrder !== undefined) {
        updateData.sort_order = sortOrder
      }

      // 设置订阅到期时间: 当前时间 + duration_value (月或年)
      if (partner.duration_value && partner.subscription_unit) {
        const expiresAt = new Date()
        if (partner.subscription_unit === "month") {
          expiresAt.setMonth(expiresAt.getMonth() + partner.duration_value)
        } else {
          expiresAt.setFullYear(expiresAt.getFullYear() + partner.duration_value)
        }
        updateData.expires_at = expiresAt.toISOString()
      }
    }

    const { error: updateError } = await supabase
      .from("partners")
      .update(updateData)
      .eq("id", partnerId)

    if (updateError) {
      console.error("Error updating partner status:", updateError)
      return { success: false, error: "操作失败,请重试" }
    }

    // 🆕 如果是批准申请，记录平台订阅收入
    if (action === "approve" && partner.total_amount) {
      const { error: incomeError } = await supabase.from("platform_income").insert({
        income_type: "partner_subscription",
        amount: partner.total_amount,
        partner_id: partnerId,
        user_id: partner.created_by,
        description: `合作伙伴订阅 - ${partner.name}`,
        details: {
          partner_name: partner.name,
          subscription_unit: partner.subscription_unit,
          duration_value: partner.duration_value,
          unit_fee: partner.unit_fee,
          expires_at: updateData.expires_at,
          partner_application_id: partnerId,
          transaction_hash: partner.transaction_hash,
        },
      })

      if (incomeError) {
        console.error("记录平台收入失败:", incomeError)
        // 不中断流程，只记录错误
      }
    }

    // 发送通知给申请人
    const notificationTitle =
      action === "approve" ? "合作伙伴申请已通过" : "合作伙伴申请被拒绝"
    const notificationContent =
      action === "approve"
        ? `恭喜!您的合作伙伴申请 "${partner.name}" 已通过审核,现已在前台展示。`
        : `很遗憾,您的合作伙伴申请 "${partner.name}" 未通过审核。${
            rejectionReason ? `原因:${rejectionReason}` : ""
          }`

    await createNotification({
      userId: partner.created_by,
      type: "system",
      category: "partner_review",
      title: notificationTitle,
      content: notificationContent,
    })

    revalidatePath("/partners")
    revalidatePath("/admin/partners")
    revalidatePath("/admin/income")

    return { success: true }
  } catch (error: any) {
    console.error("Error in reviewPartnerApplication:", error)
    return { success: false, error: error.message || "系统错误" }
  }
}

/**
 * 删除合作伙伴(管理员)
 */
export async function deletePartner(partnerId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录" }
  }

  try {
    // 验证管理员权限
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
      return { success: false, error: "权限不足" }
    }

    // 获取合作伙伴信息(如果有logo需要删除)
    const { data: partner } = await supabase
      .from("partners")
      .select("logo_url")
      .eq("id", partnerId)
      .single()

    // 删除记录
    const { error } = await supabase.from("partners").delete().eq("id", partnerId)

    if (error) {
      console.error("Error deleting partner:", error)
      return { success: false, error: "删除失败,请重试" }
    }

    // TODO: 如果需要,可以删除Storage中的logo文件
    // if (partner?.logo_url) {
    //   const path = partner.logo_url.split('/').slice(-2).join('/')
    //   await supabase.storage.from('public').remove([path])
    // }

    revalidatePath("/partners")
    revalidatePath("/admin/partners")

    return { success: true }
  } catch (error: any) {
    console.error("Error in deletePartner:", error)
    return { success: false, error: error.message || "系统错误" }
  }
}

/**
 * 更新合作伙伴排序(管理员)
 */
export async function updatePartnerSortOrder(partnerId: string, sortOrder: number) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录" }
  }

  try {
    // 验证管理员权限
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
      return { success: false, error: "权限不足" }
    }

    const { error } = await supabase
      .from("partners")
      .update({ sort_order: sortOrder })
      .eq("id", partnerId)

    if (error) {
      console.error("Error updating sort order:", error)
      return { success: false, error: "更新失败,请重试" }
    }

    revalidatePath("/partners")
    revalidatePath("/admin/partners")

    return { success: true }
  } catch (error: any) {
    console.error("Error in updatePartnerSortOrder:", error)
    return { success: false, error: error.message || "系统错误" }
  }
}

/**
 * 更新合作伙伴备注(管理员)
 */
export async function updatePartnerNotes(partnerId: string, notes: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录" }
  }

  try {
    // 验证管理员权限
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
      return { success: false, error: "权限不足" }
    }

    const { error } = await supabase
      .from("partners")
      .update({ admin_notes: notes })
      .eq("id", partnerId)

    if (error) {
      console.error("Error updating partner notes:", error)
      return { success: false, error: "更新失败,请重试" }
    }

    revalidatePath("/admin/partners")

    return { success: true }
  } catch (error: any) {
    console.error("Error in updatePartnerNotes:", error)
    return { success: false, error: error.message || "系统错误" }
  }
}

/**
 * 检查即将到期的合作伙伴并发送通知
 * 应该在定时任务中调用(每天运行一次)
 */
export async function checkExpiringPartners() {
  const supabase = await createClient()

  try {
    const now = new Date()
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    // 查询7天内即将到期的已审核合作伙伴
    const { data: expiringPartners, error } = await supabase
      .from("partners")
      .select("*")
      .eq("status", "approved")
      .gte("expires_at", now.toISOString())
      .lte("expires_at", sevenDaysLater.toISOString())

    if (error) {
      console.error("Error fetching expiring partners:", error)
      return { success: false, error: error.message }
    }

    // 为每个即将到期的合作伙伴发送通知
    for (const partner of expiringPartners || []) {
      const expiresAt = new Date(partner.expires_at)
      const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      // 格式化到期时间为中国时区
      const chinaTime = new Date(expiresAt.getTime() + 8 * 60 * 60 * 1000)
      const formattedDate = chinaTime.toISOString().split('T')[0].replace(/-/g, '/')

      await createNotification({
        userId: partner.created_by,
        type: "system",
        title: "合作伙伴订阅即将到期",
        message: `您的合作伙伴 "${partner.name}" 将在 ${daysLeft} 天后到期(${formattedDate}),请及时续费以继续展示。`,
        actionUrl: "/partners",
      })
    }

    return {
      success: true,
      notifiedCount: expiringPartners?.length || 0,
    }
  } catch (error: any) {
    console.error("Error in checkExpiringPartners:", error)
    return { success: false, error: error.message || "系统错误" }
  }
}

/**
 * 获取用户邮箱信息(管理员)
 */
export async function getUserEmails(userIds: string[]) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录" }
  }

  try {
    // 验证管理员权限
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
      return { success: false, error: "权限不足" }
    }

    // 使用服务角色密钥创建admin客户端
    const { createClient: createServiceClient } = await import("@supabase/supabase-js")
    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // 获取用户邮箱 (支持分页,获取所有用户)
    let allUsers: any[] = []
    let page = 1
    const perPage = 1000
    let hasMore = true

    while (hasMore) {
      const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage
      })

      if (usersError) {
        console.error("Error fetching users:", usersError)
        return { success: false, error: "获取用户信息失败" }
      }

      allUsers = allUsers.concat(users)
      hasMore = users.length === perPage
      page++
    }

    // 创建邮箱映射
    const emailMap: Record<string, string> = {}
    if (allUsers) {
      allUsers.forEach(u => {
        if (userIds.includes(u.id) && u.email) {
          emailMap[u.id] = u.email
        }
      })
    }

    return {
      success: true,
      data: emailMap
    }
  } catch (error: any) {
    console.error("Error in getUserEmails:", error)
    return { success: false, error: error.message || "系统错误" }
  }
}
