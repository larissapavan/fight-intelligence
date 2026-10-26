import { useTranslation } from 'react-i18next'
import { ExternalLink, Newspaper, Play } from 'lucide-react'

import { useNews } from '../hooks/useNews'
import type { NewsItem } from '../types/api'
import { LoadingSkeleton } from './LoadingSkeleton'

const UFC_X_URL = 'https://x.com/ufc'

function timeAgo(published: string | null, isPt: boolean) {
  if (!published) return null
  const time = new Date(published).getTime()
  if (Number.isNaN(time)) return null
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60000))
  if (minutes < 60) return isPt ? `há ${Math.max(1, minutes)}m` : `${Math.max(1, minutes)}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return isPt ? `há ${hours}h` : `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days <= 7) return isPt ? `há ${days}d` : `${days}d ago`
  return new Date(time).toLocaleDateString(isPt ? 'pt-BR' : 'en-US', { month: 'short', day: 'numeric' })
}

export function LatestNewsCard({ limit = 6, quiet = false }: { limit?: number; quiet?: boolean }) {
  const { i18n } = useTranslation()
  const isPt = Boolean(i18n.language?.startsWith('pt'))
  const { data, loading } = useNews(limit)

  if (loading) return <LoadingSkeleton className="h-[180px]" />
  if (!data?.items.length) return null

  return (
    <section className={`rounded-[20px] border border-[var(--line-soft)] bg-[var(--surface-3)] ${quiet ? 'px-3 py-3 sm:px-4' : 'surface-card p-3 sm:p-4'}`} aria-labelledby="latest-news-title">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex items-center gap-2">
          <Newspaper className={`h-3.5 w-3.5 ${quiet ? 'text-[var(--text-muted)]' : 'text-[var(--accent-red)]'}`} />
          <h2 id="latest-news-title" className={`broadcast-label text-[11px] ${quiet ? 'text-[var(--text-muted)]' : 'text-[var(--text-main)]'}`}>
            {isPt ? 'Últimas notícias do UFC' : 'Latest from the UFC'}
          </h2>
        </div>
        <a
          href={UFC_X_URL}
          target="_blank"
          rel="noreferrer"
          className="ghost-action inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#FFFFFF] transition hover:!bg-[#F2C230] hover:!text-[#0E0E0E]"
        >
          {isPt ? 'Seguir @ufc no X' : 'Follow @ufc on X'}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <ul className={`grid gap-2 md:grid-cols-2 xl:grid-cols-3 ${quiet ? 'opacity-90' : ''}`}>
        {data.items.map((item) => (
          <li key={item.url} className="min-w-0">
            <NewsRow item={item} quiet={quiet} isPt={isPt} />
          </li>
        ))}
      </ul>

      <p className="theme-muted mt-3 text-xs">
        {isPt ? 'Notícias via ' : 'Headlines via '}
        <a href={data.source_url} target="_blank" rel="noreferrer" className="font-semibold underline decoration-2 underline-offset-2 hover:bg-[#F2C230] hover:text-[#0E0E0E]">
          {data.source_name}
        </a>
        {isPt ? '. Cada história abre no site oficial da fonte.' : '. Each story opens on their site.'}
      </p>
    </section>
  )
}

function NewsRow({ item, quiet = false, isPt }: { item: NewsItem; quiet?: boolean; isPt: boolean }) {
  const age = timeAgo(item.published, isPt)

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
          <span className="absolute bottom-0 left-0 inline-flex items-center gap-1 bg-[#C8102E] px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.1em] text-white">
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
