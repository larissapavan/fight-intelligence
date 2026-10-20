import { LoadingSkeleton } from './LoadingSkeleton'

export function ServerLoadingState({
  waking = false,
}: {
  waking?: boolean
}) {
  return (
    <section className="space-y-3" role="status" aria-live="polite" aria-label={waking ? 'The server is waking up' : 'Loading'}>
      {waking ? (
        <p className="px-1 text-xs leading-5 text-[#999999]">
          The server is waking up. The first visit after a quiet spell can take up to a minute.
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
