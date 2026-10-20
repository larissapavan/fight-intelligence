import { ExternalLink, Newspaper, Play } from 'lucide-react'

import { useNews } from '../hooks/useNews'
import type { NewsItem } from '../types/api'
import { LoadingSkeleton } from './LoadingSkeleton'

const UFC_X_URL = 'https://x.com/ufc'

/** "3h ago", "2d ago" or a short date for anything older than a week. */
function timeAgo(published: string | null) {
  if (!published) return null
  const time = new Date(published).getTime()
  if (Number.isNaN(time)) return null
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60000))
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days <= 7) return `${days}d ago`
  return new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** The latest UFC headlines (via ESPN) with a link to the UFC's own X profile. Hidden when there is nothing to show. */
export function LatestNewsCard({ limit = 6, quiet = false }: { limit?: number; quiet?: boolean }) {
  const { data, loading } = useNews(limit)

  if (loading) return <LoadingSkeleton className="h-[180px]" />
  if (!data?.items.length) return null

  return (
    <section className={`rounded-[20px] border border-[var(--line-soft)] bg-[var(--surface-3)] ${quiet ? 'px-3 py-3 sm:px-4' : 'surface-card p-3 sm:p-4'}`} aria-labelledby="latest-news-title">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex items-center gap-2">
          <Newspaper className={`h-3.5 w-3.5 ${quiet ? 'text-[var(--text-muted)]' : 'text-[var(--accent-red)]'}`} />
          <h2 id="latest-news-title" className={`broadcast-label text-[10px] ${quiet ? 'text-[var(--text-muted)]' : 'text-[var(--text-main)]'}`}>
            Latest from the UFC
          </h2>
        </div>
        <a
          href={UFC_X_URL}
          target="_blank"
          rel="noreferrer"
          className="ghost-action inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#FFFFFF] transition hover:!bg-[#F2C230] hover:!text-[#0E0E0E]"
        >
          Follow @ufc on X
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <ul className={`grid gap-2 md:grid-cols-2 xl:grid-cols-3 ${quiet ? 'opacity-90' : ''}`}>
        {data.items.map((item) => (
          <li key={item.url} className="min-w-0">
            <NewsRow item={item} quiet={quiet} />
          </li>
        ))}
      </ul>

      <p className="theme-muted mt-3 text-xs">
        Headlines via{' '}
        <a href={data.source_url} target="_blank" rel="noreferrer" className="font-semibold underline decoration-2 underline-offset-2 hover:bg-[#F2C230] hover:text-[#0E0E0E]">
          {data.source_name}
        </a>
        . Each story opens on their site.
      </p>
    </section>
  )
}

function NewsRow({ item, quiet = false }: { item: NewsItem; quiet?: boolean }) {
  const age = timeAgo(item.published)

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="group flex h-full min-w-0 gap-2.5 border border-[var(--line-soft)] bg-[var(--card-bg)] p-2 transition hover:border-[var(--accent-red)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-red)]"
    >
      <div className={`relative shrink-0 overflow-hidden border border-[var(--rule)] bg-[var(--surface-3)] ${quiet ? 'h-12 w-16' : 'h-[72px] w-[104px]'}`}>
        {item.image_url ? (
          <img src={item.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
        ) : (
          <Newspaper className={`m-auto text-[var(--text-muted)] ${quiet ? 'mt-3 h-4 w-4' : 'mt-6 h-6 w-6'}`} />
        )}
        {item.kind === 'video' ? (
          <span className="absolute bottom-0 left-0 inline-flex items-center gap-1 bg-[#C8102E] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-white">
            <Play className="h-2.5 w-2.5 fill-current" />
            Video
          </span>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <p className={`line-clamp-2 font-semibold leading-snug text-[var(--text-main)] ${quiet ? 'text-xs' : 'text-sm'}`}>{item.title}</p>
        {age ? <p className="mt-1 text-[11px] text-[var(--text-muted)]">{age}</p> : null}
      </div>
    </a>
  )
}
