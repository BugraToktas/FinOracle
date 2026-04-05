import { supabase } from '../lib/supabaseClient'

/**
 * Returns the current user's ID (or null if not logged in).
 */
async function getUid() {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

/**
 * Returns IDs of market events that the current user has at least one analysis for.
 * Since market_events are shared across users (same asset/date/direction → same row),
 * we scope "my events" via analysis_results.user_id.
 */
async function getMyEventIds(uid) {
  if (!uid) return []
  const { data } = await supabase
    .from('analysis_results')
    .select('event_id')
    .eq('user_id', uid)
  return [...new Set((data ?? []).map((r) => r.event_id).filter(Boolean))]
}

/**
 * Aggregate stats for the Dashboard header cards — scoped to the current user.
 */
export async function getEventStats() {
  const uid = await getUid()
  if (!uid) return { totalEvents: 0, pendingVerification: 0, avgConfidence: 0 }

  const [pendingRes, allAnalysisRes, eventIdsRes] = await Promise.all([
    supabase
      .from('analysis_results')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid)
      .eq('status', 'pending'),
    supabase
      .from('analysis_results')
      .select('confidence')
      .eq('user_id', uid),
    supabase
      .from('analysis_results')
      .select('event_id')
      .eq('user_id', uid),
  ])

  const pendingVerification = pendingRes.count ?? 0

  const confidenceRows = allAnalysisRes.data ?? []
  const avgConfidence =
    confidenceRows.length > 0
      ? confidenceRows.reduce((sum, r) => sum + (r.confidence ?? 0), 0) / confidenceRows.length
      : 0

  const totalEvents = new Set(
    (eventIdsRes.data ?? []).map((r) => r.event_id).filter(Boolean)
  ).size

  return { totalEvents, pendingVerification, avgConfidence }
}

/**
 * Recent events for Dashboard table — last N events the current user has analyzed.
 */
export async function getRecentEvents(limit = 10) {
  const uid = await getUid()
  const eventIds = await getMyEventIds(uid)
  if (eventIds.length === 0) return []

  const { data, error } = await supabase
    .from('market_events')
    .select(`
      id, asset_code, event_date, direction, magnitude, created_at,
      analysis_results(id, status, confidence, created_at)
    `)
    .in('id', eventIds)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

/**
 * Filtered event list for the Events page — only current user's events.
 */
export async function getAllEvents({ assetCode, direction, status, from, to } = {}) {
  const uid = await getUid()
  const eventIds = await getMyEventIds(uid)
  if (eventIds.length === 0) return []

  let query = supabase
    .from('market_events')
    .select(`
      id, asset_code, event_date, direction, magnitude, created_at,
      analysis_results(id, status, confidence, question)
    `)
    .in('id', eventIds)
    .order('event_date', { ascending: false })

  if (assetCode) query = query.ilike('asset_code', `%${assetCode}%`)
  if (direction) query = query.eq('direction', direction)
  if (from) query = query.gte('event_date', from)
  if (to)   query = query.lte('event_date', to)

  const { data, error } = await query.limit(200)
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
 * Delete a market event (RLS: only users who have analyzed it can delete).
 * Cascades to analysis_results, analysis_document_links, revalidations.
 */
export async function deleteEvent(id) {
  const { error } = await supabase
    .from('market_events')
    .delete()
    .eq('id', id)
  if (error) throw error
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
