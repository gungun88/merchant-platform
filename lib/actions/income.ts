"use server"

import { createClient } from "@/lib/supabase/server"

/**
 * 收入类型
 */
export type IncomeType = "deposit_fee" | "partner_subscription"

/**
 * 支出类型
 */
export type ExpenseType = "manual_expense" | "operational_cost" | "marketing_cost"

/**
 * 交易类型
 */
export type TransactionType = "income" | "expense" | "all"

/**
 * 收入记录接口
 */
export interface PlatformIncome {
  id: string
  income_type: IncomeType
  amount: number
  merchant_id: string | null
  partner_id: string | null
  user_id: string | null
  description: string
  details: any
  created_at: string
  income_date: string
  admin_note: string | null
}

/**
 * 财务统计接口（包含收入、支出、净利润）
 */
export interface FinanceStats {
  todayIncome: number
  todayExpense: number
  todayProfit: number
  totalProfit: number
}

/**
 * 获取财务统计数据（收入、支出、净利润）
 */
export async function getFinanceStats(): Promise<{
  success: boolean
  data?: FinanceStats
  error?: string
}> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "未登录" }
    }

    // 检查管理员权限
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
      return { success: false, error: "权限不足" }
    }

    // 获取今日日期
    const today = new Date().toISOString().split("T")[0]

    // 使用管理员客户端
    const { createAdminClient } = await import("@/lib/supabase/server")
    const adminClient = createAdminClient()

    // 今日收入
    const { data: todayIncomeData } = await adminClient
      .from("platform_income")
      .select("amount")
      .eq("income_date", today)
      .eq("transaction_type", "income")

    const todayIncome = todayIncomeData?.reduce((sum, item) => sum + Number(item.amount), 0) || 0

    // 今日支出
    const { data: todayExpenseData } = await adminClient
      .from("platform_income")
      .select("amount")
      .eq("income_date", today)
      .eq("transaction_type", "expense")

    const todayExpense = todayExpenseData?.reduce((sum, item) => sum + Number(item.amount), 0) || 0

    // 累计收入
    const { data: totalIncomeData } = await adminClient
      .from("platform_income")
      .select("amount")
      .eq("transaction_type", "income")

    const totalIncome = totalIncomeData?.reduce((sum, item) => sum + Number(item.amount), 0) || 0

    // 累计支出
    const { data: totalExpenseData } = await adminClient
      .from("platform_income")
      .select("amount")
      .eq("transaction_type", "expense")

    const totalExpense = totalExpenseData?.reduce((sum, item) => sum + Number(item.amount), 0) || 0

    return {
      success: true,
      data: {
        todayIncome,
        todayExpense,
        todayProfit: todayIncome - todayExpense,
        totalProfit: totalIncome - totalExpense,
      },
    }
  } catch (error) {
    console.error("Error getting finance stats:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取统计数据失败",
    }
  }
}

/**
 * 获取收入统计数据（保留旧接口，兼容性）
 */
export async function getIncomeStats(): Promise<{
  success: boolean
  data?: { today: number; thisMonth: number; thisYear: number; total: number }
  error?: string
}> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "未登录" }
    }

    // 检查管理员权限
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
      return { success: false, error: "权限不足" }
    }

    // 获取今日日期 - 使用北京时间
    const now = new Date()
    const bjNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Shanghai" }))
    const today = `${bjNow.getFullYear()}-${String(bjNow.getMonth() + 1).padStart(2, '0')}-${String(bjNow.getDate()).padStart(2, '0')}`

    // 获取本月第一天 - 使用北京时间
    const thisMonthStart = new Date(bjNow.getFullYear(), bjNow.getMonth(), 1)

    // 获取本年第一天 - 使用北京时间
    const thisYearStart = new Date(bjNow.getFullYear(), 0, 1)

    // 使用管理员客户端
    const { createAdminClient } = await import("@/lib/supabase/server")
    const adminClient = createAdminClient()

    // 今日收入
    const { data: todayData } = await adminClient
      .from("platform_income")
      .select("amount")
      .eq("income_date", today)

    const todayIncome = todayData?.reduce((sum, item) => sum + Number(item.amount), 0) || 0

    // 本月收入
    const { data: monthData } = await adminClient
      .from("platform_income")
      .select("amount")
      .gte("created_at", thisMonthStart.toISOString())

    const monthIncome = monthData?.reduce((sum, item) => sum + Number(item.amount), 0) || 0

    // 本年收入
    const { data: yearData } = await adminClient
      .from("platform_income")
      .select("amount")
      .gte("created_at", thisYearStart.toISOString())

    const yearIncome = yearData?.reduce((sum, item) => sum + Number(item.amount), 0) || 0

    // 总收入
    const { data: totalData } = await adminClient.from("platform_income").select("amount")

    const totalIncome = totalData?.reduce((sum, item) => sum + Number(item.amount), 0) || 0

    return {
      success: true,
      data: {
        today: todayIncome,
        thisMonth: monthIncome,
        thisYear: yearIncome,
        total: totalIncome,
      },
    }
  } catch (error) {
    console.error("Error getting income stats:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取统计数据失败",
    }
  }
}

