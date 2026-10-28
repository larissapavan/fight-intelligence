import { useTranslation } from 'react-i18next'
import { LoadingBout } from './LoadingBout'

export function ServerLoadingState({
  waking = false,
}: {
  waking?: boolean
}) {
  const { t } = useTranslation()

  return (
    <section
      className="flex items-center justify-center py-2 sm:py-6"
      role="status"
      aria-live="polite"
      aria-label={t('common.pageLoadingLabel')}
    >
      <div className="w-full max-w-[620px] border-[3px] border-[var(--rule)] bg-[var(--card-bg)] p-3.5 shadow-[6px_6px_0_var(--hard)] sm:p-5">
        <div className="flex items-start gap-2.5">
          <span
            className="mt-1.5 h-2.5 w-2.5 shrink-0 animate-pulse bg-[#F2C230] ring-2 ring-[#C8102E]"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-sm font-bold uppercase tracking-[0.04em] text-[var(--text-main)] sm:text-base">
              {t('common.pageLoading')}
            </p>
            {waking ? (
              <p className="mt-1 text-xs leading-5 text-[var(--text-muted)] sm:text-sm">
                {t('common.serverWaking')}
              </p>
            ) : null}
          </div>
        </div>
        <LoadingBout />
      </div>
    </section>
  )
}
