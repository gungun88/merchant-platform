"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { DollarSign, TrendingUp, TrendingDown, Calendar, Search, Eye, Loader2, FileText, MessageSquare, Plus, MinusCircle } from "lucide-react"
import {
  getFinanceStats,
  getIncomeList,
  getIncomeDetail,
  updateIncomeNote,
  createManualExpense,
  type IncomeType,
  type ExpenseType,
  type TransactionType
} from "@/lib/actions/income"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"

export default function IncomePage() {
  // 统计数据
  const [stats, setStats] = useState({
    todayIncome: 0,
    todayExpense: 0,
    todayProfit: 0,
    totalProfit: 0,
  })

  // 列表数据
  const [incomes, setIncomes] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 20

  // 筛选条件
  const [transactionType, setTransactionType] = useState<TransactionType>("all")
  const [incomeType, setIncomeType] = useState<IncomeType | ExpenseType | "all">("all")
  const [searchKeyword, setSearchKeyword] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  // 详情弹窗
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [detailIncome, setDetailIncome] = useState<any>(null)

  // 备注弹窗
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)
  const [noteIncome, setNoteIncome] = useState<any>(null)
  const [editingNote, setEditingNote] = useState(false)
  const [noteText, setNoteText] = useState("")

  // 添加支出弹窗
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false)
  const [expenseAmount, setExpenseAmount] = useState("")
  const [expenseType, setExpenseType] = useState<ExpenseType>("manual_expense")
  const [expenseDescription, setExpenseDescription] = useState("")
  const [expenseHash, setExpenseHash] = useState("")
  const [submittingExpense, setSubmittingExpense] = useState(false)

  // 加载统计数据
  useEffect(() => {
    loadStats()
  }, [])

  // 加载列表数据
  useEffect(() => {
    loadIncomes()
  }, [page, transactionType, incomeType, startDate, endDate])

  const loadStats = async () => {
    const result = await getFinanceStats()
    if (result.success && result.data) {
      setStats(result.data)
    }
  }

  const loadIncomes = async () => {
    setLoading(true)
    const result = await getIncomeList({
      page,
      pageSize,
      transactionType,
      incomeType,
      startDate,
      endDate,
      searchKeyword,
    })

    if (result.success && result.data) {
      setIncomes(result.data.incomes)
      setTotal(result.data.total)
    }
    setLoading(false)
  }

  const handleSearch = () => {
    setPage(1)
    loadIncomes()
  }

  const handleViewDetail = async (incomeId: string) => {
    const result = await getIncomeDetail(incomeId)
    if (result.success && result.data) {
      setDetailIncome(result.data)
      setDetailDialogOpen(true)
    }
  }

  const handleEditNote = async (incomeId: string) => {
    const result = await getIncomeDetail(incomeId)
    if (result.success && result.data) {
      setNoteIncome(result.data)
      setNoteText(result.data.admin_note || "")
      setNoteDialogOpen(true)
    }
  }

  const handleSaveNote = async () => {
    if (!noteIncome) return

    setEditingNote(true)
    const result = await updateIncomeNote(noteIncome.id, noteText)

    if (result.success) {
      setNoteIncome({ ...noteIncome, admin_note: noteText })
      // 重新加载列表
      loadIncomes()
    }
    setEditingNote(false)
  }

  const handleSubmitExpense = async () => {
    const amount = parseFloat(expenseAmount)
    if (!amount || amount <= 0) {
      alert("请输入有效的支出金额")
      return
    }
    if (!expenseDescription.trim()) {
      alert("请填写支出描述")
      return
    }

    setSubmittingExpense(true)
    const result = await createManualExpense({
      amount,
      expenseType,
      description: expenseDescription,
      transactionHash: expenseHash || undefined,
    })

    if (result.success) {
      // 关闭弹窗并重置表单
      setExpenseDialogOpen(false)
      setExpenseAmount("")
      setExpenseDescription("")
      setExpenseHash("")
      setExpenseType("manual_expense")
      // 重新加载数据
      loadStats()
      loadIncomes()
      alert("支出记录已添加")
    } else {
      alert(result.error || "添加支出失败")
    }
    setSubmittingExpense(false)
  }

  const getIncomeTypeLabel = (type: IncomeType | ExpenseType) => {
    switch (type) {
      case "deposit_fee":
        return "押金手续费"
      case "partner_subscription":
        return "合作伙伴订阅"
      case "manual_expense":
        return "手动支出"
      case "operational_cost":
        return "运营成本"
      case "marketing_cost":
        return "推广费用"
      default:
        return type
    }
  }

  const getIncomeTypeColor = (type: IncomeType | ExpenseType) => {
    switch (type) {
      case "deposit_fee":
        return "bg-blue-100 text-blue-800"
      case "partner_subscription":
        return "bg-green-100 text-green-800"
      case "manual_expense":
        return "bg-red-100 text-red-800"
      case "operational_cost":
        return "bg-orange-100 text-orange-800"
      case "marketing_cost":
        return "bg-purple-100 text-purple-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* 页面标题和添加支出按钮 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">财务管理</h1>
            <p className="text-muted-foreground mt-2">查看和管理平台收支情况（收入与支出）</p>
          </div>
          <Button onClick={() => setExpenseDialogOpen(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            添加支出
          </Button>
        </div>

        {/* 统计卡片 */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">今日收入</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">+{stats.todayIncome.toFixed(2)} USDT</div>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date().toLocaleDateString("zh-CN")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">今日支出</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">-{stats.todayExpense.toFixed(2)} USDT</div>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date().toLocaleDateString("zh-CN")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">今日净利润</CardTitle>
              <TrendingUp className={`h-4 w-4 ${stats.todayProfit >= 0 ? "text-blue-600" : "text-orange-600"}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.todayProfit >= 0 ? "text-blue-600" : "text-orange-600"}`}>
                {stats.todayProfit >= 0 ? "+" : ""}{stats.todayProfit.toFixed(2)} USDT
              </div>
              <p className="text-xs text-muted-foreground mt-1">收入 - 支出</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">累计净利润</CardTitle>
              <TrendingUp className={`h-4 w-4 ${stats.totalProfit >= 0 ? "text-purple-600" : "text-red-600"}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.totalProfit >= 0 ? "text-purple-600" : "text-red-600"}`}>
                {stats.totalProfit >= 0 ? "+" : ""}{stats.totalProfit.toFixed(2)} USDT
              </div>
              <p className="text-xs text-muted-foreground mt-1">平台总利润</p>
            </CardContent>
          </Card>
        </div>

        {/* 筛选和搜索 */}
        <Card>
          <CardHeader>
            <CardTitle>财务明细</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* 筛选器 */}
              <div className="flex flex-wrap items-end gap-2">
                <div className="w-auto flex-shrink-0">
                  <Label className="text-xs mb-1 block">交易类型</Label>
                  <Select value={transactionType} onValueChange={(value: any) => { setTransactionType(value); setPage(1) }}>
                    <SelectTrigger className="h-9 w-auto min-w-[80px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部</SelectItem>
                      <SelectItem value="income">收入</SelectItem>
                      <SelectItem value="expense">支出</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-auto flex-shrink-0">
                  <Label className="text-xs mb-1 block">
                    {transactionType === "expense" ? "支出类型" : transactionType === "income" ? "收入类型" : "收支类型"}
                  </Label>
                  <Select value={incomeType} onValueChange={(value: any) => { setIncomeType(value); setPage(1) }}>
                    <SelectTrigger className="h-9 w-auto min-w-[80px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部</SelectItem>
                      {transactionType === "all" || transactionType === "income" ? (
                        <>
                          <SelectItem value="deposit_fee">押金手续费</SelectItem>
                          <SelectItem value="partner_subscription">合作伙伴订阅</SelectItem>
                        </>
                      ) : null}
                      {transactionType === "all" || transactionType === "expense" ? (
                        <>
                          <SelectItem value="manual_expense">手动支出</SelectItem>
                          <SelectItem value="operational_cost">运营成本</SelectItem>
                          <SelectItem value="marketing_cost">推广费用</SelectItem>
                        </>
                      ) : null}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-auto min-w-[140px] flex-shrink-0">
                  <Label className="text-xs mb-1 block">开始日期</Label>
                  <Input
                    type="date"
                    className="h-9"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                <div className="w-auto min-w-[140px] flex-shrink-0">
                  <Label className="text-xs mb-1 block">结束日期</Label>
                  <Input
                    type="date"
                    className="h-9"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>

                <div className="flex-1 min-w-[200px]">
                  <Label className="text-xs mb-1 block">搜索</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="搜索商家名、合作伙伴名..."
                      className="h-9 flex-1"
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    />
                    <Button onClick={handleSearch} size="sm" className="h-9 w-9 p-0 flex-shrink-0">
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* 列表 */}
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : incomes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  暂无财务记录
                </div>
              ) : (
                <>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium">日期</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">交易类型</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">类型</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">来源/说明</th>
                          <th className="px-4 py-3 text-right text-sm font-medium">金额</th>
                          <th className="px-4 py-3 text-center text-sm font-medium">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {incomes.map((income) => {
                          const isIncome = income.transaction_type === "income"
                          return (
                            <tr key={income.id} className="hover:bg-muted/30">
                              <td className="px-4 py-3 text-sm">
                                <div>{new Date(income.created_at).toLocaleDateString("zh-CN")}</div>
                                <div className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(income.created_at), {
                                    addSuffix: true,
                                    locale: zhCN,
                                  })}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    isIncome ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                                  }`}
                                >
                                  {isIncome ? "收入" : "支出"}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getIncomeTypeColor(
                                    income.income_type
                                  )}`}
                                >
                                  {getIncomeTypeLabel(income.income_type)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <div className="font-medium">
                                  {income.merchants?.name || income.partners?.name || "系统"}
                                </div>
                                <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {income.description}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div
                                  className={`text-sm font-semibold ${
                                    isIncome ? "text-green-600" : "text-red-600"
                                  }`}
                                >
                                  {isIncome ? "+" : "-"}
                                  {Number(income.amount).toFixed(2)} USDT
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleViewDetail(income.id)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Eye className="h-4 w-4 text-gray-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditNote(income.id)}
                                    className="h-8 w-8 p-0"
                                  >
                                    {income.admin_note ? (
                                      <MessageSquare className="h-4 w-4 text-blue-600 fill-blue-100" />
                                    ) : (
                                      <MessageSquare className="h-4 w-4 text-gray-400" />
                                    )}
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* 分页 */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        共 {total} 条记录，第 {page} / {totalPages} 页
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(page - 1)}
                          disabled={page === 1}
                        >
                          上一页
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(page + 1)}
                          disabled={page === totalPages}
                        >
                          下一页
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* 当前页合计 */}
                  <div className="text-right font-medium">
                    当前页合计:{" "}
                    <span className="text-green-600">
                      {incomes.reduce((sum, item) => sum + Number(item.amount), 0).toFixed(2)} USDT
                    </span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 详情弹窗 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>收入详情</DialogTitle>
            <DialogDescription>查看收入的详细信息</DialogDescription>
          </DialogHeader>

          {detailIncome && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">收入类型</Label>
                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getIncomeTypeColor(
                        detailIncome.income_type
                      )}`}
                    >
                      {getIncomeTypeLabel(detailIncome.income_type)}
                    </span>
                  </div>
                </div>

                <div>
                  <Label className="text-muted-foreground">金额</Label>
                  <div className="mt-1 text-lg font-bold text-green-600">
                    {Number(detailIncome.amount).toFixed(2)} USDT
                  </div>
                </div>

                <div>
                  <Label className="text-muted-foreground">日期</Label>
                  <div className="mt-1 text-sm">
                    {new Date(detailIncome.created_at).toLocaleString("zh-CN")}
                  </div>
                </div>

                <div>
                  <Label className="text-muted-foreground">来源</Label>
                  <div className="mt-1 text-sm font-medium">
                    {detailIncome.merchants?.name || detailIncome.partners?.name || "未知"}
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">描述</Label>
                <div className="mt-1 text-sm">{detailIncome.description}</div>
              </div>

              {/* 详细信息 */}
              {detailIncome.details && (
                <div>
                  <Label className="text-muted-foreground">详细信息</Label>
                  <div className="mt-1 bg-muted/30 rounded-lg p-4">
                    {detailIncome.income_type === "deposit_fee" && (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">商家名称:</span>
                          <span className="font-medium">{detailIncome.details.merchant_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">原始押金:</span>
                          <span>{detailIncome.details.original_deposit} USDT</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">退还金额:</span>
                          <span>{detailIncome.details.refund_amount} USDT</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">手续费率:</span>
                          <span>{detailIncome.details.fee_rate}%</span>
                        </div>
                        {detailIncome.details.transaction_hash && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">交易哈希:</span>
                            <span className="font-mono text-xs truncate max-w-[200px]">
                              {detailIncome.details.transaction_hash}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {detailIncome.income_type === "partner_subscription" && (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">合作伙伴:</span>
                          <span className="font-medium">{detailIncome.details.partner_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">订阅时长:</span>
                          <span>
                            {detailIncome.details.duration_value}{" "}
                            {detailIncome.details.subscription_unit === "month" ? "个月" : "年"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">单价:</span>
                          <span>{detailIncome.details.unit_fee} USDT</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">到期时间:</span>
                          <span>
                            {new Date(detailIncome.details.expires_at).toLocaleDateString("zh-CN")}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 备注弹窗 */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>管理员备注</DialogTitle>
            <DialogDescription>
              {noteIncome && (
                <span className="text-sm">
                  {getIncomeTypeLabel(noteIncome.income_type)} -{" "}
                  {noteIncome.merchants?.name || noteIncome.partners?.name || "未知"} -{" "}
                  {Number(noteIncome.amount).toFixed(2)} USDT
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {noteIncome && (
            <div className="space-y-4">
              <div>
                <Textarea
                  placeholder="添加备注..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={5}
                  className="resize-none"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveNote} disabled={editingNote}>
              {editingNote && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 添加支出弹窗 */}
      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>添加支出记录</DialogTitle>
            <DialogDescription>手动添加平台支出记录（如运营成本、推广费用等）</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>支出类型 *</Label>
              <Select value={expenseType} onValueChange={(value: ExpenseType) => setExpenseType(value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual_expense">手动支出</SelectItem>
                  <SelectItem value="operational_cost">运营成本</SelectItem>
                  <SelectItem value="marketing_cost">推广费用</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>支出金额 (USDT) *</Label>
              <Input
                type="number"
                placeholder="请输入支出金额"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                className="mt-1"
                step="0.01"
                min="0"
              />
            </div>

            <div>
              <Label>支出描述 *</Label>
              <Textarea
                placeholder="请详细描述支出用途..."
                value={expenseDescription}
                onChange={(e) => setExpenseDescription(e.target.value)}
                rows={4}
                className="mt-1 resize-none"
              />
            </div>

            <div>
              <Label>交易哈希（可选）</Label>
              <Input
                placeholder="如有链上交易，请填写交易哈希"
                value={expenseHash}
                onChange={(e) => setExpenseHash(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">如果支出涉及链上转账，可填写交易哈希</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setExpenseDialogOpen(false)
                setExpenseAmount("")
                setExpenseDescription("")
                setExpenseHash("")
                setExpenseType("manual_expense")
              }}
            >
              取消
            </Button>
            <Button onClick={handleSubmitExpense} disabled={submittingExpense}>
              {submittingExpense && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              添加支出
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
