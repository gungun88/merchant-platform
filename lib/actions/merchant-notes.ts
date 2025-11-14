"use server"

import { createClient } from "@/lib/supabase/server"

/**
 * 获取用户对某个商家的备注
 */
export async function getMerchantNote(merchantId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录" }
  }

  const { data, error } = await supabase
    .from("merchant_notes")
    .select("*")
    .eq("user_id", user.id)
    .eq("merchant_id", merchantId)
    .single()

  if (error && error.code !== "PGRST116") {
    // PGRST116 是没有找到记录的错误，这是正常的
    console.error("获取备注失败:", error)
    return { success: false, error: "获取备注失败" }
  }

  return { success: true, data: data || null }
}

/**
 * 保存或更新商家备注
 */
export async function saveMerchantNote(merchantId: string, note: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录" }
  }

  // 验证备注长度
  if (note.length > 200) {
    return { success: false, error: "备注不能超过200个字符" }
  }

  // 如果备注为空，删除记录
  if (!note.trim()) {
    const { error } = await supabase
      .from("merchant_notes")
      .delete()
      .eq("user_id", user.id)
      .eq("merchant_id", merchantId)

    if (error) {
      console.error("删除备注失败:", error)
      return { success: false, error: "删除备注失败" }
    }

    return { success: true }
  }

  // 使用 upsert 来插入或更新
  const { error } = await supabase
    .from("merchant_notes")
    .upsert(
      {
        user_id: user.id,
        merchant_id: merchantId,
        note: note.trim(),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,merchant_id",
        ignoreDuplicates: false,
      }
    )

  if (error) {
    console.error("保存备注失败:", error)
    // 如果 upsert 失败，尝试先查询是否存在，然后决定是 insert 还是 update
    const { data: existing } = await supabase
      .from("merchant_notes")
      .select("id")
      .eq("user_id", user.id)
      .eq("merchant_id", merchantId)
      .single()

    if (existing) {
      // 存在则更新
      const { error: updateError } = await supabase
        .from("merchant_notes")
        .update({
          note: note.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("merchant_id", merchantId)

      if (updateError) {
        console.error("更新备注失败:", updateError)
        return { success: false, error: `更新失败: ${updateError.message}` }
      }
    } else {
      // 不存在则插入
      const { error: insertError } = await supabase.from("merchant_notes").insert({
        user_id: user.id,
        merchant_id: merchantId,
        note: note.trim(),
      })

      if (insertError) {
        console.error("插入备注失败:", insertError)
        return { success: false, error: `插入失败: ${insertError.message}` }
      }
    }
  }

  return { success: true }
}

/**
 * 获取用户的所有商家备注
 */
export async function getAllMerchantNotes() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录", data: [] }
  }

  const { data, error } = await supabase
    .from("merchant_notes")
    .select("merchant_id, note")
    .eq("user_id", user.id)

  if (error) {
    console.error("获取所有备注失败:", error)
    return { success: false, error: "获取备注失败", data: [] }
  }

  // 转换为 Map 格式方便查询
  const notesMap: Record<string, string> = {}
  data.forEach((item) => {
    notesMap[item.merchant_id] = item.note
  })

  return { success: true, data: notesMap }
}
