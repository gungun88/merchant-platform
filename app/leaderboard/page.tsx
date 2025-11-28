"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Crown, ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface LeaderboardUser {
  id: string
  username: string
  avatar_url: string | null
  points: number
  rank?: number
}

export default function LeaderboardPage() {
  const [rankings, setRankings] = useState<LeaderboardUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRankings()
  }, [])

  async function loadRankings() {
    try {
      setLoading(true)
      const supabase = createClient()

      // 获取积分排行榜 TOP 50
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, avatar, points")
        .order("points", { ascending: false })
        .limit(50)

      if (error) {
        console.error("查询错误:", error)
      }

      if (data) {
        // 添加排名
        const rankedData = data.map((user, index) => ({
          ...user,
          avatar_url: user.avatar, // 兼容处理
          rank: index + 1,
        }))
        setRankings(rankedData)
      }
    } catch (error) {
      console.error("加载排行榜失败:", error)
    } finally {
      setLoading(false)
    }
  }

  // 获取前三名
  const topThree = rankings.slice(0, 3)
  const restRankings = rankings.slice(3)

  // 冠军台顺序: 第2名、第1名、第3名
  const podiumOrder = topThree.length >= 3 ? [topThree[1], topThree[0], topThree[2]] : topThree

  return (
    <div className="min-h-screen bg-gray-50">
      

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 返回按钮和页面标题 */}
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回首页
            </Button>
          </Link>
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">积分排行榜</h1>
            <p className="text-muted-foreground">用户积分排名</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">加载中...</div>
        ) : rankings.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">暂无数据</div>
        ) : (
          <>
            {/* 冠军台 */}
            {topThree.length > 0 && (
              <div className="mb-8 bg-gradient-to-b from-cyan-50 to-white rounded-2xl p-6 pb-8">
                <div className="flex items-end justify-center gap-4 mb-6">
                  {podiumOrder.map((user, podiumIndex) => {
                    if (!user) return null
                    const actualRank = user.rank || 0
                    const isFirst = actualRank === 1
                    const isSecond = actualRank === 2
                    const isThird = actualRank === 3

                    // 高度和样式
                    const height = isFirst ? "h-40" : isSecond ? "h-32" : "h-24"
                    const bgColor = isFirst
                      ? "bg-gradient-to-b from-yellow-400 to-yellow-600"
                      : isSecond
                        ? "bg-gradient-to-b from-gray-300 to-gray-500"
                        : "bg-gradient-to-b from-amber-600 to-amber-800"
                    const ringColor = isFirst
                      ? "ring-yellow-500"
                      : isSecond
                        ? "ring-gray-400"
                        : "ring-amber-700"
                    const avatarSize = isFirst ? "h-24 w-24" : isSecond ? "h-20 w-20" : "h-16 w-16"

                    return (
                      <div key={user.id} className="flex flex-col items-center" style={{ order: podiumIndex }}>
                        {/* 头像 */}
                        <div className="relative mb-3">
                          {isFirst && <Crown className="absolute -top-8 left-1/2 -translate-x-1/2 h-8 w-8 text-yellow-500" />}
                          <Avatar className={`${avatarSize} ring-4 ${ringColor}`}>
                            <AvatarImage
                              src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || "User")}&background=random&color=fff&size=128&bold=true`}
                            />
                            <AvatarFallback className="text-lg font-bold bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                              {user.username?.substring(0, 2) || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div
                            className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full ${bgColor} flex items-center justify-center text-white font-bold text-sm ring-2 ring-white`}
                          >
                            {actualRank}
                          </div>
                        </div>

                        {/* 用户名 */}
                        <div className="text-center mb-2 px-2">
                          <p className={`font-bold truncate max-w-[120px] ${isFirst ? "text-base" : "text-sm"}`}>
                            {user.username || "用户"}
                          </p>
                        </div>

                        {/* 积分 */}
                        <div className="text-center mb-3">
                          <p className={`font-bold ${isFirst ? "text-2xl" : "text-xl"}`}>
                            {user.points.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">积分</p>
                        </div>

                        {/* 台阶 */}
                        <div className={`w-24 ${height} ${bgColor} rounded-t-lg flex items-center justify-center text-white font-bold text-lg`}>
                          {actualRank}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 其余排名 */}
            {restRankings.length > 0 && (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {restRankings.map((user) => (
                      <div key={user.id} className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors">
                        {/* 排名 */}
                        <div className="w-12 text-center">
                          <span className="text-lg font-bold text-muted-foreground">{user.rank}</span>
                        </div>

                        {/* 用户信息 */}
                        <Avatar className="h-12 w-12">
                          <AvatarImage
                            src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || "User")}&background=random&color=fff&size=128&bold=true`}
                          />
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                            {user.username?.substring(0, 2) || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{user.username || "用户"}</p>
                        </div>

                        {/* 积分 */}
                        <div className="text-right">
                          <p className="text-xl font-bold">{user.points.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">积分</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}
