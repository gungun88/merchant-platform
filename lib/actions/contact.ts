"use server"

import { createClient } from "@/lib/supabase/server"
import { addPointsLog } from "./points"
import { createNotification } from "./notifications"
import { getSystemSettings } from "./settings"

// 查看联系方式
export async function viewContact(merchantId: string) {
  const supabase = await createClient()

  // 获取当前用户
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("请先登录")
  }

  // 获取当前用户的profile
  const { data: viewerProfile, error: viewerError } = await supabase
    .from("profiles")
    .select("points, is_merchant")
    .eq("id", user.id)
    .single()

  if (viewerError) {
    throw new Error("获取用户信息失败")
  }

  // 获取商家信息
  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .select("*, profiles!inner(id, points, is_merchant)")
    .eq("id", merchantId)
    .single()

  if (merchantError || !merchant) {
    throw new Error("商家不存在")
  }

  const merchantProfile = merchant.profiles

  // 判断是否是商家本人查看自己的联系方式
  const isOwnMerchant = merchant.user_id === user.id

  // 如果是商家本人查看自己，直接返回联系方式，不扣积分
  if (isOwnMerchant) {
    return {
      success: true,
      contact: {
        phone: merchant.contact_phone,
        wechat: merchant.contact_wechat,
        telegram: merchant.contact_telegram,
        whatsapp: merchant.contact_whatsapp,
        email: merchant.contact_email,
      },
      pointsDeducted: 0,
      isOwnMerchant: true,
    }
  }

  // 获取系统设置的积分配置
  const settingsResult = await getSystemSettings()
  const settings = settingsResult.data
  const customerCost = settings?.view_contact_customer_cost || 10
  const merchantCost = settings?.view_contact_merchant_cost || 50
  const merchantDeduct = settings?.view_contact_merchant_deduct || 10

  // 判断查看者身份
  const isViewerMerchant = viewerProfile.is_merchant
  const pointsToDeduct = isViewerMerchant ? merchantCost : customerCost

  // 检查查看者积分是否足够
  if (viewerProfile.points < pointsToDeduct) {
    throw new Error(`积分不足，需要${pointsToDeduct}积分`)
  }

  // 如果是客户查看商家，还需要检查商家积分
  if (!isViewerMerchant) {
    if (merchantProfile.points < merchantDeduct) {
      throw new Error(`该商家积分不足，暂时无法查看`)
    }
  }

  // 扣除查看者积分
  // addPointsLog 内部会调用 recordPointTransaction,自动更新积分和记录交易
  const viewerDesc = isViewerMerchant
    ? `查看商家【${merchant.name}】联系方式 -${pointsToDeduct}积分`
    : `查看商家【${merchant.name}】联系方式 -${pointsToDeduct}积分`

  await addPointsLog(
    user.id,
    -pointsToDeduct,
    "view_contact",
    viewerDesc,
    null,
    merchantId
  )

  // 如果是注册用户查看商家，商家也扣除积分
  if (!isViewerMerchant) {
    // addPointsLog 内部会调用 recordPointTransaction,自动更新积分和记录交易
    await addPointsLog(
      merchantProfile.id,
      -merchantDeduct,
      "contact_viewed",
      `联系方式被注册用户查看 -${merchantDeduct}积分`,
      user.id,
      merchantId
    )

    // 发送通知给商家：有用户查看了联系方式
    await createNotification({
      userId: merchantProfile.id,
      type: "merchant",
      category: "contact_view",
      title: "有用户查看了你的联系方式",
      content: `用户消耗 ${customerCost} 积分查看了你的联系方式（你也消耗 ${merchantDeduct} 积分）`,
      relatedUserId: user.id,
      relatedMerchantId: merchantId,
      metadata: { points_deducted: merchantDeduct },
    })

    // 检查商家积分余额,使用系统配置的阈值
    const { data: updatedMerchantProfile } = await supabase
      .from("profiles")
      .select("points")
      .eq("id", merchantProfile.id)
      .maybeSingle()

    const merchantRemainingPoints = updatedMerchantProfile?.points || 0
    const lowPointsThreshold = settings?.low_points_threshold || 100
    if (merchantRemainingPoints < lowPointsThreshold) {
      await createNotification({
        userId: merchantProfile.id,
        type: "transaction",
        category: "low_points_warning",
        title: "积分余额不足",
        content: `您的积分余额仅剩 ${merchantRemainingPoints} 分,建议及时获取积分以便继续使用平台服务`,
        metadata: { remaining_points: merchantRemainingPoints, threshold: lowPointsThreshold },
        priority: "high",
      })
    }
  }

  // 检查查看者积分余额,使用系统配置的阈值
  const { data: updatedViewerProfile } = await supabase
    .from("profiles")
    .select("points")
    .eq("id", user.id)
    .maybeSingle()

  const viewerRemainingPoints = updatedViewerProfile?.points || 0
  const lowPointsThreshold = settings?.low_points_threshold || 100
  if (viewerRemainingPoints < lowPointsThreshold) {
    await createNotification({
      userId: user.id,
      type: "transaction",
      category: "low_points_warning",
      title: "积分余额不足",
      content: `您的积分余额仅剩 ${viewerRemainingPoints} 分,建议及时获取积分以便继续使用平台服务`,
      metadata: { remaining_points: viewerRemainingPoints, threshold: lowPointsThreshold },
      priority: "high",
    })
  }

  // 返回联系方式
  return {
    success: true,
    contact: {
      phone: merchant.contact_phone,
      wechat: merchant.contact_wechat,
      telegram: merchant.contact_telegram,
      whatsapp: merchant.contact_whatsapp,
      email: merchant.contact_email,
    },
    pointsDeducted: pointsToDeduct,
  }
}

