// 修改 navigation.tsx 中的 useEffect

useEffect(() => {
  const supabase = createClient()
  let realtimeChannel: ReturnType<typeof supabase.channel> | null = null
  let notificationsChannel: ReturnType<typeof supabase.channel> | null = null

  async function loadUser() {
    // 1️⃣ 先从 localStorage 读取缓存数据
    try {
      const cachedSettings = localStorage.getItem('systemSettings')
      const cachedProfile = localStorage.getItem('userProfile')

      if (cachedSettings) {
        setSystemSettings(JSON.parse(cachedSettings))
      }

      if (cachedProfile) {
        const profileData = JSON.parse(cachedProfile)
        setProfile(profileData)
        setIsLoggedIn(true)
        setIsAdmin(profileData.role === "admin" || profileData.role === "super_admin")
        // 立即标记加载完成,显示缓存的数据
        setInitialLoading(false)
      }
    } catch (e) {
      console.error('Failed to load cache:', e)
    }

    // 2️⃣ 然后再获取最新数据
    const { data: { user } } = await supabase.auth.getUser()

    const settingsResult = await getSystemSettings()
    if (settingsResult.success && settingsResult.data) {
      setSystemSettings(settingsResult.data)
      // 更新缓存
      localStorage.setItem('systemSettings', JSON.stringify(settingsResult.data))
    }

    if (user) {
      setIsLoggedIn(true)
      setUser(user)

      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()

      if (profileData) {
        setProfile(profileData)
        setIsAdmin(profileData.role === "admin" || profileData.role === "super_admin")
        // 更新缓存
        localStorage.setItem('userProfile', JSON.stringify(profileData))
      }

      // ... 其他代码保持不变
    } else {
      // 如果未登录,清除缓存
      localStorage.removeItem('userProfile')
    }

    setInitialLoading(false)
  }

  loadUser()

  // ... 其他代码
}, [])

// 在退出登录时清除缓存
const handleLogout = async () => {
  const supabase = createClient()
  await supabase.auth.signOut()
  localStorage.removeItem('userProfile')
  localStorage.removeItem('systemSettings')
  window.location.href = "/"
}
