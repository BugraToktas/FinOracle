import { supabase } from '../lib/supabaseClient'

/**
 * Top N sources by reputation_score — for the CredibilityBoard chart.
 */
export async function getTopSources(limit = 10) {
  const { data, error } = await supabase
    .from('news_sources')
    .select('id, organization, author_name, reputation_score, total_predictions, correct_predictions, last_updated')
    .order('reputation_score', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

/**
 * All sources — for the full CredibilityBoard table.
 */
export async function getAllSources() {
  const { data, error } = await supabase
    .from('news_sources')
    .select('id, organization, author_name, reputation_score, total_predictions, correct_predictions, last_updated')
    .order('reputation_score', { ascending: false })

  if (error) throw error
  return data ?? []
}

/**
 * Best single source label — used in Dashboard stat card.
 */
export async function getTopSourceLabel() {
  const { data } = await supabase
    .from('news_sources')
    .select('organization, author_name, reputation_score')
    .order('reputation_score', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null
  const label = [data.organization, data.author_name].filter(Boolean).join(' / ')
  return { label, score: data.reputation_score }
}
