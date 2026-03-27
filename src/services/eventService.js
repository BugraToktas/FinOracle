import { supabase } from '../lib/supabaseClient'

/**
 * Aggregate stats for the Dashboard header cards.
 * Returns counts from market_events and analysis_results.
 */
export async function getEventStats() {
  const [eventsRes, pendingRes, allAnalysisRes] = await Promise.all([
    supabase.from('market_events').select('id', { count: 'exact', head: true }),
    supabase
      .from('analysis_results')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase.from('analysis_results').select('confidence'),
  ])

  const totalEvents = eventsRes.count ?? 0
  const pendingVerification = pendingRes.count ?? 0

  const confidenceRows = allAnalysisRes.data ?? []
  const avgConfidence =
    confidenceRows.length > 0
      ? confidenceRows.reduce((sum, r) => sum + (r.confidence ?? 0), 0) / confidenceRows.length
      : 0

  return { totalEvents, pendingVerification, avgConfidence }
}

/**
 * Recent events for Dashboard table — last N events with their latest analysis status.
 */
export async function getRecentEvents(limit = 10) {
  const { data, error } = await supabase
    .from('market_events')
    .select(`
      id, asset_code, event_date, direction, magnitude, created_at,
      analysis_results(id, status, confidence, created_at)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

/**
 * Filtered event list for the Events page.
 */
export async function getAllEvents({ assetCode, direction, status, from, to } = {}) {
  let query = supabase
    .from('market_events')
    .select(`
      id, asset_code, event_date, direction, magnitude, created_at,
      analysis_results(id, status, confidence)
    `)
    .order('event_date', { ascending: false })

  if (assetCode) query = query.ilike('asset_code', `%${assetCode}%`)
  if (direction) query = query.eq('direction', direction)
  if (from) query = query.gte('event_date', from)
  if (to) query = query.lte('event_date', to)

  if (status) {
    // filter by latest analysis status via a sub-select isn't straightforward;
    // fetch all and filter client-side to keep the query simple
  }

  const { data, error } = await query.limit(100)
  if (error) throw error

  let rows = data ?? []

  if (status) {
    rows = rows.filter((ev) => {
      const analyses = ev.analysis_results ?? []
      if (!analyses.length) return status === 'no_analysis'
      const latest = analyses[analyses.length - 1]
      return latest.status === status
    })
  }

  return rows
}

/**
 * Single event by id — used in EventDetail.
 */
export async function getEventById(id) {
  const { data, error } = await supabase
    .from('market_events')
    .select('id, asset_code, event_date, direction, magnitude, created_at')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}
