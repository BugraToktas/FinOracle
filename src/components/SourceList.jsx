import { ExternalLink } from 'lucide-react'
import { format } from 'date-fns'

export default function SourceList({ sources = [] }) {
  if (!sources.length) {
    return <p className="text-sm text-fin-muted italic">No source documents linked.</p>
  }

  return (
    <ul className="space-y-2">
      {sources.map((src) => (
        <li key={src.id} className="flex items-start gap-3 p-3 rounded-lg bg-fin-dark/50 border border-fin-border/50">
          <div className="flex-1 min-w-0">
            <a
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-fin-accent hover:underline flex items-center gap-1.5 truncate"
            >
              <ExternalLink size={12} className="shrink-0" />
              <span className="truncate">{src.title || src.url}</span>
            </a>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-fin-muted">{src.domain}</span>
              {src.published_at && (
                <>
                  <span className="text-fin-border">·</span>
                  <span className="text-xs text-fin-muted">
                    {format(new Date(src.published_at), 'dd MMM yyyy')}
                  </span>
                </>
              )}
            </div>
            {src.content_snippet && (
              <p className="text-xs text-fin-muted/80 mt-1.5 line-clamp-2">{src.content_snippet}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
