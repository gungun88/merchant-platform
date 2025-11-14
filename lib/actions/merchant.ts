"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { addPointsLog, updateUserPoints } from "./points"
import { createNotification } from "./notifications"
import { getSystemSettings } from "./settings"
import { sanitizeText, sanitizeRichHTML, sanitizeSearchTerm } from "@/lib/utils/sanitize"
import { filterSupabaseError, logSecurityEvent } from "@/lib/utils/security-filter"

// 创建商家
export async function createMerchant(formData: {
  name: string
  description: string
  service_types: string[]
  contact_wechat?: string
  contact_telegram?: string
  contact_whatsapp?: string
  contact_email?: string
  contact_phone?: string
  certifications: string[]
  warranties: string[]
  payment_methods: string[]
  location?: string
  price_range?: string
  response_time?: number
  stock_status?: string
  logo?: string
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("请先登录")
  }

  // 🔒 速率限制：每天最多创建3个商家
  const { rateLimitCheck } = await import("@/lib/rate-limiter")
  const rateLimit = await rateLimitCheck(user.id, "CREATE_MERCHANT")
  if (!rateLimit.allowed) {
    throw new Error(`创建商家过于频繁，请在 ${rateLimit.retryAfter} 秒后重试`)
  }

  const { data: existingMerchant } = await supabase.from("merchants").select("id").eq("user_id", user.id).maybeSingle()

  if (existingMerchant) {
    throw new Error("您已经是商家，无法重复入驻")
  }

  // 🔒 XSS防护：清理用户输入
  const sanitizedData = {
    name: sanitizeText(formData.name),
    description: sanitizeRichHTML(formData.description),
    logo: formData.logo ? sanitizeText(formData.logo) : null,
    contact_wechat: formData.contact_wechat ? sanitizeText(formData.contact_wechat) : null,
    contact_telegram: formData.contact_telegram ? sanitizeText(formData.contact_telegram) : null,
    contact_whatsapp: formData.contact_whatsapp ? sanitizeText(formData.contact_whatsapp) : null,
    contact_email: formData.contact_email ? sanitizeText(formData.contact_email) : null,
    contact_phone: formData.contact_phone ? sanitizeText(formData.contact_phone) : null,
    location: formData.location ? sanitizeText(formData.location) : null,
    price_range: formData.price_range ? sanitizeText(formData.price_range) : null,
    stock_status: formData.stock_status ? sanitizeText(formData.stock_status) : "现货充足",
    service_types: formData.service_types.map(t => sanitizeText(t)),
    certifications: formData.certifications.map(c => sanitizeText(c)),
    warranties: formData.warranties.map(w => sanitizeText(w)),
    payment_methods: formData.payment_methods.map(p => sanitizeText(p)),
  }

  // 创建商家（立即显示在前台，未认证状态）
  const { data: merchant, error } = await supabase
    .from("merchants")
    .insert({
      user_id: user.id,
      name: sanitizedData.name,
      description: sanitizedData.description,
      logo: sanitizedData.logo,
      service_types: sanitizedData.service_types,
      contact_wechat: sanitizedData.contact_wechat,
      contact_telegram: sanitizedData.contact_telegram,
      contact_whatsapp: sanitizedData.contact_whatsapp,
      contact_email: sanitizedData.contact_email,
      contact_phone: sanitizedData.contact_phone,
      certifications: sanitizedData.certifications,
      warranties: sanitizedData.warranties,
      payment_methods: sanitizedData.payment_methods,
      location: sanitizedData.location,
      price_range: sanitizedData.price_range,
      response_time: formData.response_time || 5,
      stock_status: sanitizedData.stock_status,
      // 不设置 certification_status，认证状态由 is_deposit_merchant 决定
    })
    .select()
    .maybeSingle()

  if (error) {
    // 🔒 安全修复：过滤数据库错误信息
    const safeError = filterSupabaseError(error)
    logSecurityEvent('error', '创建商家失败', { error: safeError, userId: user.id })
    throw new Error("创建商家失败")
  }

  // 更新用户为商家身份
  await supabase.from("profiles").update({ is_merchant: true }).eq("id", user.id)

  // 获取系统设置的商家入驻奖励积分
  const settingsResult = await getSystemSettings()
  const merchantRegisterPoints = settingsResult.data?.merchant_register_points || 50

  // 赠送新商家入驻积分
  await updateUserPoints(user.id, merchantRegisterPoints)
  await addPointsLog(user.id, merchantRegisterPoints, "merchant_register", `商家入驻奖励 +${merchantRegisterPoints}积分`)

  // 发送通知：商家入驻成功
  await createNotification({
    userId: user.id,
    type: "merchant",
    category: "merchant_created",
    title: "商家入驻成功",
    content: `恭喜！您的商家【${formData.name}】已成功入驻，获得 ${merchantRegisterPoints} 积分奖励。成为押金商家可获得"已认证"标识。`,
    priority: "normal",
    relatedMerchantId: merchant.id,
  })

  revalidatePath("/")

  return merchant
}

