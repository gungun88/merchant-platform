"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Ban, LogOut } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export default function BannedPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const reason = searchParams.get("reason") || "您的账户已被封禁"
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <Ban className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-red-600">账户已被封禁</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-900 font-medium mb-2">封禁原因：</p>
            <p className="text-sm text-red-800 whitespace-pre-wrap">{reason}</p>
          </div>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>您的账户因违反平台规则已被封禁，无法继续使用平台功能。</p>
            <p>如有疑问，请联系平台客服。</p>
          </div>

          <Button onClick={handleLogout} disabled={loading} className="w-full" variant="destructive">
            <LogOut className="h-4 w-4 mr-2" />
            {loading ? "退出中..." : "退出登录"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
