import { supabase } from '../lib/supabaseClient'

export async function getLandingStats() {
  const { data } = await supabase.rpc('get_landing_stats')
  const row = Array.isArray(data) ? data[0] : data
  return {
    totalAnalyses: Number(row?.total_analyses ?? 0),
    totalSources:  Number(row?.total_sources  ?? 0),
    totalAssets:   Number(row?.total_assets   ?? 0),
    verifiedCount: Number(row?.verified_count ?? 0),
  }
}