// 更新商家信息
export async function updateMerchant(
  merchantId: string,
  formData: {
    name?: string
    description?: string
    short_desc?: string
    service_types?: string[]
    contact_wechat?: string
    contact_telegram?: string
    contact_whatsapp?: string
    contact_email?: string
    contact_phone?: string
    certifications?: string[]
    warranties?: string[]
    payment_methods?: string[]
    location?: string
    price_range?: string
    stock_status?: string
  },
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("请先登录")
  }

  // 验证商家所有权或管理员权限
  const { requireOwnershipOrAdmin } = await import("./auth-helpers")

  const { data: merchant } = await supabase.from("merchants").select("user_id").eq("id", merchantId).single()

  if (!merchant) {
    throw new Error("商家不存在")
  }

  // 验证权限：必须是商家所有者或管理员
  await requireOwnershipOrAdmin(merchant.user_id)

  // 🔒 XSS防护：清理用户输入
  const sanitizedData: any = {}
  if (formData.name !== undefined) sanitizedData.name = sanitizeText(formData.name)
  if (formData.description !== undefined) sanitizedData.description = sanitizeRichHTML(formData.description)
  if (formData.short_desc !== undefined) sanitizedData.short_desc = sanitizeText(formData.short_desc)
  if (formData.contact_wechat !== undefined) sanitizedData.contact_wechat = formData.contact_wechat ? sanitizeText(formData.contact_wechat) : null
  if (formData.contact_telegram !== undefined) sanitizedData.contact_telegram = formData.contact_telegram ? sanitizeText(formData.contact_telegram) : null
  if (formData.contact_whatsapp !== undefined) sanitizedData.contact_whatsapp = formData.contact_whatsapp ? sanitizeText(formData.contact_whatsapp) : null
  if (formData.contact_email !== undefined) sanitizedData.contact_email = formData.contact_email ? sanitizeText(formData.contact_email) : null
  if (formData.contact_phone !== undefined) sanitizedData.contact_phone = formData.contact_phone ? sanitizeText(formData.contact_phone) : null
  if (formData.location !== undefined) sanitizedData.location = formData.location ? sanitizeText(formData.location) : null
  if (formData.price_range !== undefined) sanitizedData.price_range = formData.price_range ? sanitizeText(formData.price_range) : null
  if (formData.stock_status !== undefined) sanitizedData.stock_status = formData.stock_status ? sanitizeText(formData.stock_status) : null
  if (formData.service_types !== undefined) sanitizedData.service_types = formData.service_types.map(t => sanitizeText(t))
  if (formData.certifications !== undefined) sanitizedData.certifications = formData.certifications.map(c => sanitizeText(c))
  if (formData.warranties !== undefined) sanitizedData.warranties = formData.warranties.map(w => sanitizeText(w))
  if (formData.payment_methods !== undefined) sanitizedData.payment_methods = formData.payment_methods.map(p => sanitizeText(p))

  const { error } = await supabase.from("merchants").update(sanitizedData).eq("id", merchantId)

  if (error) {
    // 🔒 安全修复：过滤数据库错误信息
    const safeError = filterSupabaseError(error)
    logSecurityEvent('error', '更新商家信息失败', { error: safeError, merchantId, userId: user.id })
    throw new Error("更新商家信息失败")
  }

  // 发送编辑成功通知
  await createNotification({
    userId: user.id,
    type: "merchant",
    category: "merchant_update_success",
    title: "商家信息更新成功",
    content: "您的商家信息已成功更新",
    relatedMerchantId: merchantId,
  })

  // 通知收藏该商家的用户
  const { data: favorites } = await supabase
    .from("favorites")
    .select("user_id")
    .eq("merchant_id", merchantId)

  console.log(`[商家更新] 找到 ${favorites?.length || 0} 个收藏用户`)

  if (favorites && favorites.length > 0) {
    // 为每个收藏用户创建通知
    const { data: merchantInfo } = await supabase
      .from("merchants")
      .select("name")
      .eq("id", merchantId)
      .single()

    console.log(`[商家更新] 商家名称: ${merchantInfo?.name}`)

    for (const fav of favorites) {
      await createNotification({
        userId: fav.user_id,
        type: "social",
        category: "favorite_merchant_update",
        title: "收藏的商家有更新",
        content: `您收藏的商家"${merchantInfo?.name}"更新了信息`,
        relatedMerchantId: merchantId,
        relatedUserId: user.id,
      })
      console.log(`[商家更新] 已通知用户: ${fav.user_id}`)
    }
  }

  revalidatePath("/")
}

// 获取用户的商家信息
export async function getUserMerchant() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: merchant } = await supabase.from("merchants").select("*").eq("user_id", user.id).maybeSingle()

  return merchant
}

