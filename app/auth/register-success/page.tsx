import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Gift, AlertCircle } from "lucide-react"

export default function RegisterSuccessPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">注册成功！</CardTitle>
            <CardDescription>请查收邮件确认您的账号</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              我们已向您的邮箱发送了一封确认邮件，请点击邮件中的链接激活您的账号。
            </p>
            <p className="text-sm text-muted-foreground">激活后您将获得注册奖励积分！</p>

            <Alert className="bg-gray-50 border-gray-200">
              <AlertCircle className="h-4 w-4 text-gray-700" />
              <AlertDescription className="text-gray-700">
                登录后前往<strong>个人设置</strong>上传头像，可额外获得积分奖励！
              </AlertDescription>
            </Alert>

            <Button asChild className="w-full">
              <Link href="/auth/login">返回登录</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