/**
 * 获取财务列表（收入+支出）
 */
export async function getIncomeList(params?: {
  page?: number
  pageSize?: number
  transactionType?: TransactionType
  incomeType?: IncomeType | ExpenseType | "all"
  startDate?: string
  endDate?: string
  searchKeyword?: string
}): Promise<{
  success: boolean
  data?: {
    incomes: any[]
    total: number
    page: number
    pageSize: number
  }
  error?: string
}> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "未登录" }
    }

    // 检查管理员权限
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
      return { success: false, error: "权限不足" }
    }

    const page = params?.page || 1
    const pageSize = params?.pageSize || 20
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    // 使用管理员客户端
    const { createAdminClient } = await import("@/lib/supabase/server")
    const adminClient = createAdminClient()

    // 构建查询
    let query = adminClient
      .from("platform_income")
      .select(
        `
        *,
        merchants(id, name),
        partners(id, name)
      `,
        { count: "exact" }
      )

    // 筛选交易类型（收入/支出）
    if (params?.transactionType && params.transactionType !== "all") {
      query = query.eq("transaction_type", params.transactionType)
    }

    // 筛选收入/支出类型
    if (params?.incomeType && params.incomeType !== "all") {
      query = query.eq("income_type", params.incomeType)
    }

    // 筛选日期范围
    if (params?.startDate) {
      query = query.gte("income_date", params.startDate)
    }
    if (params?.endDate) {
      query = query.lte("income_date", params.endDate)
    }

    // 搜索关键词（搜索描述）
    if (params?.searchKeyword) {
      query = query.ilike("description", `%${params.searchKeyword}%`)
    }

    // 排序和分页
    const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to)

    if (error) {
      console.error("Error fetching income list:", error)
      return { success: false, error: "获取收入列表失败" }
    }

    return {
      success: true,
      data: {
        incomes: data || [],
        total: count || 0,
        page,
        pageSize,
      },
    }
  } catch (error) {
    console.error("Error in getIncomeList:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取收入列表失败",
    }
  }
}

/**
 * 获取单条收入详情
 */
export async function getIncomeDetail(incomeId: string): Promise<{
  success: boolean
  data?: any
  error?: string
}> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "未登录" }
    }

    // 检查管理员权限
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
      return { success: false, error: "权限不足" }
    }

    // 使用管理员客户端
    const { createAdminClient } = await import("@/lib/supabase/server")
    const adminClient = createAdminClient()

    const { data, error } = await adminClient
      .from("platform_income")
      .select(
        `
        *,
        merchants(id, name),
        partners(id, name)
      `
      )
      .eq("id", incomeId)
      .single()

    if (error) {
      console.error("Error fetching income detail:", error)
      return { success: false, error: "获取收入详情失败" }
    }

    return {
      success: true,
      data,
    }
  } catch (error) {
    console.error("Error in getIncomeDetail:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取收入详情失败",
    }
  }
}

/**
 * 更新收入备注
 */