// 置顶商家（消耗积分）
export async function topMerchant(merchantId: string, days: number) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("请先登录")
  }

  // 🔒 速率限制：每小时最多置顶3次
  const { rateLimitCheck } = await import("@/lib/rate-limiter")
  const rateLimit = await rateLimitCheck(user.id, "TOP_MERCHANT")
  if (!rateLimit.allowed) {
    throw new Error(`置顶操作过于频繁，请在 ${rateLimit.retryAfter} 秒后重试`)
  }

  const { data: merchant } = await supabase.from("merchants").select("user_id").eq("id", merchantId).maybeSingle()

  if (!merchant || merchant.user_id !== user.id) {
    throw new Error("无权限操作此商家")
  }

  // 从系统设置获取置顶费用
  const settingsResult = await getSystemSettings()
  const costPerDay = settingsResult.data?.merchant_top_cost_per_day || 1000

  // 计算所需积分
  const requiredPoints = days * costPerDay

  const { data: profile } = await supabase.from("profiles").select("points").eq("id", user.id).maybeSingle()

  if (!profile || profile.points < requiredPoints) {
    throw new Error(`积分不足,需要${requiredPoints}积分`)
  }

  // 获取当前商家的置顶信息
  const { data: currentMerchant } = await supabase
    .from("merchants")
    .select("is_topped, topped_until")
    .eq("id", merchantId)
    .maybeSingle()

  // 计算置顶结束时间（支持续费叠加）
  let toppedUntil = new Date()

  // 如果当前已置顶且未过期，从当前到期时间开始叠加
  if (currentMerchant?.is_topped && currentMerchant.topped_until) {
    const currentExpiry = new Date(currentMerchant.topped_until)
    const now = new Date()

    // 如果当前置顶未过期，从到期时间开始叠加
    if (currentExpiry > now) {
      toppedUntil = currentExpiry
    }
  }

  // 叠加新的置顶天数
  toppedUntil.setDate(toppedUntil.getDate() + days)

  // 更新商家置顶状态
  const { error } = await supabase
    .from("merchants")
    .update({
      is_topped: true,
      topped_until: toppedUntil.toISOString(),
    })
    .eq("id", merchantId)

  if (error) {
    // 🔒 安全修复：过滤数据库错误信息
    const safeError = filterSupabaseError(error)
    logSecurityEvent('error', '商家置顶失败', { error: safeError, merchantId, userId: user.id })
    throw new Error("置顶失败")
  }

  // 扣除积分
  await updateUserPoints(user.id, -requiredPoints)
  await addPointsLog(user.id, -requiredPoints, "merchant_top", `商家置顶${days}天 -${requiredPoints}积分`)

  // 获取扣除后的积分余额
  const { data: updatedProfile } = await supabase
    .from("profiles")
    .select("points")
    .eq("id", user.id)
    .maybeSingle()

  const remainingPoints = updatedProfile?.points || 0

  // 发送置顶成功通知
  await createNotification({
    userId: user.id,
    type: "merchant",
    category: "merchant_top_success",
    title: "商家置顶成功",
    content: `您的商家已成功置顶 ${days} 天,消耗 ${requiredPoints} 积分,到期时间: ${toppedUntil.toLocaleDateString('zh-CN')}`,
    relatedMerchantId: merchantId,
    metadata: { days, points: requiredPoints, until: toppedUntil.toISOString() },
  })

  // 积分余额预警(剩余积分少于100时发送提醒)
  if (remainingPoints < 100) {
    await createNotification({
      userId: user.id,
      type: "transaction",
      category: "low_points_warning",
      title: "积分余额不足",
      content: `您的积分余额仅剩 ${remainingPoints} 分,建议及时获取积分以便继续使用平台服务`,
      metadata: { remaining_points: remainingPoints, threshold: 100 },
      priority: "high",
    })
  }

  revalidatePath("/")

  return { success: true }
}

