// 数据库类型定义
export interface Profile {
  id: string
  username: string | null
  avatar: string | null
  points: number
  is_merchant: boolean
  created_at: string
  updated_at: string
}

export interface PointsLog {
  id: string
  user_id: string
  points_change: number
  action_type: string
  description: string | null
  related_user_id: string | null
  created_at: string
}

export interface Merchant {
  id: string
  user_id: string
  name: string
  logo: string | null
  description: string | null
  short_desc: string | null
  contact_wechat: string | null
  contact_telegram: string | null
  contact_whatsapp: string | null
  contact_email: string | null
  service_types: string[]
  certifications: string[]
  warranties: string[]
  payment_methods: string[]
  location: string | null
  price_range: string | null
  response_time: number
  is_online: boolean
  stock_status: string
  is_active: boolean
  is_topped: boolean
  topped_until: string | null
  view_count: number
  favorite_count: number
  created_at: string
  updated_at: string
}
