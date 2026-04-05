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