// 获取所有商家列表
export async function getMerchants(filters?: {
  service_type?: string
  location?: string
  price_range?: string
  merchant_type?: string
  search?: string
  page?: number
  pageSize?: number
}) {
  const supabase = await createClient()

  const page = filters?.page || 1
  const pageSize = filters?.pageSize || 20

  // 构建查询条件 - 包含 user_number 和 points,不包含分页(稍后在内存中过滤和排序)
  let query = supabase
    .from("merchants")
    .select("*, profiles!inner(username, avatar, user_number, points)")
    .eq("is_active", true)

  if (filters?.service_type && filters.service_type !== "all") {
    query = query.contains("service_types", [filters.service_type])
  }

  if (filters?.location && filters.location !== "all") {
    query = query.eq("location", filters.location)
  }

  if (filters?.price_range && filters.price_range !== "all") {
    query = query.eq("price_range", filters.price_range)
  }

  if (filters?.merchant_type && filters.merchant_type !== "all") {
    if (filters.merchant_type === "deposit") {
      query = query.eq("is_deposit_merchant", true)
    } else if (filters.merchant_type === "regular") {
      query = query.eq("is_deposit_merchant", false)
    }
  }

  // 🔒 安全修复：防止SQL注入和XSS - 清理搜索输入
  // 检查是否是纯数字搜索
  const isNumericSearch = filters?.search && /^\d+$/.test(filters.search)

  // 搜索 - 商家名称和描述(数据库层面)
  // 注意：如果是纯数字搜索，不在数据库层面搜索，而是获取所有商家后在内存中过滤
  if (filters?.search && !isNumericSearch) {
    // 🔒 清理搜索词，防止SQL注入和XSS
    const sanitizedSearch = sanitizeSearchTerm(filters.search)
    if (sanitizedSearch.trim()) {
      query = query.or(`name.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%`)
    }
  }

  const { data, error } = await query

  if (error) {
    // 🔒 安全修复：过滤数据库错误信息
    const safeError = filterSupabaseError(error)
    logSecurityEvent('error', '获取商家列表失败', { error: safeError })
    return { merchants: [], total: 0 }
  }

  let filteredData = data || []

  // 如果是纯数字搜索,在内存中过滤用户编号
  if (isNumericSearch) {
    const searchNumber = parseInt(filters.search)
    console.log(`[getMerchants] 纯数字搜索: ${searchNumber}, 总商家数: ${data?.length || 0}`)

    filteredData = (data || []).filter((merchant: any) => {
      const userNumberMatch = merchant.profiles?.user_number === searchNumber
      if (userNumberMatch) {
        console.log(`[getMerchants] 找到匹配商家: ${merchant.name}, 用户编号: ${merchant.profiles?.user_number}`)
      }
      return userNumberMatch
    })

    console.log(`[getMerchants] 过滤后商家数: ${filteredData.length}`)
  } else if (filters?.search) {
    // 非纯数字搜索，但包含搜索词，进一步在内存中过滤（数据库已经过滤过一次）
    filteredData = (data || []).filter((merchant: any) => {
      return merchant.name.toLowerCase().includes(filters.search!.toLowerCase()) ||
             merchant.description.toLowerCase().includes(filters.search!.toLowerCase())
    })
  }

  // 在内存中进行多级排序：置顶 → 积分 → 创建时间
  filteredData.sort((a: any, b: any) => {
    // 1. 首先按置顶状态排序（置顶的在前）
    if (a.is_topped !== b.is_topped) {
      return b.is_topped ? 1 : -1
    }

    // 2. 然后按用户积分排序（积分高的在前）
    const pointsA = a.profiles?.points || 0
    const pointsB = b.profiles?.points || 0
    if (pointsA !== pointsB) {
      return pointsB - pointsA
    }

    // 3. 最后按创建时间排序（新的在前）
    const timeA = new Date(a.created_at).getTime()
    const timeB = new Date(b.created_at).getTime()
    return timeB - timeA
  })

  // 获取总数
  const total = filteredData.length

  // 内存分页
  const from = (page - 1) * pageSize
  const to = from + pageSize
  const paginatedData = filteredData.slice(from, to)

  return { merchants: paginatedData, total }
}

// 编辑商家信息（消耗积分）
export async function editMerchant(
  merchantId: string,
  formData: {
    name?: string
    description?: string
    service_types?: string[]
    contact_wechat?: string
    contact_telegram?: string
    contact_whatsapp?: string
    contact_email?: string
    contact_phone?: string
    location?: string
    price_range?: string
    response_time?: number
    stock_status?: string
  },
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("请先登录")
  }

  // 验证商家所有权
  const { data: merchant } = await supabase.from("merchants").select("user_id").eq("id", merchantId).maybeSingle()

  if (!merchant || merchant.user_id !== user.id) {
    throw new Error("无权限修改此商家")
  }

  // 获取系统设置的编辑商家扣除积分
  const settingsResult = await getSystemSettings()
  const editMerchantCost = settingsResult.data?.edit_merchant_cost || 100

  // 检查积分是否足够
  const { data: profile } = await supabase.from("profiles").select("points").eq("id", user.id).maybeSingle()

  if (!profile || profile.points < editMerchantCost) {
    throw new Error(`积分不足，编辑商家信息需要${editMerchantCost}积分`)
  }

  // 更新商家信息
  const { error } = await supabase.from("merchants").update(formData).eq("id", merchantId)

  if (error) {
    console.error("[v0] Error updating merchant:", error)
    throw new Error("更新商家信息失败")
  }

  // 扣除积分
  await updateUserPoints(user.id, -editMerchantCost)
  await addPointsLog(user.id, -editMerchantCost, "merchant_edit", `编辑商家信息 -${editMerchantCost}积分`)

  revalidatePath("/")

  return { success: true }
}

// 下架商家
export async function deactivateMerchant(merchantId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("请先登录")
  }

  // 验证商家所有权
  const { data: merchant } = await supabase.from("merchants").select("user_id").eq("id", merchantId).maybeSingle()

  if (!merchant || merchant.user_id !== user.id) {
    throw new Error("无权限操作此商家")
  }

  // 下架商家
  const { error } = await supabase.from("merchants").update({ is_active: false }).eq("id", merchantId)

  if (error) {
    console.error("[v0] Error deactivating merchant:", error)
    throw new Error("下架失败")
  }

  revalidatePath("/")

  return { success: true }
}

