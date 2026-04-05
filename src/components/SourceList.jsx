import { ExternalLink } from 'lucide-react'
import { format } from 'date-fns'

// ─── Provider display config ──────────────────────────────────────────────────
const PROVIDER_CONFIG = {
  alphavantage: { label: 'Alpha Vantage', bg: 'bg-blue-500/10',   text: 'text-blue-400',   border: 'border-blue-500/20'   },
  finnhub:      { label: 'Finnhub',       bg: 'bg-emerald-500/10',text: 'text-emerald-400', border: 'border-emerald-500/20' },
  newsdata:     { label: 'NewsData',      bg: 'bg-purple-500/10', text: 'text-purple-400',  border: 'border-purple-500/20' },
  yahoo_news:   { label: 'Yahoo Finance', bg: 'bg-violet-500/10', text: 'text-violet-400',  border: 'border-violet-500/20' },
  rss:          { label: 'RSS',           bg: 'bg-fin-border/20', text: 'text-fin-muted',   border: 'border-fin-border/30' },
  google_news:  { label: 'Google News',   bg: 'bg-red-500/10',    text: 'text-red-400',     border: 'border-red-500/20'    },
}

function ProviderBadge({ provider }) {
  if (!provider) return null
  const cfg = PROVIDER_CONFIG[provider]
  if (!cfg) return null
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.label}
    </span>
  )
}


export default function SourceList({ sources = [] }) {
  if (!sources.length) {
    return <p className="text-sm text-fin-muted italic">No source documents linked.</p>
  }

  return (
    <ul className="space-y-2">
      {sources.map((src) =>         {
          return (
          <li
            key={src.id}
            className="p-3 rounded-lg bg-fin-dark/60 border border-fin-border/40 hover:border-fin-border/70 transition-colors"
          >
            {/* Title + external link */}
            <a
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-2 mb-2"
            >
              <ExternalLink size={11} className="shrink-0 mt-0.5 text-fin-muted group-hover:text-fin-accent transition-colors" />
              <span className="text-sm text-fin-text group-hover:text-fin-accent transition-colors leading-snug line-clamp-2">
                {src.title || src.url}
              </span>
            </a>

            {/* Meta row: domain · date · provider */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-fin-muted/80 font-mono">{src.domain}</span>

              {src.published_at && (
                <>
                  <span className="text-fin-border text-[10px]">·</span>
                  <span className="text-[11px] text-fin-muted/70">
                    {format(new Date(src.published_at), 'dd MMM yyyy')}
                  </span>
                </>
              )}

              {src.provider && (
                <>
                  <span className="text-fin-border text-[10px]">·</span>
                  <ProviderBadge provider={src.provider} />
                </>
              )}
            </div>

            {/* Snippet */}
            {src.content_snippet && (
              <p className="text-[11px] text-fin-muted/70 mt-2 leading-relaxed line-clamp-3">
                {src.content_snippet}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