// 检查是否可以查看联系方式
export async function canViewContact(merchantId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      canView: false,
      reason: "请先登录",
      requiredPoints: 0,
    }
  }

  const { data: viewerProfile } = await supabase
    .from("profiles")
    .select("points, is_merchant")
    .eq("id", user.id)
    .single()

  if (!viewerProfile) {
    return {
      canView: false,
      reason: "获取用户信息失败",
      requiredPoints: 0,
    }
  }

  const { data: merchant } = await supabase
    .from("merchants")
    .select("*, profiles!inner(points)")
    .eq("id", merchantId)
    .single()

  if (!merchant) {
    return {
      canView: false,
      reason: "商家不存在",
      requiredPoints: 0,
    }
  }

  // 判断是否是商家本人查看自己
  const isOwnMerchant = merchant.user_id === user.id

  // 如果是商家本人，可以免费查看，不需要积分
  if (isOwnMerchant) {
    return {
      canView: true,
      requiredPoints: 0,
      currentPoints: viewerProfile.points,
      isOwnMerchant: true,
    }
  }

  // 获取系统设置的积分配置
  const settingsResult = await getSystemSettings()
  const settings = settingsResult.data
  const customerCost = settings?.view_contact_customer_cost || 10
  const merchantCost = settings?.view_contact_merchant_cost || 50
  const merchantDeduct = settings?.view_contact_merchant_deduct || 10

  const isViewerMerchant = viewerProfile.is_merchant
  const requiredPoints = isViewerMerchant ? merchantCost : customerCost

  if (viewerProfile.points < requiredPoints) {
    return {
      canView: false,
      reason: `积分不足，需要${requiredPoints}积分`,
      requiredPoints,
      currentPoints: viewerProfile.points,
    }
  }

  if (!isViewerMerchant && merchant.profiles.points < merchantDeduct) {
    return {
      canView: false,
      reason: "该商家积分不足，暂时无法查看",
      requiredPoints,
    }
  }

  return {
    canView: true,
    requiredPoints,
    currentPoints: viewerProfile.points,
  }
}
