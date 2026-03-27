import { supabase } from '../lib/supabaseClient'

/**
 * Call the ask_finoracle edge function.
 * Returns { analysis_id, event, answer: { summary, confidence, sources } }
 */
export async function callAskFinoracle({ asset_code, event_date, direction, question }) {
  const { data, error } = await supabase.functions.invoke('ask_finoracle', {
    body: { asset_code, event_date, direction, question },
  })

  if (error) throw new Error(error.message ?? 'ask_finoracle failed')
  if (!data?.ok) throw new Error(data?.error ?? 'ask_finoracle returned not-ok')

  return data
}

/**
 * Get all analyses for an event, including linked source documents.
 */
export async function getAnalysesByEventId(eventId) {
  const { data, error } = await supabase
    .from('analysis_results')
    .select(`
      id, event_id, summary, confidence, status, created_at, verify_after,
      analysis_document_links(
        weight_used,
        source_documents(id, url, domain, title, published_at, content_snippet)
      ),
      revalidations(id, verdict, confidence, notes, created_at)
    `)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

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
        source_documents(id, url, domain, title, published_at, content_snippet)
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