export async function updateIncomeNote(incomeId: string, adminNote: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "未登录" }
    }

    // 检查管理员权限
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
      return { success: false, error: "权限不足" }
    }

    // 使用管理员客户端
    const { createAdminClient } = await import("@/lib/supabase/server")
    const adminClient = createAdminClient()

    const { error } = await adminClient
      .from("platform_income")
      .update({ admin_note: adminNote })
      .eq("id", incomeId)

    if (error) {
      console.error("Error updating income note:", error)
      return { success: false, error: "更新备注失败" }
    }

    return {
      success: true,
    }
  } catch (error) {
    console.error("Error in updateIncomeNote:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "更新备注失败",
    }
  }
}

/**
 * 获取收入趋势数据（最近12个月）
 */
export async function getIncomeTrend(): Promise<{
  success: boolean
  data?: Array<{
    month: string
    depositFee: number
    partnerSubscription: number
    total: number
  }>
  error?: string
}> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "未登录" }
    }

    // 检查管理员权限
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
      return { success: false, error: "权限不足" }
    }

    // 使用管理员客户端
    const { createAdminClient } = await import("@/lib/supabase/server")
    const adminClient = createAdminClient()

    // 获取最近12个月的数据 - 使用北京时间
    const now = new Date()
    const bjNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Shanghai" }))
    const twelveMonthsAgo = new Date(bjNow.getFullYear(), bjNow.getMonth() - 11, 1)
    const startDate = `${twelveMonthsAgo.getFullYear()}-${String(twelveMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`

    const { data, error } = await adminClient
      .from("platform_income")
      .select("income_type, amount, income_date")
      .gte("income_date", startDate)
      .order("income_date", { ascending: true })

    if (error) {
      console.error("Error fetching income trend:", error)
      return { success: false, error: "获取趋势数据失败" }
    }

    // 按月份分组统计
    const monthlyData: Record<
      string,
      {
        depositFee: number
        partnerSubscription: number
        total: number
      }
    > = {}

    data?.forEach((item) => {
      const month = item.income_date.substring(0, 7) // YYYY-MM
      if (!monthlyData[month]) {
        monthlyData[month] = { depositFee: 0, partnerSubscription: 0, total: 0 }
      }

      const amount = Number(item.amount)
      monthlyData[month].total += amount

      if (item.income_type === "deposit_fee") {
        monthlyData[month].depositFee += amount
      } else if (item.income_type === "partner_subscription") {
        monthlyData[month].partnerSubscription += amount
      }
    })

    // 转换为数组格式
    const trendData = Object.entries(monthlyData).map(([month, values]) => ({
      month,
      ...values,
    }))

    return {
      success: true,
      data: trendData,
    }
  } catch (error) {
    console.error("Error in getIncomeTrend:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取趋势数据失败",
    }
  }
}

/**
 * 创建手动支出记录
 */
export async function createManualExpense(data: {
  amount: number
  expenseType: ExpenseType
  description: string
  transactionHash?: string
}): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "未登录" }
    }

    // 检查管理员权限
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
      return { success: false, error: "权限不足" }
    }

    // 验证数据
    if (!data.amount || data.amount <= 0) {
      return { success: false, error: "请输入有效的支出金额" }
    }

    if (!data.description || !data.description.trim()) {
      return { success: false, error: "请填写支出描述" }
    }

    // 使用管理员客户端
    const { createAdminClient } = await import("@/lib/supabase/server")
    const adminClient = createAdminClient()

    const today = new Date().toISOString().split("T")[0]

    // 创建支出记录
    const { error: insertError } = await adminClient.from("platform_income").insert({
      transaction_type: "expense",
      income_type: data.expenseType,
      amount: data.amount,
      description: data.description,
      income_date: today,
      created_by: user.id,
      details: {
        transaction_hash: data.transactionHash || null,
        created_by_username: profile.role,
      },
    })

    if (insertError) {
      console.error("Error creating expense:", insertError)
      return { success: false, error: "创建支出记录失败" }
    }

    return {
      success: true,
    }
  } catch (error) {
    console.error("Error in createManualExpense:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建支出记录失败",
    }
  }
}
