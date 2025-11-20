"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface BetaCode {
  id: string
  code: string
  is_used: boolean
  used_by: string | null
  used_at: string | null
  created_by: string | null
  created_at: string
  user?: {
    username: string
    email: string
    user_number: number
  }
}

/**
 * 生成随机内测码（8位大写字母+数字，排除易混淆字符）
 */
function generateBetaCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  // 排除 0,O,1,I 等易混淆字符
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/**
 * 验证内测码是否有效（注册时调用）
 * 会检查内测码是否存在且未被使用
 */
export async function validateBetaCode(code: string) {
  const supabase = await createClient()

  try {
    // 调用数据库函数验证
    const { data, error } = await supabase.rpc('validate_beta_code', {
      p_code: code.toUpperCase()
    })

    if (error) {
      console.error('[validateBetaCode] Error:', error)
      return {
        success: false,
        valid: false,
        error: '验证失败，请重试'
      }
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        valid: false,
        error: '邀请码不存在或无效'
      }
    }

    const result = data[0]

    return {
      success: true,
      valid: result.is_valid,
      betaCodeId: result.beta_code_id,
      error: result.error_message
    }
  } catch (error) {
    console.error('[validateBetaCode] Exception:', error)
    return {
      success: false,
      valid: false,
      error: '系统错误，请重试'
    }
  }
}

/**
 * 标记内测码为已使用（注册成功后调用）
 */
export async function useBetaCode(code: string, userId: string) {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase.rpc('use_beta_code', {
      p_code: code.toUpperCase(),
      p_user_id: userId
    })

    if (error) {
      console.error('[useBetaCode] Error:', error)
      return { success: false, error: error.message }
    }

    if (!data) {
      return { success: false, error: '标记失败' }
    }

    return { success: true }
  } catch (error: any) {
    console.error('[useBetaCode] Exception:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 获取所有内测码（管理员）
 */
export async function getBetaCodes() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录", data: [] }
  }

  // 验证管理员权限
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "admin") {
    return { success: false, error: "无权限访问", data: [] }
  }

  try {
    const { data: betaCodes, error } = await supabase
      .from("beta_codes")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error('[getBetaCodes] Error:', error)
      return { success: false, error: error.message, data: [] }
    }

    // 如果有使用者，获取使用者信息
    if (betaCodes && betaCodes.length > 0) {
      const usedCodes = betaCodes.filter(bc => bc.used_by)
      if (usedCodes.length > 0) {
        const userIds = usedCodes.map(bc => bc.used_by)
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, email, user_number")
          .in("id", userIds)

        const profileMap: Record<string, any> = {}
        profiles?.forEach(p => {
          profileMap[p.id] = p
        })

        const enrichedBetaCodes = betaCodes.map(bc => ({
          ...bc,
          user: bc.used_by ? profileMap[bc.used_by] : undefined
        }))

        return { success: true, data: enrichedBetaCodes }
      }
    }

    return { success: true, data: betaCodes || [] }
  } catch (error: any) {
    console.error('[getBetaCodes] Exception:', error)
    return { success: false, error: error.message, data: [] }
  }
}

/**
 * 批量生成内测码（管理员）
 */
export async function generateBatchBetaCodes(count: number) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录", data: [] }
  }

  // 验证管理员权限
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "admin") {
    return { success: false, error: "无权限操作", data: [] }
  }

  if (count < 1 || count > 500) {
    return { success: false, error: "批量生成数量必须在1-500之间", data: [] }
  }

  try {
    const codes: string[] = []
    const betaCodesToInsert = []

    // 生成唯一的内测码
    while (codes.length < count) {
      const newCode = generateBetaCode()
      if (!codes.includes(newCode)) {
        codes.push(newCode)
      }
    }

    // 准备插入数据
    for (const code of codes) {
      betaCodesToInsert.push({
        code,
        created_by: user.id,
      })
    }

    // 批量插入
    const { data: newBetaCodes, error } = await supabase
      .from("beta_codes")
      .insert(betaCodesToInsert)
      .select()

    if (error) {
      console.error('[generateBatchBetaCodes] Error:', error)
      return { success: false, error: error.message, data: [] }
    }

    revalidatePath("/admin/beta-codes")
    return { success: true, data: newBetaCodes || [] }
  } catch (error: any) {
    console.error('[generateBatchBetaCodes] Exception:', error)
    return { success: false, error: error.message, data: [] }
  }
}

/**
 * 删除内测码（管理员）
 */
export async function deleteBetaCode(id: string) {
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

  if (!profile || profile.role !== "admin") {
    return { success: false, error: "无权限操作" }
  }

  try {
    const { error } = await supabase
      .from("beta_codes")
      .delete()
      .eq("id", id)

    if (error) {
      console.error('[deleteBetaCode] Error:', error)
      return { success: false, error: error.message }
    }

    revalidatePath("/admin/beta-codes")
    return { success: true }
  } catch (error: any) {
    console.error('[deleteBetaCode] Exception:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 批量删除内测码（管理员）
 */
export async function deleteBatchBetaCodes(ids: string[]) {
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

  if (!profile || profile.role !== "admin") {
    return { success: false, error: "无权限操作" }
  }

  try {
    const { error } = await supabase
      .from("beta_codes")
      .delete()
      .in("id", ids)

    if (error) {
      console.error('[deleteBatchBetaCodes] Error:', error)
      return { success: false, error: error.message }
    }

    revalidatePath("/admin/beta-codes")
    return { success: true }
  } catch (error: any) {
    console.error('[deleteBatchBetaCodes] Exception:', error)
    return { success: false, error: error.message }
  }
}
