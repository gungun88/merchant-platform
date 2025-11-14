"use server"

import { createClient } from "@/lib/supabase/server"
import { createNotification } from "./notifications"

/**
 * 检查并发送商家置顶即将到期提醒
 * 每天运行一次,检查3天内即将到期的置顶商家
 */
export async function checkTopExpiringMerchants() {
  const supabase = await createClient()

  try {
    // 获取3天内即将到期的置顶商家
    const threeDaysFromNow = new Date()
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)

    const now = new Date()

    const { data: merchants, error } = await supabase
      .from("merchants")
      .select("id, user_id, name, topped_until")
      .eq("is_topped", true)
      .not("topped_until", "is", null)
      .gt("topped_until", now.toISOString()) // 还没过期
      .lt("topped_until", threeDaysFromNow.toISOString()) // 3天内到期

    if (error) {
      console.error("Error fetching expiring merchants:", error)
      return { success: false, error: error.message }
    }

    if (!merchants || merchants.length === 0) {
      console.log("No expiring merchants found")
      return { success: true, count: 0 }
    }

    // 为每个即将到期的商家发送通知
    let notificationCount = 0
    for (const merchant of merchants) {
      const expiryDate = new Date(merchant.topped_until!)
      const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      await createNotification({
        userId: merchant.user_id,
        type: "merchant",
        category: "merchant_top_expiring",
        title: "商家置顶即将到期",
        content: `您的商家"${merchant.name}"的置顶服务将在 ${daysLeft} 天后到期 (${expiryDate.toLocaleDateString('zh-CN')})`,
        relatedMerchantId: merchant.id,
        metadata: {
          expires_at: merchant.topped_until,
          days_left: daysLeft,
        },
        priority: "high",
      })

      notificationCount++
    }

    console.log(`Sent ${notificationCount} expiring notifications`)
    return { success: true, count: notificationCount }
  } catch (error: any) {
    console.error("Error in checkTopExpiringMerchants:", error)
    return { success: false, error: error.message }
  }
}

/**
 * 自动下架已过期的置顶商家
 * 每小时运行一次
 */
export async function expireTopMerchants() {
  const supabase = await createClient()

  try {
    const now = new Date()

    // 查找已过期的置顶商家
    const { data: expiredMerchants, error: fetchError } = await supabase
      .from("merchants")
      .select("id, user_id, name")
      .eq("is_topped", true)
      .not("topped_until", "is", null)
      .lt("topped_until", now.toISOString())

    if (fetchError) {
      console.error("Error fetching expired merchants:", fetchError)
      return { success: false, error: fetchError.message }
    }

    if (!expiredMerchants || expiredMerchants.length === 0) {
      console.log("No expired merchants found")
      return { success: true, count: 0 }
    }

    // 取消置顶状态
    const merchantIds = expiredMerchants.map((m) => m.id)
    const { error: updateError } = await supabase
      .from("merchants")
      .update({
        is_topped: false,
        topped_until: null,
      })
      .in("id", merchantIds)

    if (updateError) {
      console.error("Error updating expired merchants:", updateError)
      return { success: false, error: updateError.message }
    }

    // 发送过期通知
    for (const merchant of expiredMerchants) {
      await createNotification({
        userId: merchant.user_id,
        type: "merchant",
        category: "merchant_top_expired",
        title: "商家置顶已到期",
        content: `您的商家"${merchant.name}"的置顶服务已到期`,
        relatedMerchantId: merchant.id,
        priority: "normal",
      })
    }

    console.log(`Expired ${expiredMerchants.length} merchants`)
    return { success: true, count: expiredMerchants.length }
  } catch (error: any) {
    console.error("Error in expireTopMerchants:", error)
    return { success: false, error: error.message }
  }
}
