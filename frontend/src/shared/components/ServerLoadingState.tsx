import { useTranslation } from 'react-i18next'
import { LoadingBout } from './LoadingBout'
import { LoadingSkeleton } from './LoadingSkeleton'

export function ServerLoadingState({
  waking = false,
}: {
  waking?: boolean
}) {
  const { t } = useTranslation()

  return (
    <section className="space-y-3" role="status" aria-live="polite" aria-label={t('common.pageLoadingLabel')}>
      <div className="border-2 border-[var(--rule)] bg-[var(--card-bg)] px-4 py-3 shadow-[4px_4px_0_var(--hard)]">
        <p className="text-sm font-semibold leading-6 text-[var(--text-main)]">{t('common.pageLoading')}</p>
        {waking ? <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{t('common.serverWaking')}</p> : null}
        <LoadingBout />
      </div>
      <LoadingSkeleton className="h-[88px] rounded-[20px]" />
      <div className="grid gap-3 lg:grid-cols-2">
        <LoadingSkeleton className="h-[220px] rounded-[20px]" />
        <LoadingSkeleton className="h-[220px] rounded-[20px]" />
      </div>
      <LoadingSkeleton className="h-[160px] rounded-[20px]" />
    </section>
  )
}
