import { checkTopExpiringMerchants } from "@/lib/actions/cron"
import { NextResponse } from "next/server"

/**
 * API端点: 检查并发送商家置顶即将到期提醒
 * 建议: 每天运行一次(推荐上午10点)
 *
 * 使用方法:
 * 1. 使用外部Cron服务(如cron-job.org)定时调用此端点
 * 2. 或使用Vercel Cron Jobs (需要在vercel.json配置)
 */
export async function GET(request: Request) {
  // 验证请求来源（必需）
  const expectedToken = process.env.CRON_SECRET

  // 检查环境变量是否配置
  if (!expectedToken) {
    console.error("CRON_SECRET 环境变量未配置！")
    return NextResponse.json(
      { error: "Server misconfigured: CRON_SECRET not set" },
      { status: 500 }
    )
  }

  // 验证请求授权
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${expectedToken}`) {
    console.warn("CRON 端点未授权访问尝试", {
      ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
      timestamp: new Date().toISOString()
    })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await checkTopExpiringMerchants()
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// 支持POST方法
export async function POST(request: Request) {
  return GET(request)
}