// 上架商家
export async function activateMerchant(merchantId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("请先登录")
  }

  // 验证商家所有权
  const { data: merchant } = await supabase.from("merchants").select("user_id").eq("id", merchantId).maybeSingle()

  if (!merchant || merchant.user_id !== user.id) {
    throw new Error("无权限操作此商家")
  }

  // 上架商家
  const { error } = await supabase.from("merchants").update({ is_active: true }).eq("id", merchantId)

  if (error) {
    console.error("[v0] Error activating merchant:", error)
    throw new Error("上架失败")
  }

  revalidatePath("/")

  return { success: true }
}

// 收藏商家
export async function toggleFavoriteMerchant(merchantId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("请先登录")
  }

  // 🔒 速率限制：每分钟最多30次收藏操作
  const { rateLimitCheck } = await import("@/lib/rate-limiter")
  const rateLimit = await rateLimitCheck(user.id, "FAVORITE")
  if (!rateLimit.allowed) {
    throw new Error(`收藏操作过于频繁，请在 ${rateLimit.retryAfter} 秒后重试`)
  }

  // 检查是否已收藏
  const { data: existing } = await supabase
    .from("favorites")
    .select("*")
    .eq("user_id", user.id)
    .eq("merchant_id", merchantId)
    .maybeSingle()

  if (existing) {
    // 取消收藏
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("merchant_id", merchantId)

    if (error) {
      throw new Error("取消收藏失败")
    }

    return { success: true, isFavorited: false }
  } else {
    // 添加收藏
    const { error } = await supabase.from("favorites").insert({
      user_id: user.id,
      merchant_id: merchantId,
    })

    if (error) {
      throw new Error("收藏失败")
    }

    // 获取商家信息
    const { data: merchant } = await supabase
      .from("merchants")
      .select("user_id, name")
      .eq("id", merchantId)
      .single()

    // 发送通知给商家
    if (merchant && merchant.user_id !== user.id) {
      await createNotification({
        userId: merchant.user_id,
        type: "social",
        category: "merchant_favorited",
        title: "有用户收藏了你的商家",
        content: `有用户收藏了您的商家"${merchant.name}"`,
        relatedUserId: user.id,
        relatedMerchantId: merchantId,
      })
    }

    return { success: true, isFavorited: true }
  }
}

// 创建系统公告通知（管理员功能）
export async function createSystemAnnouncement(announcement: {
  title: string
  content: string
  priority?: "high" | "normal" | "low"
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("请先登录")
  }

  // 获取所有用户
  const { data: profiles } = await supabase.from("profiles").select("id")

  if (!profiles || profiles.length === 0) {
    return { success: true, count: 0 }
  }

  // 为每个用户创建系统公告通知
  let count = 0
  for (const profile of profiles) {
    await createNotification({
      userId: profile.id,
      type: "system",
      category: "announcement",
      title: announcement.title,
      content: announcement.content,
      priority: announcement.priority || "normal",
    })
    count++
  }

  return { success: true, count }
}

// 获取所有不重复的服务类型（用于筛选器）
export async function getAllServiceTypes() {
  const supabase = await createClient()

  try {
    // 获取所有激活的商家的服务类型
    const { data: merchants, error } = await supabase
      .from("merchants")
      .select("service_types")
      .eq("is_active", true)

    if (error) {
      console.error("Error fetching service types:", error)
      return []
    }

    // 收集所有服务类型并去重
    const allServiceTypes = new Set<string>()

    merchants?.forEach((merchant) => {
      if (merchant.service_types && Array.isArray(merchant.service_types)) {
        merchant.service_types.forEach((type: string) => {
          allServiceTypes.add(type)
        })
      }
    })

    // 转换为数组并排序
    return Array.from(allServiceTypes).sort()
  } catch (error) {
    console.error("Error in getAllServiceTypes:", error)
    return []
  }
}

// ============================================
// 管理员专用功能
// ============================================

/**
 * 管理员 - 获取所有商家列表（包含下架的）
 */
