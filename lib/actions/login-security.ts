"use server"

import { createClient } from "@/lib/supabase/server"
import { getSystemSettings } from "@/lib/actions/settings"

/**
 * 检查账号是否被锁定
 */
export async function checkAccountLocked(email: string) {
  const supabase = await createClient()

  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, account_locked_until, login_failed_attempts")
      .eq("email", email)
      .maybeSingle()

    if (error || !profile) {
      return { locked: false, remainingMinutes: 0 }
    }

    // 检查是否有锁定时间且未过期
    if (profile.account_locked_until) {
      const lockUntil = new Date(profile.account_locked_until)
      const now = new Date()

      if (now < lockUntil) {
        const remainingMs = lockUntil.getTime() - now.getTime()
        const remainingMinutes = Math.ceil(remainingMs / (1000 * 60))
        return {
          locked: true,
          remainingMinutes,
          attempts: profile.login_failed_attempts || 0,
        }
      } else {
        // 锁定时间已过期，清除锁定状态
        await supabase
          .from("profiles")
          .update({
            account_locked_until: null,
            login_failed_attempts: 0,
          })
          .eq("id", profile.id)

        return { locked: false, remainingMinutes: 0 }
      }
    }

    return { locked: false, remainingMinutes: 0, attempts: profile.login_failed_attempts || 0 }
  } catch (error) {
    console.error("Error checking account lock:", error)
    return { locked: false, remainingMinutes: 0 }
  }
}

/**
 * 记录登录失败，并在达到最大次数时锁定账号
 */
export async function recordLoginFailure(email: string) {
  const supabase = await createClient()

  try {
    // 获取系统设置
    const settingsResult = await getSystemSettings()
    if (!settingsResult.success || !settingsResult.data) {
      return { success: false, error: "无法获取系统设置" }
    }

    const settings = settingsResult.data
    const maxAttempts = settings.max_login_attempts || 5
    const lockoutMinutes = settings.login_lockout_minutes || 30

    // 获取用户 profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, login_failed_attempts")
      .eq("email", email)
      .maybeSingle()

    if (profileError || !profile) {
      return { success: false, error: "用户不存在" }
    }

    const newAttempts = (profile.login_failed_attempts || 0) + 1

    // 判断是否需要锁定
    if (newAttempts >= maxAttempts) {
      const lockUntil = new Date()
      lockUntil.setMinutes(lockUntil.getMinutes() + lockoutMinutes)

      await supabase
        .from("profiles")
        .update({
          login_failed_attempts: newAttempts,
          account_locked_until: lockUntil.toISOString(),
          last_failed_login_at: new Date().toISOString(),
        })
        .eq("id", profile.id)

      return {
        success: true,
        locked: true,
        attempts: newAttempts,
        lockoutMinutes,
      }
    } else {
      // 只增加失败次数
      await supabase
        .from("profiles")
        .update({
          login_failed_attempts: newAttempts,
          last_failed_login_at: new Date().toISOString(),
        })
        .eq("id", profile.id)

      return {
        success: true,
        locked: false,
        attempts: newAttempts,
        remainingAttempts: maxAttempts - newAttempts,
      }
    }
  } catch (error: any) {
    console.error("Error recording login failure:", error)
    return { success: false, error: error.message }
  }
}

/**
 * 重置登录失败次数（登录成功时调用）
 */
export async function resetLoginAttempts(userId: string) {
  const supabase = await createClient()

  try {
    await supabase
      .from("profiles")
      .update({
        login_failed_attempts: 0,
        account_locked_until: null,
        last_failed_login_at: null,
      })
      .eq("id", userId)

    return { success: true }
  } catch (error: any) {
    console.error("Error resetting login attempts:", error)
    return { success: false, error: error.message }
  }
}
