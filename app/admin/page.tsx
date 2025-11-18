import { redirect } from "next/navigation"

export default function AdminPage() {
  // 直接重定向到 dashboard
  redirect("/admin/dashboard")
}