export async function adminGetMerchants(filters?: {
  status?: string // all, active, inactive
  depositStatus?: string // all, deposit, regular
  search?: string
}) {
  try {
    // 检查管理员权限 - 使用统一的权限验证
    const { requireAdmin } = await import("./auth-helpers")
    await requireAdmin()

    const supabase = await createClient()

    // 构建查询 - 包含 user_number
    let query = supabase
      .from("merchants")
      .select(`
        *,
        profiles!inner(id, username, avatar, user_number)
      `)
      .order("created_at", { ascending: false })

    // 状态筛选
    if (filters?.status === "active") {
      query = query.eq("is_active", true)
    } else if (filters?.status === "inactive") {
      query = query.eq("is_active", false)
    }

    // 押金商家筛选
    if (filters?.depositStatus === "deposit") {
      query = query.eq("is_deposit_merchant", true)
    } else if (filters?.depositStatus === "regular") {
      query = query.eq("is_deposit_merchant", false)
    }

    // 🔒 安全修复：防止SQL注入和XSS - 清理搜索输入
    // 检查是否是纯数字搜索
    const isNumericSearch = filters?.search && /^\d+$/.test(filters.search)

    // 搜索 - 商家名称和描述(数据库层面)
    // 注意：如果是纯数字搜索，不在数据库层面搜索，而是获取所有商家后在内存中过滤
    if (filters?.search && !isNumericSearch) {
      // 🔒 清理搜索词，防止SQL注入和XSS
      const sanitizedSearch = sanitizeSearchTerm(filters.search)
      if (sanitizedSearch.trim()) {
        query = query.or(`name.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%`)
      }
    }

    const { data, error } = await query

    if (error) throw error

    let filteredData = data || []

    // 如果是纯数字搜索,在内存中过滤用户编号
    if (isNumericSearch) {
      const searchNumber = parseInt(filters.search)
      console.log(`[adminGetMerchants] 纯数字搜索: ${searchNumber}, 总商家数: ${data?.length || 0}`)

      filteredData = (data || []).filter((merchant: any) => {
        const userNumberMatch = merchant.profiles?.user_number === searchNumber
        if (userNumberMatch) {
          console.log(`[adminGetMerchants] 找到匹配商家: ${merchant.name}, 用户编号: ${merchant.profiles?.user_number}`)
        }
        return userNumberMatch
      })

      console.log(`[adminGetMerchants] 过滤后商家数: ${filteredData.length}`)
    } else if (filters?.search) {
      // 非纯数字搜索，但包含搜索词，进一步在内存中过滤（数据库已经过滤过一次）
      filteredData = (data || []).filter((merchant: any) => {
        return merchant.name.toLowerCase().includes(filters.search!.toLowerCase()) ||
               merchant.description.toLowerCase().includes(filters.search!.toLowerCase())
      })
    }

    return {
      success: true,
      data: filteredData,
    }
  } catch (error) {
    console.error("Error in adminGetMerchants:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取商家列表失败",
      data: [],
    }
  }
}

/**
 * 管理员 - 上架商家
 */
export async function adminActivateMerchant(merchantId: string, adminNote?: string) {
  try {
    // 检查管理员权限 - 使用统一的权限验证
    const { requireAdmin, logAdminOperation } = await import("./auth-helpers")
    await requireAdmin()

    const supabase = await createClient()

    // 获取商家信息
    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("*, profiles!inner(username)")
      .eq("id", merchantId)
      .single()

    if (merchantError || !merchant) {
      throw new Error("商家不存在")
    }

    // 更新商家状态
    const { error: updateError } = await supabase
      .from("merchants")
      .update({ is_active: true })
      .eq("id", merchantId)

    if (updateError) throw updateError

    // 记录管理员操作
    const { logAdminOperation: logOp } = await import("./admin")
    await logOp({
      operationType: "activate_merchant",
      targetType: "merchant",
      targetId: merchantId,
      description: `上架商家: ${merchant.name}`,
      metadata: { adminNote, merchantName: merchant.name },
    })

    // 发送通知给商家
    await createNotification({
      userId: merchant.user_id,
      type: "merchant",
      category: "merchant_activated",
      title: "商家已上架",
      content: adminNote || "您的商家已通过审核并上架",
      relatedMerchantId: merchantId,
    })

    revalidatePath("/admin/merchants")
    revalidatePath("/")

    return { success: true }
  } catch (error) {
    console.error("Error in adminActivateMerchant:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "上架失败",
    }
  }
}

/**
 * 管理员 - 下架商家
 */
export async function adminDeactivateMerchant(merchantId: string, reason: string) {
  try {
    // 检查管理员权限 - 使用统一的权限验证
    const { requireAdmin } = await import("./auth-helpers")
    await requireAdmin()

    const supabase = await createClient()

    // 获取商家信息
    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("*, profiles!inner(username)")
      .eq("id", merchantId)
      .single()

    if (merchantError || !merchant) {
      throw new Error("商家不存在")
    }

    // 更新商家状态
    const { error: updateError } = await supabase
      .from("merchants")
      .update({ is_active: false })
      .eq("id", merchantId)

    if (updateError) throw updateError

    // 记录管理员操作
    const { logAdminOperation } = await import("./admin")
    await logAdminOperation({
      operationType: "deactivate_merchant",
      targetType: "merchant",
      targetId: merchantId,
      description: `下架商家: ${merchant.name}`,
      metadata: { reason, merchantName: merchant.name },
    })

    // 发送通知给商家
    await createNotification({
      userId: merchant.user_id,
      type: "merchant",
      category: "merchant_deactivated",
      title: "商家已下架",
      content: `您的商家已被下架。原因: ${reason}`,
      priority: "high",
      relatedMerchantId: merchantId,
    })

    revalidatePath("/admin/merchants")
    revalidatePath("/")

    return { success: true }
  } catch (error) {
    console.error("Error in adminDeactivateMerchant:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "下架失败",
    }
  }
}

/**
 * 管理员 - 违规处理（扣除押金）
 */
