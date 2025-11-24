/**
 * 硬币兑换积分 API
 * POST /api/exchange/coins-to-points
 *
 * 接收论坛的硬币兑换请求，为用户增加商家平台积分
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyRequest } from '@/lib/utils/signature-verification'

// 兑换比例配置
const EXCHANGE_RATE = 0.1 // 1积分 = 10硬币 = 0.1
const DAILY_COIN_LIMIT = 1000 // 每日最多兑换1000硬币
const MIN_COIN_AMOUNT = 10 // 最小兑换10硬币（= 1积分）

interface ExchangeRequest {
  forum_user_id: string      // 论坛用户ID
  forum_transaction_id: string // 论坛交易ID（唯一，防重放）
  user_email: string          // 用户邮箱（用于关联账户）
  coin_amount: number         // 硬币数量
  timestamp: number           // 时间戳（毫秒）
}

interface ExchangeResponse {
  success: boolean
  message?: string
  error?: string
  data?: {
    transaction_id: string
    coin_amount: number
    points_amount: number
    user_points_balance: number
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<ExchangeResponse>> {
  try {
    // 1. 解析请求体
    const body = await request.json()
    const signature = request.headers.get('X-Signature') || ''

    // 2. 验证请求签名
    const verificationResult = verifyRequest(body, signature)
    if (!verificationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: verificationResult.error || 'SIGNATURE_VERIFICATION_FAILED'
        },
        { status: 401 }
      )
    }

    // 3. 验证请求参数
    const {
      forum_user_id,
      forum_transaction_id,
      user_email,
      coin_amount,
      timestamp
    } = body as ExchangeRequest

    if (!forum_user_id || !forum_transaction_id || !user_email || !coin_amount) {
      return NextResponse.json(
        {
          success: false,
          error: 'MISSING_REQUIRED_PARAMETERS'
        },
        { status: 400 }
      )
    }

    // 4. 验证硬币数量
    if (coin_amount < MIN_COIN_AMOUNT) {
      return NextResponse.json(
        {
          success: false,
          error: 'COIN_AMOUNT_TOO_SMALL',
          message: `最少需要兑换 ${MIN_COIN_AMOUNT} 硬币`
        },
        { status: 400 }
      )
    }

    if (coin_amount % 10 !== 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'COIN_AMOUNT_INVALID',
          message: '硬币数量必须是10的倍数'
        },
        { status: 400 }
      )
    }

    // 5. 计算积分数量
    const points_amount = Math.floor(coin_amount * EXCHANGE_RATE)

    if (points_amount <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'POINTS_AMOUNT_INVALID',
          message: '计算的积分数量无效'
        },
        { status: 400 }
      )
    }

    // 6. 创建 Supabase 客户端（使用 service role）
    const supabase = createAdminClient()

    // 7. 检查论坛交易ID是否已存在（防重放）
    const { data: existingRecord, error: checkError } = await supabase
      .from('coin_exchange_records')
      .select('id, status')
      .eq('forum_transaction_id', forum_transaction_id)
      .single()

    if (existingRecord) {
      if (existingRecord.status === 'completed') {
        return NextResponse.json(
          {
            success: false,
            error: 'TRANSACTION_ALREADY_PROCESSED',
            message: '此交易已处理过'
          },
          { status: 409 }
        )
      }
    }

    // 8. 通过邮箱查找用户
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, email, points')
      .eq('email', user_email)
      .single()

    if (profileError || !profile) {
      // 记录失败的兑换
      await supabase.from('coin_exchange_records').insert({
        forum_user_id,
        forum_transaction_id,
        user_email,
        coin_amount,
        points_amount,
        exchange_rate: EXCHANGE_RATE,
        status: 'failed',
        failure_reason: 'USER_NOT_FOUND',
        request_signature: signature,
        request_timestamp: timestamp,
        request_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
      })

      return NextResponse.json(
        {
          success: false,
          error: 'USER_NOT_FOUND',
          message: '未找到该邮箱对应的用户，请确保已在商家平台注册'
        },
        { status: 404 }
      )
    }

    const user_id = profile.id

    // 9. 检查今日已兑换的硬币数量
    const today = new Date().toISOString().split('T')[0]
    const { data: todayRecords, error: limitError } = await supabase
      .from('coin_exchange_records')
      .select('coin_amount')
      .eq('user_email', user_email)
      .eq('status', 'completed')
      .gte('created_at', `${today}T00:00:00Z`)
      .lt('created_at', `${today}T23:59:59Z`)

    if (limitError) {
      console.error('Error checking daily limit:', limitError)
    }

    const todayTotalCoins = todayRecords?.reduce((sum, record) => sum + record.coin_amount, 0) || 0

    if (todayTotalCoins + coin_amount > DAILY_COIN_LIMIT) {
      return NextResponse.json(
        {
          success: false,
          error: 'DAILY_LIMIT_EXCEEDED',
          message: `每日兑换限额为 ${DAILY_COIN_LIMIT} 硬币，您今日已兑换 ${todayTotalCoins} 硬币`
        },
        { status: 429 }
      )
    }

    // 10. 开始事务：记录兑换 + 增加积分
    const { data: exchangeRecord, error: insertError } = await supabase
      .from('coin_exchange_records')
      .insert({
        user_id,
        user_email,
        forum_user_id,
        forum_transaction_id,
        coin_amount,
        points_amount,
        exchange_rate: EXCHANGE_RATE,
        status: 'pending',
        request_signature: signature,
        request_timestamp: timestamp,
        request_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
      })
      .select()
      .single()

    if (insertError || !exchangeRecord) {
      console.error('Error inserting exchange record:', insertError)
      return NextResponse.json(
        {
          success: false,
          error: 'DATABASE_ERROR',
          message: '创建兑换记录失败'
        },
        { status: 500 }
      )
    }

    // 11. 使用 recordPointTransaction 函数增加用户积分
    // 这个函数会自动更新 profiles.points 和创建 point_transactions 记录
    const { data: transactionId, error: transactionError } = await supabase
      .rpc('record_point_transaction', {
        p_user_id: user_id,
        p_amount: points_amount,
        p_type: 'coin_exchange',
        p_description: `硬币兑换积分:${coin_amount} 硬币 → ${points_amount} 积分`,
        p_related_user_id: null,
        p_related_merchant_id: null,
        p_metadata: {
          exchange_record_id: exchangeRecord.id,
          coin_amount,
          exchange_rate: EXCHANGE_RATE
        }
      })

    if (transactionError) {
      // 回滚：标记兑换记录为失败
      await supabase
        .from('coin_exchange_records')
        .update({
          status: 'failed',
          failure_reason: 'POINTS_UPDATE_FAILED'
        })
        .eq('id', exchangeRecord.id)

      console.error('Error updating points:', transactionError)
      return NextResponse.json(
        {
          success: false,
          error: 'POINTS_UPDATE_FAILED',
          message: '积分更新失败'
        },
        { status: 500 }
      )
    }

    // 12. 获取更新后的用户积分
    const { data: updatedProfile } = await supabase
      .from('profiles')
      .select('points')
      .eq('id', user_id)
      .single()

    // 13. 标记兑换记录为完成
    await supabase
      .from('coin_exchange_records')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', exchangeRecord.id)

    // 14. 返回成功响应
    return NextResponse.json(
      {
        success: true,
        message: `成功兑换 ${coin_amount} 硬币为 ${points_amount} 积分`,
        data: {
          transaction_id: exchangeRecord.id,
          coin_amount,
          points_amount,
          user_points_balance: updatedProfile?.points || 0
        }
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('Exchange API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: '服务器内部错误'
      },
      { status: 500 }
    )
  }
}

// 不允许 GET 请求
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      success: false,
      error: 'METHOD_NOT_ALLOWED',
      message: '请使用 POST 方法'
    },
    { status: 405 }
  )
}
