import { supabase } from '../lib/supabaseClient'

/** Get all users with analysis count (admin only — RPC checks permission). */
export async function adminGetUsers() {
  const { data, error } = await supabase.rpc('admin_get_users')
  if (error) throw error
  return data ?? []
}

/** Get queue stats: pending, verified today, failed total. */
export async function adminGetQueueStats() {
  const { data, error } = await supabase.rpc('admin_queue_stats')
  if (error) throw error
  return data?.[0] ?? { pending_count: 0, verified_today: 0, failed_total: 0 }
}

/** Manually trigger the verification queue. */
export async function adminRunQueue() {
  const { data, error } = await supabase.functions.invoke('run_verification_queue', {
    body: {},
  })
  if (error) throw new Error(error.message ?? 'run_verification_queue failed')
  return data
}

/** Update a user's admin role and daily limit (RPC checks admin permission). */
export async function adminUpdateUser(userId, isAdmin, dailyLimit) {
  const { data, error } = await supabase.rpc('admin_update_user', {
    p_user_id: userId,
    p_is_admin: isAdmin,
    p_daily_limit: dailyLimit,
  })
  if (error) throw error
  return data
}

/** Delete a user account completely (RPC checks admin permission). */
export async function adminDeleteUser(userId) {
  const { data, error } = await supabase.rpc('admin_delete_user', {
    p_user_id: userId,
  })
  if (error) throw error
  return data
}

/** Get a specific user's analysis history (read policy allows this). */
export async function adminGetUserAnalyses(userId) {
  const { data, error } = await supabase
    .from('analysis_results')
    .select('id, question, summary, confidence, status, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}
