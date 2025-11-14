import { NextRequest, NextResponse } from "next/server"
import { checkExpiringPartners } from "@/lib/actions/partners"

/**
 * API路由: 检查即将到期的合作伙伴
 * 用途: 每天运行一次,检查7天内即将到期的合作伙伴并发送通知
 *
 * 使用方法:
 * 1. 手动触发: GET /api/cron/check-expiring-partners
 * 2. 定时任务: 配置cron job每天执行一次
 */
export async function GET(request: NextRequest) {
  try {
    // 验证请求来源（必需）
    const cronSecret = process.env.CRON_SECRET

    // 检查环境变量是否配置
    if (!cronSecret) {
      console.error("CRON_SECRET 环境变量未配置！")
      return NextResponse.json(
        { error: "Server misconfigured: CRON_SECRET not set" },
        { status: 500 }
      )
    }

    // 验证请求授权
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn("CRON 端点未授权访问尝试", {
        ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
        timestamp: new Date().toISOString()
      })
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    // 执行检查
    const result = await checkExpiringPartners()

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "检查失败" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `已发送 ${result.notifiedCount} 条到期提醒通知`,
      notifiedCount: result.notifiedCount,
    })
  } catch (error: any) {
    console.error("Error in check-expiring-partners cron:", error)
    return NextResponse.json(
      { error: error.message || "系统错误" },
      { status: 500 }
    )
  }
}