export async function adminViolateMerchant(
  merchantId: string,
  violationReason: string,
  deductAmount: number
) {
  try {
    // 检查管理员权限 - 使用统一的权限验证
    const { requireAdmin } = await import("./auth-helpers")
    await requireAdmin()

    const supabase = await createClient()

    // 获取商家信息
    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("*")
      .eq("id", merchantId)
      .single()

    if (merchantError || !merchant) {
      throw new Error("商家不存在")
    }

    // 检查是否是押金商家
    if (!merchant.is_deposit_merchant) {
      throw new Error("该商家不是押金商家，无法扣除押金")
    }

    // 检查押金余额
    if (merchant.deposit_amount < deductAmount) {
      throw new Error("押金余额不足")
    }

    // 计算剩余押金和赔付金额
    const remainingDeposit = merchant.deposit_amount - deductAmount
    // 🔒 安全修复：赔付金额应该是扣除金额的70%，而不是总押金的70%
    const compensationAmount = deductAmount * 0.7

    // 更新商家状态
    const updateData: any = {
      deposit_amount: remainingDeposit,
      deposit_status: "frozen", // 押金冻结中，等待赔付
      is_active: false, // 违规后自动下架
    }

    // 如果押金被完全扣完，更新为违规扣除状态
    if (remainingDeposit <= 0) {
      updateData.deposit_status = "violated"
      updateData.is_deposit_merchant = false
    }

    const { error: updateError } = await supabase
      .from("merchants")
      .update(updateData)
      .eq("id", merchantId)

    if (updateError) throw updateError

    // 记录管理员操作
    const { logAdminOperation } = await import("./admin")
    await logAdminOperation({
      operationType: "violate_merchant",
      targetType: "merchant",
      targetId: merchantId,
      description: `违规处理商家: ${merchant.name}，扣除押金 ${deductAmount.toFixed(2)} USDT（30%），赔付金额 ${compensationAmount.toFixed(2)} USDT（70%）`,
      metadata: {
        reason: violationReason,
        deductAmount,
        compensationAmount,
        remainingDeposit,
        merchantName: merchant.name,
      },
    })

    // 发送通知给商家
    await createNotification({
      userId: merchant.user_id,
      type: "merchant",
      category: "merchant_violated",
      title: "违规处理通知",
      content: `您的商家因违规被处理。平台扣除押金 ${deductAmount.toFixed(2)} USDT（30%），${compensationAmount.toFixed(2)} USDT（70%）用于赔付受害方。原因: ${violationReason}。剩余押金: ${remainingDeposit.toFixed(2)} USDT`,
      priority: "high",
      relatedMerchantId: merchantId,
    })

    revalidatePath("/admin/merchants")
    revalidatePath("/")

    return { success: true, remainingDeposit }
  } catch (error) {
    console.error("Error in adminViolateMerchant:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "违规处理失败",
    }
  }
}

/**
 * 管理员 - 完成赔付（解除押金冻结）
 * @param merchantId 商家ID
 * @param compensationAmount 实际赔付金额
 */
export async function adminCompleteCompensation(merchantId: string, compensationAmount: number) {
  try {
    // 检查管理员权限 - 使用统一的权限验证
    const { requireAdmin } = await import("./auth-helpers")
    await requireAdmin()

    const supabase = await createClient()

    // 验证赔付金额
    if (!compensationAmount || compensationAmount <= 0) {
      throw new Error("赔付金额必须大于0")
    }

    // 获取商家信息
    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("*")
      .eq("id", merchantId)
      .single()

    if (merchantError || !merchant) {
      throw new Error("商家不存在")
    }

    // 检查押金状态
    if (merchant.deposit_status !== "frozen") {
      throw new Error("该商家押金未冻结，无需解冻")
    }

    // 检查赔付金额是否超过剩余押金
    if (compensationAmount > merchant.deposit_amount) {
      throw new Error(`赔付金额不能超过剩余押金 ${merchant.deposit_amount.toFixed(2)} USDT`)
    }

    // 计算赔付后剩余押金
    const remainingDeposit = merchant.deposit_amount - compensationAmount

    // 准备更新数据
    const updateData: any = {
      deposit_amount: remainingDeposit,
    }

    // 如果押金扣完或接近0，标记为违规扣除状态
    if (remainingDeposit <= 0.01) {
      updateData.deposit_status = "violated"
      updateData.is_deposit_merchant = false
    } else {
      // 否则解除冻结，恢复为已缴纳状态
      updateData.deposit_status = "paid"
    }

    // 更新商家押金状态
    const { error: updateError } = await supabase
      .from("merchants")
      .update(updateData)
      .eq("id", merchantId)

    if (updateError) throw updateError

    // 记录管理员操作
    const { logAdminOperation } = await import("./admin")
    await logAdminOperation({
      operationType: "complete_compensation",
      targetType: "merchant",
      targetId: merchantId,
      description: `完成赔付: ${merchant.name}，赔付金额 ${compensationAmount.toFixed(2)} USDT`,
      metadata: {
        merchantName: merchant.name,
        compensationAmount,
        beforeDeposit: merchant.deposit_amount,
        afterDeposit: remainingDeposit,
        isFinalDepletion: remainingDeposit <= 0.01,
      },
    })

    // 发送通知给商家
    let notificationContent = ""
    if (remainingDeposit <= 0.01) {
      notificationContent = `赔付流程已完成，赔付金额 ${compensationAmount.toFixed(2)} USDT。您的押金已全部用于赔付，押金商家身份已取消。`
    } else {
      notificationContent = `赔付流程已完成，赔付金额 ${compensationAmount.toFixed(2)} USDT。剩余押金 ${remainingDeposit.toFixed(2)} USDT 已解除冻结，您可以继续使用押金商家权益或申请退还押金。`
    }

    await createNotification({
      userId: merchant.user_id,
      type: "merchant",
      category: "deposit_unfrozen",
      title: remainingDeposit <= 0.01 ? "押金已扣完" : "押金已解除冻结",
      content: notificationContent,
      priority: "high",
      relatedMerchantId: merchantId,
      metadata: {
        compensationAmount,
        remainingDeposit,
      },
    })

    revalidatePath("/admin/merchants")
    revalidatePath("/merchant/dashboard")

    return {
      success: true,
      remainingDeposit,
      isDepleted: remainingDeposit <= 0.01
    }
  } catch (error) {
    console.error("Error in adminCompleteCompensation:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "完成赔付失败",
    }
  }
}

