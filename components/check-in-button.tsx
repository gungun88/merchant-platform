"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { checkIn, getCheckInStatus } from "@/lib/actions/points"
import { createClient } from "@/lib/supabase/client"
import { Calendar } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export function CheckInButton() {
  const [loading, setLoading] = useState(false)
  const [hasCheckedIn, setHasCheckedIn] = useState(false)
  const [consecutiveDays, setConsecutiveDays] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function fetchStatus() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      setUserId(user.id)

      const status = await getCheckInStatus(user.id)
      setHasCheckedIn(status.hasCheckedInToday)
      setConsecutiveDays(status.consecutiveDays)
    }

    fetchStatus()
  }, [])

  const handleCheckIn = async () => {
    if (!userId) {
      toast.error("请先登录")
      return
    }

    setLoading(true)

    try {
      const result = await checkIn(userId)
      setHasCheckedIn(true)
      setConsecutiveDays(result.consecutiveDays)
      toast.success(`签到成功！获得 ${result.points} 积分`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "签到失败")
    } finally {
      setLoading(false)
    }
  }

  if (!userId) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      <Button onClick={handleCheckIn} disabled={loading || hasCheckedIn} size="sm" variant="outline">
        <Calendar className="h-4 w-4 mr-2" />
        {hasCheckedIn ? "已签到" : "每日签到"}
      </Button>
      {consecutiveDays > 0 && <span className="text-sm text-muted-foreground">连续 {consecutiveDays} 天</span>}
    </div>
  )
}
