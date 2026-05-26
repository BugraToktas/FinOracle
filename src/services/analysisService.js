import { supabase } from '../lib/supabaseClient'

/**
 * Call the ask_finoracle edge function.
 * Returns { analysis_id, event, answer: { summary, confidence, sources } }
 */
export async function callAskFinoracle({ asset_code, event_date, direction, question }) {
  const { data, error } = await supabase.functions.invoke('ask_finoracle', {
    body: { asset_code, event_date, direction, question },
  })

  if (error) {
    // FunctionsRelayError / FunctionsHttpError — extract as much detail as possible
    let detail = ''
    try {
      if (error.context && typeof error.context.text === 'function') {
        detail = await error.context.text()
      } else if (typeof error.context === 'string') {
        detail = error.context
      } else if (error.context) {
        detail = JSON.stringify(error.context)
      }
    } catch { /* ignore */ }
    throw new Error(`${error.message ?? 'ask_finoracle failed'}${detail ? ` — ${detail}` : ''}`)
  }
  if (!data?.ok) throw new Error(data?.message ?? data?.error ?? 'ask_finoracle returned not-ok')

  return data
}

/**
 * Get all analyses for an event, including linked source documents.
 */
const SOURCE_DOC_FIELDS = `
  id, url, domain, title, published_at, content_snippet, provider
`

export async function getAnalysesByEventId(eventId) {
  const { data: { user } } = await supabase.auth.getUser()
  const uid = user?.id

  let query = supabase
    .from('analysis_results')
    .select(`
      id, event_id, question, summary, confidence, status, created_at, verify_after,
      analysis_document_links(
        weight_used,
        source_documents(${SOURCE_DOC_FIELDS})
      ),
      revalidations(id, verdict, confidence, notes, created_at)
    `)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  // Filter to current user's analyses if logged in
  if (uid) query = query.eq('user_id', uid)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

/**
 * Get a single analysis with all related data — used in EventDetail.
 */
export async function getAnalysisById(analysisId) {
  const { data, error } = await supabase
    .from('analysis_results')
    .select(`
      id, event_id, summary, confidence, status, created_at, verify_after,
      analysis_document_links(
        weight_used,
        source_documents(${SOURCE_DOC_FIELDS})
      ),
      revalidations(id, verdict, confidence, notes, created_at)
    `)
    .eq('id', analysisId)
    .single()

  if (error) throw error
  return data
}

/**
 * Call verify_analysis edge function for a specific analysis.
 */
export async function callVerifyAnalysis(analysisId) {
  const { data, error } = await supabase.functions.invoke('verify_analysis', {
    body: { analysis_id: analysisId },
  })

  if (error) throw new Error(error.message ?? 'verify_analysis failed')
  if (!data?.ok) throw new Error(data?.error ?? 'verify_analysis returned not-ok')

  return data
}

/**
 * Trigger the verification queue (runs all pending due analyses).
 */
export async function callRunVerificationQueue() {
  const { data, error } = await supabase.functions.invoke('run_verification_queue', {
    body: {},
  })

  if (error) throw new Error(error.message ?? 'run_verification_queue failed')
  return data
}

/** Delete a single analysis result (only owner can delete via RLS). */
export async function deleteAnalysis(analysisId) {
  const { error } = await supabase
    .from('analysis_results')
    .delete()
    .eq('id', analysisId)
  if (error) throw error
}

/** How many analyses the current user has made today (UTC day). Per-user via RPC. */
export const DAILY_LIMIT = 10

export async function getTodayAnalysisCount() {
  // Try the per-user RPC first (requires migration 20260316_user_profiles.sql)
  const { data, error } = await supabase.rpc('get_today_analysis_count')
  if (!error && typeof data === 'number') return data

  // Fallback: global count (before migration is applied)
  const todayUtc = new Date().toISOString().split('T')[0]
  const { count } = await supabase
    .from('analysis_results')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', `${todayUtc}T00:00:00Z`)
    .lt('created_at',  `${todayUtc}T23:59:59Z`)
  return count ?? 0
}

/** Confidence trend for the last N days (for dashboard chart) — current user only. */
export async function getConfidenceTrend(days = 30) {
  const { data: { user } } = await supabase.auth.getUser()
  const uid = user?.id
  if (!uid) return []

  const since = new Date(Date.now() - days * 86400_000).toISOString()
  const { data, error } = await supabase
    .from('analysis_results')
    .select('confidence, created_at')
    .eq('user_id', uid)
    .gte('created_at', since)
    .order('created_at', { ascending: true })

  if (error) return []

  // Group by date, average confidence per day
  const byDay = {}
  for (const row of data ?? []) {
    const day = row.created_at.split('T')[0]
    if (!byDay[day]) byDay[day] = { sum: 0, count: 0 }
    byDay[day].sum   += row.confidence ?? 0
    byDay[day].count += 1
  }

  return Object.entries(byDay).map(([date, { sum, count }]) => ({
    date,
    confidence: Math.round((sum / count) * 100),
    analyses: count,
  }))
}

/** Asset distribution for bar chart — current user only (via their analysis_results). */
export async function getAssetDistribution() {
  const { data: { user } } = await supabase.auth.getUser()
  const uid = user?.id
  if (!uid) return []

  // Get event_ids from my analyses
  const { data: myAnalyses, error: aErr } = await supabase
    .from('analysis_results')
    .select('event_id')
    .eq('user_id', uid)
  if (aErr || !myAnalyses?.length) return []

  const eventIds = [...new Set(myAnalyses.map((r) => r.event_id).filter(Boolean))]

  const { data, error } = await supabase
    .from('market_events')
    .select('asset_code')
    .in('id', eventIds)

  if (error) return []

  const counts = {}
  for (const { asset_code } of data ?? []) {
    counts[asset_code] = (counts[asset_code] ?? 0) + 1
  }

  return Object.entries(counts)
    .map(([asset, count]) => ({ asset, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
}
