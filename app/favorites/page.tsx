"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { ArrowLeft, Star, Trash2, Eye } from "lucide-react"
import Link from "next/link"

export default function FavoritesPage() {
  const router = useRouter()
  const [favorites, setFavorites] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    async function loadFavorites() {
      const supabase = createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        toast.error("请先登录")
        router.push("/auth/login")
        return
      }

      setCurrentUserId(user.id)

      // 获取收藏列表
      const { data: favoritesData, error } = await supabase
        .from("favorites")
        .select(
          `
          *,
          merchants:merchant_id (*)
        `,
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error loading favorites:", error)
        toast.error("加载收藏失败")
      } else {
        setFavorites(favoritesData || [])
      }

      setLoading(false)
    }

    loadFavorites()
  }, [router])

  const handleRemoveFavorite = async (favoriteId: string, merchantId: string) => {
    const supabase = createClient()

    const { error } = await supabase.from("favorites").delete().eq("id", favoriteId)

    if (error) {
      toast.error("取消收藏失败")
    } else {
      toast.success("已取消收藏")
      setFavorites(favorites.filter((f) => f.id !== favoriteId))
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 max-w-5xl">
        <Link href="/">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回首页
          </Button>
        </Link>

        <div className="mb-6">
          <h1 className="text-3xl font-bold">我的收藏</h1>
          <p className="text-muted-foreground mt-2">共收藏 {favorites.length} 个商家</p>
        </div>

        {favorites.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Star className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">暂无收藏的商家</p>
              <Link href="/">
                <Button className="mt-4">去浏览商家</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {favorites.map((favorite) => {
              const merchant = favorite.merchants
              if (!merchant) return null

              return (
                <Card key={favorite.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-4 md:p-6">
                    <div className="flex flex-col gap-4">
                      <div className="flex gap-4">
                        <Avatar className="h-12 w-12 md:h-16 md:w-16 flex-shrink-0">
                          <AvatarImage src={merchant.logo || "/placeholder.svg"} />
                          <AvatarFallback className="text-lg">{merchant.name[0]}</AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-base md:text-lg truncate">{merchant.name}</h3>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{merchant.description}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {merchant.service_types?.slice(0, 3).map((type: string) => (
                          <Badge key={type} variant="secondary" className="text-xs">
                            {type}
                          </Badge>
                        ))}
                        {merchant.service_types?.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{merchant.service_types.length - 3}
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                        <span className="text-xs text-muted-foreground">收藏于 {formatDate(favorite.created_at)}</span>

                        <div className="flex gap-2 w-full sm:w-auto">
                          <Link href={`/merchant/${merchant.id}`} className="flex-1 sm:flex-initial">
                            <Button variant="outline" size="sm" className="w-full">
                              <Eye className="h-4 w-4 mr-1" />
                              查看
                            </Button>
                          </Link>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveFavorite(favorite.id, merchant.id)}
                            className="flex-1 sm:flex-initial"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            取消
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
