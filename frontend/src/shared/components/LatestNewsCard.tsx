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
export function LatestNewsCard({ limit = 6 }: { limit?: number }) {
  const { data, loading } = useNews(limit)

  if (loading) return <LoadingSkeleton className="h-[260px]" />
  if (!data?.items.length) return null

  return (
    <section className="surface-card rounded-[20px] p-3 sm:p-4" aria-labelledby="latest-news-title">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-[#C8102E]" />
          <h2 id="latest-news-title" className="broadcast-label text-xs text-[#FFFFFF]">
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

      <ul className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {data.items.map((item) => (
          <li key={item.url} className="min-w-0">
            <NewsRow item={item} />
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

function NewsRow({ item }: { item: NewsItem }) {
  const age = timeAgo(item.published)

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="metric-tile group flex h-full min-w-0 gap-3 p-2.5 transition hover:!bg-[#F2C230]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2C230]"
    >
      <div className="relative h-[72px] w-[104px] shrink-0 overflow-hidden border-2 border-[var(--rule)] bg-[var(--surface-3)]">
        {item.image_url ? (
          <img src={item.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
        ) : (
          <Newspaper className="m-auto mt-6 h-6 w-6 text-[#999999]" />
        )}
        {item.kind === 'video' ? (
          <span className="absolute bottom-0 left-0 inline-flex items-center gap-1 bg-[#C8102E] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-white">
            <Play className="h-2.5 w-2.5 fill-current" />
            Video
          </span>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-3 text-[15px] font-semibold leading-snug text-[#FFFFFF]">{item.title}</p>
        {age ? <p className="theme-muted mt-1 text-xs font-semibold">{age}</p> : null}
      </div>
    </a>
  )
}