/**
 * 管理员 - 置顶商家
 * @param merchantId 商家ID
 * @param days 置顶天数
 */
export async function adminPinMerchant(merchantId: string, days: number = 7) {
  try {
    // 检查管理员权限
    const { requireAdmin } = await import("./auth-helpers")
    await requireAdmin()

    const supabase = await createClient()

    // 验证置顶天数
    if (!days || days <= 0) {
      throw new Error("置顶天数必须大于0")
    }

    // 获取商家信息
    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("*, profiles!inner(username)")
      .eq("id", merchantId)
      .single()

    if (merchantError || !merchant) {
      throw new Error("商家不存在")
    }

    // 计算置顶截止时间
    const toppedUntil = new Date()
    toppedUntil.setDate(toppedUntil.getDate() + days)

    // 更新商家置顶状态
    const { error: updateError } = await supabase
      .from("merchants")
      .update({
        is_topped: true,
        topped_until: toppedUntil.toISOString(),
      })
      .eq("id", merchantId)

    if (updateError) throw updateError

    // 记录管理员操作
    const { logAdminOperation } = await import("./admin")
    await logAdminOperation({
      operationType: "pin_merchant",
      targetType: "merchant",
      targetId: merchantId,
      description: `置顶商家: ${merchant.name}，置顶${days}天`,
      metadata: {
        merchantName: merchant.name,
        days,
        toppedUntil: toppedUntil.toISOString(),
      },
    })

    // 发送通知给商家
    await createNotification({
      userId: merchant.user_id,
      type: "merchant",
      category: "merchant_pinned",
      title: "商家已置顶",
      content: `您的商家已被置顶${days}天，将在首页优先展示，置顶截止时间: ${toppedUntil.toLocaleString("zh-CN")}`,
      relatedMerchantId: merchantId,
    })

    revalidatePath("/admin/merchants")
    revalidatePath("/")

    return { success: true, toppedUntil: toppedUntil.toISOString() }
  } catch (error) {
    console.error("Error in adminPinMerchant:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "置顶失败",
    }
  }
}

/**
 * 管理员 - 取消置顶商家
 * @param merchantId 商家ID
 */
export async function adminUnpinMerchant(merchantId: string) {
  try {
    // 检查管理员权限
    const { requireAdmin } = await import("./auth-helpers")
    await requireAdmin()

    const supabase = await createClient()

    // 获取商家信息
    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("*, profiles!inner(username)")
      .eq("id", merchantId)
      .single()

    if (merchantError || !merchant) {
      throw new Error("商家不存在")
    }

    // 更新商家置顶状态
    const { error: updateError } = await supabase
      .from("merchants")
      .update({
        is_topped: false,
        topped_until: null,
      })
      .eq("id", merchantId)

    if (updateError) throw updateError

    // 记录管理员操作
    const { logAdminOperation } = await import("./admin")
    await logAdminOperation({
      operationType: "unpin_merchant",
      targetType: "merchant",
      targetId: merchantId,
      description: `取消置顶商家: ${merchant.name}`,
      metadata: {
        merchantName: merchant.name,
      },
    })

    // 发送通知给商家
    await createNotification({
      userId: merchant.user_id,
      type: "merchant",
      category: "merchant_unpinned",
      title: "商家置顶已取消",
      content: `您的商家置顶已取消`,
      relatedMerchantId: merchantId,
    })

    revalidatePath("/admin/merchants")
    revalidatePath("/")

    return { success: true }
  } catch (error) {
    console.error("Error in adminUnpinMerchant:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "取消置顶失败",
    }
  }
}
