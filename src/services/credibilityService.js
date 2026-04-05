import { supabase } from '../lib/supabaseClient'

/**
 * Top N sources by reputation_score — for the CredibilityBoard chart.
 * Returns [] gracefully if news_sources table is missing or empty.
 */
export async function getTopSources(limit = 10) {
  try {
    const { data, error } = await supabase
      .from('news_sources')
      .select('id, organization, author_name, reputation_score, total_predictions, correct_predictions, last_updated')
      .order('reputation_score', { ascending: false })
      .limit(limit)

    if (error) {
      console.warn('[credibilityService] getTopSources:', error.message)
      return []
    }
    return data ?? []
  } catch (err) {
    console.warn('[credibilityService] getTopSources:', err.message)
    return []
  }
}

/**
 * All sources — for the full CredibilityBoard table.
 * Returns [] gracefully if news_sources table is missing or empty.
 */
export async function getAllSources() {
  try {
    const { data, error } = await supabase
      .from('news_sources')
      .select('id, organization, author_name, reputation_score, total_predictions, correct_predictions, last_updated')
      .order('reputation_score', { ascending: false })

    if (error) {
      console.warn('[credibilityService] getAllSources:', error.message)
      return []
    }
    return data ?? []
  } catch (err) {
    console.warn('[credibilityService] getAllSources:', err.message)
    return []
  }
}

/**
 * Best single source label — used in Dashboard stat card.
 * Returns null gracefully if news_sources table is missing or empty.
 */
export async function getTopSourceLabel() {
  try {
    const { data, error } = await supabase
      .from('news_sources')
      .select('organization, author_name, reputation_score')
      .order('reputation_score', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) return null
    const label = [data.organization, data.author_name].filter(Boolean).join(' / ')
    return { label, score: data.reputation_score }
  } catch (err) {
    console.warn('[credibilityService] getTopSourceLabel:', err.message)
    return null
  }
}
