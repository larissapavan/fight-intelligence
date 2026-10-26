import { useTranslation } from 'react-i18next'
import { LoadingSkeleton } from './LoadingSkeleton'

export function ServerLoadingState({
  waking = false,
}: {
  waking?: boolean
}) {
  const { i18n } = useTranslation()
  const isPt = Boolean(i18n.language?.startsWith('pt'))

  return (
    <section
      className="space-y-3"
      role="status"
      aria-live="polite"
      aria-label={waking ? (isPt ? 'O servidor está iniciando' : 'The server is waking up') : (isPt ? 'Carregando' : 'Loading')}
    >
      {waking ? (
        <p className="px-1 text-xs leading-5 text-[#999999]">
          {isPt
            ? 'O servidor está iniciando. A primeira visita após um período inativo pode levar até um minuto.'
            : 'The server is waking up. The first visit after a quiet spell can take up to a minute.'}
        </p>
      ) : null}
      <LoadingSkeleton className="h-[88px] rounded-[20px]" />
      <div className="grid gap-3 lg:grid-cols-2">
        <LoadingSkeleton className="h-[220px] rounded-[20px]" />
        <LoadingSkeleton className="h-[220px] rounded-[20px]" />
      </div>
      <LoadingSkeleton className="h-[160px] rounded-[20px]" />
    </section>
  )
}
