import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

async function fetchProfileDetails(userId) {
  if (!userId) return { isAdmin: false, dailyLimit: 10 }
  const { data } = await supabase
    .from('profiles')
    .select('is_admin, daily_limit')
    .eq('id', userId)
    .single()
  return {
    isAdmin: data?.is_admin === true,
    dailyLimit: data?.daily_limit ?? 10
  }
}

export function AuthProvider({ children }) {
  const [user, setUser]             = useState(null)
  const [isAdmin, setIsAdmin]       = useState(false)
  const [dailyLimit, setDailyLimit] = useState(10)
  const [loading, setLoading]       = useState(true)

  async function handleSession(session) {
    const u = session?.user ?? null
    setUser(u)
    if (u) {
      const details = await fetchProfileDetails(u.id)
      setIsAdmin(details.isAdmin)
      setDailyLimit(details.dailyLimit)
    } else {
      setIsAdmin(false)
      setDailyLimit(10)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      await handleSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ user, isAdmin, dailyLimit, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
