"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Coins } from "lucide-react"

export function PointsDisplay() {
  const [points, setPoints] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchPoints() {
      const supabase = createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      const { data } = await supabase.from("profiles").select("points").eq("id", user.id).single()

      if (data) {
        setPoints(data.points)
      }

      setLoading(false)
    }

    fetchPoints()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Coins className="h-4 w-4" />
        <span>加载中...</span>
      </div>
    )
  }

  if (points === null) {
    return null
  }

  return (
    <div className="flex items-center gap-2 text-sm font-medium">
      <Coins className="h-4 w-4 text-yellow-500" />
      <span>{points} 积分</span>
    </div>
  )
}
